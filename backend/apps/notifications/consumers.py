import json
import logging
import uuid

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.utils import timezone

from apps.accounts.models import AccountType
from apps.accounts import presence
from apps.accounts.presence_access import authorized_presence_member_ids

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    Unified WebSocket consumer for real-time notifications.

    Supports members and administrative accounts. Operational staff use the
    ADMIN authentication scope, which keeps staff events permission-gated by
    their assigned administrative role.

    Channels are registered in role-based groups for permission-aware
    event delivery and a personal group (user_{id}) for private events.
    """

    async def connect(self):
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        if not user.is_active or getattr(user, "deleted_at", None) is not None:
            await self.close(code=4403)
            return

        account_type = await self._get_account_type()

        if not account_type:
            await self.close(code=4403)
            return

        self.account_type = account_type
        self.account_id = str(user.pk)
        self.connection_id = str(uuid.uuid4())
        self.joined_groups = []
        self.presence_groups = []

        # Register this connection in Redis presence (TTL-backed). Run in a
        # thread so the sync Redis client does not block the event loop.
        await database_sync_to_async(presence.mark_online)(
            self.account_id, self.connection_id
        )
        await self._persist_last_seen(self.account_id)
        await self._emit_presence_changed("ONLINE")

        personal_group = f"user_{self.account_id}"
        self.joined_groups.append(personal_group)
        await self.channel_layer.group_add(personal_group, self.channel_name)

        role_group = self._role_group(account_type)
        if role_group:
            self.joined_groups.append(role_group)
            await self.channel_layer.group_add(role_group, self.channel_name)

        await self.accept(subprotocol=self.scope.get("jwt_subprotocol"))

        await self.send_json({
            "type": "connection.established",
            "message": "Real-time connection established",
            "data": {
                "user_id": self.account_id,
                "role": account_type,
            },
        })

        if settings.DEBUG:
            logger.info(
                "WS connected: user=%s type=%s groups=%s",
                self.account_id,
                account_type,
                self.joined_groups,
            )

    async def disconnect(self, close_code):
        for group_name in getattr(self, "presence_groups", []):
            await self.channel_layer.group_discard(group_name, self.channel_name)
        for group_name in getattr(self, "joined_groups", []):
            await self.channel_layer.group_discard(group_name, self.channel_name)

        user_id = getattr(self, "account_id", None)
        if user_id:
            await database_sync_to_async(presence.mark_offline)(
                user_id, self.connection_id
            )
            # Only mark OFFLINE + persist last_seen if this was the user's last
            # live connection. Presence is Redis-only; last_seen is durable but
            # written sparingly to avoid database write pressure.
            still_online = await database_sync_to_async(presence.is_online)(user_id)
            if not still_online:
                await self._emit_presence_changed("OFFLINE")
                await self._persist_last_seen(user_id)

        if settings.DEBUG:
            logger.info(
                "WS disconnected: user=%s code=%s",
                user_id,
                close_code,
            )

    async def receive_json(self, content):
        msg_type = content.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
        elif msg_type in ("presence.ping", "heartbeat"):
            # Refresh this connection's TTL without touching the database.
            user_id = getattr(self, "account_id", None)
            if user_id:
                await database_sync_to_async(presence.refresh_connection)(
                    user_id, self.connection_id
                )
                await self.send_json({"type": "presence.pong"})
        elif msg_type == "presence.subscribe":
            await self._replace_presence_subscriptions(content.get("user_ids"))

    async def notification_message(self, event):
        payload = event.get("payload", event)
        await self.send_json(payload)

    async def presence_changed(self, event):
        """Deliver a targeted presence.changed event to this socket."""
        await self.send_json(event.get("payload", event))

    async def _emit_presence_changed(self, status_value):
        user_id = getattr(self, "account_id", None)
        if not user_id or not self.channel_layer:
            return
        payload = {
            "type": "presence.changed",
            "user_id": user_id,
            "status": status_value,
            "timestamp": timezone.now().isoformat(),
        }
        # A member's own personal socket can update local state, while the
        # private presence group is joined only after a server-side match and
        # block-list authorization check.
        try:
            for group_name in (f"user_{user_id}", f"presence_{user_id}"):
                await self.channel_layer.group_send(
                    group_name,
                    {"type": "presence_changed", "payload": payload},
                )
        except Exception:
            logger.exception("Failed to emit presence.changed for user=%s", user_id)

    async def _replace_presence_subscriptions(self, raw_ids):
        """Subscribe this socket to relationship-authorized presence events."""
        user_ids = await self._authorized_presence_ids(raw_ids)
        next_groups = [f"presence_{user_id}" for user_id in user_ids]
        for group_name in self.presence_groups:
            if group_name not in next_groups:
                await self.channel_layer.group_discard(group_name, self.channel_name)
        for group_name in next_groups:
            if group_name not in self.presence_groups:
                await self.channel_layer.group_add(group_name, self.channel_name)
        self.presence_groups = next_groups

        statuses = await database_sync_to_async(presence.get_bulk_status)(user_ids)
        last_seen_at = await database_sync_to_async(presence.get_last_seen_map)(user_ids)
        await self.send_json({
            "type": "presence.snapshot",
            "data": {
                "statuses": statuses,
                "last_seen_at": last_seen_at,
            },
        })

    @database_sync_to_async
    def _authorized_presence_ids(self, raw_ids):
        return authorized_presence_member_ids(self.scope.get("user"), raw_ids)

    @database_sync_to_async
    def _persist_last_seen(self, user_id):
        from django.db import transaction

        from apps.accounts.models import (
            AccountType,
            Admin,
            Member,
            Staff,
            SuperAdmin,
        )

        # BaseAccount is abstract, so persist on the concrete account model.
        # Operational staff share ADMIN's token scope but live in their own
        # table, which must be used for durable last-seen updates.
        scoped_user = self.scope.get("user")
        if isinstance(scoped_user, (Member, SuperAdmin, Admin, Staff)):
            model = scoped_user.__class__
        else:
            model = None
        model_for_type = {
            AccountType.MEMBER: Member,
            AccountType.SUPER_ADMIN: SuperAdmin,
            AccountType.ADMIN: Admin,
        }
        model = model or model_for_type.get(self.account_type)
        if model is None:
            return

        try:
            with transaction.atomic():
                account = model.objects.select_for_update().get(pk=user_id)
                now = timezone.now()
                previous = account.last_seen_at
                # Throttle writes: only update if older than the throttle window.
                if previous is None or (now - previous).total_seconds() >= 120:
                    account.last_seen_at = now
                    account.save(update_fields=("last_seen_at", "updated_at"))
        except Exception:
            logger.exception("Failed to persist last_seen for user=%s", user_id)

    def _role_group(self, account_type):
        mapping = {
            AccountType.SUPER_ADMIN: "role_super_admin",
            AccountType.ADMIN: "role_admin",
            AccountType.MEMBER: "role_member",
        }
        return mapping.get(str(account_type))

    @database_sync_to_async
    def _get_account_type(self):
        user = self.scope.get("user")
        if not user:
            return None

        if hasattr(user, "account_type"):
            account_type = user.account_type
            if account_type and str(account_type) in AccountType.values:
                return str(account_type)

        return None
