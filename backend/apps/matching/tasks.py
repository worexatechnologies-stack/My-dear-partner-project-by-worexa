from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from apps.accounts.models import MemberProfile
from apps.core.models import Interest


@shared_task(name="apps.matching.tasks.recalculate_compatibility_scores")
def recalculate_compatibility_scores():
    """Refresh simple 0-100 compatibility scores from shared profile traits."""

    profiles = list(MemberProfile.objects.select_related("member").all())
    updated = 0
    weighted_fields = (
        ("religion", 30),
        ("caste", 25),
        ("work_location", 25),
        ("mother_tongue", 20),
    )
    for profile in profiles:
        # 75 is the neutral default requested for incomplete profiles.  The
        # highest overlap with another active profile provides a lightweight,
        # deterministic score without introducing a recommendation model.
        score = 75
        for other in profiles:
            if other.pk == profile.pk or not other.member.is_active:
                continue
            overlap = sum(
                weight
                for field, weight in weighted_fields
                if getattr(profile, field, "")
                and getattr(profile, field, "").strip().lower()
                == getattr(other, field, "").strip().lower()
            )
            score = max(score, overlap)
        if profile.compatibility != score:
            profile.compatibility = score
            profile.save(update_fields=("compatibility", "updated_at"))
            updated += 1
    return updated


@shared_task(name="apps.matching.tasks.send_interest_notification")
def send_interest_notification(interest_id):
    """Email notification stub; replaceable with a push provider later."""

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
    return True
