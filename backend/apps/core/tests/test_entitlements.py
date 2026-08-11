from datetime import timedelta

import pytest
from django.utils import timezone

from apps.core.entitlements import get_active_entitlements
from apps.core.models import MemberMembership, MembershipPlan


pytestmark = pytest.mark.django_db


def make_plan(slug, **overrides):
    defaults = {
        'name': slug.title(), 'price': 0, 'duration': '30 Days', 'duration_days': 30,
        'features': [], 'is_active': True,
        'entitlements': {
            'daily_profile_view_limit': 5, 'can_send_interest': True,
            'daily_interest_limit': 3, 'can_chat': False,
            'can_view_contact_details': False, 'profile_visibility_boost': False,
            'can_see_who_viewed_profile': False, 'can_view_received_interests': False,
            'priority_support': False, 'max_photos': 6,
            'contact_access_mode': 'NONE', 'photo_access_mode': 'PRIMARY_ONLY',
            'can_use_advanced_search': False,
        },
    }
    defaults.update(overrides)
    return MembershipPlan.objects.create(slug=slug, **defaults)


def test_resolver_uses_free_plan_without_paid_membership(member):
    make_plan('free')

    resolved = get_active_entitlements(member)

    assert resolved.plan_slug == 'free'
    assert resolved.can_chat is False
    assert resolved.daily_profile_view_limit == 5


def test_resolver_uses_active_paid_plan_and_reflects_immediate_edit(member):
    make_plan('free')
    gold = make_plan('gold-entitlements', name='Gold', price=999, entitlements={
        'daily_profile_view_limit': 20, 'can_send_interest': True,
        'daily_interest_limit': 10, 'can_chat': True,
        'can_view_contact_details': True, 'profile_visibility_boost': False,
        'can_see_who_viewed_profile': True, 'can_view_received_interests': True,
        'priority_support': False, 'max_photos': 8,
        'contact_access_mode': 'FULL', 'photo_access_mode': 'ALL_APPROVED',
        'can_use_advanced_search': True,
    })
    MemberMembership.objects.create(
        member=member, plan=gold, status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True, started_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30),
    )

    assert get_active_entitlements(member).can_chat is True
    gold.entitlements['can_chat'] = False
    gold.save(update_fields=('entitlements',))
    assert get_active_entitlements(member).can_chat is False


def test_member_entitlements_endpoint_and_free_interest_denial(authenticated_client, member):
    make_plan('free')

    summary = authenticated_client(member).get('/api/v1/member/entitlements/')
    blocked = authenticated_client(member).get('/api/v1/interests/?type=incoming')

    assert summary.status_code == 200
    assert summary.data['data']['entitlements']['plan_slug'] == 'free'
    assert blocked.status_code == 403
    assert blocked.data['error'] == 'ENTITLEMENT_DENIED'


def test_admin_cannot_mutate_super_admin_plan_endpoint(authenticated_client, admin_account, super_admin):
    plan = make_plan('free')

    denied = authenticated_client(admin_account).patch(
        f'/api/v1/super-admin/membership-plans/{plan.pk}/', {'name': 'Changed'}, format='json'
    )
    allowed = authenticated_client(super_admin).patch(
        f'/api/v1/super-admin/membership-plans/{plan.pk}/', {'name': 'Changed'}, format='json'
    )

    assert denied.status_code == 403
    assert allowed.status_code == 200
