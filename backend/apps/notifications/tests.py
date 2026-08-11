import json

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
    role, _ = AdminRole.objects.get_or_create(code=AccountType.STAFF, defaults={'name': 'Staff', 'permissions': []})
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
        comm, connected = await self._connect(staff)
        self.assertTrue(connected)
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "connection.established")
        self.assertEqual(response["data"]["role"], "STAFF")
        await comm.disconnect()

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
