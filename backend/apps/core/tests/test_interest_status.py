from datetime import timedelta

import pytest
from django.utils import timezone

from apps.core.entitlement_service import MembershipEntitlementService
from apps.core.models import ChatMessage, Interest, MatchClosure, MemberMembership, MembershipPlan
from apps.core.services.profile_service import ProfileService


pytestmark = pytest.mark.django_db


def _activate_chat_membership(member, messaging_mode='ENABLED'):
    plan = MembershipPlan.objects.create(
        name=f'Chat {member.pk}',
        slug=f'chat-{str(member.pk).replace("-", "")[:16]}',
        price=999,
        duration='30 Days',
        features=[],
        can_message=True,
        can_view_contact=True,
        contact_access_mode='FULL',
        messaging_mode=messaging_mode,
        entitlements={
            'can_chat': True,
            'can_view_contact_details': True,
            'contact_access_mode': 'FULL',
        },
    )
    MemberMembership.objects.create(
        member=member,
        plan=plan,
        status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True,
        start_date=timezone.now(),
        end_date=timezone.now() + timedelta(days=30),
    )


def test_receiver_can_remove_an_accepted_interest_and_reopen_it(authenticated_client, member, other_member):
    interest = Interest.objects.create(
        sender=other_member,
        receiver=member,
        status=Interest.Status.ACCEPTED,
    )

    response = authenticated_client(member).patch(
        f'/api/v1/interests/{interest.pk}/',
        {'status': Interest.Status.DECLINED},
        format='json',
    )

    assert response.status_code == 200, response.data
    interest.refresh_from_db()
    assert interest.status == Interest.Status.DECLINED
    closure = MatchClosure.objects.get(interest=interest)
    assert closure.closed_by_id == member.pk

    reopened = authenticated_client(member).patch(
        f'/api/v1/interests/{interest.pk}/',
        {'status': Interest.Status.ACCEPTED},
        format='json',
    )

    assert reopened.status_code == 200, reopened.data
    interest.refresh_from_db()
    assert interest.status == Interest.Status.ACCEPTED
    assert not MatchClosure.objects.filter(interest=interest).exists()


def test_sender_can_remove_an_accepted_match_and_close_chat_access(authenticated_client, member, other_member):
    _activate_chat_membership(member)
    other_member.profile_status = other_member.ProfileStatus.APPROVED
    other_member.save(update_fields=('profile_status',))
    interest = Interest.objects.create(
        sender=member,
        receiver=other_member,
        status=Interest.Status.ACCEPTED,
    )
    ChatMessage.objects.create(sender=member, receiver=other_member, text='Private history')
    client = authenticated_client(member)

    allowed, reason = MembershipEntitlementService.can_connect_chat(member, other_member)
    assert allowed, reason

    removed = client.delete(f'/api/v1/interests/{interest.pk}/')

    assert removed.status_code == 200, removed.data
    interest.refresh_from_db()
    assert interest.status == Interest.Status.WITHDRAWN
    assert MatchClosure.objects.filter(interest=interest, closed_by=member).exists()

    allowed, reason = MembershipEntitlementService.can_connect_chat(member, other_member)
    assert not allowed
    assert reason == 'match_removed'
    contact_allowed, contact_mode = MembershipEntitlementService.can_view_contact(member, other_member)
    assert not contact_allowed
    assert contact_mode == 'NONE'

    conversations = client.get('/api/v1/conversations/')
    assert conversations.status_code == 200, conversations.data
    conversation_rows = conversations.data.get('data', conversations.data)
    assert str(other_member.pk) not in {row['partner_id'] for row in conversation_rows}

    history = client.get(f'/api/v1/conversations/{other_member.pk}/messages/')
    assert history.status_code == 403, history.data
    assert history.data['code'] == 'match_removed'


def test_accepted_match_is_searchable_and_can_start_a_first_message(authenticated_client, member, other_member):
    _activate_chat_membership(member, messaging_mode='MUTUAL_ONLY')
    other_member.profile_status = other_member.ProfileStatus.APPROVED
    other_member.save(update_fields=('profile_status',))
    Interest.objects.create(
        sender=member,
        receiver=other_member,
        status=Interest.Status.ACCEPTED,
    )
    client = authenticated_client(member)

    conversations = client.get('/api/v1/conversations/')

    assert conversations.status_code == 200, conversations.data
    rows = conversations.data['data']
    row = next(row for row in rows if row['partner_id'] == str(other_member.pk))
    assert row['lastMessage'] == ''
    assert row['unread'] == 0
    assert row['profile']['id'] == str(other_member.pk)

    history = client.get(f'/api/v1/conversations/{other_member.pk}/messages/')
    assert history.status_code == 200, history.data
    assert history.data['data']['messages'] == []

    sent = client.post(
        f'/api/v1/conversations/{other_member.pk}/messages/',
        {'text': 'Hello, it is nice to connect.'},
        format='json',
    )
    assert sent.status_code == 201, sent.data
    assert sent.data['data']['text'] == 'Hello, it is nice to connect.'


def test_profile_message_access_uses_the_same_trial_entitlement_as_chat(member, other_member):
    other_member.profile_status = other_member.ProfileStatus.APPROVED
    other_member.save(update_fields=('profile_status',))

    expected = MembershipEntitlementService.can_connect_chat(member, other_member)

    assert expected[0] is True
    assert ProfileService.can_message(member, other_member) == expected
