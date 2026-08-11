"""Stage the legacy profile-photo table for an out-of-band backfill.

This migration deliberately *does not* read files or drop ``member_photos``.
Large image conversions are not appropriate for a database migration: a
single unreadable object would roll back an unbounded transaction, and the
operation could not be resumed safely.  After this migration is deployed,
run ``backfill_legacy_profile_photos`` in bounded batches.  Migration 0015
performs the final validation and removes the legacy table only when every
row has a verified BYTEA counterpart.
"""

from django.db import migrations


def stage_legacy_profile_photos(apps, schema_editor):
    """Intentional no-op marking the start of the staged cutover.

    Keeping an explicit operation makes the deployment boundary visible in
    migration history without coupling file IO to ``migrate``.
    """


def reverse_stage_legacy_profile_photos(apps, schema_editor):
    """No schema or data change was made by the staging migration."""


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0013_user"),
        ("profiles", "0003_postgresql_profile_photo_cutover"),
    ]

    operations = [
        migrations.RunPython(
            stage_legacy_profile_photos,
            reverse_stage_legacy_profile_photos,
        ),
    ]
