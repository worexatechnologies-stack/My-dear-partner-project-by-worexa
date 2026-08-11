from celery import shared_task
from django.utils import timezone

from .models import MembershipSubscription
from apps.core.api_utils import create_notification
from apps.core.models import MemberMembership


@shared_task(name="apps.memberships.tasks.reset_daily_view_limits")
def reset_daily_view_limits():
    """Reset usage counters for subscriptions that are active at run time."""

    return MembershipSubscription.objects.filter(end_date__gt=timezone.now()).update(views_used=0)


@shared_task(name='apps.memberships.tasks.expire_memberships')
def expire_memberships():
    """Expire paid memberships and notify the member exactly once."""
    now = timezone.now()
    expired = list(MemberMembership.objects.select_related('member', 'plan').filter(
        status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True,
        expires_at__lte=now,
    ))
    for membership in expired:
        membership.status = MemberMembership.MembershipStatus.EXPIRED
        membership.is_active = False
        membership.end_date = membership.expires_at
        membership.save(update_fields=('status', 'is_active', 'end_date', 'updated_at'))
        if not MemberMembership.objects.filter(
            member=membership.member,
            status=MemberMembership.MembershipStatus.ACTIVE,
            is_active=True,
        ).exists():
            membership.member.is_premium = False
            membership.member.save(update_fields=('is_premium', 'updated_at'))
        create_notification(
            membership.member,
            type='MEMBERSHIP_EXPIRED',
            title='Your membership has expired',
            body=f'Your {membership.plan.name if membership.plan else "paid"} membership has ended.',
            link_url='/membership',
        )
    return len(expired)


@shared_task(name='apps.memberships.tasks.notify_expiring_memberships')
def notify_expiring_memberships():
    """Notify active members once when their membership has three days left."""
    from datetime import timedelta

    now = timezone.now()
    threshold = now + timedelta(days=3)
    memberships = MemberMembership.objects.select_related('member', 'plan').filter(
        status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True,
        expires_at__gt=now,
        expires_at__lte=threshold,
    )
    created = 0
    for membership in memberships:
        if MemberMembership.objects.filter(
            pk=membership.pk,
            # A notification row is used as the durable idempotency record.
            member__notifications__notification_type='MEMBERSHIP_EXPIRING_SOON',
            member__notifications__related_object_id=str(membership.pk),
        ).exists():
            continue
        create_notification(
            membership.member,
            type='MEMBERSHIP_EXPIRING_SOON',
            title='Your membership expires soon',
            body=f'Your {membership.plan.name if membership.plan else "paid"} membership expires in three days.',
            link_url='/membership',
            related_object=membership,
        )
        created += 1
    return created
