from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Member
from apps.memberships.models import MembershipSubscription
from apps.memberships.tasks import reset_daily_view_limits


pytestmark = pytest.mark.django_db


def test_reset_daily_view_limits_only_resets_active_subscriptions():
    member = Member.objects.create_user(
        email="task@example.com",
        mobile_number="9002223303",
        password="StrongPass123!",
        first_name="Task",
        last_name="Member",
    )
    active = MembershipSubscription.objects.create(
        user=member,
        plan_name="Gold",
        plan_slug="gold",
        views_limit=10,
        views_used=8,
        end_date=timezone.now() + timedelta(days=1),
    )
    expired = MembershipSubscription.objects.create(
        user=member,
        plan_name="Elite",
        plan_slug="elite",
        views_limit=50,
        views_used=8,
        end_date=timezone.now() - timedelta(days=1),
    )
    assert reset_daily_view_limits() == 1
    active.refresh_from_db()
    expired.refresh_from_db()
    assert active.views_used == 0
    assert expired.views_used == 8
