from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import Staff
from apps.core.models import EmployeeAvailability, Workload, ProfileVerificationRequest, Notification

@receiver(post_save, sender=Staff)
def create_availability_and_workload(sender, instance, created, **kwargs):
    if created or not hasattr(instance, 'availability'):
        EmployeeAvailability.objects.get_or_create(
            staff_member=instance,
            defaults={
                'is_online': True,
                'is_suspended': False,
                'availability_status': 'AVAILABLE',
            }
        )
    if created or not hasattr(instance, 'workload'):
        Workload.objects.get_or_create(
            staff_member=instance,
            defaults={
                'open_tickets_count': 0,
                'urgent_tickets_count': 0,
                'open_verifications_count': 0,
                'capacity': 10,
            }
        )

@receiver(post_save, sender=ProfileVerificationRequest)
def trigger_verification_auto_assignment(sender, instance, created, **kwargs):
    if (created or instance.status == ProfileVerificationRequest.Status.PENDING_REVIEW) and not getattr(instance, '_auto_assigning', False):
        instance._auto_assigning = True
        from apps.core.assignment_engine import auto_assign_verification
        auto_assign_verification(instance)
        instance._auto_assigning = False


@receiver(post_save, sender=Notification)
def publish_notification_after_commit(sender, instance, created, **kwargs):
    """Covers legacy direct creates as well as create_notification callers."""
    if created:
        from apps.core.api_utils import broadcast_notification
        transaction.on_commit(lambda: broadcast_notification(instance))
