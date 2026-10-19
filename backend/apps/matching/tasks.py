import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from apps.accounts.models import MemberProfile
from apps.core.models import Interest

logger = logging.getLogger(__name__)


@shared_task(name="apps.matching.tasks.recalculate_compatibility_scores")
def recalculate_compatibility_scores():
    """Refresh personalized bidirectional compatibility evaluations from stored profiles."""
    from apps.matching.services import MatchmakingService
    return MatchmakingService.refresh_all_compatibility_caches()


@shared_task(name="apps.matching.tasks.send_interest_notification")
def send_interest_notification(interest_id):
    """Email and push notification for received interests."""

    interest = Interest.objects.select_related("sender", "receiver").filter(pk=interest_id).first()
    if interest is None:
        return False
    send_mail(
        subject="You received a new interest",
        message=f"{interest.sender.get_full_name()} sent you an interest.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[interest.receiver.email],
        fail_silently=True,
    )

    try:
        from apps.notifications.models import Device
        from apps.notifications.push import send_interest_push

        devices = list(Device.objects.filter(user=interest.receiver, active=True))
        sender_name = interest.sender.get_full_name() or interest.sender.email or "Someone"
        sender_id = str(interest.sender.pk)
        receiver_id = str(interest.receiver.pk)

        logger.info(
            "Dispatching mobile interest push: recipient_user_id=%s active_tokens=%d sender_id=%s interest_id=%s",
            receiver_id,
            len(devices),
            sender_id,
            interest.pk,
        )

        for device in devices:
            send_interest_push(
                device=device,
                sender_name=sender_name,
                interest_id=str(interest.pk),
                sender_id=sender_id,
                receiver_id=receiver_id,
                title="New Interest",
                body="Someone sent you an interest",
            )
    except Exception:
        logger.exception("Failed to dispatch mobile FCM interest push")

    return True
