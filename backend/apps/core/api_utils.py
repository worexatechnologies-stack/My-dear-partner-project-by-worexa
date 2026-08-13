import gzip
import json
import math
from urllib import request as urllib_request
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.core.cache import cache
from django.core.paginator import EmptyPage, Paginator
from django.db import transaction
from rest_framework import status


_IPRIVATE = (
    '127.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
    '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
)


def _resolve_location(ip):
    """Resolve IP to city/country via ip-api.com with 1-hour cache."""
    if not ip:
        return None, None, None, None
    if any(ip.startswith(p) for p in _IPRIVATE) or ip == '127.0.0.1' or ip == '::1':
        return None, None, 'Local Network', ''
    cache_key = f'geoip_{ip}'
    cached = cache.get(cache_key)
    if cached:
        return cached
    try:
        req = urllib_request.Request(
            f'http://ip-api.com/json/{ip}?fields=lat,lon,city,country',
            headers={'User-Agent': 'Matiromony/1.0'},
        )
        with urllib_request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())
        if data.get('status') == 'success':
            result = (
                data.get('lat'),
                data.get('lon'),
                data.get('city', '') or '',
                data.get('country', '') or '',
            )
            cache.set(cache_key, result, 3600)
            return result
    except Exception:
        pass
    return None, None, None, None


def _json_safe(value):
    """Recursively convert non-JSON-serializable objects to strings so audit
    payloads can be stored in a JSONB column without psycopg2 raising."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value

from apps.accounts.models import (
    AccountType,
    AdminActivityLog,
    MemberActivityLog,
    SuperAdminActivityLog,
)

from .models import Notification, SupportTicketAttachment
from .responses import ApiResponse


ACTIVITY_MODELS = {
    AccountType.SUPER_ADMIN: SuperAdminActivityLog,
    AccountType.ADMIN: AdminActivityLog,
    AccountType.MEMBER: MemberActivityLog,
}



def client_ip(request):
    from apps.accounts.throttling import get_client_ip

    return get_client_ip(request)


def audit(
    request,
    actor,
    *,
    action,
    module,
    target_type='',
    target_id='',
    description='',
    old_data=None,
    new_data=None,
):
    model = ACTIVITY_MODELS.get(str(actor.account_type))
    if not model:
        return None
    ip = client_ip(request)
    lat, lon, city, country = _resolve_location(ip)
    return model.objects.create(
        actor_id=actor.pk,
        actor_name=actor.get_full_name() or actor.email or '',
        actor_role=str(actor.account_type),
        action=action,
        module=module,
        target_type=target_type,
        target_id=str(target_id or ''),
        description=description,
        old_data=_json_safe(old_data or {}),
        new_data=_json_safe(new_data or {}),
        ip_address=ip or '',
        latitude=lat,
        longitude=lon,
        city=city or '',
        country=country or '',
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000] if request and hasattr(request, 'META') else '',
    )


def create_notification(recipient, *, type, title, body, link_url='', related_object=None, priority='NORMAL'):
    """Persist a notification and publish it to the member's websocket group.

    Persistence happens first, so a disconnected browser always receives the
    notification on its next API load. Broadcasting is deliberately best
    effort; a websocket outage cannot make notification creation fail.
    """
    recipient_field = {
        AccountType.MEMBER: 'member_recipient',
        AccountType.SUPER_ADMIN: 'super_admin_recipient',
        AccountType.ADMIN: 'admin_recipient',
    }[str(recipient.account_type)]

    values = {
        recipient_field: recipient,
        'notification_type': type,
        'title': title,
        'message': body,
        'link_url': link_url,
        'priority': priority,
    }
    if related_object is not None:
        values['related_object_type'] = related_object._meta.label_lower
        values['related_object_id'] = str(related_object.pk)
    notification = Notification.objects.create(**values)
    # Publish only after the database transaction commits. A recipient can
    # then open the notification immediately from any live socket and never
    # receive an event for a row that later rolls back.
    transaction.on_commit(lambda: broadcast_notification(notification))
    return notification


def notify_chat_message(recipient, sender, text, message):
    """Persist ONE CHAT_MESSAGE notification per conversation instead of one
    per message so the notification bell does not flood (e.g. 10 messages from
    the same member no longer create 10 bell alerts).

    A new row is created only when there is no unread CHAT_MESSAGE alert for
    the same sender; otherwise the existing alert is refreshed and re-bumped so
    it stays at the top of the recipient's notification list.
    """
    from django.utils import timezone

    from apps.core.models import Notification

    link_url = f'/messages?user={sender.pk}'
    title = f'New message from {sender.get_full_name() or "Member"}'
    body = str(text or '')[:100]

    existing = (
        Notification.objects.filter(
            member_recipient=recipient,
            notification_type='CHAT_MESSAGE',
            link_url=link_url,
            is_read=False,
        )
        .order_by('-created_at')
        .first()
    )

    if existing is not None:
        existing.title = title
        existing.message = body
        existing.related_object_type = message._meta.label_lower
        existing.related_object_id = str(message.pk)
        existing.created_at = timezone.now()
        existing.save(update_fields=(
            'title', 'message', 'related_object_type', 'related_object_id', 'created_at',
        ))
        notification = existing
        transaction.on_commit(lambda n=notification: broadcast_notification(n))
        return notification

    return create_notification(
        recipient,
        type='CHAT_MESSAGE',
        title=title,
        body=body,
        link_url=link_url,
        related_object=message,
        priority='HIGH',
    )


def broadcast_notification(notification):
    """Realtime delivery for every persisted notification across all user roles."""
    recipient_id = (
        notification.member_recipient_id
        or notification.super_admin_recipient_id
        or notification.admin_recipient_id
        or notification.staff_recipient_id
    )
    if not recipient_id:
        return

    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        payload = {
            "type": "notification.created",
            "id": str(notification.pk),
            "notification_type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "link_url": notification.link_url,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat(),
            "priority": notification.priority,
        }

        # Unified group delivery for NotificationConsumer
        async_to_sync(channel_layer.group_send)(
            f"user_{recipient_id}",
            {
                "type": "notification_message",
                "payload": payload,
            },
        )

        # Legacy group delivery for legacy sockets
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient_id}",
            {
                "type": "notification_created",
                "notification": payload,
            },
        )
    except Exception:
        # Persistence is the delivery guarantee; a realtime outage is not.
        pass


def notify(recipient, *, notification_type, title, message, link_url='', related_object=None, priority='NORMAL'):
    """Backward-compatible wrapper for legacy callers."""
    return create_notification(
        recipient,
        type=notification_type,
        title=title,
        body=message,
        link_url=link_url,
        related_object=related_object,
        priority=priority,
    )


def paginated_response(request, queryset, serializer_class, *, context=None, message='Request completed successfully.'):
    try:
        requested_size = int(request.query_params.get('page_size', 10))
    except (TypeError, ValueError):
        requested_size = 10
    page_size = max(1, min(requested_size, 100))
    try:
        page_number = int(request.query_params.get('page', 1))
    except (TypeError, ValueError):
        page_number = 1
    paginator = Paginator(queryset, page_size)
    try:
        page = paginator.page(max(1, page_number))
    except EmptyPage:
        page = paginator.page(paginator.num_pages or 1)
    serializer_context = {'request': request}
    serializer_context.update(context or {})
    data = serializer_class(page.object_list, many=True, context=serializer_context).data
    payload = {
        'count': paginator.count,
        'page': page.number,
        'page_size': page_size,
        'num_pages': max(1, math.ceil(paginator.count / page_size)),
        'next': page.next_page_number() if page.has_next() else None,
        'previous': page.previous_page_number() if page.has_previous() else None,
        'results': data,
    }
    return ApiResponse(data=payload, message=message)


def create_ticket_attachment(*, ticket, upload, member=None, admin=None, super_admin=None, reply=None):
    raw_data = upload.read()
    compressed_data = gzip.compress(raw_data)
    return SupportTicketAttachment.objects.create(
        ticket=ticket,
        reply=reply,
        uploaded_by_member=member,
        uploaded_by_admin=admin,
        uploaded_by_super_admin=super_admin,
        file_bytes=compressed_data,
        compression='gzip',
        original_filename=upload.name[:255],
        mime_type=(getattr(upload, 'content_type', '') or 'application/octet-stream')[:100],
        file_size=upload.size,
    )


def bad_request(message, *, errors=None):
    return ApiResponse(
        success=False,
        message=message,
        errors=errors,
        status=status.HTTP_400_BAD_REQUEST,
    )
