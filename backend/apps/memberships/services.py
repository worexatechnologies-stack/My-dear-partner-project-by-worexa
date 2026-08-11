from django.utils import timezone

from .models import MembershipSubscription


def active_subscription_for(user, *, for_update=False):
    """Return the most recently expiring active compatibility subscription."""

    queryset = MembershipSubscription.objects.filter(
        user=user,
        end_date__gt=timezone.now(),
    ).order_by("-end_date", "-created_at")
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.first()
