from datetime import timedelta

import gzip
import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import Member
from apps.accounts.security import issue_account_tokens
from apps.core.consumers import (
    CLOSE_INVALID_PAYLOAD,
    CLOSE_MESSAGING_NOT_ALLOWED,
    CLOSE_PARTNER_UNAVAILABLE,
    CLOSE_PAYLOAD_TOO_LARGE,
    CLOSE_UNAUTHENTICATED,
    MAX_CHAT_PAYLOAD_BYTES,
)
from apps.notifications.middleware import JwtAuthMiddleware as JWTAuthMiddleware, token_from_subprotocols
from apps.core.models import ChatMessage, MemberMembership, MembershipPlan
from apps.core.routing import websocket_urlpatterns


pytestmark = pytest.mark.django_db(transaction=True)

IN_MEMORY_CHANNEL_LAYER = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
}


@pytest.fixture
def messaging_plan(db):
    return MembershipPlan.objects.create(
        name='Messaging',
        slug='messaging-test',
        price=1,
        duration='30 days',
        duration_days=30,
        features=[],
        can_message=True,
    )


def enable_messaging(member, messaging_plan):
    MemberMembership.objects.create(
        member=member,
        plan=messaging_plan,
        end_date=timezone.now() + timedelta(days=30),
        is_active=True,
        status='ACTIVE',
    )
    member.is_premium = True
    member.save(update_fields=['is_premium'])


def approve(member):
    member.profile_status = Member.ProfileStatus.APPROVED
    member.is_email_verified = True
    member.is_mobile_verified = True
    member.photo_status = Member.PhotoStatus.APPROVED
    member.document_status = Member.DocumentStatus.APPROVED
    member.save()

    from apps.accounts.models import MemberDocument
    from apps.profiles.models import ProfilePhoto
    ProfilePhoto.objects.get_or_create(
        user=member,
        is_primary=True,
        status=ProfilePhoto.Status.APPROVED,
        defaults={
            'image_data': b'test-main-image',
            'thumbnail_data': b'test-thumbnail',
            'original_filename': 'test_photo.webp',
            'original_size_bytes': 100,
            'compressed_size_bytes': 15,
            'thumbnail_size_bytes': 14,
            'checksum': f'chat-photo-{member.pk}',
        },
    )
    MemberDocument.objects.get_or_create(
        member=member,
        status=MemberDocument.Status.APPROVED,
        defaults={
            'document_type': 'AADHAAR',
            'original_file_name': 'test_doc.pdf',
            'file_data': gzip.compress(b'%PDF-1.4 test document'),
            'mime_type': 'application/pdf',
            'file_size': 18,
            'compressed_size': len(gzip.compress(b'%PDF-1.4 test document')),
        }
    )


def websocket_application():
    return JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


def test_conversation_rows_have_a_stable_partner_identifier(
    authenticated_client, member, other_member
):
    ChatMessage.objects.create(sender=other_member, receiver=member, text='Hello')

    response = authenticated_client(member).get('/api/v1/conversations/')

    assert response.status_code == 200, response.data
    row = response.data['data'][0]
    assert row['id'] == str(other_member.pk)
    assert row['partner_id'] == str(other_member.pk)
    assert row['profile']['id'] == str(other_member.pk)


def test_http_message_fallback_rejects_an_unapproved_partner(
    authenticated_client, member, other_member, messaging_plan
):
    approve(member)
    enable_messaging(member, messaging_plan)

    response = authenticated_client(member).post(
        f'/api/v1/conversations/{other_member.pk}/messages/',
        {'text': 'This must not be saved'},
        format='json',
    )

    assert response.status_code == 404
    assert ChatMessage.objects.count() == 0


def test_access_token_subprotocol_pair_is_parsed_without_using_the_url():
    token = 'header.payload.signature'
    assert token_from_subprotocols(['access_token', token]) == (token, 'access_token')
    assert token_from_subprotocols(['access_token']) == (None, 'access_token')


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_malformed_subprotocol_does_not_downgrade_to_a_query_token(member, other_member):
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/?token={access}',
            subprotocols=['access_token'],
        )
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == CLOSE_UNAUTHENTICATED
        await communicator.wait()

    async_to_sync(scenario)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_authenticates_with_access_token_subprotocol(
    member, other_member, messaging_plan
):
    approve(member)
    approve(other_member)
    enable_messaging(member, messaging_plan)
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, negotiated_protocol = await communicator.connect()
        assert connected is True
        assert negotiated_protocol == 'access_token'
        await communicator.disconnect()

    async_to_sync(scenario)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_rejects_members_without_messaging_entitlement(member, other_member):
    approve(member)
    approve(other_member)
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == CLOSE_MESSAGING_NOT_ALLOWED
        await communicator.wait()

    async_to_sync(scenario)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_rejects_an_unapproved_partner(member, other_member, messaging_plan):
    approve(member)
    enable_messaging(member, messaging_plan)
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == CLOSE_PARTNER_UNAVAILABLE
        await communicator.wait()

    async_to_sync(scenario)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_rejects_a_malformed_partner_identifier(member, messaging_plan):
    enable_messaging(member, messaging_plan)
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            '/ws/chat/bad/',
            subprotocols=['access_token', access],
        )
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == CLOSE_PARTNER_UNAVAILABLE
        await communicator.wait()

    async_to_sync(scenario)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_rechecks_partner_policy_before_persisting_message(
    member, other_member, messaging_plan
):
    approve(member)
    approve(other_member)
    enable_messaging(member, messaging_plan)
    access = issue_account_tokens(member)['access']

    async def scenario():
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, _ = await communicator.connect()
        assert connected is True

        await database_sync_to_async(Member.objects.filter(pk=other_member.pk).update)(
            profile_status=Member.ProfileStatus.REJECTED
        )
        await communicator.send_json_to({'text': 'This must not be saved'})
        output = await communicator.receive_output()
        assert output['type'] == 'websocket.close'
        assert output['code'] == CLOSE_PARTNER_UNAVAILABLE
        await communicator.wait()

    async_to_sync(scenario)()
    assert ChatMessage.objects.count() == 0


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_closes_on_malformed_or_oversized_payloads(
    member, other_member, messaging_plan
):
    approve(member)
    approve(other_member)
    enable_messaging(member, messaging_plan)
    access = issue_account_tokens(member)['access']

    async def rejected_payload(text_data, expected_code):
        communicator = WebsocketCommunicator(
            websocket_application(),
            f'/ws/chat/{other_member.pk}/',
            subprotocols=['access_token', access],
        )
        connected, _ = await communicator.connect()
        assert connected is True
        await communicator.send_to(text_data=text_data)
        output = await communicator.receive_output()
        assert output['type'] == 'websocket.close'
        assert output['code'] == expected_code
        await communicator.wait()

    async def scenario():
        await rejected_payload('{not-json', CLOSE_INVALID_PAYLOAD)
        await rejected_payload('x' * (MAX_CHAT_PAYLOAD_BYTES + 1), CLOSE_PAYLOAD_TOO_LARGE)

    async_to_sync(scenario)()
    assert ChatMessage.objects.count() == 0
