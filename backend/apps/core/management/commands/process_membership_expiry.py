from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import MemberMembership
from apps.accounts.models import Member
from apps.core.services.membership_lifecycle_service import MembershipLifecycleService


class Command(BaseCommand):
    help = 'Process membership expiry: mark expired memberships, send notifications for expiring ones.'

    def add_arguments(self, parser):
        parser.add_argument('--batch-size', type=int, default=200, help='Batch size for expiry processing.')
        parser.add_argument('--mark-expiring-soon', type=int, default=7, help='Days threshold for EXPIRING_SOON status.')
        parser.add_argument('--notify', action='store_true', default=True, help='Send expiry notifications.')

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        days_threshold = options['mark_expiring_soon']
        notify = options['notify']

        # Step 1: Mark memberships that are expiring within threshold
        self.stdout.write(self.style.WARNING(f'Marking memberships expiring within {days_threshold} days as EXPIRING_SOON...'))
        soon_count = MembershipLifecycleService.mark_expiring_soon(days_threshold)
        self.stdout.write(self.style.SUCCESS(f'  → {soon_count} memberships marked as EXPIRING_SOON.'))

        # Step 2: Process expired memberships
        self.stdout.write(self.style.WARNING('Processing expired memberships...'))
        result = MembershipLifecycleService.process_batch_expiry(batch_size)
        self.stdout.write(self.style.SUCCESS(f'  → {result["expired"]} memberships expired.'))

        # Step 3: Send expiry notifications (30/14/7/3/1 day reminders)
        if notify:
            self.stdout.write(self.style.WARNING('Sending expiry notifications...'))
            notif_results = MembershipLifecycleService.process_expiry_notifications()
            for milestone, count in notif_results.items():
                self.stdout.write(self.style.SUCCESS(f'  → {milestone}: {count} notifications sent.'))

        self.stdout.write(self.style.SUCCESS('Membership expiry processing complete.'))
