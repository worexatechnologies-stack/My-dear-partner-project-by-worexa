"""
Django management command to clear all user and member data

Usage:
    python manage.py clear_all_data
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from apps.accounts.models import Member, User, AuthChallenge

class Command(BaseCommand):
    help = 'Clear all user and member data from database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('DATABASE CLEANUP - DELETE ALL USERS AND MEMBERS'))
        self.stdout.write(self.style.WARNING('=' * 80))
        
        self.stdout.write('\n[WARNING] This will permanently delete:')
        self.stdout.write('   - All user accounts')
        self.stdout.write('   - All member profiles')
        self.stdout.write('   - All notifications')
        self.stdout.write('   - All verification data')
        self.stdout.write('   - All auth challenges')
        
        self.stdout.write('\nIt will NOT delete:')
        self.stdout.write('   - Database schema')
        self.stdout.write('   - Migrations')
        self.stdout.write('   - Settings')
        
        # Ask for confirmation unless --force is used
        if not options['force']:
            self.stdout.write('\n')
            response = input("Type 'YES' to proceed (or press Enter to cancel): ")
            if response.lower() != 'yes':
                self.stdout.write(self.style.ERROR('[CANCELLED] Database not modified.'))
                return
        
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 80))
        self.stdout.write(self.style.SUCCESS('STARTING DATABASE CLEANUP...'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        
        try:
            # Count before deletion
            self.stdout.write('\nCurrent database state:')
            self.stdout.write(f'  - Members: {Member.objects.count()}')
            self.stdout.write(f'  - Users: {User.objects.count()}')
            self.stdout.write(f'  - Auth Challenges: {AuthChallenge.objects.count()}')
            
            # Step 1: Delete auth challenges
            self.stdout.write('\nStep 1: Deleting auth challenges...')
            auth_count, _ = AuthChallenge.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f'  - Deleted {auth_count} auth challenges'))
            
            # Step 2: Delete members
            self.stdout.write('\nStep 2: Deleting members...')
            member_count, _ = Member.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f'  - Deleted {member_count} members'))
            
            # Step 3: Delete users
            self.stdout.write('\nStep 3: Deleting users...')
            user_count, _ = User.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f'  - Deleted {user_count} users'))
            
            # Step 4: Delete verification requests
            self.stdout.write('\nStep 4: Deleting verification requests...')
            try:
                from apps.core.models import ProfileVerificationRequest
                verif_count, _ = ProfileVerificationRequest.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f'  - Deleted {verif_count} verification requests'))
            except ImportError:
                self.stdout.write(self.style.WARNING('  - Verification model not found (skipped)'))
            
            # Step 5: Delete notifications
            self.stdout.write('\nStep 5: Deleting notifications...')
            try:
                from apps.core.models import Notification
                notif_count, _ = Notification.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f'  - Deleted {notif_count} notifications'))
            except ImportError:
                self.stdout.write(self.style.WARNING('  - Notification model not found (skipped)'))
            
            # Verify deletion
            self.stdout.write('\nVerification after cleanup:')
            self.stdout.write(f'  - Members: {Member.objects.count()}')
            self.stdout.write(f'  - Users: {User.objects.count()}')
            self.stdout.write(f'  - Auth Challenges: {AuthChallenge.objects.count()}')
            
            self.stdout.write(self.style.SUCCESS('\n' + '=' * 80))
            self.stdout.write(self.style.SUCCESS('DATABASE CLEANUP COMPLETE!'))
            self.stdout.write(self.style.SUCCESS('=' * 80))
            
            self.stdout.write('\nSummary:')
            self.stdout.write(f'  - Members deleted: {member_count}')
            self.stdout.write(f'  - Users deleted: {user_count}')
            self.stdout.write(f'  - Auth challenges deleted: {auth_count}')
            
            self.stdout.write(self.style.SUCCESS('\nDatabase is now clean and ready for fresh data!'))
            self.stdout.write('\nNext steps:')
            self.stdout.write('  1. Create new user via API')
            self.stdout.write('  2. Register as member')
            self.stdout.write('  3. Start fresh verification process\n')
            
        except Exception as e:
            raise CommandError(f'Error during cleanup: {e}')
