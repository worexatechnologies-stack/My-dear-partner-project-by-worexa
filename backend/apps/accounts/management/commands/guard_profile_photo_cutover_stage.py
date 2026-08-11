"""Refuse to rewind a database that has passed the one-way photo cutover."""

from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.migrations.recorder import MigrationRecorder


STAGE_MAX_MIGRATIONS = {
    "accounts": 14,
    "profiles": 4,
}


def _migration_number(name: str) -> int | None:
    prefix = name.split("_", 1)[0]
    return int(prefix) if prefix.isdigit() else None


class Command(BaseCommand):
    help = "Fail if stage mode would unapply an already-applied cutover migration."

    def add_arguments(self, parser):
        parser.add_argument("--database", default="default")

    def handle(self, *args, **options):
        database = options["database"]
        if database not in connections:
            raise CommandError(f"Unknown database alias: {database}")

        recorder = MigrationRecorder(connections[database])
        if not recorder.has_table():
            return

        unsafe = []
        for app, name in recorder.applied_migrations():
            maximum = STAGE_MAX_MIGRATIONS.get(app)
            number = _migration_number(name)
            if maximum is not None and (number is None or number > maximum):
                unsafe.append(f"{app}.{name}")

        if unsafe:
            sample = ", ".join(sorted(unsafe)[:5])
            raise CommandError(
                "Profile-photo stage mode is forward-only and would rewind applied "
                f"migrations ({sample}). Use PROFILE_PHOTO_CUTOVER_PHASE=final."
            )

        self.stdout.write("Profile-photo stage guard passed; no finalized migration is applied.")
