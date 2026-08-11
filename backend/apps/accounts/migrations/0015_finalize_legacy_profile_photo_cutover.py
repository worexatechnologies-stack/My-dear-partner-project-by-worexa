"""Guarded removal of the legacy ImageField profile-photo table.

The companion management command performs the resumable file-to-BYTEA
backfill after migration 0014. This migration refuses to delete
``member_photos`` until every source row has a valid, compressed WebP BYTEA
counterpart and every non-empty target gallery has exactly one primary photo.
"""

from __future__ import annotations

import hashlib

from django.db import migrations
from django.db.models import Count, Q


VALID_STATUSES = {"PENDING", "APPROVED", "REJECTED"}
SAMPLE_LIMIT = 5
BINARY_VALIDATION_CHUNK_SIZE = 25
MAIN_MAX_BYTES = 600 * 1024
THUMBNAIL_MAX_BYTES = 100 * 1024
PURGE_ACTOR_TYPE = "LEGACY_SOURCE_PURGE"
PURGE_ACTION = "LEGACY_SOURCE_PURGED"
SUCCESSFUL_PURGE_RESULTS = {"deleted", "deleted_after_restore", "already_missing"}


def _sample(values) -> str:
    return ", ".join(str(value) for value in values[:SAMPLE_LIMIT])


def _has_valid_bytea_invariants(photo) -> bool:
    """Validate persisted bytes and metadata without ever serializing them."""
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


def validate_legacy_profile_photo_backfill(apps, schema_editor):
    """Fail closed unless the staged command completed and verified the backfill."""
    LegacyPhoto = apps.get_model("accounts", "MemberPhoto")
    ProfilePhoto = apps.get_model("profiles", "ProfilePhoto")
    ProfilePhotoAuditLog = apps.get_model("profiles", "ProfilePhotoAuditLog")
    database = schema_editor.connection.alias

    source_count = LegacyPhoto.objects.using(database).count()
    if source_count == 0:
        return

    source_primary_counts = {
        row["member_id"]: row["primary_count"]
        for row in (
            LegacyPhoto.objects.using(database)
            .values("member_id")
            .annotate(primary_count=Count("id", filter=Q(is_primary=True)))
        )
    }
    purged_source_paths: dict[object, set[str]] = {}
    purge_audits = (
        ProfilePhotoAuditLog.objects.using(database)
        .filter(actor_type=PURGE_ACTOR_TYPE, action=PURGE_ACTION)
        .values_list("photo_id", "details")
    )
    for photo_id, details in purge_audits.iterator(chunk_size=1000):
        if (
            isinstance(details, dict)
            and details.get("source_table") == "member_photos"
            and details.get("purge_result") in SUCCESSFUL_PURGE_RESULTS
            and isinstance(details.get("legacy_source_path"), str)
        ):
            purged_source_paths.setdefault(photo_id, set()).add(details["legacy_source_path"])
    errors: list[str] = []
    issue_counts = {
        "missing": 0,
        "mismatched": 0,
        "invalid_status": 0,
        "invalid_bytea": 0,
        "missing_purge_audit": 0,
    }
    issue_samples = {key: [] for key in issue_counts}

    def note_issue(kind, legacy_id):
        issue_counts[kind] += 1
        if len(issue_samples[kind]) < SAMPLE_LIMIT:
            issue_samples[kind].append(legacy_id)

    # Only this final validation deliberately fetches BLOB data. The chunk is
    # small enough to cap memory around ~18 MiB at the configured max image
    # sizes, even for a large production gallery.
    source_rows = LegacyPhoto.objects.using(database).values_list(
        "id", "member_id", "image_path", "status", "is_primary"
    )
    chunk: list[tuple[object, object, str, str, bool]] = []

    def validate_chunk(rows):
        if not rows:
            return
        ids = [row[0] for row in rows]
        targets = {
            photo.id: photo
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
        for legacy_id, member_id, source_path, status, is_primary in rows:
            if str(source_path) not in purged_source_paths.get(legacy_id, set()):
                note_issue("missing_purge_audit", legacy_id)
            if status not in VALID_STATUSES:
                note_issue("invalid_status", legacy_id)
                continue
            target = targets.get(legacy_id)
            if target is None:
                note_issue("missing", legacy_id)
                continue
            # A gallery with no old primary is deterministically repaired by
            # the command. Its selected target is the only permitted false →
            # true transition; the aggregate check below guarantees uniqueness.
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
                note_issue("mismatched", legacy_id)
                continue
            if not _has_valid_bytea_invariants(target):
                note_issue("invalid_bytea", legacy_id)

    for source_row in source_rows.iterator(chunk_size=BINARY_VALIDATION_CHUNK_SIZE):
        chunk.append(source_row)
        if len(chunk) == BINARY_VALIDATION_CHUNK_SIZE:
            validate_chunk(chunk)
            chunk = []
    validate_chunk(chunk)

    if issue_counts["missing"]:
        errors.append(
            f"{issue_counts['missing']} legacy row(s) have no ProfilePhoto counterpart "
            f"(for example: {_sample(issue_samples['missing'])})."
        )
    if issue_counts["mismatched"]:
        errors.append(
            f"{issue_counts['mismatched']} counterpart row(s) do not preserve member, status, "
            f"or primary state (for example: {_sample(issue_samples['mismatched'])})."
        )
    if issue_counts["invalid_status"]:
        errors.append(
            f"{issue_counts['invalid_status']} legacy row(s) have an unsupported status "
            f"(for example: {_sample(issue_samples['invalid_status'])})."
        )
    if issue_counts["invalid_bytea"]:
        errors.append(
            f"{issue_counts['invalid_bytea']} counterpart row(s) fail BYTEA/WebP size or checksum "
            f"validation (for example: {_sample(issue_samples['invalid_bytea'])})."
        )
    if issue_counts["missing_purge_audit"]:
        errors.append(
            f"{issue_counts['missing_purge_audit']} legacy row(s) have no successful "
            f"LEGACY_SOURCE_PURGED audit marker (for example: "
            f"{_sample(issue_samples['missing_purge_audit'])})."
        )

    over_limit = list(
        ProfilePhoto.objects.using(database)
        .values("user_id")
        .annotate(total=Count("id"))
        .filter(total__gt=6)
        .values_list("user_id", "total")[:SAMPLE_LIMIT]
    )
    if over_limit:
        errors.append(
            "ProfilePhoto has gallery rows above the six-photo limit "
            f"(for example: {_sample(over_limit)})."
        )

    invalid_primary_counts = list(
        ProfilePhoto.objects.using(database)
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
        errors.append(
            "Every non-empty ProfilePhoto gallery must have exactly one primary "
            f"(for example: {_sample(invalid_primary_counts)})."
        )

    if errors:
        detail = " ".join(errors)
        raise RuntimeError(
            "Legacy profile-photo cutover is incomplete; member_photos was not removed. "
            "Run `python manage.py backfill_legacy_profile_photos --check-only` and "
            "`python manage.py purge_legacy_profile_photo_files` first; after the restore test, "
            "run the purge again with `--delete --confirm-backup-restore BACKUP_RESTORE_VERIFIED`. "
            "Resolve the reported rows, then retry migration 0015. "
            f"{detail}"
        )


def reverse_noop(apps, schema_editor):
    # The legacy table is intentionally not reconstructed. Restore a tested
    # database backup if a rollback across the final cutover is required.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0014_migrate_member_photos_to_postgres_bytea"),
        ("profiles", "0004_profilephotoauditlog_legacy_source_purged"),
    ]

    operations = [
        migrations.RunPython(validate_legacy_profile_photo_backfill, reverse_noop),
        migrations.DeleteModel(name="MemberPhoto"),
    ]
