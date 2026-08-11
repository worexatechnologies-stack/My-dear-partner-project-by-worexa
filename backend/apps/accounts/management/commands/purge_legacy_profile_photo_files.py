"""Explicit, audited cleanup of verified legacy ``member_photos/`` objects.

This is intentionally separate from the BYTEA backfill and never runs from a
migration. Its default mode is a read-only integrity rehearsal; deletion needs
both an explicit flag and a human assertion that backup restore was tested.
"""

from __future__ import annotations

from collections import defaultdict
import hashlib
from pathlib import PurePosixPath

from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.models import Count, Q

from apps.accounts.management.commands.backfill_legacy_profile_photos import (
    LegacyMemberPhoto,
    VALID_STATUSES,
)
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog


SAMPLE_LIMIT = 5
BINARY_VALIDATION_CHUNK_SIZE = 25
MAIN_MAX_BYTES = 600 * 1024
THUMBNAIL_MAX_BYTES = 100 * 1024
BACKUP_RESTORE_CONFIRMATION = "BACKUP_RESTORE_VERIFIED"
PURGE_ACTOR_TYPE = "LEGACY_SOURCE_PURGE"
SUCCESSFUL_PURGE_RESULTS = {"deleted", "deleted_after_restore", "already_missing"}


def _is_valid_target_bytea(photo) -> bool:
    """Confirm BYTEA contents and metadata before any source object is removed."""
    try:
        image_data = bytes(photo.image_data)
        thumbnail_data = bytes(photo.thumbnail_data)
    except (TypeError, ValueError):
        return False
    return (
        bool(image_data)
        and bool(thumbnail_data)
        and image_data[:4] == b"RIFF"
        and image_data[8:12] == b"WEBP"
        and thumbnail_data[:4] == b"RIFF"
        and thumbnail_data[8:12] == b"WEBP"
        and photo.mime_type == "image/webp"
        and photo.original_size_bytes > 0
        and photo.compressed_size_bytes == len(image_data)
        and photo.thumbnail_size_bytes == len(thumbnail_data)
        and 0 < photo.compressed_size_bytes <= MAIN_MAX_BYTES
        and 0 < photo.thumbnail_size_bytes <= THUMBNAIL_MAX_BYTES
        and photo.width == 1200
        and photo.height == 1500
        and photo.thumbnail_width == 240
        and photo.thumbnail_height == 300
        and photo.checksum == hashlib.sha256(image_data).hexdigest()
    )


class Command(BaseCommand):
    help = (
        "Dry-run by default: verify BYTEA counterparts and explicitly purge only legacy "
        "member_photos/ objects after a tested backup restore."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="default",
            help="Database connection to use (default: default).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Maximum source rows loaded at once (default: 50).",
        )
        parser.add_argument(
            "--max-records",
            type=int,
            default=None,
            help="Purge at most this many unaudited source paths, then rerun to resume.",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Actually delete verified source objects. Omit for a no-write rehearsal.",
        )
        parser.add_argument(
            "--confirm-backup-restore",
            default="",
            metavar=BACKUP_RESTORE_CONFIRMATION,
            help=(
                "Required with --delete after a successful restore test. Supply the exact "
                f"value {BACKUP_RESTORE_CONFIRMATION}."
            ),
        )

    def handle(self, *args, **options):
        database = options["database"]
        batch_size = options["batch_size"]
        max_records = options["max_records"]
        delete = options["delete"]
        confirmation = options["confirm_backup_restore"]

        if database not in connections:
            raise CommandError(f"Unknown database alias: {database}")
        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1.")
        if max_records is not None and max_records < 1:
            raise CommandError("--max-records must be at least 1 when supplied.")
        if delete and confirmation != BACKUP_RESTORE_CONFIRMATION:
            raise CommandError(
                "Refusing to delete legacy originals without an explicit verified backup-restore "
                f"confirmation: --confirm-backup-restore {BACKUP_RESTORE_CONFIRMATION}"
            )
        self._ensure_legacy_table(database)

        source_count = self._preflight(database)
        mode = "delete" if delete else "dry-run"
        self.stdout.write(
            f"Legacy source purge {mode} preflight passed for {source_count} row(s)."
        )
        if not delete:
            self.stdout.write(
                self.style.WARNING(
                    "No files or audit rows were changed. Re-run with --delete and the exact "
                    "backup-restore confirmation only after the restore test succeeds."
                )
            )
            return

        storage = LegacyMemberPhoto._meta.get_field("image_path").storage
        audited_paths = self._successful_purge_audit_paths(database)
        deleted = 0
        already_missing = 0
        already_audited = 0
        processed = 0
        rows = LegacyMemberPhoto.objects.using(database).values_list("id", "member_id", "image_path")
        for photo_id, member_id, source_path in rows.iterator(chunk_size=batch_size):
            if max_records is not None and processed >= max_records:
                break
            path = self._validated_legacy_path(source_path, photo_id)
            try:
                object_exists = storage.exists(path)
            except Exception as exc:
                raise CommandError(
                    f"Could not inspect legacy source {photo_id} at {path!r}; no further files were removed."
                ) from exc

            has_successful_audit = path in audited_paths.get(photo_id, set())
            if not object_exists and has_successful_audit:
                already_audited += 1
                continue

            if object_exists:
                try:
                    storage.delete(path)
                    if storage.exists(path):
                        raise RuntimeError("storage still reports the object as present")
                except Exception as exc:
                    raise CommandError(
                        f"Could not delete verified legacy source {photo_id} at {path!r}; "
                        "no success audit was written for this path; previous deletions remain audited "
                        "and rerunnable."
                    ) from exc
                result = "deleted_after_restore" if has_successful_audit else "deleted"
                deleted += 1
            else:
                result = "already_missing"
                already_missing += 1

            ProfilePhotoAuditLog.objects.using(database).create(
                photo_id=photo_id,
                member_id=member_id,
                actor_type=PURGE_ACTOR_TYPE,
                action=ProfilePhotoAuditLog.Action.LEGACY_SOURCE_PURGED,
                details={
                    "source_table": "member_photos",
                    "legacy_source_path": path,
                    "purge_result": result,
                    "backup_restore_confirmation": BACKUP_RESTORE_CONFIRMATION,
                },
            )
            audited_paths.setdefault(photo_id, set()).add(path)
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Legacy source purge finished: {deleted} deleted, {already_missing} already absent and "
                f"audited, {already_audited} previously audited."
            )
        )

    @staticmethod
    def _ensure_legacy_table(database: str) -> None:
        table_names = set(connections[database].introspection.table_names())
        if LegacyMemberPhoto._meta.db_table not in table_names:
            raise CommandError(
                "The legacy member_photos table is not present. Purge must run after the staged "
                "backfill and before accounts migration 0015."
            )

    def _preflight(self, database: str) -> int:
        """Fail closed unless every source has a validated target and safe path."""
        source_primary_counts = {
            row["member_id"]: row["primary_count"]
            for row in (
                LegacyMemberPhoto.objects.using(database)
                .values("member_id")
                .annotate(primary_count=Count("id", filter=Q(is_primary=True)))
            )
        }
        source_member_ids = set(source_primary_counts)
        issue_counts: dict[str, int] = defaultdict(int)
        issue_samples: dict[str, list[str]] = defaultdict(list)
        source_count = 0

        def issue(kind: str, value) -> None:
            issue_counts[kind] += 1
            if len(issue_samples[kind]) < SAMPLE_LIMIT:
                issue_samples[kind].append(str(value))

        def check_chunk(rows) -> None:
            if not rows:
                return
            ids = [row[0] for row in rows]
            targets = {
                photo.pk: photo
                for photo in ProfilePhoto.objects.using(database)
                .filter(pk__in=ids)
                .only(
                    "id",
                    "user_id",
                    "status",
                    "is_primary",
                    "image_data",
                    "thumbnail_data",
                    "mime_type",
                    "original_size_bytes",
                    "compressed_size_bytes",
                    "thumbnail_size_bytes",
                    "width",
                    "height",
                    "thumbnail_width",
                    "thumbnail_height",
                    "checksum",
                )
            }
            for photo_id, member_id, path, status, is_primary in rows:
                try:
                    self._validated_legacy_path(path, photo_id)
                except CommandError:
                    issue("unsafe legacy source path", photo_id)
                if status not in VALID_STATUSES:
                    issue("unsupported source status", photo_id)
                    continue
                target = targets.get(photo_id)
                if target is None:
                    issue("missing ProfilePhoto counterpart", photo_id)
                    continue
                primary_matches = target.is_primary == is_primary or (
                    not is_primary
                    and target.is_primary
                    and source_primary_counts.get(member_id, 0) == 0
                )
                if (
                    target.user_id != member_id
                    or target.status != status
                    or not primary_matches
                ):
                    issue("incompatible ProfilePhoto counterpart", photo_id)
                    continue
                if not _is_valid_target_bytea(target):
                    issue("invalid BYTEA counterpart", photo_id)

        chunk: list[tuple[object, object, str, str, bool]] = []
        source_rows = LegacyMemberPhoto.objects.using(database).values_list(
            "id", "member_id", "image_path", "status", "is_primary"
        )
        for row in source_rows.iterator(chunk_size=BINARY_VALIDATION_CHUNK_SIZE):
            source_count += 1
            chunk.append(row)
            if len(chunk) == BINARY_VALIDATION_CHUNK_SIZE:
                check_chunk(chunk)
                chunk = []
        check_chunk(chunk)

        invalid_primary_counts = list(
            ProfilePhoto.objects.using(database)
            .filter(user_id__in=source_member_ids)
            .values("user_id")
            .annotate(
                total=Count("id"),
                primaries=Count("id", filter=Q(is_primary=True)),
            )
            .filter(total__gt=0)
            .exclude(primaries=1)
            .values_list("user_id", "total", "primaries")[:SAMPLE_LIMIT]
        )
        if invalid_primary_counts:
            issue("gallery without exactly one primary", invalid_primary_counts[0])

        if issue_counts:
            details = "; ".join(
                f"{count} {kind} ({', '.join(issue_samples[kind])})"
                for kind, count in sorted(issue_counts.items())
            )
            raise CommandError(
                "Legacy source purge preflight failed; no files were removed. "
                f"Resolve the reported data conflict and retry. {details}"
            )
        return source_count

    @staticmethod
    def _validated_legacy_path(source_path, photo_id) -> str:
        path = str(source_path or "")
        parsed = PurePosixPath(path)
        if (
            not path.startswith("member_photos/")
            or path == "member_photos/"
            or "\\" in path
            or parsed.is_absolute()
            or ".." in parsed.parts
        ):
            raise CommandError(
                f"Legacy photo {photo_id} has unsafe source path {path!r}; refusing to target it."
            )
        return path

    @staticmethod
    def _successful_purge_audit_paths(database: str) -> dict[object, set[str]]:
        audit_paths: dict[object, set[str]] = defaultdict(set)
        audit_rows = (
            ProfilePhotoAuditLog.objects.using(database)
            .filter(
                actor_type=PURGE_ACTOR_TYPE,
                action=ProfilePhotoAuditLog.Action.LEGACY_SOURCE_PURGED,
            )
            .values_list("photo_id", "details")
        )
        for photo_id, details in audit_rows.iterator(chunk_size=1000):
            if (
                isinstance(details, dict)
                and details.get("source_table") == "member_photos"
                and details.get("purge_result") in SUCCESSFUL_PURGE_RESULTS
                and isinstance(details.get("legacy_source_path"), str)
            ):
                audit_paths[photo_id].add(details["legacy_source_path"])
        return audit_paths
