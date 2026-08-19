"""Secure Web Push delivery for member notifications.

Subscriptions are stored per authenticated member/device. The Web Push
provider dependency is imported only when keys are configured so local and test
environments do not need external credentials to run the core application.
"""

import json
import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


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
        # Chat content can be end-to-end encrypted and is never copied to a
        # system notification preview.
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
    """Deliver a persisted notification to active devices after commit."""

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
        # The database row and Channels event remain the primary delivery path.
        logger.exception('Could not enqueue Web Push notification=%s', notification.pk)
