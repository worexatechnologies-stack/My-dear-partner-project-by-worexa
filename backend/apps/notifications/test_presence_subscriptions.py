import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import override_settings

from apps.accounts.models import Member
from apps.accounts import presence
from apps.core.models import Interest
from apps.notifications.consumers import NotificationConsumer


pytestmark = pytest.mark.django_db(transaction=True)

IN_MEMORY_CHANNEL_LAYER = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}


def make_member(email):
    return Member.objects.create(
        email=email,
        first_name="Presence",
        last_name="Member",
        is_active=True,
    )


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_presence_subscription_only_receives_accepted_unblocked_matches():
    viewer = make_member("presence-viewer@example.com")
    match = make_member("presence-match@example.com")
    unrelated = make_member("presence-unrelated@example.com")
    Interest.objects.create(
        sender=viewer,
        receiver=match,
        status=Interest.Status.ACCEPTED,
    )

    async def scenario():
        communicator = WebsocketCommunicator(
            NotificationConsumer.as_asgi(),
            "/ws/notifications/",
        )
        communicator.scope["user"] = viewer
        communicator.scope["query_string"] = b""
        connected, _ = await communicator.connect()
        assert connected is True
        assert (await communicator.receive_json_from())["type"] == "connection.established"

        await communicator.send_json_to({
            "type": "presence.subscribe",
            "user_ids": [str(match.pk), str(unrelated.pk)],
        })
        snapshot = await communicator.receive_json_from()
        assert snapshot["type"] == "presence.snapshot"
        assert str(match.pk) in snapshot["data"]["statuses"]
        assert str(unrelated.pk) not in snapshot["data"]["statuses"]

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"presence_{match.pk}",
            {
                "type": "presence_changed",
                "payload": {
                    "type": "presence.changed",
                    "user_id": str(match.pk),
                    "status": "ONLINE",
                },
            },
        )
        change = await communicator.receive_json_from()
        assert change["type"] == "presence.changed"
        assert change["user_id"] == str(match.pk)

        await communicator.disconnect()

    async_to_sync(scenario)()


def test_presence_heartbeat_refreshes_the_live_connection_counter(monkeypatch):
    class FakeCache:
        def __init__(self):
            self.values = {"presence:user:member-1:count": 1}
            self.touched = []
            self.set_calls = []

        def touch(self, key, timeout):
            self.touched.append((key, timeout))
            return key in self.values

        def get(self, key):
            return self.values.get(key)

        def set(self, key, value, timeout=None):
            self.values[key] = value
            self.set_calls.append((key, value, timeout))

    cache = FakeCache()
    monkeypatch.setattr(presence, "_cache", lambda: cache)

    assert presence.refresh_connection("member-1", "connection-1") is True
    assert cache.touched == [
        ("presence:user:member-1:count", int(presence.PRESENCE_TTL.total_seconds())),
    ]
    assert cache.values["presence:user:member-1:expires_at"] > 0
