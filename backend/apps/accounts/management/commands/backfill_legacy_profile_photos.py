"""Safely move legacy ``member_photos`` files into ProfilePhoto BYTEA rows.

The legacy model was intentionally removed from ``apps.accounts.models``.  An
unmanaged model below is a narrow, read-only view of the old table so this
command remains usable between the staging and final migrations without
reintroducing ImageField storage into the application.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import uuid

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, models, transaction
from django.db.models import Count, Q

from apps.accounts.models import Member
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog
from apps.profiles.services.image_processing import (
    ImageProcessingService,
    ProfilePhotoProcessingError,
)


VALID_STATUSES = {
    ProfilePhoto.Status.PENDING,
    ProfilePhoto.Status.APPROVED,
    ProfilePhoto.Status.REJECTED,
}
MAX_PROFILE_PHOTOS = 6
SAMPLE_LIMIT = 5


class LegacyMemberPhoto(models.Model):
    """The pre-cutover schema, deliberately unmanaged and read-only by default."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    member_id = models.UUIDField(db_column="member_id")
    image_path = models.ImageField(upload_to="member_photos/")
    is_primary = models.BooleanField(default=False)
    status = models.CharField(max_length=20)
    rejection_reason = models.TextField(blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    uploaded_at = models.DateTimeField()
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "accounts"
        db_table = "member_photos"
        managed = False
        ordering = ("member_id", "display_order", "uploaded_at", "id")


class BackfillFailure(Exception):
    """Expected source-data failure with a useful, resumable error message."""


@dataclass(frozen=True)
class PreflightResult:
    source_count: int
    migrated_count: int
    pending_count: int
    member_count: int
    galleries_needing_primary_promotion: int


class Command(BaseCommand):
    help = (
        "Safely backfill legacy member_photos files into PostgreSQL ProfilePhoto BYTEA rows. "
        "Run after accounts migration 0014 and before 0015."
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
            help="Maximum legacy records loaded into memory at once (default: 50).",
        )
        parser.add_argument(
            "--max-records",
            type=int,
            default=None,
            help="Stop cleanly after this many newly migrated records; rerun to resume.",
        )
        parser.add_argument(
            "--check-only",
            action="store_true",
            help="Run structural/capacity preflight without writing any ProfilePhoto rows.",
        )
        parser.add_argument(
            "--verify-files",
            action="store_true",
            help=(
                "Decode and compress every still-pending source image before writing. "
                "Use with --check-only for a no-write production rehearsal."
            ),
        )

    def handle(self, *args, **options):
        database = options["database"]
        batch_size = options["batch_size"]
        max_records = options["max_records"]
        check_only = options["check_only"]
        verify_files = options["verify_files"]

        if database not in connections:
            raise CommandError(f"Unknown database alias: {database}")
        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1.")
        if max_records is not None and max_records < 1:
            raise CommandError("--max-records must be at least 1 when supplied.")
        self._ensure_legacy_table(database)

        result = self._preflight(database)
        self.stdout.write(
            "Legacy photo preflight passed: "
            f"{result.source_count} source row(s), {result.migrated_count} already migrated, "
            f"{result.pending_count} pending across {result.member_count} member(s), "
            f"{result.galleries_needing_primary_promotion} gallery/galleries queued for "
            "deterministic primary promotion."
        )

        if verify_files:
            self._verify_pending_files(database, batch_size)

        if check_only:
            self.stdout.write(self.style.SUCCESS("No-write preflight completed successfully."))
            return

        migrated = 0
        skipped = 0
        while max_records is None or migrated < max_records:
            request_size = batch_size
            if max_records is not None:
                request_size = min(request_size, max_records - migrated)
            batch = list(self._pending_queryset(database)[:request_size])
            if not batch:
                break

            for legacy_photo in batch:
                try:
                    created = self._migrate_one(legacy_photo.pk, database)
                except BackfillFailure as exc:
                    raise CommandError(
                        "Backfill stopped safely before writing the failing record. "
                        f"Previously committed records remain resumable. {exc}"
                    ) from exc
                if created:
                    migrated += 1
                else:
                    skipped += 1

                if max_records is not None and migrated >= max_records:
                    break

        promoted = self._promote_completed_source_galleries(database)
        if promoted:
            self.stdout.write(
                f"Promoted a deterministic primary photo for {promoted} completed source gallery/galleries."
            )

        final = self._preflight(database)
        if final.pending_count:
            self.stdout.write(
                self.style.WARNING(
                    f"Migrated {migrated} record(s), skipped {skipped}; "
                    f"{final.pending_count} remain. Rerun this command to resume."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Legacy photo backfill completed: {migrated} migrated, {skipped} skipped. "
                    "Run migration accounts 0015 to perform its final guard and drop only the old table."
                )
            )

    def _ensure_legacy_table(self, database: str) -> None:
        table_names = set(connections[database].introspection.table_names())
        if LegacyMemberPhoto._meta.db_table not in table_names:
            raise CommandError(
                "The legacy member_photos table is not present. This command is only valid "
                "after accounts 0014 and before the guarded accounts 0015 finalization."
            )

    def _pending_queryset(self, database: str):
        migrated_ids = ProfilePhoto.objects.using(database).values("pk")
        return (
            LegacyMemberPhoto.objects.using(database)
            .exclude(pk__in=migrated_ids)
            .order_by("member_id", "display_order", "uploaded_at", "pk")
        )

    def _preflight(self, database: str) -> PreflightResult:
        """Validate capacity, idempotency, and state before any source file is read."""
        source_count = 0
        migrated_count = 0
        source_primary_counts = self._source_primary_counts(database)
        per_member = defaultdict(
            lambda: {"source": 0, "unmigrated": 0, "unmigrated_primary": 0}
        )
        issue_counts: dict[str, int] = defaultdict(int)
        issue_samples: dict[str, list[str]] = defaultdict(list)

        def issue(kind: str, value) -> None:
            issue_counts[kind] += 1
            if len(issue_samples[kind]) < SAMPLE_LIMIT:
                issue_samples[kind].append(str(value))

        def check_chunk(rows) -> None:
            nonlocal migrated_count
            if not rows:
                return
            ids = [row[0] for row in rows]
            targets = {
                photo.pk: photo
                for photo in ProfilePhoto.objects.using(database)
                .filter(pk__in=ids)
                .only("id", "user_id", "status", "is_primary")
            }
            for legacy_id, member_id, status, is_primary in rows:
                state = per_member[member_id]
                state["source"] += 1
                if status not in VALID_STATUSES:
                    issue("unsupported status", legacy_id)
                target = targets.get(legacy_id)
                if target is None:
                    state["unmigrated"] += 1
                    if is_primary:
                        state["unmigrated_primary"] += 1
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
                    issue("incompatible existing ProfilePhoto", legacy_id)
                    continue
                migrated_count += 1

        rows: list[tuple[object, object, str, bool]] = []
        source_values = LegacyMemberPhoto.objects.using(database).values_list(
            "id", "member_id", "status", "is_primary"
        )
        for source_row in source_values.iterator(chunk_size=1000):
            source_count += 1
            rows.append(source_row)
            if len(rows) == 1000:
                check_chunk(rows)
                rows = []
        check_chunk(rows)

        member_ids = list(per_member)
        known_member_ids = set(
            Member.objects.using(database)
            .filter(pk__in=member_ids)
            .values_list("pk", flat=True)
        )
        for member_id in member_ids:
            if member_id not in known_member_ids:
                issue("legacy row references a missing member", member_id)

        target_counts = {
            row["user_id"]: (row["total"], row["primaries"])
            for row in (
                ProfilePhoto.objects.using(database)
                .values("user_id")
                .annotate(
                    total=Count("id"),
                    primaries=Count("id", filter=Q(is_primary=True)),
                )
            )
        }
        galleries_needing_primary_promotion = 0
        for member_id, state in per_member.items():
            existing_total, existing_primaries = target_counts.get(member_id, (0, 0))
            future_total = existing_total + state["unmigrated"]
            future_primaries = existing_primaries + state["unmigrated_primary"]
            if future_total > MAX_PROFILE_PHOTOS:
                issue("gallery would exceed the six-photo limit", member_id)
            if future_primaries > 1:
                issue("gallery would have multiple primary photos", member_id)
            if future_total and future_primaries == 0:
                galleries_needing_primary_promotion += 1

        if issue_counts:
            details = "; ".join(
                f"{count} {kind} ({', '.join(issue_samples[kind])})"
                for kind, count in sorted(issue_counts.items())
            )
            raise CommandError(
                "Legacy profile-photo preflight failed; no files were changed. "
                f"Resolve the source/target conflict and rerun. {details}"
            )

        return PreflightResult(
            source_count=source_count,
            migrated_count=migrated_count,
            pending_count=source_count - migrated_count,
            member_count=len(per_member),
            galleries_needing_primary_promotion=galleries_needing_primary_promotion,
        )

    @staticmethod
    def _source_primary_counts(database: str) -> dict[object, int]:
        return {
            row["member_id"]: row["primary_count"]
            for row in (
                LegacyMemberPhoto.objects.using(database)
                .values("member_id")
                .annotate(primary_count=Count("id", filter=Q(is_primary=True)))
            )
        }

    def _verify_pending_files(self, database: str, batch_size: int) -> None:
        """Exercise the same in-memory processor without persisting any rows."""
        verified = 0
        for legacy_photo in self._pending_queryset(database).iterator(chunk_size=batch_size):
            try:
                self._process_source(legacy_photo)
            except BackfillFailure as exc:
                raise CommandError(
                    "File verification stopped safely; no ProfilePhoto rows were written. "
                    f"{exc}"
                ) from exc
            verified += 1
        self.stdout.write(f"Validated {verified} pending legacy image file(s).")

    def _read_source_upload(self, legacy_photo) -> ContentFile:
        field_file = legacy_photo.image_path
        name = str(getattr(field_file, "name", "") or "")
        if not name:
            raise BackfillFailure(f"Legacy photo {legacy_photo.pk} has no image path.")
        try:
            try:
                declared_size = int(field_file.size)
            except (AttributeError, OSError, TypeError, ValueError):
                declared_size = None
            if declared_size is not None and declared_size > ImageProcessingService.MAX_UPLOAD_BYTES:
                raise BackfillFailure(
                    f"Legacy photo {legacy_photo.pk} at {name!r} is larger than the 10 MB limit."
                )
            field_file.open("rb")
            # Never trust storage metadata alone. A bounded read prevents a
            # corrupt or adversarial legacy object from exhausting the worker
            # before the in-memory processor can apply its upload limit.
            source_bytes = field_file.read(ImageProcessingService.MAX_UPLOAD_BYTES + 1)
            if len(source_bytes) > ImageProcessingService.MAX_UPLOAD_BYTES:
                raise BackfillFailure(
                    f"Legacy photo {legacy_photo.pk} at {name!r} is larger than the 10 MB limit."
                )
        except BackfillFailure:
            raise
        except Exception as exc:
            raise BackfillFailure(
                f"Could not read legacy photo {legacy_photo.pk} at {name!r}."
            ) from exc
        finally:
            try:
                field_file.close()
            except Exception:
                pass
        if not source_bytes:
            raise BackfillFailure(f"Legacy photo {legacy_photo.pk} at {name!r} is empty.")
        return ContentFile(source_bytes, name=Path(name).name)

    def _process_source(self, legacy_photo):
        upload = self._read_source_upload(legacy_photo)
        try:
            # Historic images can be smaller than today's upload minimum. They
            # still receive the same strict format, decode, crop, and size
            # safety checks before becoming WebP BYTEA values.
            return ImageProcessingService.process_profile_photo(
                upload,
                enforce_minimum_dimensions=False,
            )
        except ProfilePhotoProcessingError as exc:
            raise BackfillFailure(
                f"Legacy photo {legacy_photo.pk} could not be converted safely: {exc}"
            ) from exc

    def _migrate_one(self, legacy_id, database: str) -> bool:
        """Convert one source row atomically; committed rows make retries idempotent."""
        # Storage I/O and Pillow compression happen before a database
        # transaction is opened. The cutover runs with legacy writes paused;
        # the locked reload below still verifies all source metadata before
        # inserting the already-bounded WebP bytes.
        source_photo = LegacyMemberPhoto.objects.using(database).get(pk=legacy_id)
        source_state = (
            source_photo.member_id,
            str(source_photo.image_path.name),
            source_photo.status,
            source_photo.is_primary,
            source_photo.display_order,
            source_photo.rejection_reason,
            source_photo.uploaded_at,
            source_photo.reviewed_at,
        )
        processed = self._process_source(source_photo)

        with transaction.atomic(using=database):
            legacy_photo = (
                LegacyMemberPhoto.objects.using(database)
                .select_for_update()
                .get(pk=legacy_id)
            )
            locked_state = (
                legacy_photo.member_id,
                str(legacy_photo.image_path.name),
                legacy_photo.status,
                legacy_photo.is_primary,
                legacy_photo.display_order,
                legacy_photo.rejection_reason,
                legacy_photo.uploaded_at,
                legacy_photo.reviewed_at,
            )
            if locked_state != source_state:
                raise BackfillFailure(
                    f"Legacy photo {legacy_photo.pk} changed while it was being processed; retry it."
                )
            member = (
                Member.objects.using(database)
                .select_for_update()
                .filter(pk=legacy_photo.member_id)
                .first()
            )
            if member is None:
                raise BackfillFailure(
                    f"Legacy photo {legacy_photo.pk} references missing member {legacy_photo.member_id}."
                )
            if legacy_photo.status not in VALID_STATUSES:
                raise BackfillFailure(
                    f"Legacy photo {legacy_photo.pk} has unsupported status {legacy_photo.status!r}."
                )

            existing = (
                ProfilePhoto.objects.using(database)
                .select_for_update()
                .filter(pk=legacy_photo.pk)
                .only("id", "user_id", "status", "is_primary")
                .first()
            )
            if existing is not None:
                legacy_gallery_has_primary = LegacyMemberPhoto.objects.using(database).filter(
                    member_id=legacy_photo.member_id,
                    is_primary=True,
                ).exists()
                primary_matches = existing.is_primary == legacy_photo.is_primary or (
                    not legacy_photo.is_primary
                    and existing.is_primary
                    and not legacy_gallery_has_primary
                )
                if (
                    existing.user_id != legacy_photo.member_id
                    or existing.status != legacy_photo.status
                    or not primary_matches
                ):
                    raise BackfillFailure(
                        f"ProfilePhoto {legacy_photo.pk} already exists with incompatible ownership or state."
                    )
                return False

            existing_count = ProfilePhoto.objects.using(database).filter(
                user_id=legacy_photo.member_id
            ).count()
            if existing_count >= MAX_PROFILE_PHOTOS:
                raise BackfillFailure(
                    f"Member {legacy_photo.member_id} would exceed the six-photo limit."
                )
            if legacy_photo.is_primary and ProfilePhoto.objects.using(database).filter(
                user_id=legacy_photo.member_id,
                is_primary=True,
            ).exists():
                raise BackfillFailure(
                    f"Member {legacy_photo.member_id} already has a primary ProfilePhoto."
                )

            filename = Path(str(legacy_photo.image_path.name)).name[:255]
            photo = ProfilePhoto.objects.using(database).create(
                id=legacy_photo.pk,
                user_id=legacy_photo.member_id,
                image_data=processed.image_bytes,
                thumbnail_data=processed.thumbnail_bytes,
                mime_type=processed.mime_type,
                original_filename=filename,
                original_size_bytes=processed.original_size_bytes,
                compressed_size_bytes=processed.compressed_size_bytes,
                thumbnail_size_bytes=processed.thumbnail_size_bytes,
                width=processed.width,
                height=processed.height,
                thumbnail_width=processed.thumbnail_width,
                thumbnail_height=processed.thumbnail_height,
                checksum=processed.checksum,
                is_primary=legacy_photo.is_primary,
                display_order=legacy_photo.display_order,
                status=legacy_photo.status,
                rejection_reason=legacy_photo.rejection_reason or "",
                verified_at=legacy_photo.reviewed_at,
            )
            timestamps = {"created_at": legacy_photo.uploaded_at}
            if legacy_photo.reviewed_at is not None:
                timestamps["updated_at"] = legacy_photo.reviewed_at
            ProfilePhoto.objects.using(database).filter(pk=photo.pk).update(**timestamps)

            ProfilePhotoAuditLog.objects.using(database).create(
                photo_id=photo.pk,
                member_id=member.pk,
                actor_type="LEGACY_BACKFILL",
                action=ProfilePhotoAuditLog.Action.UPLOADED,
                details={
                    "source_table": "member_photos",
                    "legacy_photo_id": str(legacy_photo.pk),
                    "preserved_status": legacy_photo.status,
                    "preserved_primary": legacy_photo.is_primary,
                },
            )
            self._sync_member_photo_status(member, database)
            return True

    def _promote_completed_source_galleries(self, database: str) -> int:
        """Give old galleries without a primary a deterministic valid default.

        A source gallery that explicitly named a primary is never changed. For
        a legacy gallery with no primary at all, choose an approved photo
        first, then the oldest pending photo, and only then the oldest rejected
        photo so the new table's one-primary invariant remains true even for a
        rejected-only historic gallery.
        """
        pending_member_ids = set(
            self._pending_queryset(database)
            .values_list("member_id", flat=True)
            .distinct()
        )
        promoted = 0
        for member_id, primary_count in self._source_primary_counts(database).items():
            if primary_count or member_id in pending_member_ids:
                continue
            if self._promote_missing_primary(member_id, database):
                promoted += 1
        return promoted

    def _promote_missing_primary(self, member_id, database: str) -> bool:
        with transaction.atomic(using=database):
            member = (
                Member.objects.using(database)
                .select_for_update()
                .filter(pk=member_id)
                .first()
            )
            if member is None:
                raise BackfillFailure(
                    f"Cannot promote a primary for missing member {member_id}."
                )
            photos = list(
                ProfilePhoto.objects.using(database)
                .select_for_update()
                .filter(user_id=member_id)
                .only("id", "status", "display_order", "created_at", "is_primary")
            )
            if not photos or any(photo.is_primary for photo in photos):
                return False

            status_rank = {
                ProfilePhoto.Status.APPROVED: 0,
                ProfilePhoto.Status.PENDING: 1,
                ProfilePhoto.Status.REJECTED: 2,
            }
            candidate = min(
                photos,
                key=lambda photo: (
                    status_rank.get(photo.status, 3),
                    photo.created_at,
                    photo.display_order,
                    str(photo.pk),
                ),
            )
            candidate.is_primary = True
            candidate.save(using=database, update_fields=("is_primary", "updated_at"))
            ProfilePhotoAuditLog.objects.using(database).create(
                photo_id=candidate.pk,
                member_id=member.pk,
                actor_type="LEGACY_BACKFILL",
                action=ProfilePhotoAuditLog.Action.SET_PRIMARY,
                details={
                    "reason": "legacy_gallery_had_no_primary",
                    "selection_policy": "approved_then_oldest_pending_then_oldest_rejected",
                },
            )
            self._sync_member_photo_status(member, database)
            return True

    @staticmethod
    def _sync_member_photo_status(member: Member, database: str) -> None:
        photo_statuses = list(
            ProfilePhoto.objects.using(database)
            .filter(user_id=member.pk)
            .values_list("status", "is_primary")
        )
        primary_status = next(
            (status for status, is_primary in photo_statuses if is_primary),
            None,
        )
        if primary_status == ProfilePhoto.Status.APPROVED:
            target_status = Member.VerificationStatus.APPROVED
        elif primary_status == ProfilePhoto.Status.PENDING or any(
            status == ProfilePhoto.Status.PENDING for status, _ in photo_statuses
        ):
            target_status = Member.VerificationStatus.PENDING_REVIEW
        else:
            target_status = Member.VerificationStatus.REJECTED
        if member.photo_status != target_status:
            member.photo_status = target_status
            member.save(using=database, update_fields=("photo_status", "updated_at"))
