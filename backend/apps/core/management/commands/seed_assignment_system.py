from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import Staff
from apps.core.models import (
    Specialization, Queue, AssignmentStrategy, EmployeeAvailability,
    Workload, AssignmentRule, SupportCategory
)

class Command(BaseCommand):
    help = 'Seeds initial queues, strategies, specializations, workloads, and assignment rules.'

    def handle(self, *args, **options):
        self.stdout.write('Seeding assignment system configuration...')
        with transaction.atomic():
            # 1. Seed Assignment Strategies
            strategies = [
                {'code': 'ROUND_ROBIN', 'name': 'Round Robin', 'description': 'Assigns to the eligible agent who was assigned a task least recently.'},
                {'code': 'LEAST_WORKLOAD', 'name': 'Least Workload', 'description': 'Assigns to the eligible agent with the lowest open task count.'},
                {'code': 'SLA_AVAILABILITY', 'name': 'SLA Availability', 'description': 'Assigns to online eligible agents sorted by lowest response/resolution SLA.'},
            ]
            strategy_objs = {}
            for strat in strategies:
                obj, created = AssignmentStrategy.objects.get_or_create(code=strat['code'], defaults=strat)
                strategy_objs[strat['code']] = obj
                if created:
                    self.stdout.write(f"Created AssignmentStrategy: {strat['code']}")

            # 2. Seed Queues
            queues = [
                {'code': 'UNASSIGNED', 'name': 'Unassigned Queue', 'description': 'Queue for unassigned support tickets.'},
                {'code': 'VERIFICATION', 'name': 'Verification Queue', 'description': 'Queue for pending profile, photo, and document verifications.'},
                {'code': 'SUPPORT', 'name': 'Support Queue', 'description': 'Queue for customer support issues.'},
                {'code': 'PAYMENT', 'name': 'Payment Queue', 'description': 'Queue for billing and payment related support tickets.'},
                {'code': 'TECHNICAL', 'name': 'Technical Queue', 'description': 'Queue for technical and system bugs.'},
                {'code': 'ESCALATED', 'name': 'Escalated Queue', 'description': 'Queue for escalated tickets and verifications.'},
                {'code': 'RESOLVED', 'name': 'Resolved Queue', 'description': 'Queue for resolved items.'},
                {'code': 'CLOSED', 'name': 'Closed Queue', 'description': 'Queue for closed items.'},
            ]
            queue_objs = {}
            for q in queues:
                obj, created = Queue.objects.get_or_create(code=q['code'], defaults=q)
                queue_objs[q['code']] = obj
                if created:
                    self.stdout.write(f"Created Queue: {q['code']}")

            # 3. Seed Specializations
            specializations = [
                {'code': 'GENERAL', 'name': 'General support', 'description': 'General customer issues and queries.'},
                {'code': 'PAYMENTS', 'name': 'Payments & Billing', 'description': 'Specialization in billing, membership plans, and payments.'},
                {'code': 'PROFILE_VERIFICATION', 'name': 'Verification Desk', 'description': 'Specialization in member profile, photo, and document verifications.'},
                {'code': 'TECHNICAL', 'name': 'Technical Support', 'description': 'Specialization in software, login, and profile errors.'},
                {'code': 'REFUNDS', 'name': 'Refund Desk', 'description': 'Specialization in billing refunds.'},
                {'code': 'SAFETY', 'name': 'Trust & Safety', 'description': 'Specialization in member complaints and reports.'},
            ]
            spec_objs = {}
            for spec in specializations:
                obj, created = Specialization.objects.get_or_create(code=spec['code'], defaults=spec)
                spec_objs[spec['code']] = obj
                if created:
                    self.stdout.write(f"Created Specialization: {spec['code']}")

            # 4. Backfill workload and availability for existing employees
            for employee in Staff.objects.all():
                EmployeeAvailability.objects.get_or_create(staff_member=employee, defaults={
                    'is_online': True,
                    'availability_status': 'AVAILABLE',
                })
                Workload.objects.get_or_create(staff_member=employee, defaults={
                    'open_tickets_count': 0,
                    'urgent_tickets_count': 0,
                    'open_verifications_count': 0,
                    'capacity': 10,
                })
                if spec_objs.get('PROFILE_VERIFICATION'):
                    employee.specializations.add(spec_objs['PROFILE_VERIFICATION'])


            # 5. Create Default Assignment Rules mapping categories to strategies/queues
            categories = SupportCategory.objects.all()
            for cat in categories:
                code = cat.code.upper()
                rule_name = f"Default routing rule for {cat.name}"
                
                strategy_code = 'ROUND_ROBIN'
                queue_code = 'SUPPORT'
                
                if 'PAYMENT' in code or 'MEMBERSHIP' in code or 'REFUND' in code:
                    queue_code = 'PAYMENT'
                    strategy_code = 'LEAST_WORKLOAD'
                elif 'TECHNICAL' in code or 'LOGIN' in code:
                    queue_code = 'TECHNICAL'
                elif 'VERIFICATION' in code:
                    queue_code = 'VERIFICATION'
                elif 'ABUSE' in code or 'FAKE' in code:
                    queue_code = 'ESCALATED'
                
                rule, created = AssignmentRule.objects.get_or_create(
                    category=cat,
                    defaults={
                        'name': rule_name,
                        'strategy': strategy_objs[strategy_code],
                        'queue': queue_objs[queue_code],
                        'priority_order': 10,
                        'is_active': True
                    }
                )
                if created:
                    self.stdout.write(f"Created AssignmentRule for category {cat.code}")

            # 6. Add default rules for verification types (if no category associated)
            verif_types = [
                ('FULL_PROFILE', 'Profile Verification Rule', 'VERIFICATION'),
                ('PROFILE_PHOTO', 'Photo Verification Rule', 'VERIFICATION'),
                ('IDENTITY_DOCUMENT', 'Document Verification Rule', 'VERIFICATION')
            ]
            for vt_code, vt_name, q_code in verif_types:
                rule, created = AssignmentRule.objects.get_or_create(
                    verification_type=vt_code,
                    defaults={
                        'name': vt_name,
                        'strategy': strategy_objs['ROUND_ROBIN'],
                        'queue': queue_objs[q_code],
                        'priority_order': 20,
                        'is_active': True
                    }
                )
                if created:
                    self.stdout.write(f"Created AssignmentRule for verification type {vt_code}")

        self.stdout.write(self.style.SUCCESS('Successfully seeded assignment system configuration.'))
