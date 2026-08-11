import re
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, connections


class Command(BaseCommand):
    help = 'Destructively recreate the development database and seed lookup data only.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            help='Must exactly match the configured database name.',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Refusing destructive reset because DEBUG=False.')
        if not getattr(settings, 'ALLOW_DESTRUCTIVE_DEV_RESET', False):
            raise CommandError(
                'Refusing destructive reset because ALLOW_DESTRUCTIVE_DEV_RESET is not explicitly enabled.'
            )

        config = connection.settings_dict
        engine = config['ENGINE']
        database_name = str(config['NAME'])
        confirmation = options.get('confirm')
        if confirmation != database_name:
            raise CommandError(f'Pass --confirm "{database_name}" to confirm the exact target.')

        if 'postgresql' in engine:
            self._rebuild_postgresql(config, database_name)
        elif 'sqlite3' in engine:
            self._rebuild_sqlite(database_name)
        else:
            raise CommandError(f'Unsupported development database engine: {engine}')

        call_command('migrate', interactive=False, verbosity=options.get('verbosity', 1))
        from apps.accounts.rbac import seed_rbac
        from apps.core.baseline import seed_support_baseline

        seed_rbac()
        seed_support_baseline()
        self.stdout.write(
            self.style.SUCCESS(
                'Development database rebuilt. Roles, permissions, categories and SLA rules were seeded; no accounts or business data were created.'
            )
        )

    def _rebuild_postgresql(self, config, database_name):
        host = str(config.get('HOST') or '').lower()
        if host not in {'localhost', '127.0.0.1', '::1'}:
            raise CommandError('Refusing to reset a PostgreSQL database on a non-local host.')
        if not re.fullmatch(r'[A-Za-z0-9_-]+', database_name):
            raise CommandError('Database name contains unsafe characters.')
        lowered = database_name.lower()
        if lowered in {'postgres', 'template0', 'template1'} or 'prod' in lowered:
            raise CommandError('Refusing to reset a protected or production-looking database name.')

        database_driver = connection.Database
        connections.close_all()
        connect_kwargs = {
            'dbname': 'postgres',
            'user': config.get('USER'),
            'password': config.get('PASSWORD'),
            'host': config.get('HOST'),
            'port': config.get('PORT'),
        }
        admin_connection = database_driver.connect(**{key: value for key, value in connect_kwargs.items() if value})
        admin_connection.autocommit = True
        try:
            with admin_connection.cursor() as cursor:
                cursor.execute(
                    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid()',
                    (database_name,),
                )
                quoted_name = f'"{database_name}"'
                cursor.execute(f'DROP DATABASE IF EXISTS {quoted_name}')
                cursor.execute(f'CREATE DATABASE {quoted_name}')
        finally:
            admin_connection.close()

    def _rebuild_sqlite(self, database_name):
        target = Path(database_name).resolve()
        workspace = Path(settings.BASE_DIR).resolve()
        if workspace not in target.parents:
            raise CommandError('Refusing to delete a SQLite database outside the backend workspace.')
        connections.close_all()
        if target.exists():
            target.unlink()
