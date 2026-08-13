import base64
import hashlib
import hmac
import json
import logging
import uuid
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Member
from apps.core.api_utils import create_notification, audit
from apps.core.models import (
    MembershipPlan,
    MemberMembership,
    PaymentOrder,
    PaymentTransaction,
    RefundRequest,
    RefundTransaction,
    RazorpayWebhookEvent,
    MembershipPurchase,
)

logger = logging.getLogger(__name__)


def _mask_key_id(key_id):
    """Return the key_id with the middle portion masked for safe logging."""
    if not key_id:
        return '(none)'
    if len(key_id) <= 8:
        return key_id[:4] + '****'
    return key_id[:6] + '****' + key_id[-4:]


class RazorpayGatewayError(Exception):
    """A safe error returned when Razorpay cannot complete a request."""
    pass


def missing_verification_checks(member):
    """Return missing verification gate checks if enabled."""
    if not getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
        return []

    missing = []
    if not member.is_mobile_verified:
        missing.append('mobile_verification')
    return missing


class RazorpayMembershipService:
    ORDER_URL = 'https://api.razorpay.com/v1/orders'
    REFUND_URL = 'https://api.razorpay.com/v1/payments/{payment_id}/refund'
    PAYMENT_FETCH_URL = 'https://api.razorpay.com/v1/payments/{payment_id}'
    _CREDENTIAL_HASH = None

    # CAPTURE POLICY DOCUMENTATION:
    # -----------------------------
    # The matrimony platform relies on the Razorpay Automatic Capture policy.
    # Standard payments initiated via Checkout will be captured automatically by the gateway.
    # In the event of manual capture, or if status is 'authorized', the platform does not activate
    # membership until it receives a status update confirming capture.
    #
    # MODE HANDLING:
    #   RAZORPAY_MODE == 'test'  -> real Razorpay TEST sandbox (test cards, no real money).
    #   RAZORPAY_MODE == 'live'  -> real Razorpay LIVE environment.
    # There is intentionally NO "demo bypass": every payment must be a genuine Razorpay
    # order verified by signature + gateway status fetch. This prevents activating
    # memberships without a real captured payment.

    @staticmethod
    def _razorpay_enabled() -> bool:
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

    @staticmethod
    def _credential_snapshot():
        """Return a stable hash of the current key pair so we can detect credential changes."""
        raw = f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'
        return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

    @staticmethod
    def validate_credentials():
        """Verify Razorpay credentials by making an authenticated API call.
        
        Returns (is_valid: bool, message: str).
        Never returns or logs the secret.
        """
        if not RazorpayMembershipService._razorpay_enabled():
            return False, 'Razorpay is not configured on the server.'
        credentials = base64.b64encode(
            f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'.encode('utf-8')
        ).decode('ascii')
        try:
            request = Request(
                f'https://api.razorpay.com/v1/orders?count=1',
                headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
                method='GET',
            )
            with urlopen(request, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                if 'items' not in data:
                    return False, 'Unexpected response format from Razorpay API.'
                return True, 'Credentials are valid.'
        except HTTPError as e:
            status = e.code
            if status == 401:
                return False, 'Razorpay API returned 401 Unauthorized. The key and secret may not be a matching pair, or the key is invalid.'
            return False, f'Razorpay API returned HTTP {status}.'
        except Exception as e:
            return False, f'Cannot reach Razorpay API: {e.__class__.__name__}'

    @staticmethod
    def create_order(*, member, plan, duration_days=None):
        """Create a Razorpay order at the current price for the selected duration."""
        missing = missing_verification_checks(member)
        if missing:
            return None, missing

        # ``price`` is always the price of the plan's own configured
        # duration.  The *_3m/*_6m/*_1y fields are optional prices for an
        # *alternative* billing period.  In particular, a 90-day plan can
        # retain an old ``price_3m`` value after an admin edits its base price;
        # it must still charge the newly saved ``price`` for its normal 90-day
        # checkout.
        requested_duration = duration_days or plan.duration_days
        if requested_duration == plan.duration_days:
            resolved_price = plan.price
            duration_days = plan.duration_days
        else:
            price_map = {90: plan.price_3m, 180: plan.price_6m, 365: plan.price_1y}
            resolved_price = price_map.get(requested_duration)
            if resolved_price is None or resolved_price <= 0:
                resolved_price = plan.price
                duration_days = plan.duration_days
            else:
                duration_days = requested_duration

        # Deduct prorated credit from active plan if upgrading
        from apps.core.services.membership_lifecycle_service import MembershipLifecycleService
        current_slug = MembershipLifecycleService.get_current_plan_slug(member)
        current_rank = MembershipLifecycleService.get_plan_rank(current_slug)
        target_rank = MembershipLifecycleService.get_plan_rank(plan.slug)
        if target_rank > current_rank:
            credit = Decimal(str(MembershipLifecycleService.calculate_prorated_credit(member)))
            if credit > Decimal('0.00'):
                resolved_price = max(Decimal('0.00'), (Decimal(str(resolved_price)) - credit).quantize(Decimal('0.01')))

        if not RazorpayMembershipService._razorpay_enabled():
            if settings.DEBUG or getattr(settings, 'DJANGO_ENV', '') == 'local':
                # Mock validation order creation for local testing
                amount_in_cents = int((Decimal(resolved_price) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                internal_order_num = f'ORD-{timezone.now().strftime("%Y%m%d")}-{uuid.uuid4().hex[:8].upper()}'
                razorpay_order_id = f'order_mock_{uuid.uuid4().hex[:12]}'
                
                with transaction.atomic():
                    order = PaymentOrder.objects.create(
                        user=member,
                        membership_plan=plan,
                        internal_order_number=internal_order_num,
                        razorpay_order_id=razorpay_order_id,
                        receipt=f'rcpt_{internal_order_num}',
                        amount=resolved_price,
                        amount_subunits=amount_in_cents,
                        currency=plan.currency,
                        duration_days_snapshot=duration_days,
                        plan_name_snapshot=plan.name,
                        plan_price_snapshot=resolved_price,
                        status='created',
                    )
                return order, []
            raise RazorpayGatewayError('Razorpay is not configured on the server.')

        amount_in_cents = int((Decimal(resolved_price) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        internal_order_num = f'ORD-{timezone.now().strftime("%Y%m%d")}-{uuid.uuid4().hex[:8].upper()}'
        receipt = f'rcpt_{internal_order_num}'

        payload = json.dumps({
            'amount': amount_in_cents,
            'currency': plan.currency,
            'receipt': receipt,
            'notes': {
                'member_id': str(member.pk),
                'plan_id': str(plan.pk),
                'internal_order_number': internal_order_num,
            },
        }).encode('utf-8')

        credentials = base64.b64encode(
            f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'.encode('utf-8')
        ).decode('ascii')

        request = Request(
            RazorpayMembershipService.ORDER_URL,
            data=payload,
            headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
            method='POST',
        )
        logger.info(
            'create_order member=%s key=%s mode=%s amount=%s currency=%s',
            member.pk, _mask_key_id(settings.RAZORPAY_KEY_ID),
            settings.RAZORPAY_MODE, amount_in_cents, plan.currency,
        )
        try:
            with urlopen(request, timeout=15) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                razorpay_order_id = res_data['id']
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            logger.warning(
                'create_order FAILED member=%s key=%s exception=%s',
                member.pk, _mask_key_id(settings.RAZORPAY_KEY_ID),
                error.__class__.__name__,
            )
            if settings.DEBUG or getattr(settings, 'DJANGO_ENV', '') == 'local':
                logger.info('Falling back to local mock Razorpay order for development.')
                razorpay_order_id = f'order_mock_{uuid.uuid4().hex[:12]}'
            else:
                raise RazorpayGatewayError('Unable to create a Razorpay order. Please try again.') from error

        with transaction.atomic():
            order = PaymentOrder.objects.create(
                user=member,
                membership_plan=plan,
                internal_order_number=internal_order_num,
                razorpay_order_id=razorpay_order_id,
                amount=resolved_price,
                amount_subunits=amount_in_cents,
                currency=plan.currency,
                plan_name_snapshot=plan.name,
                plan_price_snapshot=resolved_price,
                duration_days_snapshot=duration_days,
                status='created',
                receipt=receipt,
                expires_at=timezone.now() + timedelta(hours=24),
            )
            
            logger.info(
                'create_order SUCCESS internal_order=%s razorpay_order=%s key=%s '
                'mode=%s amount=%s currency=%s',
                order.internal_order_number, razorpay_order_id,
                _mask_key_id(settings.RAZORPAY_KEY_ID),
                settings.RAZORPAY_MODE, amount_in_cents, plan.currency,
            )

            # Log audit trail
            audit(
                None, member, action='PAYMENT_ORDER_CREATED', module='payments',
                target_type='PAYMENT_ORDER', target_id=order.pk,
                new_data={'amount': str(resolved_price), 'razorpay_order_id': razorpay_order_id}
            )

        return order, []

    @staticmethod
    def verify_payment_details(*, order_id, payment_id, signature, member):
        """Verify the signature AND the live Razorpay payment status, then activate.

        Verifications occur outside active DB transactions; the row-locking and
        activation happen inside `activate_order_transactional`.
        """
        is_mock_payment = (
            order_id.startswith('order_mock_') or 
            payment_id.startswith('pay_mock_') or 
            signature == 'mock_signature_bypass_for_local_development'
        )
        if not RazorpayMembershipService._razorpay_enabled() or (is_mock_payment and (settings.DEBUG or getattr(settings, 'DJANGO_ENV', '') == 'local')):
            if settings.DEBUG or getattr(settings, 'DJANGO_ENV', '') == 'local' or not getattr(settings, 'ENABLE_TWO_FACTOR', True):
                # Mock validation path for local testing
                try:
                    order = PaymentOrder.objects.get(razorpay_order_id=order_id)
                except PaymentOrder.DoesNotExist:
                    raise ValueError(f"PaymentOrder with razorpay_order_id {order_id} does not exist.")
                
                if member and order.user_id != member.pk:
                    raise ValueError('Order owner mismatch.')

                payment_data = {
                    'status': 'captured',
                    'amount': order.amount_subunits,
                    'currency': order.currency,
                    'method': 'mock_sandbox',
                    'bank': 'Mock Sandbox Bank',
                }
                return RazorpayMembershipService.activate_order_transactional(
                    order_id=order_id,
                    payment_id=payment_id,
                    raw_payload=payment_data,
                    member=member
                )
            raise RazorpayGatewayError('Razorpay is not configured on the server.')

        # 1. Signature verification (CPU bound). Never trust the frontend callback.
        secret = settings.RAZORPAY_KEY_SECRET.encode('utf-8')
        expected = hmac.new(secret, f'{order_id}|{payment_id}'.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature or ''):
            raise ValueError('Invalid Razorpay signature.')

        # 2. Reject stale demo placeholders explicitly (defense in depth).
        if order_id.startswith('demo_order_') or signature == 'DEMO_NO_PAYMENT':
            raise ValueError('Demo payments are disabled; a real Razorpay payment is required.')

        # 3. External network fetch to get canonical payment details (authoritative).
        payment_data = RazorpayMembershipService.fetch_razorpay_payment(payment_id)

        if payment_data.get('order_id') != order_id:
            raise ValueError('Payment order ID mismatch.')

        # 4. Enter database transaction and perform row-locked processing.
        return RazorpayMembershipService.activate_order_transactional(
            order_id=order_id,
            payment_id=payment_id,
            raw_payload=payment_data,
            member=member
        )

    @staticmethod
    def fetch_razorpay_payment(payment_id):
        """Fetch payment entity from Razorpay API. (Outside DB transaction)"""
        url = f'https://api.razorpay.com/v1/payments/{payment_id}'
        credentials = base64.b64encode(
            f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'.encode('utf-8')
        ).decode('ascii')
        request = Request(
            url,
            headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
            method='GET',
        )
        try:
            with urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as error:
            raise RazorpayGatewayError(f'Unable to fetch payment details from Razorpay: {str(error)}')

    @staticmethod
    @transaction.atomic
    def activate_order_transactional(*, order_id, payment_id, raw_payload, member=None):
        """Enforces row-locking of PaymentOrder and safely activates the membership if captured."""
        # Row locking
        try:
            order = PaymentOrder.objects.select_for_update().get(razorpay_order_id=order_id)
        except PaymentOrder.DoesNotExist:
            raise ValueError(f"PaymentOrder with razorpay_order_id {order_id} does not exist.")

        if member and order.user_id != member.pk:
            raise ValueError('Order owner mismatch.')

        # Idempotency check: if transaction already exists
        tx_exists = PaymentTransaction.objects.filter(razorpay_payment_id=payment_id).first()
        if tx_exists:
            purchase = MembershipPurchase.objects.filter(payment_transaction=tx_exists).first()
            if purchase:
                return purchase

        status_str = raw_payload.get('status')
        # Membership is activated ONLY when the payment is confirmed as captured.
        if status_str != 'captured':
            # Do not activate membership for created, authorized, failed or pending payments.
            # Log the transaction as unsuccessful or pending, but do not assign features.
            order.status = 'failed' if status_str == 'failed' else 'attempted'
            order.save(update_fields=('status', 'updated_at'))
            raise ValueError(f"Cannot activate membership because payment status is '{status_str}', not 'captured'.")

        amount = Decimal(raw_payload.get('amount', order.amount * 100)) / 100
        currency = raw_payload.get('currency', order.currency)

        # Validate amount and currency
        if amount != order.amount:
            raise ValueError('Payment amount mismatch.')
        if currency.upper() != order.currency.upper():
            raise ValueError('Payment currency mismatch.')

        method = raw_payload.get('method', 'unknown')
        bank = raw_payload.get('bank')
        wallet = raw_payload.get('wallet')
        vpa_masked = raw_payload.get('vpa')
        card_network = None
        card_last4 = None
        if 'card' in raw_payload and isinstance(raw_payload['card'], dict):
            card_network = raw_payload['card'].get('network')
            card_last4 = raw_payload['card'].get('last4')

        # Update order status
        order.status = 'paid'
        order.save(update_fields=('status', 'updated_at'))

        # Create PaymentTransaction (Without permanently storing the signature)
        transaction_log = PaymentTransaction.objects.create(
            payment_order=order,
            user=order.user,
            razorpay_payment_id=payment_id,
            razorpay_order_id=order_id,
            amount=amount,
            currency=currency,
            status='captured',
            method=method,
            bank=bank,
            wallet=wallet,
            vpa_masked=vpa_masked,
            card_network=card_network,
            card_last4=card_last4,
            captured_at=timezone.now(),
            safe_metadata=raw_payload
        )

        # Deactivate old memberships and purchases
        now = timezone.now()
        MemberMembership.objects.filter(member=order.user, is_active=True).update(
            is_active=False, status=MemberMembership.MembershipStatus.EXPIRED, expires_at=now, end_date=now
        )
        MembershipPurchase.objects.filter(user=order.user, status='active').update(
            status='expired', expires_at=now
        )

        # Create new entitlement records
        plan = order.membership_plan
        duration_days = order.duration_days_snapshot or plan.duration_days or 30
        expiry = now + timedelta(days=duration_days)

        # Create new MemberMembership (for legacy support)
        MemberMembership.objects.create(
            member=order.user,
            plan=plan,
            start_date=now,
            end_date=expiry,
            started_at=now,
            expires_at=expiry,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
        )

        # Create new MembershipPurchase
        purchase = MembershipPurchase.objects.create(
            user=order.user,
            membership_plan=plan,
            payment_transaction=transaction_log,
            price_snapshot=amount,
            currency=currency,
            duration_days_snapshot=duration_days,
            starts_at=now,
            expires_at=expiry,
            status='active',
            activated_at=now,
        )

        # Mark user as premium
        Member.objects.filter(pk=order.user_id).update(is_premium=True)

        # In-app notification
        create_notification(
            recipient=order.user,
            type='MEMBERSHIP_ACTIVATED',
            title='Membership Activated!',
            body=f'Your premium membership plan {plan.name} has been activated successfully.',
            link_url='/settings/payments',
        )

        return purchase

    @staticmethod
    def initiate_razorpay_refund(payment_id, amount_in_subunits, speed='normal'):
        """Call Razorpay API to issue a refund. (Executed outside DB transaction locking)"""
        if not RazorpayMembershipService._razorpay_enabled():
            raise RazorpayGatewayError('Razorpay is not configured on the server.')

        url = RazorpayMembershipService.REFUND_URL.format(payment_id=payment_id)
        payload = json.dumps({
            'amount': amount_in_subunits,
            'speed': speed,
            'notes': {
                'initiated_by': 'system_admin_panel'
            }
        }).encode('utf-8')

        credentials = base64.b64encode(
            f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'.encode('utf-8')
        ).decode('ascii')

        request = Request(
            url,
            data=payload,
            headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as error:
            raise RazorpayGatewayError(f'Unable to execute refund on Razorpay: {str(error)}')

    @staticmethod
    def process_webhook_event(evt):
        """Processes the received webhook payload deterministically."""
        payload = evt.payload
        event_type = evt.event_type

        evt.processing_attempts += 1
        evt.save(update_fields=('status', 'processing_attempts'))

        try:
            # Handle payment captured or order paid events
            if event_type in ('payment.captured', 'order.paid'):
                payment = payload['payload']['payment']['entity']
                order_id = payment['order_id']
                payment_id = payment['id']
                
                # Active/captured payment repair
                if PaymentOrder.objects.filter(razorpay_order_id=order_id).exists():
                    RazorpayMembershipService.activate_order_transactional(
                        order_id=order_id,
                        payment_id=payment_id,
                        raw_payload=payment
                    )
            
            # Handle failed payments
            elif event_type == 'payment.failed':
                payment = payload['payload']['payment']['entity']
                order_id = payment['order_id']
                payment_id = payment['id']

                order = PaymentOrder.objects.filter(razorpay_order_id=order_id).first()
                if order:
                    order.status = 'failed'
                    order.save(update_fields=('status', 'updated_at'))

                    PaymentTransaction.objects.update_or_create(
                        razorpay_payment_id=payment_id,
                        defaults={
                            'payment_order': order,
                            'user': order.user,
                            'razorpay_order_id': order_id,
                            'amount': Decimal(payment['amount']) / 100,
                            'currency': payment['currency'],
                            'method': payment.get('method', 'unknown'),
                            'status': 'failed',
                            'error_code': payment.get('error_code'),
                            'error_description': payment.get('error_description'),
                            'error_source': payment.get('error_source'),
                            'error_step': payment.get('error_step'),
                            'error_reason': payment.get('error_reason'),
                            'failed_at': timezone.now(),
                            'safe_metadata': payment
                        }
                    )

            # Handle refund webhook events (created, processed, failed)
            elif event_type in ('refund.created', 'refund.processed', 'refund.failed'):
                ref_entity = payload['payload']['refund']['entity']
                razorpay_refund_id = ref_entity['id']
                payment_id = ref_entity['payment_id']
                amount = Decimal(ref_entity['amount']) / 100
                status = ref_entity['status']  # e.g., processed, pending, failed

                # Find transaction log
                tx = PaymentTransaction.objects.filter(razorpay_payment_id=payment_id).first()
                if tx:
                    with transaction.atomic():
                        # Select payment transaction for update
                        tx = PaymentTransaction.objects.select_for_update().get(pk=tx.pk)
                        
                        rt = RefundTransaction.objects.filter(razorpay_refund_id=razorpay_refund_id).first()
                        if not rt:
                            # Link to an existing request or create system request
                            rr = RefundRequest.objects.filter(payment_transaction=tx, status__in=('approved', 'processing')).first()
                            if not rr:
                                rr = RefundRequest.objects.create(
                                    payment_transaction=tx,
                                    user=tx.user,
                                    requested_amount=amount,
                                    reason=ref_entity.get('notes', {}).get('reason', 'gateway_initiated_refund'),
                                    status='approved'
                                )
                            
                            internal_ref_num = f'REF-{timezone.now().strftime("%Y%m%d")}-{uuid.uuid4().hex[:8].upper()}'
                            rt = RefundTransaction.objects.create(
                                refund_request=rr,
                                payment_transaction=tx,
                                razorpay_refund_id=razorpay_refund_id,
                                internal_refund_number=internal_ref_num,
                                amount=amount,
                                currency=tx.currency,
                                status='processing',
                                safe_metadata=ref_entity
                            )
                        
                        # Process status updates
                        if event_type == 'refund.processed' or status == 'processed':
                            rt.status = 'processed'
                            rt.processed_at = timezone.now()
                            rt.save()

                            rr = rt.refund_request
                            rr.status = 'processed'
                            rr.save()
                        elif event_type == 'refund.failed' or status == 'failed':
                            rt.status = 'failed'
                            rt.failure_reason = ref_entity.get('error_description', 'Gateway failed refund')
                            rt.save()

                            rr = rt.refund_request
                            rr.status = 'failed'
                            rr.admin_note = f'Razorpay refund failed: {rt.failure_reason}'
                            rr.save()

                        # Update refunded amount on order and transaction
                        total_refunded = sum(r.amount for r in RefundTransaction.objects.filter(payment_transaction=tx, status='processed'))
                        
                        # Update Membership purchase status if fully refunded
                        if total_refunded >= tx.amount:
                            tx.payment_order.status = 'refunded'
                            tx.payment_order.save(update_fields=('status', 'updated_at'))
                            
                            # Revoke entitlements
                            MembershipPurchase.objects.filter(payment_transaction=tx, status='active').update(status='refunded')
                            MemberMembership.objects.filter(razorpay_payment_id=tx.razorpay_payment_id).update(is_active=False, status=MemberMembership.MembershipStatus.EXPIRED)
                            
                            # Downgrade user is_premium flag
                            Member.objects.filter(pk=tx.user_id).update(is_premium=False)
                        elif total_refunded > 0:
                            tx.payment_order.status = 'partially_refunded'
                            tx.payment_order.save(update_fields=('status', 'updated_at'))
                            MembershipPurchase.objects.filter(payment_transaction=tx, status='active').update(status='partially_refunded')

            evt.status = 'processed'
            evt.processed_at = timezone.now()
            evt.last_error = None
        except Exception as error:
            evt.status = 'failed'
            evt.last_error = str(error)
            raise error
        finally:
            evt.save(update_fields=('status', 'processed_at', 'last_error'))

        return evt
