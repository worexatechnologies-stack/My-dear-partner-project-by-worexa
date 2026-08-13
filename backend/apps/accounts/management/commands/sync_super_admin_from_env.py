from django.core.management.base import BaseCommand, CommandError

from apps.accounts.super_admin_sync import SuperAdminSyncError, sync_super_admin_from_environment


class Command(BaseCommand):
    help = 'Create or synchronize the singleton Super Admin from server-side environment settings.'

    def handle(self, *_args, **_options):
        try:
            result = sync_super_admin_from_environment()
        except SuperAdminSyncError as exc:
            raise CommandError(str(exc)) from exc

        if result.skipped:
            self.stdout.write(self.style.WARNING('Super Admin environment credentials are not configured; synchronization skipped.'))
        elif result.created:
            self.stdout.write(self.style.SUCCESS('Super Admin created from environment configuration.'))
        elif result.updated:
            self.stdout.write(self.style.SUCCESS('Super Admin synchronized from environment configuration.'))
        else:
            self.stdout.write('Super Admin is already synchronized with environment configuration.')
