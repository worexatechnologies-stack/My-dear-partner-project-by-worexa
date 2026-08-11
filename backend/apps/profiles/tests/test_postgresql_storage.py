"""PostgreSQL-only checks for the profile-photo storage contract.

Run this module with ``config.settings.postgres_integration``.  The default
SQLite suite collects it as a skip so the PostgreSQL coverage gap remains
visible without making every unit-test run require an external service.
"""

import pytest
from django.db import IntegrityError, connection, transaction

from apps.profiles.models import ProfilePhoto


pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.postgresql,
]


def _photo_values(member, *, suffix: bytes, is_primary: bool) -> dict:
    return {
        "user": member,
        "image_data": b"main-webp-" + suffix,
        "thumbnail_data": b"thumbnail-webp-" + suffix,
        "mime_type": "image/webp",
        "original_filename": f"photo-{suffix.decode('ascii')}.jpg",
        "original_size_bytes": 1024,
        "compressed_size_bytes": 11 + len(suffix),
        "thumbnail_size_bytes": 16 + len(suffix),
        "checksum": suffix.hex().ljust(64, "0"),
        "is_primary": is_primary,
        "status": ProfilePhoto.Status.APPROVED,
    }


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="requires the opt-in PostgreSQL integration settings",
)
def test_bytea_columns_and_partial_primary_uniqueness_are_enforced(member):
    table_name = ProfilePhoto._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT attribute.attname, pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
            FROM pg_catalog.pg_attribute AS attribute
            JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            WHERE namespace.nspname = current_schema()
              AND relation.relname = %s
              AND attribute.attname IN ('image_data', 'thumbnail_data')
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
            ORDER BY attribute.attname
            """,
            [table_name],
        )
        column_types = dict(cursor.fetchall())

        cursor.execute(
            """
            SELECT index.indisunique, pg_catalog.pg_get_expr(index.indpred, index.indrelid)
            FROM pg_catalog.pg_index AS index
            JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index.indexrelid
            JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index.indrelid
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
            WHERE namespace.nspname = current_schema()
              AND table_relation.relname = %s
              AND index_relation.relname = 'one_primary_profile_photo_per_user'
            """,
            [table_name],
        )
        primary_index = cursor.fetchone()

    assert column_types == {
        "image_data": "bytea",
        "thumbnail_data": "bytea",
    }
    assert primary_index is not None
    assert primary_index[0] is True
    assert primary_index[1] is not None
    assert "is_primary" in primary_index[1]

    first_primary = ProfilePhoto.objects.create(
        **_photo_values(member, suffix=b"one", is_primary=True)
    )
    ProfilePhoto.objects.create(
        **_photo_values(member, suffix=b"two", is_primary=False)
    )
    ProfilePhoto.objects.create(
        **_photo_values(member, suffix=b"three", is_primary=False)
    )

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT pg_typeof(image_data)::text, pg_typeof(thumbnail_data)::text "
            f"FROM {connection.ops.quote_name(table_name)} WHERE id = %s",
            [first_primary.pk],
        )
        stored_types = cursor.fetchone()

    assert stored_types == ("bytea", "bytea")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ProfilePhoto.objects.create(
                **_photo_values(member, suffix=b"four", is_primary=True)
            )

    assert ProfilePhoto.objects.filter(user=member, is_primary=True).count() == 1
    assert ProfilePhoto.objects.filter(user=member, is_primary=False).count() == 2
