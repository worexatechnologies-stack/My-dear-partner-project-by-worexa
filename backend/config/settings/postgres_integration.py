"""Opt-in settings for destructive, database-isolated PostgreSQL tests.

This module is intentionally not selected by ``pytest.ini``.  It creates and
drops the database named by ``PROFILE_PHOTO_POSTGRES_TEST_DB`` using Django's
normal test-database lifecycle, so callers must opt in explicitly and provide
a clearly dedicated database name.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from .test import *  # noqa: F403


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(
            f"{name} is required for the opt-in PostgreSQL integration suite."
        )
    return value


if os.environ.get("RUN_PROFILE_PHOTO_POSTGRES_TESTS") != "1":
    raise ImproperlyConfigured(
        "Set RUN_PROFILE_PHOTO_POSTGRES_TESTS=1 to enable the PostgreSQL "
        "profile-photo integration suite."
    )

postgres_test_database = _required_environment("PROFILE_PHOTO_POSTGRES_TEST_DB")
if not postgres_test_database.startswith("test_matiromony_profile_photos_"):
    raise ImproperlyConfigured(
        "PROFILE_PHOTO_POSTGRES_TEST_DB must start with "
        "'test_matiromony_profile_photos_' so an application database cannot "
        "be selected accidentally."
    )

postgres_database = os.environ.get("DB_NAME", "postgres").strip() or "postgres"
if postgres_database == postgres_test_database:
    raise ImproperlyConfigured(
        "DB_NAME and PROFILE_PHOTO_POSTGRES_TEST_DB must be different."
    )

DATABASES = {  # noqa: F405
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": postgres_database,
        "USER": _required_environment("DB_USER"),
        "PASSWORD": _required_environment("DB_PASSWORD"),
        "HOST": _required_environment("DB_HOST"),
        "PORT": os.environ.get("DB_PORT", "5432").strip() or "5432",
        "CONN_MAX_AGE": 0,
        "DISABLE_SERVER_SIDE_CURSORS": True,
        "TEST": {
            "NAME": postgres_test_database,
        },
    }
}
