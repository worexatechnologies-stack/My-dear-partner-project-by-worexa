from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import Member, MemberDocument
from apps.accounts.security import issue_account_tokens
from apps.notifications.middleware import JwtAuthMiddleware as JWTAuthMiddleware
from apps.core.models import ChatMessage, MemberMembership, MembershipPlan
from apps.core.routing import websocket_urlpatterns
from apps.profiles.models import ProfilePhoto


pytestmark = pytest.mark.django_db(transaction=True)

IN_MEMORY_CHANNEL_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def make_member(email, mobile):
    return Member.objects.create_user(
        email=email,
        mobile_number=mobile,
        password="StrongPass123!",
        first_name="Chat",
        last_name="Member",
        profile_status=Member.ProfileStatus.APPROVED,
        is_email_verified=True,
        is_mobile_verified=True,
        photo_status=Member.PhotoStatus.APPROVED,
        document_status=Member.DocumentStatus.APPROVED,
    )


def enable_chat(member, plan):
    ProfilePhoto.objects.create(
        user=member,
        image_data=b"test-main-image",
        thumbnail_data=b"test-thumbnail",
        original_filename="test_photo.webp",
        original_size_bytes=100,
        compressed_size_bytes=15,
        thumbnail_size_bytes=14,
        checksum=f"chat-photo-{member.pk}",
        is_primary=True,
        status=ProfilePhoto.Status.APPROVED,
    )
    import gzip
    MemberDocument.objects.create(
        member=member,
        document_type=MemberDocument.DocumentType.OTHER,
        custom_document_name="Government ID",
        original_file_name="test_document.pdf",
        file_data=gzip.compress(b"dummy bytes"),
        mime_type="application/pdf",
        file_size=11,
        compressed_size=len(gzip.compress(b"dummy bytes")),
        status=MemberDocument.Status.APPROVED,
    )
    MemberMembership.objects.create(
        member=member,
        plan=plan,
        end_date=timezone.now() + timedelta(days=30),
        is_active=True,
        status=MemberMembership.MembershipStatus.ACTIVE,
    )


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_chat_broadcasts_and_marks_read_with_a_receipt():
    plan = MembershipPlan.objects.create(
        name="Chat",
        slug="chat-read-receipt",
        price=1,
        duration="30 days",
        features=[],
        can_message=True,
        message_limit_daily=None,
    )
    sender = make_member("chat-sender@example.com", "9002223301")
    receiver = make_member("chat-receiver@example.com", "9002223302")
    enable_chat(sender, plan)
    enable_chat(receiver, plan)

    application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
    sender_token = issue_account_tokens(sender)["access"]
    receiver_token = issue_account_tokens(receiver)["access"]

    async def scenario():
        sender_socket = WebsocketCommunicator(
                application,
                f"/ws/chat/{receiver.pk}/",
                subprotocols=["access_token", sender_token],
        )
        receiver_socket = WebsocketCommunicator(
                application,
                f"/ws/chat/{sender.pk}/",
                subprotocols=["access_token", receiver_token],
        )
        assert (await sender_socket.connect())[0] is True
        assert (await receiver_socket.connect())[0] is True

        await sender_socket.send_json_to({"text": "Hello"})
        sent_to_sender = await sender_socket.receive_json_from()
        sent_to_receiver = await receiver_socket.receive_json_from()
        assert sent_to_sender["id"] == sent_to_receiver["id"]
        assert sent_to_receiver["text"] == "Hello"

        await receiver_socket.send_json_to(
            {"type": "read_receipt", "message_id": sent_to_receiver["id"]}
        )
        receipt_for_sender = await sender_socket.receive_json_from()
        receipt_for_receiver = await receiver_socket.receive_json_from()
        assert receipt_for_sender["type"] == "read_receipt"
        assert receipt_for_sender["message_id"] == sent_to_receiver["id"]
        assert receipt_for_receiver == receipt_for_sender
        await sender_socket.disconnect()
        await receiver_socket.disconnect()

    async_to_sync(scenario)()
    assert ChatMessage.objects.get().is_read is True


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_typing_is_published_to_the_recipient_global_realtime_socket():
    plan = MembershipPlan.objects.create(
        name="Typing",
        slug="chat-typing-realtime",
        price=1,
        duration="30 days",
        features=[],
        can_message=True,
        message_limit_daily=None,
    )
    sender = make_member("typing-sender@example.com", "9002223303")
    receiver = make_member("typing-receiver@example.com", "9002223304")
    enable_chat(sender, plan)
    enable_chat(receiver, plan)

    application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
    sender_token = issue_account_tokens(sender)["access"]
    receiver_token = issue_account_tokens(receiver)["access"]

    async def scenario():
        sender_chat = WebsocketCommunicator(
            application,
            f"/ws/chat/{receiver.pk}/",
            subprotocols=["access_token", sender_token],
        )
        receiver_notifications = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=["access_token", receiver_token],
        )
        assert (await sender_chat.connect())[0] is True
        assert (await receiver_notifications.connect())[0] is True
        established = await receiver_notifications.receive_json_from()
        assert established["type"] == "connection.established"

        await sender_chat.send_json_to({"type": "typing", "is_typing": True})
        started = await receiver_notifications.receive_json_from()
        assert started == {
            "type": "chat.typing",
            "sender_id": str(sender.pk),
            "partner_id": str(receiver.pk),
            "is_typing": True,
        }

        await sender_chat.send_json_to({"type": "typing", "is_typing": False})
        stopped = await receiver_notifications.receive_json_from()
        assert stopped["type"] == "chat.typing"
        assert stopped["is_typing"] is False
        await sender_chat.disconnect()
        await receiver_notifications.disconnect()

    async_to_sync(scenario)()
