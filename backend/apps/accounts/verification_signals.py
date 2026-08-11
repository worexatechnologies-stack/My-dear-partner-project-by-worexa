"""
Django Signals for Account Verification

Signals fired when account verification status changes:
- When new Member is created → auto-create FULL_PROFILE verification request for admin queue
- When account is verified → auto-activate pending membership
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Member


@receiver(post_save, sender=Member)
def on_member_saved(sender, instance, created, update_fields=None, **kwargs):
    """
    Signal handler when Member model is saved.
    """
    if created:
        from apps.core.models import ProfileVerificationRequest
        ProfileVerificationRequest.objects.get_or_create(
            member=instance,
            verification_type=ProfileVerificationRequest.VerificationType.FULL_PROFILE,
            defaults={
                'status': ProfileVerificationRequest.Status.PENDING_REVIEW,
                'submitted_at': instance.created_at or timezone.now()
            }
        )
        return

    if update_fields is None:
        return

    verification_fields = {'account_status', 'profile_status', 'photo_status', 'document_status'}
    changed_verification = bool(verification_fields & set(update_fields))

    if not changed_verification:
        return

    return


def ready():
    """Called when apps are ready"""
    pass
