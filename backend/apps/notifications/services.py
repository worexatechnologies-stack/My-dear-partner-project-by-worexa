import asyncio
import logging
from datetime import datetime, timezone

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from apps.accounts.models import AccountType

logger = logging.getLogger(__name__)


def send_realtime_event(
    *,
    groups,
    event_type,
    entity,
    entity_id,
    message,
    data=None,
):
    """
    Send a real-time event to one or more channel layer groups.

    Call inside ``transaction.on_commit()`` to ensure the event is only
    sent after the database update has been committed.
    """
    channel_layer = get_channel_layer()

    if not channel_layer:
        logger.warning("No channel layer configured; event not sent: %s", event_type)
        return

    payload = {
        "type": event_type,
        "entity": entity,
        "entity_id": str(entity_id) if entity_id is not None else "",
        "message": message,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    for group_name in set(groups):
        try:
            if loop and loop.is_running():
                loop.create_task(
                    channel_layer.group_send(
                        group_name,
                        {
                            "type": "notification_message",
                            "payload": payload,
                        },
                    )
                )
            else:
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        "type": "notification_message",
                        "payload": payload,
                    },
                )
        except Exception:
            logger.exception("Failed to send event to group: %s", group_name)


def send_event_after_commit(
    *,
    groups,
    event_type,
    entity,
    entity_id,
    message,
    data=None,
):
    """
    Schedule real-time event delivery for after the current transaction
    commits.  Use this inside view / service code that is already wrapped
    in an ``atomic()`` block.
    """
    transaction.on_commit(
        lambda: send_realtime_event(
            groups=groups,
            event_type=event_type,
            entity=entity,
            entity_id=entity_id,
            message=message,
            data=data,
        )
    )


def user_personal_group(user_id):
    """Return the personal channel group name for *user_id*."""
    return f"user_{user_id}"


def role_group(account_type):
    """Return the role-based group name for *account_type*."""
    mapping = {
        AccountType.SUPER_ADMIN: "role_super_admin",
        AccountType.ADMIN: "role_admin",
        AccountType.MEMBER: "role_member",
    }
    return mapping.get(str(account_type))
