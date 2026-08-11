from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import override_settings
from django.utils import timezone

from apps.accounts.security import issue_account_tokens
from apps.notifications.middleware import JwtAuthMiddleware as JWTAuthMiddleware
from apps.core.models import ChatMessage, MemberMembership, MembershipPlan
from apps.core.routing import websocket_urlpatterns


pytestmark = pytest.mark.django_db

IN_MEMORY_CHANNEL_LAYER = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
}


def test_members_cannot_activate_paid_plans_directly(authenticated_client, member):
    response = authenticated_client(member).post(
        '/api/v1/member-auth/membership/activate/',
        {'plan_slug': 'gold'},
        format='json',
    )

    assert response.status_code == 404


def test_super_admin_can_grant_an_active_plan_to_a_member(
    authenticated_client, super_admin, member
):
    plan = MembershipPlan.objects.create(
        name='Grantable plan',
        slug='grantable-plan',
        price=1,
        duration='30 days',
        duration_days=30,
        features=[],
        is_active=True,
        can_message=True,
        entitlements={'can_chat': True},
    )

    response = authenticated_client(super_admin).post(
        f'/api/v1/admin/users/{member.pk}/grant-membership/',
        {'plan_slug': plan.slug, 'duration_months': 6},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['data']['plan_name'] == plan.name
    granted = MemberMembership.objects.get(member=member, is_active=True)
    assert granted.plan_id == plan.pk
    assert granted.status == MemberMembership.MembershipStatus.ACTIVE


@override_settings(ENABLE_ADMIN_PORTAL=False)
def test_paused_admin_portal_returns_not_found(authenticated_client, member):
    client = authenticated_client(member)

    assert client.get('/api/v1/admin/dashboard/').status_code == 404
    assert client.get('/api/v1/admin-auth/login/').status_code == 404
    assert client.get('/django-admin/').status_code == 404


@override_settings(
    REQUIRE_MEMBER_VERIFICATION=False,
    CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER,
)
@pytest.mark.django_db(transaction=True)
def test_unverified_members_can_use_the_authenticated_chat_socket(member, other_member):
    plan = MembershipPlan.objects.create(
        name='Chat',
        slug='chat-rollout-test',
        price=1,
        duration='30 days',
        duration_days=30,
        features=[],
        can_message=True,
    )
    MemberMembership.objects.create(
        member=member,
        plan=plan,
        start_date=timezone.now(),
        end_date=timezone.now() + timedelta(days=30),
        is_active=True,
        status=MemberMembership.MembershipStatus.ACTIVE,
    )
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, negotiated_protocol = await communicator.connect()
        assert connected is True
        assert negotiated_protocol == 'access_token'
        await communicator.send_json_to({'text': 'Socket chat is live'})
        message = await communicator.receive_json_from()
        assert message['text'] == 'Socket chat is live'
        assert message['receiver_id'] == str(other_member.pk)
        await communicator.disconnect()

    async_to_sync(scenario)()
    assert ChatMessage.objects.filter(
        sender=member,
        receiver=other_member,
        text='Socket chat is live',
    ).exists()
