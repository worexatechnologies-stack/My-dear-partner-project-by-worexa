import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'

    def ready(self):
        import apps.core.signals

        # Expire stale unpaid PaymentOrders once on the first HTTP request,
        # after the database is guaranteed to be ready.
        from django.core.signals import request_started
        from django.dispatch import receiver

        @receiver(request_started, weak=False, dispatch_uid='core_expire_stale_orders')
        def _on_first_request(sender, **kwargs):
            from datetime import timedelta
            from django.conf import settings
            from django.core.signals import request_started
            from django.db import DatabaseError
            from django.utils import timezone
            from apps.core.models import PaymentOrder

            request_started.disconnect(dispatch_uid='core_expire_stale_orders')
            threshold = timezone.now() - timedelta(hours=1)
            try:
                stale = PaymentOrder.objects.filter(
                    status='created',
                    created_at__lt=threshold,
                )
                count = stale.count()
                if count:
                    stale.update(status='expired', updated_at=timezone.now())
                    logger.info(
                        'startup: expired %d stale PaymentOrder(s) '
                        'older than 1 hour. key=%s mode=%s',
                        count,
                        getattr(settings, 'RAZORPAY_KEY_ID', '')[:6] + '****',
                        getattr(settings, 'RAZORPAY_MODE', 'N/A'),
                    )
            except (PaymentOrder.DoesNotExist, DatabaseError):
                pass
            except Exception:
                logger.warning('startup: could not expire stale orders.', exc_info=True)
