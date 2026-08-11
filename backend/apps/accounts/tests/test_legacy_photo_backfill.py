from __future__ import annotations

import importlib
from io import BytesIO
from types import SimpleNamespace

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from PIL import Image

from apps.accounts.management.commands.backfill_legacy_profile_photos import (
    LegacyMemberPhoto,
)
from apps.profiles.services.image_processing import ImageProcessingService
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog


pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def legacy_member_photo_table():
    """Recreate the retired table only for command-level cutover tests."""
    with connection.schema_editor() as schema_editor:
        schema_editor.create_model(LegacyMemberPhoto)
    try:
        yield
    finally:
        with connection.schema_editor() as schema_editor:
            schema_editor.delete_model(LegacyMemberPhoto)


@pytest.fixture
def legacy_photo_storage(tmp_path):
    field = LegacyMemberPhoto._meta.get_field("image_path")
    original_storage = field.storage
    field.storage = FileSystemStorage(location=tmp_path)
    try:
        yield field.storage
    finally:
        field.storage = original_storage


def image_bytes() -> bytes:
    image = Image.new("RGB", (900, 1200), (80, 140, 200))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def create_legacy_photo(member, storage, *, primary=True, status="APPROVED", order=0):
    filename = storage.save(
        f"member_photos/legacy-{member.pk}-{order}.jpg",
        ContentFile(image_bytes()),
    )
    return LegacyMemberPhoto.objects.create(
        member_id=member.pk,
        image_path=filename,
        is_primary=primary,
        status=status,
        rejection_reason="Needs a clearer image" if status == "REJECTED" else "",
        display_order=order,
        uploaded_at=timezone.now(),
        reviewed_at=timezone.now() if status != "PENDING" else None,
    )


def create_target_photo(member, index: int):
    return ProfilePhoto.objects.create(
        user=member,
        image_data=b"main",
        thumbnail_data=b"thumb",
        mime_type="image/webp",
        original_filename=f"existing-{index}.webp",
        original_size_bytes=4,
        compressed_size_bytes=4,
        thumbnail_size_bytes=5,
        width=1200,
        height=1500,
        thumbnail_width=240,
        thumbnail_height=300,
        checksum=f"{index:064x}",
        is_primary=index == 0,
        status=ProfilePhoto.Status.APPROVED,
        display_order=index,
    )


def test_backfill_is_batched_idempotent_and_preserves_source_state(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    primary = create_legacy_photo(member, legacy_photo_storage, primary=True, order=0)
    secondary = create_legacy_photo(
        member,
        legacy_photo_storage,
        primary=False,
        status="PENDING",
        order=1,
    )

    call_command("backfill_legacy_profile_photos", batch_size=1, max_records=1)
    assert ProfilePhoto.objects.filter(pk=primary.pk).exists()
    assert not ProfilePhoto.objects.filter(pk=secondary.pk).exists()

    call_command("backfill_legacy_profile_photos", batch_size=1)
    primary_target = ProfilePhoto.objects.get(pk=primary.pk)
    secondary_target = ProfilePhoto.objects.get(pk=secondary.pk)

    assert primary_target.user_id == member.pk
    assert primary_target.status == "APPROVED"
    assert primary_target.is_primary is True
    assert primary_target.display_order == 0
    assert secondary_target.status == "PENDING"
    assert secondary_target.is_primary is False
    assert primary_target.image_data.startswith(b"RIFF")
    assert primary_target.thumbnail_data.startswith(b"RIFF")
    assert legacy_photo_storage.exists(primary.image_path.name)
    assert member.__class__.objects.get(pk=member.pk).photo_status == "approved"
    assert ProfilePhotoAuditLog.objects.filter(
        photo_id=primary.pk,
        actor_type="LEGACY_BACKFILL",
    ).exists()

    # A third invocation sees matching UUIDs and makes no duplicate rows.
    call_command("backfill_legacy_profile_photos")
    assert ProfilePhoto.objects.filter(user=member).count() == 2


def test_backfill_preflight_rejects_a_gallery_that_would_exceed_six_photos(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    for index in range(6):
        create_target_photo(member, index)
    create_legacy_photo(member, legacy_photo_storage)

    with pytest.raises(CommandError, match="six-photo"):
        call_command("backfill_legacy_profile_photos", check_only=True)

    assert ProfilePhoto.objects.filter(user=member).count() == 6


def test_backfill_promotes_an_approved_primary_when_the_legacy_gallery_has_none(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    approved = create_legacy_photo(
        member,
        legacy_photo_storage,
        primary=False,
        status="APPROVED",
        order=1,
    )
    pending = create_legacy_photo(
        member,
        legacy_photo_storage,
        primary=False,
        status="PENDING",
        order=0,
    )

    call_command("backfill_legacy_profile_photos")

    approved_target = ProfilePhoto.objects.get(pk=approved.pk)
    pending_target = ProfilePhoto.objects.get(pk=pending.pk)
    assert approved_target.is_primary is True
    assert pending_target.is_primary is False
    assert ProfilePhotoAuditLog.objects.filter(
        photo_id=approved.pk,
        action=ProfilePhotoAuditLog.Action.SET_PRIMARY,
        actor_type="LEGACY_BACKFILL",
    ).exists()


def test_backfill_stops_before_writing_an_unreadable_source(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    legacy = LegacyMemberPhoto.objects.create(
        member_id=member.pk,
        image_path="member_photos/not-present.jpg",
        is_primary=True,
        status="APPROVED",
        display_order=0,
        uploaded_at=timezone.now(),
        reviewed_at=timezone.now(),
    )

    with pytest.raises(CommandError, match="Could not read legacy photo"):
        call_command("backfill_legacy_profile_photos", batch_size=1)

    assert not ProfilePhoto.objects.filter(pk=legacy.pk).exists()


def test_backfill_rejects_oversized_legacy_object_before_image_decode(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
    monkeypatch,
):
    filename = legacy_photo_storage.save(
        "member_photos/oversized.jpg",
        ContentFile(b"x" * (ImageProcessingService.MAX_UPLOAD_BYTES + 1)),
    )
    legacy = LegacyMemberPhoto.objects.create(
        member_id=member.pk,
        image_path=filename,
        is_primary=True,
        status="APPROVED",
        display_order=0,
        uploaded_at=timezone.now(),
        reviewed_at=timezone.now(),
    )

    def unexpected_decode(*args, **kwargs):
        raise AssertionError("oversized legacy object reached Pillow")

    monkeypatch.setattr(ImageProcessingService, "process_profile_photo", unexpected_decode)
    with pytest.raises(CommandError, match="larger than the 10 MB limit"):
        call_command("backfill_legacy_profile_photos", batch_size=1)

    assert not ProfilePhoto.objects.filter(pk=legacy.pk).exists()


def test_stage_guard_refuses_to_rewind_later_migrations(monkeypatch):
    from django.db.migrations.recorder import MigrationRecorder

    monkeypatch.setattr(MigrationRecorder, "has_table", lambda self: True)
    monkeypatch.setattr(
        MigrationRecorder,
        "applied_migrations",
        lambda self: {
            ("accounts", "0014_migrate_member_photos_to_postgres_bytea"): object(),
            ("accounts", "0015_finalize_legacy_profile_photo_cutover"): object(),
        },
    )

    with pytest.raises(CommandError, match="forward-only"):
        call_command("guard_profile_photo_cutover_stage")


def test_final_migration_guard_refuses_to_drop_unmigrated_legacy_rows(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    create_legacy_photo(member, legacy_photo_storage)
    migration_module = importlib.import_module(
        "apps.accounts.migrations.0015_finalize_legacy_profile_photo_cutover"
    )
    historical_apps = MigrationExecutor(connection).loader.project_state(
        [("accounts", "0014_migrate_member_photos_to_postgres_bytea")]
    ).apps

    with pytest.raises(RuntimeError, match="cutover is incomplete"):
        migration_module.validate_legacy_profile_photo_backfill(
            historical_apps,
            SimpleNamespace(connection=connection),
        )


def test_purge_is_explicit_audited_idempotent_and_satisfies_final_guard(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    legacy = create_legacy_photo(member, legacy_photo_storage)
    call_command("backfill_legacy_profile_photos")
    migration_module = importlib.import_module(
        "apps.accounts.migrations.0015_finalize_legacy_profile_photo_cutover"
    )
    historical_apps = MigrationExecutor(connection).loader.project_state(
        [
            ("accounts", "0014_migrate_member_photos_to_postgres_bytea"),
            ("profiles", "0004_profilephotoauditlog_legacy_source_purged"),
        ]
    ).apps
    with pytest.raises(RuntimeError, match="LEGACY_SOURCE_PURGED"):
        migration_module.validate_legacy_profile_photo_backfill(
            historical_apps,
            SimpleNamespace(connection=connection),
        )

    call_command("purge_legacy_profile_photo_files")
    assert legacy_photo_storage.exists(legacy.image_path.name)
    assert not ProfilePhotoAuditLog.objects.filter(
        photo_id=legacy.pk,
        action=ProfilePhotoAuditLog.Action.LEGACY_SOURCE_PURGED,
    ).exists()

    with pytest.raises(CommandError, match="backup-restore"):
        call_command("purge_legacy_profile_photo_files", delete=True)

    call_command(
        "purge_legacy_profile_photo_files",
        delete=True,
        confirm_backup_restore="BACKUP_RESTORE_VERIFIED",
    )
    assert not legacy_photo_storage.exists(legacy.image_path.name)
    purge_audits = ProfilePhotoAuditLog.objects.filter(
        photo_id=legacy.pk,
        action=ProfilePhotoAuditLog.Action.LEGACY_SOURCE_PURGED,
        actor_type="LEGACY_SOURCE_PURGE",
    )
    assert purge_audits.count() == 1
    assert purge_audits.get().details["purge_result"] == "deleted"

    # Missing files with a successful audit marker are deliberately harmless
    # on rerun, and the final migration accepts the persisted marker.
    call_command(
        "purge_legacy_profile_photo_files",
        delete=True,
        confirm_backup_restore="BACKUP_RESTORE_VERIFIED",
    )
    assert purge_audits.count() == 1

    migration_module.validate_legacy_profile_photo_backfill(
        historical_apps,
        SimpleNamespace(connection=connection),
    )


def test_purge_refuses_to_audit_when_storage_keeps_the_source_object(
    member,
    legacy_member_photo_table,
    legacy_photo_storage,
):
    legacy = create_legacy_photo(member, legacy_photo_storage)
    call_command("backfill_legacy_profile_photos")
    field = LegacyMemberPhoto._meta.get_field("image_path")
    original_storage = field.storage

    class SilentDeleteStorage(FileSystemStorage):
        def delete(self, name):
            return None

    field.storage = SilentDeleteStorage(location=legacy_photo_storage.location)
    try:
        with pytest.raises(CommandError, match="no success audit"):
            call_command(
                "purge_legacy_profile_photo_files",
                delete=True,
                confirm_backup_restore="BACKUP_RESTORE_VERIFIED",
            )
    finally:
        field.storage = original_storage

    assert legacy_photo_storage.exists(legacy.image_path.name)
    assert not ProfilePhotoAuditLog.objects.filter(
        photo_id=legacy.pk,
        action=ProfilePhotoAuditLog.Action.LEGACY_SOURCE_PURGED,
    ).exists()
