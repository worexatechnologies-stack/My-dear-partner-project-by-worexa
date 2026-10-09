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
                # Do NOT blindly expire orders that have a razorpay_order_id without gateway verification.
                # Only expire orders that never received a gateway order id and are older than 2 hours.
                stale_unlinked = PaymentOrder.objects.filter(
                    status='created',
                    razorpay_order_id__isnull=True,
                    created_at__lt=timezone.now() - timedelta(hours=2),
                )
                count = stale_unlinked.count()
                if count:
                    stale_unlinked.update(status='expired', updated_at=timezone.now())
                    logger.info(
                        'startup: expired %d unlinked PaymentOrder(s) older than 2 hours.',
                        count,
                    )
            except (PaymentOrder.DoesNotExist, DatabaseError):
                pass
            except Exception:
                logger.warning('startup: could not expire stale orders.', exc_info=True)
