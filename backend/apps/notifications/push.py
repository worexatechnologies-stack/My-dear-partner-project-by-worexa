"""Push notification delivery service for MyDearPartner.

Supports both:
1. Web Push (VAPID / pywebpush) for desktop / mobile browsers.
2. Firebase Cloud Messaging (FCM / APNs) for iOS and Android native apps.
"""

import json
import logging
import os

from celery import shared_task
from django.conf import settings
from django.utils import timezone
import firebase_admin
from firebase_admin import credentials, exceptions, messaging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Firebase Admin SDK initialization
# ---------------------------------------------------------------------------

_firebase_initialized = False


def get_firebase_credentials():
    """Locate and load Firebase credentials from environment or secret files."""
    # 1. Inline JSON via environment variable (useful in Docker / container deployments)
    raw_json = (
        os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()
        or os.environ.get('FIREBASE_CREDENTIALS_JSON', '').strip()
    )
    if raw_json:
        try:
            if raw_json.startswith('{'):
                cred_dict = json.loads(raw_json)
            else:
                import base64
                cred_dict = json.loads(base64.b64decode(raw_json).decode('utf-8'))
            return credentials.Certificate(cred_dict)
        except Exception as exc:
            logger.warning("Failed to parse inline Firebase credentials JSON: %s", exc)

    # 2. File path candidates
    candidates = [
        getattr(settings, 'FIREBASE_SERVICE_ACCOUNT_FILE', None),
        getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None),
        os.environ.get('FIREBASE_SERVICE_ACCOUNT_FILE'),
        os.environ.get('FIREBASE_CREDENTIALS_PATH'),
        os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'),
        '/opt/mydearpartner/secrets/firebase-service-account.json',
        str(getattr(settings, 'BASE_DIR', '')) + '/secrets/firebase-service-account.json',
        str(getattr(settings, 'BASE_DIR', '')) + '/firebase-service-account.json',
    ]

    for path in candidates:
        if path and os.path.exists(path) and os.path.isfile(path):
            try:
                cred = credentials.Certificate(path)
                logger.info("Found valid Firebase credentials file at '%s'", path)
                return cred
            except Exception as exc:
                logger.warning("Failed reading Firebase credentials from '%s': %s", path, exc)

    return None


def firebase_app():
    """Initialize and return the Firebase Admin app instance."""
    global _firebase_initialized
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    cred = get_firebase_credentials()
    if not cred:
        logger.warning(
            "Firebase credentials not found. Push notifications are suspended. "
            "Please configure FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_SERVICE_ACCOUNT_JSON."
        )
        return None

    try:
        app = firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info(
            "Firebase Admin initialized successfully (project_id=%s)",
            getattr(cred, 'project_id', 'unknown'),
        )
        return app
    except Exception as exc:
        logger.exception("Failed to initialize Firebase Admin SDK: %s", exc)
        return None


def _handle_token_error(token, user_id, exc):
    """Remove invalid/unregistered token from database when Firebase rejects it."""
    is_unregistered = isinstance(exc, (messaging.UnregisteredError, exceptions.NotFoundError))
    is_invalid = isinstance(exc, exceptions.InvalidArgumentError)
    err_str = str(exc).upper()
    err_code = str(getattr(exc, 'code', '') or '').upper()

    if (
        is_unregistered
        or is_invalid
        or 'UNREGISTERED' in err_str
        or 'INVALID_ARGUMENT' in err_str
        or err_code in ('UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND')
    ):
        from apps.notifications.models import Device

        deleted_count, _ = Device.objects.filter(token=token).delete()
        logger.warning(
            "Firebase token invalid/unregistered. Removed %s device record(s) "
            "for token=%s... (recipient_user_id=%s, error=%s)",
            deleted_count,
            token[:15],
            user_id,
            exc,
        )
        return True
    return False


# ---------------------------------------------------------------------------
# Mobile FCM Push Senders (iOS + Android)
# ---------------------------------------------------------------------------

def send_chat_push(
    device,
    sender_name="Member",
    encrypted_text="",
    message_id="",
    conversation_id="",
    sender_id="",
    receiver_id="",
    title="New message",
    body="You have a new message",
):
    """Send FCM/APNs push notification for a new chat message.

    Appears in the system tray when foregrounded, backgrounded, or killed.
    Android uses channel 'mdp_messages_v2' with priority 'high'.
    iOS uses APNs priority 10, sound default, badge 1, mutable-content 1.
    """
    app = firebase_app()
    if not app:
        return None

    token = getattr(device, 'token', device)
    user_id = getattr(device, 'user_id', receiver_id)

    # Build data payload (all values must be strings)
    data = {
        "kind": "message",
        "conversation_id": str(conversation_id or ""),
        "message_id": str(message_id or ""),
        "sender_id": str(sender_id or ""),
    }
    if sender_name:
        data["sender_name"] = str(sender_name)

    # Android config
    android = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            channel_id="mdp_messages_v2",
            sound="default",
        ),
    )

    # APNs config
    apns = messaging.APNSConfig(
        headers={
            "apns-priority": "10",
        },
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                sound="default",
                badge=1,
                mutable_content=True,
            )
        ),
    )

    msg = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title=title or "New message",
            body=body or "You have a new message",
        ),
        data=data,
        android=android,
        apns=apns,
    )

    try:
        response = messaging.send(msg)
        logger.info(
            "Firebase message delivered: message_id=%s recipient_user_id=%s token=%s...",
            response,
            user_id,
            token[:15],
        )
        return response
    except Exception as exc:
        logger.error(
            "Firebase delivery error for recipient_user_id=%s token=%s...: %s",
            user_id,
            token[:15],
            exc,
        )
        _handle_token_error(token, user_id, exc)
        return None


def send_interest_push(
    device,
    sender_name="Someone",
    interest_id="",
    sender_id="",
    receiver_id="",
    title="New Interest",
    body="Someone sent you an interest",
):
    """Send FCM/APNs push notification for an interest received.

    Appears in the system tray when foregrounded, backgrounded, or killed.
    Android uses channel 'mdp_interests_v2' with priority 'high'.
    iOS uses APNs priority 10, sound default, badge 1.
    """
    app = firebase_app()
    if not app:
        return None

    token = getattr(device, 'token', device)
    user_id = getattr(device, 'user_id', receiver_id)

    # Build data payload (all values must be strings)
    data = {
        "kind": "interest",
        "interest_id": str(interest_id or ""),
        "sender_id": str(sender_id or ""),
    }
    if sender_name:
        data["sender_name"] = str(sender_name)

    # Android config
    android = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            channel_id="mdp_interests_v2",
            sound="default",
        ),
    )

    # APNs config
    apns = messaging.APNSConfig(
        headers={
            "apns-priority": "10",
        },
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                sound="default",
                badge=1,
            )
        ),
    )

    msg = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title=title or "New Interest",
            body=body or "Someone sent you an interest",
        ),
        data=data,
        android=android,
        apns=apns,
    )

    try:
        response = messaging.send(msg)
        logger.info(
            "Firebase message delivered: message_id=%s recipient_user_id=%s token=%s...",
            response,
            user_id,
            token[:15],
        )
        return response
    except Exception as exc:
        logger.error(
            "Firebase delivery error for recipient_user_id=%s token=%s...: %s",
            user_id,
            token[:15],
            exc,
        )
        _handle_token_error(token, user_id, exc)
        return None


def send_chat_push_to_user(
    recipient_user,
    sender_name="Member",
    encrypted_text="",
    message_id="",
    conversation_id="",
    sender_id="",
    title="New message",
    body="You have a new message",
):
    """Dispatch chat push notifications to all active devices of a recipient user."""
    from apps.notifications.models import Device

    recipient_id = getattr(recipient_user, 'pk', recipient_user)
    devices = list(Device.objects.filter(user=recipient_user, active=True))
    logger.info(
        "Preparing chat push dispatch: recipient_user_id=%s token_count=%d",
        recipient_id,
        len(devices),
    )
    results = []
    for dev in devices:
        res = send_chat_push(
            device=dev,
            sender_name=sender_name,
            encrypted_text=encrypted_text,
            message_id=message_id,
            conversation_id=conversation_id,
            sender_id=sender_id,
            receiver_id=recipient_id,
            title=title,
            body=body,
        )
        results.append(res)
    return results


def send_interest_push_to_user(
    recipient_user,
    sender_name="Someone",
    interest_id="",
    sender_id="",
    title="New Interest",
    body="Someone sent you an interest",
):
    """Dispatch interest push notifications to all active devices of a recipient user."""
    from apps.notifications.models import Device

    recipient_id = getattr(recipient_user, 'pk', recipient_user)
    devices = list(Device.objects.filter(user=recipient_user, active=True))
    logger.info(
        "Preparing interest push dispatch: recipient_user_id=%s token_count=%d",
        recipient_id,
        len(devices),
    )
    results = []
    for dev in devices:
        res = send_interest_push(
            device=dev,
            sender_name=sender_name,
            interest_id=interest_id,
            sender_id=sender_id,
            receiver_id=recipient_id,
            title=title,
            body=body,
        )
        results.append(res)
    return results


def send_general_push(
    device,
    title="My Dear Partner",
    body="You have a new notification",
    notification_id="",
    notification_type="GENERAL",
    link_url="/notifications",
    receiver_id="",
    channel_id="mdp_general_v2",
    priority="high",
    extra_data=None,
):
    """Send FCM/APNs push notification for general notifications, status updates, and system events.

    Android uses channel 'mdp_general_v2' (or fallback) with high priority.
    iOS uses APNs priority 10, sound default, badge 1, mutable-content 1.
    """
    app = firebase_app()
    if not app:
        return None

    token = getattr(device, 'token', device)
    user_id = getattr(device, 'user_id', receiver_id)

    data = {
        "kind": "notification",
        "notification_id": str(notification_id or ""),
        "notification_type": str(notification_type or "GENERAL"),
        "url": str(link_url or "/notifications"),
    }
    if extra_data and isinstance(extra_data, dict):
        for k, v in extra_data.items():
            if v is not None:
                data[str(k)] = str(v)

    android = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            channel_id=channel_id or "mdp_general_v2",
            sound="default",
        ),
    )

    apns = messaging.APNSConfig(
        headers={
            "apns-priority": "10",
        },
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                sound="default",
                badge=1,
                mutable_content=True,
            )
        ),
    )

    msg = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title=title or "My Dear Partner",
            body=body or "You have a new notification",
        ),
        data=data,
        android=android,
        apns=apns,
    )

    try:
        response = messaging.send(msg)
        logger.info(
            "Firebase general notification delivered: message_id=%s recipient_user_id=%s token=%s...",
            response,
            user_id,
            token[:15],
        )
        return response
    except Exception as exc:
        logger.error(
            "Firebase delivery error for recipient_user_id=%s token=%s...: %s",
            user_id,
            token[:15],
            exc,
        )
        _handle_token_error(token, user_id, exc)
        return None


def send_general_push_to_user(
    recipient_user,
    title="My Dear Partner",
    body="You have a new notification",
    notification_id="",
    notification_type="GENERAL",
    link_url="/notifications",
    channel_id="mdp_general_v2",
    extra_data=None,
):
    """Dispatch general push notification to all active devices of a recipient user."""
    from apps.notifications.models import Device

    recipient_id = getattr(recipient_user, 'pk', recipient_user)
    devices = list(Device.objects.filter(user=recipient_user, active=True))
    logger.info(
        "Preparing general push dispatch: recipient_user_id=%s token_count=%d type=%s",
        recipient_id,
        len(devices),
        notification_type,
    )
    results = []
    for dev in devices:
        res = send_general_push(
            device=dev,
            title=title,
            body=body,
            notification_id=notification_id,
            notification_type=notification_type,
            link_url=link_url,
            receiver_id=recipient_id,
            channel_id=channel_id,
            extra_data=extra_data,
        )
        results.append(res)
    return results


@shared_task(ignore_result=True, autoretry_for=(), retry_backoff=False)
def deliver_chat_push_task(
    recipient_id,
    sender_name="Member",
    encrypted_text="",
    message_id="",
    conversation_id="",
    sender_id="",
    title="New message",
    body="You have a new message",
):
    """Celery background task for mobile chat push notifications."""
    from apps.notifications.models import Device

    devices = list(Device.objects.filter(user_id=recipient_id, active=True))
    if not devices:
        return

    app = firebase_app()
    if not app:
        return

    for dev in devices:
        send_chat_push(
            device=dev,
            sender_name=sender_name,
            encrypted_text=encrypted_text,
            message_id=message_id,
            conversation_id=conversation_id,
            sender_id=sender_id,
            receiver_id=recipient_id,
            title=title,
            body=body,
        )


@shared_task(ignore_result=True, autoretry_for=(), retry_backoff=False)
def deliver_mobile_notification_push(notification_id):
    """Deliver a persisted notification to active mobile devices (iOS / Android FCM)."""
    from apps.core.models import Notification
    from apps.notifications.models import Device

    notification = (
        Notification.objects.select_related('member_recipient')
        .filter(pk=notification_id, member_recipient__isnull=False)
        .first()
    )
    if notification is None:
        return

    # Chat messages have dedicated real-time dispatch with conversation payload via _send_mobile_chat_push
    if str(notification.notification_type or '').upper() == 'CHAT_MESSAGE':
        return

    recipient = notification.member_recipient
    devices = list(Device.objects.filter(user=recipient, active=True))
    if not devices:
        return

    app = firebase_app()
    if not app:
        return

    notif_type = str(notification.notification_type or '').upper()
    title = str(notification.title or 'My Dear Partner')[:120]
    body = str(notification.message or 'You have a new notification')[:180]
    link_url = _safe_link_url(notification.link_url)

    logger.info(
        "Dispatching mobile FCM notification: notification_id=%s recipient_user_id=%s type=%s devices=%d",
        notification_id,
        recipient.pk,
        notif_type,
        len(devices),
    )

    if notif_type.startswith('INTEREST_'):
        for dev in devices:
            send_interest_push(
                device=dev,
                sender_name=title.replace("New interest from ", "").replace("New interest received", "").strip() or "Someone",
                interest_id=str(notification.related_object_id or ""),
                receiver_id=str(recipient.pk),
                title=title,
                body=body,
            )
    else:
        for dev in devices:
            send_general_push(
                device=dev,
                title=title,
                body=body,
                notification_id=str(notification.pk),
                notification_type=notif_type,
                link_url=link_url,
                receiver_id=str(recipient.pk),
                channel_id="mdp_general_v2",
                extra_data={
                    "related_object_type": str(notification.related_object_type or ""),
                    "related_object_id": str(notification.related_object_id or ""),
                    "priority": str(notification.priority or "NORMAL"),
                },
            )


# ---------------------------------------------------------------------------
# Web Push (VAPID / Browser)
# ---------------------------------------------------------------------------

def push_is_configured():
    return bool(
        getattr(settings, 'WEB_PUSH_VAPID_PUBLIC_KEY', '')
        and getattr(settings, 'WEB_PUSH_VAPID_PRIVATE_KEY', '')
    )


def _safe_link_url(link_url):
    link_url = str(link_url or '')
    return link_url if link_url.startswith('/') and not link_url.startswith('//') else '/notifications'


def notification_push_payload(notification):
    """Return the deliberately minimal payload exposed on the device lock screen."""
    is_chat = str(notification.notification_type or '').upper() == 'CHAT_MESSAGE'
    return {
        'id': str(notification.pk),
        'title': str(notification.title or 'My Dear Partner')[:120],
        'body': 'You have a new message.' if is_chat else str(notification.message or 'You have a new update.')[:180],
        'icon': '/images/main-logo.png',
        'tag': f'mdp-notification-{notification.pk}',
        'url': _safe_link_url(notification.link_url),
        'notification_type': str(notification.notification_type or ''),
        'priority': str(notification.priority or 'NORMAL'),
        'created_at': notification.created_at.isoformat(),
    }


@shared_task(ignore_result=True, autoretry_for=(), retry_backoff=False)
def deliver_notification_push(notification_id):
    """Deliver a persisted notification to active web browsers."""
    if not push_is_configured():
        return

    from apps.core.models import Notification, WebPushSubscription

    notification = (
        Notification.objects.select_related('member_recipient')
        .filter(pk=notification_id, member_recipient__isnull=False)
        .first()
    )
    if notification is None:
        return

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.error('Web Push is configured but pywebpush is not installed.')
        return

    payload = json.dumps(notification_push_payload(notification), separators=(',', ':'))
    vapid_claims = {
        'sub': getattr(settings, 'WEB_PUSH_VAPID_SUBJECT', 'mailto:support@mydearpartner.com'),
    }
    subscriptions = WebPushSubscription.objects.filter(
        member_id=notification.member_recipient_id,
        is_active=True,
    )

    for subscription in subscriptions.iterator(chunk_size=100):
        try:
            webpush(
                subscription_info={
                    'endpoint': subscription.endpoint,
                    'keys': {
                        'p256dh': subscription.p256dh,
                        'auth': subscription.auth,
                    },
                },
                data=payload,
                vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims,
                ttl=300,
            )
            WebPushSubscription.objects.filter(pk=subscription.pk).update(last_used_at=timezone.now())
        except WebPushException as exc:
            response = getattr(exc, 'response', None)
            status_code = getattr(response, 'status_code', None)
            if status_code in (404, 410):
                WebPushSubscription.objects.filter(pk=subscription.pk).update(is_active=False)
            else:
                logger.warning('Web Push delivery failed for subscription=%s status=%s', subscription.pk, status_code)
        except Exception:
            logger.exception('Unexpected Web Push failure for subscription=%s', subscription.pk)


def queue_notification_push(notification):
    """Queue delivery without allowing device provider failures to affect the API."""
    if not notification or not notification.member_recipient_id:
        return

    # 1. Enqueue Web Push if VAPID keys are configured
    if push_is_configured():
        try:
            deliver_notification_push.delay(str(notification.pk))
        except Exception:
            logger.exception('Could not enqueue Web Push notification=%s', notification.pk)

    # 2. Enqueue Mobile FCM Push for native devices (iOS / Android)
    try:
        deliver_mobile_notification_push.delay(str(notification.pk))
    except Exception:
        # If Celery worker/broker is unavailable, try synchronous fallback
        try:
            deliver_mobile_notification_push(str(notification.pk))
        except Exception:
            logger.exception('Could not dispatch mobile push notification=%s', notification.pk)
