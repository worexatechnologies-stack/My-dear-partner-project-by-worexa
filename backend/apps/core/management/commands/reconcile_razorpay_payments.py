import base64
import json
from datetime import timedelta
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import PaymentOrder, PaymentTransaction
from apps.core.services.razorpay_memberships import RazorpayMembershipService


class Command(BaseCommand):
    help = 'Reconciles local PaymentOrders with Razorpay gateway state.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=30,
            help='Reconcile orders older than this many minutes.'
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        threshold = timezone.now() - timedelta(minutes=minutes)
        
        self.stdout.write(self.style.WARNING(f'Starting reconciliation for orders created before {threshold}'))

        # Fetch unpaid orders older than threshold
        orders = PaymentOrder.objects.filter(
            status='created',
            created_at__lt=threshold
        )

        total_orders = orders.count()
        self.stdout.write(f'Found {total_orders} unpaid orders to check.')

        reconciled_count = 0
        expired_count = 0
        failed_count = 0

        credentials = base64.b64encode(
            f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'.encode('utf-8')
        ).decode('ascii')

        for order in orders:
            try:
                if not order.razorpay_order_id:
                    # Mark expired if order has no gateway reference and is old
                    order.status = 'expired'
                    order.save(update_fields=('status', 'updated_at'))
                    expired_count += 1
                    continue

                # Query Razorpay for payments related to this order
                url = f'https://api.razorpay.com/v1/orders/{order.razorpay_order_id}/payments'
                request = Request(
                    url,
                    headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
                    method='GET',
                )
                
                with urlopen(request, timeout=15) as response:
                    payment_list = json.loads(response.read().decode('utf-8'))
                    items = payment_list.get('items', [])

                captured_payment = None
                for payment in items:
                    if payment.get('status') == 'captured':
                        captured_payment = payment
                        break

                if captured_payment:
                    # Payment was captured, but local order is unpaid. Repair now!
                    payment_id = captured_payment['id']
                    
                    # Run transactional activation
                    RazorpayMembershipService.activate_order_transactional(
                        order_id=order.razorpay_order_id,
                        payment_id=payment_id,
                        raw_payload=captured_payment
                    )
                    
                    self.stdout.write(self.style.SUCCESS(
                        f'RECONCILED: Order {order.internal_order_number} was paid under payment ID {payment_id}. Activated.'
                    ))
                    reconciled_count += 1
                else:
                    # No captured payment found. Check if order is expired.
                    if order.expires_at and order.expires_at <= timezone.now():
                        order.status = 'expired'
                        order.save(update_fields=('status', 'updated_at'))
                        self.stdout.write(f'EXPIRED: Order {order.internal_order_number} has expired.')
                        expired_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'ERROR: Failed to reconcile order {order.internal_order_number}: {str(e)}'
                ))
                failed_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Reconciliation finished. Reconciled: {reconciled_count}, Expired: {expired_count}, Failed: {failed_count}'
        ))
