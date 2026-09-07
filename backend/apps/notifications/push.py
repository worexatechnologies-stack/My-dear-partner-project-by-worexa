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
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Firebase Admin SDK initialization
# ---------------------------------------------------------------------------

_firebase_initialized = False


def firebase_app():
    """Initialize and return the Firebase Admin app instance."""
    global _firebase_initialized
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    cert_path = getattr(
        settings,
        'FIREBASE_SERVICE_ACCOUNT_FILE',
        '/opt/mydearpartner/secrets/firebase-service-account.json',
    )
    if not cert_path or not os.path.exists(cert_path):
        logger.warning(
            "Firebase credentials file not found at '%s'. Push notifications are suspended.",
            cert_path,
        )
        return None

    try:
        cred = credentials.Certificate(cert_path)
        app = firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin initialized successfully using %s", cert_path)
        return app
    except Exception as exc:
        logger.exception("Failed to initialize Firebase Admin SDK: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Mobile FCM Push Senders (iOS + Android)
# ---------------------------------------------------------------------------

def send_chat_push(
    device,
    sender_name,
    encrypted_text,
    message_id,
    conversation_id,
    sender_id,
    receiver_id,
):
    """Send E2EE chat push notification to an iOS or Android device.

    iOS requires an APNs alert with mutable_content=True so the Notification
    Service Extension can decrypt and render the message while the app is
    closed/terminated.
    Android receives a data-only payload so headless JavaScript can decrypt.
    """
    app = firebase_app()
    if not app:
        return None

    token = getattr(device, 'token', device)
    platform = str(getattr(device, 'platform', 'android')).lower().strip()

    data = {
        "kind": "chat_message",
        "message_id": str(message_id),
        "conversation_id": str(conversation_id),
        "sender_id": str(sender_id),
        "receiver_id": str(receiver_id),
        "sender_name": str(sender_name),
        "encrypted_text": str(encrypted_text),
    }

    apns = None
    if platform == "ios":
        apns = messaging.APNSConfig(
            headers={
                "apns-push-type": "alert",
                "apns-priority": "10",
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(
                        title="💬 MyDearPartner",
                        body="🔒 You have a new message",
                    ),
                    sound="default",
                    mutable_content=True,
                )
            ),
        )

    try:
        msg = messaging.Message(
            token=token,
            data=data,
            android=messaging.AndroidConfig(priority="high"),
            apns=apns,
        )
        response = messaging.send(msg)
        logger.info("FCM chat push delivered: %s (token=%s...)", response, token[:15])
        return response
    except messaging.UnregisteredError:
        logger.info("FCM token unregistered. Deleting device %s...", token[:15])
        if hasattr(device, 'delete'):
            device.delete()
        else:
            from apps.notifications.models import Device
            Device.objects.filter(token=token).delete()
        return None
    except Exception as exc:
        logger.exception("Error sending chat push to %s: %s", token[:15], exc)
        return None


def send_interest_push(device, sender_name, interest_id):
    """Notify a mobile device when an interest is received."""
    app = firebase_app()
    if not app:
        return None

    token = getattr(device, 'token', device)
    platform = str(getattr(device, 'platform', 'android')).lower().strip()

    data = {
        "kind": "interest_received",
        "interest_id": str(interest_id),
        "sender_name": str(sender_name),
    }

    apns = None
    if platform == "ios":
        apns = messaging.APNSConfig(
            headers={
                "apns-push-type": "alert",
                "apns-priority": "10",
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(
                        title="💌 New Interest",
                        body=f"{sender_name} sent you an interest!",
                    ),
                    sound="default",
                )
            ),
        )

    try:
        msg = messaging.Message(
            token=token,
            data=data,
            android=messaging.AndroidConfig(priority="high"),
            apns=apns,
        )
        response = messaging.send(msg)
        logger.info("FCM interest push delivered: %s", response)
        return response
    except messaging.UnregisteredError:
        logger.info("FCM token unregistered. Deleting device %s...", token[:15])
        if hasattr(device, 'delete'):
            device.delete()
        else:
            from apps.notifications.models import Device
            Device.objects.filter(token=token).delete()
        return None
    except Exception as exc:
        logger.exception("Error sending interest push to %s: %s", token[:15], exc)
        return None


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
    if not push_is_configured() or not notification.member_recipient_id:
        return
    try:
        deliver_notification_push.delay(str(notification.pk))
    except Exception:
        logger.exception('Could not enqueue Web Push notification=%s', notification.pk)
