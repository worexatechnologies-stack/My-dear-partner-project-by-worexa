import json
from unittest.mock import patch

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase, override_settings

from apps.accounts.models import (
    AccountType,
    Admin,
    AdminRole,
    Member,
    SuperAdmin,
    Staff,
)

from .consumers import NotificationConsumer
from .services import send_realtime_event

IN_MEMORY_CHANNEL_LAYER = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}


def make_member(**kwargs):
    defaults = dict(
        email="member@example.com",
        first_name="Test",
        last_name="Member",
        is_active=True,
    )
    defaults.update(kwargs)
    return Member.objects.create(**defaults)


def make_super_admin(**kwargs):
    role, _ = AdminRole.objects.get_or_create(code=AccountType.SUPER_ADMIN, defaults={'name': 'Super Admin', 'permissions': []})
    defaults = dict(
        email="superadmin@example.com",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        role=role,
    )
    defaults.update(kwargs)
    return SuperAdmin.objects.create(**defaults)


def make_admin(**kwargs):
    role, _ = AdminRole.objects.get_or_create(code=AccountType.ADMIN, defaults={'name': 'Admin', 'permissions': []})
    defaults = dict(
        email="admin@example.com",
        first_name="Test",
        last_name="Admin",
        is_active=True,
        role=role,
    )
    defaults.update(kwargs)
    return Admin.objects.create(**defaults)


def make_staff(**kwargs):
    # Operational staff share the ADMIN authentication scope; STAFF is not a
    # standalone AccountType in the current account model.
    role, _ = AdminRole.objects.get_or_create(code=AccountType.ADMIN, defaults={'name': 'Admin', 'permissions': []})
    defaults = dict(
        email="staff@example.com",
        first_name="Test",
        last_name="Staff",
        is_active=True,
        role=role,
    )
    defaults.update(kwargs)
    return Staff.objects.create(**defaults)


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
class NotificationConsumerTests(TestCase):
    """Test suite for the unified NotificationConsumer."""

    async def _connect(self, user):
        communicator = WebsocketCommunicator(
            NotificationConsumer.as_asgi(),
            "/ws/notifications/",
        )
        communicator.scope["user"] = user
        communicator.scope["query_string"] = b""
        connected, _ = await communicator.connect()
        return communicator, connected

    async def test_authenticated_member_connects(self):
        member = await database_sync_to_async(make_member)()
        comm, connected = await self._connect(member)
        self.assertTrue(connected)
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "connection.established")
        self.assertEqual(response["data"]["role"], "MEMBER")
        await comm.disconnect()

    async def test_authenticated_super_admin_connects(self):
        admin = await database_sync_to_async(make_super_admin)()
        comm, connected = await self._connect(admin)
        self.assertTrue(connected)
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "connection.established")
        self.assertEqual(response["data"]["role"], "SUPER_ADMIN")
        await comm.disconnect()

    async def test_authenticated_admin_connects(self):
        admin = await database_sync_to_async(make_admin)()
        comm, connected = await self._connect(admin)
        self.assertTrue(connected)
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "connection.established")
        self.assertEqual(response["data"]["role"], "ADMIN")
        await comm.disconnect()

    async def test_authenticated_staff_connects(self):
        staff = await database_sync_to_async(make_staff)()
        with patch('apps.notifications.consumers.logger.exception') as log_exception:
            comm, connected = await self._connect(staff)
            self.assertTrue(connected)
            response = await comm.receive_json_from()
            self.assertEqual(response["type"], "connection.established")
            self.assertEqual(response["data"]["role"], "ADMIN")
            await comm.disconnect()
        log_exception.assert_not_called()

    async def test_anonymous_user_rejected(self):
        comm, connected = await self._connect(AnonymousUser())
        self.assertFalse(connected)
        await comm.disconnect()

    async def test_missing_user_rejected(self):
        comm = WebsocketCommunicator(
            NotificationConsumer.as_asgi(),
            "/ws/notifications/",
        )
        comm.scope["user"] = None
        comm.scope["query_string"] = b""
        connected, _ = await comm.connect()
        self.assertFalse(connected)
        await comm.disconnect()

    async def test_inactive_user_rejected(self):
        member = await database_sync_to_async(make_member)(is_active=False)
        comm, connected = await self._connect(member)
        self.assertFalse(connected)
        await comm.disconnect()

    async def test_member_receives_personal_event(self):
        member = await database_sync_to_async(make_member)()
        comm, connected = await self._connect(member)
        self.assertTrue(connected)
        await comm.receive_json_from()

        send_realtime_event(
            groups=[f"user_{member.pk}"],
            event_type="verification.approved",
            entity="profile_verification",
            entity_id=member.pk,
            message="Profile approved",
            data={"status": "approved"},
        )

        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "verification.approved")
        self.assertEqual(response["entity"], "profile_verification")
        await comm.disconnect()

    async def test_admin_receives_role_event(self):
        admin = await database_sync_to_async(make_admin)()
        comm, connected = await self._connect(admin)
        self.assertTrue(connected)
        await comm.receive_json_from()

        send_realtime_event(
            groups=["role_admin"],
            event_type="verification.submitted",
            entity="verification",
            entity_id="test-123",
            message="New verification submitted",
            data={"status": "pending"},
        )

        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "verification.submitted")
        await comm.disconnect()

    async def test_member_does_not_receive_admin_event(self):
        member = await database_sync_to_async(make_member)()
        admin = await database_sync_to_async(make_admin)()

        member_comm, _ = await self._connect(member)
        await member_comm.receive_json_from()

        admin_comm, _ = await self._connect(admin)
        await admin_comm.receive_json_from()

        send_realtime_event(
            groups=["role_admin"],
            event_type="admin.secret",
            entity="admin",
            entity_id="test",
            message="Admin only",
            data={},
        )

        try:
            await member_comm.receive_json_from(timeout=0.2)
        except (Exception, BaseException):
            pass

        try:
            await member_comm.disconnect()
        except (Exception, BaseException):
            pass
        try:
            await admin_comm.disconnect()
        except (Exception, BaseException):
            pass

    async def test_disconnect_removes_groups(self):
        member = await database_sync_to_async(make_member)()
        comm, connected = await self._connect(member)
        self.assertTrue(connected)
        await comm.receive_json_from()

        user_group = f"user_{member.pk}"
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            user_group,
            {
                "type": "notification_message",
                "payload": {
                    "type": "test.event",
                    "entity": "test",
                    "entity_id": "1",
                    "message": "Before disconnect",
                    "data": {},
                    "timestamp": "2026-01-01T00:00:00Z",
                },
            },
        )
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "test.event")

        await comm.disconnect()

        await channel_layer.group_send(
            user_group,
            {
                "type": "notification_message",
                "payload": {
                    "type": "test.after",
                    "entity": "test",
                    "entity_id": "2",
                    "message": "After disconnect",
                    "data": {},
                    "timestamp": "2026-01-01T00:00:00Z",
                },
            },
        )

        with self.assertRaises(Exception):
            await comm.receive_json_from(timeout=1)


class DeviceRegistrationAndPushTests(TestCase):
    """Test suite for device registration and FCM push notification dispatch."""

    def setUp(self):
        self.member1 = make_member(email="member1@example.com")
        self.member2 = make_member(email="member2@example.com")
        from rest_framework.test import APIClient
        self.client = APIClient()

    def test_device_registration_creates_active_device(self):
        self.client.force_authenticate(user=self.member1)
        response = self.client.post(
            "/api/v1/devices/",
            {"token": "fcm_token_12345", "platform": "android"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["token"], "fcm_token_12345")
        self.assertEqual(response.data["data"]["platform"], "android")
        self.assertTrue(response.data["data"]["active"])

        from apps.notifications.models import Device
        device = Device.objects.get(token="fcm_token_12345")
        self.assertEqual(device.user, self.member1)
        self.assertTrue(device.active)

    def test_device_registration_reassigns_to_new_user_and_activates(self):
        from apps.notifications.models import Device
        Device.objects.create(
            user=self.member1,
            token="shared_fcm_token",
            platform="android",
            active=False,
        )

        self.client.force_authenticate(user=self.member2)
        response = self.client.post(
            "/api/v1/devices/",
            {"token": "shared_fcm_token", "platform": "ios"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["data"]["active"])
        self.assertEqual(response.data["data"]["platform"], "ios")

        device = Device.objects.get(token="shared_fcm_token")
        self.assertEqual(device.user, self.member2)
        self.assertTrue(device.active)
        self.assertEqual(device.platform, "ios")

    def test_device_unregistration(self):
        from apps.notifications.models import Device
        Device.objects.create(user=self.member1, token="token_to_remove", platform="android")

        self.client.force_authenticate(user=self.member1)
        # DELETE via path param
        response = self.client.delete("/api/v1/devices/token_to_remove/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Device.objects.filter(token="token_to_remove").exists())

    def test_send_chat_push_payload_and_channel(self):
        from apps.notifications.push import send_chat_push

        with patch("apps.notifications.push.firebase_app") as mock_app, \
             patch("firebase_admin.messaging.send") as mock_send:
            mock_app.return_value = object()
            mock_send.return_value = "projects/mydearpartner/messages/test_msg_id_1"

            msg_id = send_chat_push(
                device="test_device_token_abc",
                sender_name="Alice",
                message_id="msg_999",
                conversation_id="conv_888",
                sender_id="usr_1",
                receiver_id="usr_2",
                title="New message",
                body="You have a new message",
            )

            self.assertEqual(msg_id, "projects/mydearpartner/messages/test_msg_id_1")
            mock_send.assert_called_once()
            message_arg = mock_send.call_args[0][0]

            # Verify Android payload
            self.assertEqual(message_arg.android.notification.channel_id, "mdp_messages_v2")
            self.assertEqual(message_arg.android.priority, "high")

            # Verify Data payload
            self.assertEqual(message_arg.data["kind"], "message")
            self.assertEqual(message_arg.data["conversation_id"], "conv_888")
            self.assertEqual(message_arg.data["message_id"], "msg_999")
            self.assertEqual(message_arg.data["sender_id"], "usr_1")

            # Verify APNs payload
            self.assertTrue(message_arg.apns.payload.aps.mutable_content)
            self.assertEqual(message_arg.apns.payload.aps.sound, "default")
            self.assertEqual(message_arg.apns.payload.aps.badge, 1)

    def test_send_interest_push_payload_and_channel(self):
        from apps.notifications.push import send_interest_push

        with patch("apps.notifications.push.firebase_app") as mock_app, \
             patch("firebase_admin.messaging.send") as mock_send:
            mock_app.return_value = object()
            mock_send.return_value = "projects/mydearpartner/messages/test_interest_id_2"

            msg_id = send_interest_push(
                device="test_device_token_xyz",
                sender_name="Bob",
                interest_id="int_777",
                sender_id="usr_3",
                receiver_id="usr_4",
                title="New Interest",
                body="Someone sent you an interest",
            )

            self.assertEqual(msg_id, "projects/mydearpartner/messages/test_interest_id_2")
            mock_send.assert_called_once()
            message_arg = mock_send.call_args[0][0]

            # Verify Android channel
            self.assertEqual(message_arg.android.notification.channel_id, "mdp_interests_v2")
            self.assertEqual(message_arg.android.priority, "high")

            # Verify Data payload
            self.assertEqual(message_arg.data["kind"], "interest")
            self.assertEqual(message_arg.data["interest_id"], "int_777")
            self.assertEqual(message_arg.data["sender_id"], "usr_3")

    def test_unregistered_error_deletes_device(self):
        from apps.notifications.models import Device
        from apps.notifications.push import send_chat_push
        import firebase_admin.messaging as fcm

        dev = Device.objects.create(user=self.member1, token="unregistered_token_123")

        with patch("apps.notifications.push.firebase_app") as mock_app, \
             patch("firebase_admin.messaging.send") as mock_send:
            mock_app.return_value = object()
            mock_send.side_effect = fcm.UnregisteredError("App instance unregistered")

            result = send_chat_push(device=dev)
            self.assertIsNone(result)
            self.assertFalse(Device.objects.filter(token="unregistered_token_123").exists())

