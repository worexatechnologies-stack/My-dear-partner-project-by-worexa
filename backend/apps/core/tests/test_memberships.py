from datetime import timedelta

import pytest
from django.utils import timezone
from apps.core.models import Interest, MembershipPlan, MembershipRequest, MemberMembership
from apps.accounts.models import Member, SuperAdmin, Admin

pytestmark = pytest.mark.django_db

@pytest.fixture
def plan(db):
    plan, _ = MembershipPlan.objects.get_or_create(
        slug='platinum',
        defaults={
            'name': 'Platinum',
            'price': 4999.00,
            'duration': '6 Months',
            'features': ['Unlimited views', 'Priority support'],
            'duration_days': 180,
            'is_active': True,
        }
    )
    return plan

def test_manual_membership_request_endpoint_is_removed(authenticated_client, member, plan):
    client = authenticated_client(member)
    response = client.post(
        '/api/v1/memberships/request/',
        {'plan_slug': 'platinum'},
        format='json'
    )
    assert response.status_code == 404


def test_free_member_cannot_view_received_interests(authenticated_client, member, other_member):
    Interest.objects.create(sender=other_member, receiver=member)

    response = authenticated_client(member).get('/api/v1/interests/?type=incoming')

    assert response.status_code == 403
    assert response.data['error'] == 'ENTITLEMENT_DENIED'
    assert response.data['entitlement'] == 'can_view_received_interests'


def test_paid_member_can_view_received_interests(authenticated_client, member, other_member):
    plan = MembershipPlan.objects.create(
        name='Gold', slug='gold-received-interests', price=4999,
        duration='3 Months', duration_days=90, features=[],
        can_view_received_interests=True,
    )
    MemberMembership.objects.create(
        member=member, plan=plan, status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True, started_at=timezone.now(), expires_at=timezone.now() + timedelta(days=90),
    )
    Interest.objects.create(sender=other_member, receiver=member)

    response = authenticated_client(member).get('/api/v1/interests/?type=incoming')

    assert response.status_code == 200
    assert len(response.data['data']) == 1

def test_manual_membership_admin_queue_is_removed(authenticated_client, admin_account, member, plan):
    # Setup a pending request
    req = MembershipRequest.objects.create(
        user=member,
        selected_plan=plan,
        status='pending'
    )
    
    client = authenticated_client(admin_account)
    response = client.get('/api/v1/admin/membership-requests/')
    assert response.status_code == 404

def test_admin_cannot_approve_membership_requests(authenticated_client, admin_account, member, plan):
    # Setup pending request
    req = MembershipRequest.objects.create(
        user=member,
        selected_plan=plan,
        status='pending'
    )
    
    client = authenticated_client(admin_account)
    response = client.patch(
        f'/api/v1/admin/membership-requests/{req.pk}/',
        {'action': 'approve'},
        format='json'
    )
    assert response.status_code == 404
    req.refresh_from_db()
    assert req.status == 'pending'

def test_admin_cannot_reject_membership_requests(authenticated_client, admin_account, member, plan):
    req = MembershipRequest.objects.create(
        user=member,
        selected_plan=plan,
        status='pending'
    )
    
    client = authenticated_client(admin_account)
    response = client.patch(
        f'/api/v1/admin/membership-requests/{req.pk}/',
        {'action': 'reject', 'rejection_reason': 'Invalid documentation'},
        format='json'
    )
    assert response.status_code == 404
    
    req.refresh_from_db()
    assert req.status == 'pending'

def test_admin_direct_membership_override(authenticated_client, admin_account, member, plan):
    client = authenticated_client(admin_account)
    
    # Direct activate plan
    response = client.post(
        '/api/v1/admin/memberships/direct/',
        {
            'user_id': str(member.pk),
            'plan_slug': 'platinum',
            'action': 'activate',
            'duration_days': 60
        },
        format='json'
    )
    assert response.status_code == 200, response.data
    
    member.refresh_from_db()
    assert member.is_premium is True
    membership = MemberMembership.objects.get(member=member, is_active=True)
    assert membership.plan == plan
    
    # Direct extend plan
    response_ext = client.post(
        '/api/v1/admin/memberships/direct/',
        {
            'user_id': str(member.pk),
            'action': 'extend',
            'duration_days': 30
        },
        format='json'
    )
    assert response_ext.status_code == 200, response_ext.data
    membership.refresh_from_db()
    delta = membership.end_date - timezone.now()
    assert 88 <= delta.days <= 91
    
    # Direct cancel plan
    response_cancel = client.post(
        '/api/v1/admin/memberships/direct/',
        {
            'user_id': str(member.pk),
            'action': 'cancel'
        },
        format='json'
    )
    assert response_cancel.status_code == 200, response_cancel.data
    
    member.refresh_from_db()
    assert member.is_premium is False
    assert MemberMembership.objects.filter(member=member, is_active=True).exists() is False
