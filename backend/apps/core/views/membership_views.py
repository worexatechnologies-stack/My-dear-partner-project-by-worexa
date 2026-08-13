"""
Membership Views

Member-facing views for membership activation and management.
All business logic delegated to MembershipActivationService and AccountVerificationService.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework import permissions
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
import hashlib
import hmac

from django.shortcuts import get_object_or_404
from apps.accounts.permissions import IsMember
from apps.accounts.verification_service import AccountVerificationService
from apps.core.responses import ApiResponse, ApiErrorResponse
from apps.core.membership_activation_service import MembershipActivationService
from apps.core.services.membership_service import MembershipService
from django.db import transaction
import uuid
from apps.core.models import MemberMembership, MembershipPlan, PaymentOrder, PaymentTransaction, RefundRequest, RefundTransaction, MembershipPurchase, RazorpayWebhookEvent
from apps.core.services.razorpay_memberships import (
    RazorpayGatewayError,
    RazorpayMembershipService,
    missing_verification_checks,
)
from apps.core.api_utils import audit
from apps.core.services.razorpay_memberships import _mask_key_id as _mask_rp_key

import logging
logger = logging.getLogger(__name__)

class MembershipEntitlementsView(APIView):
    """Return the resolved, typed entitlement set and today's shared usage."""

    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        from apps.core.entitlements import get_active_entitlements, usage_for

        entitlements = get_active_entitlements(request.user)
        return ApiResponse(data={
            'entitlements': entitlements.as_dict(),
            'usage': usage_for(request.user, entitlements),
        })


class MembershipActivateView(APIView):
    """
    POST /api/v1/member-auth/membership/activate/
    
    Select a membership plan.
    
    Behavior:
    - Unverified member: Save plan as pending_verification, redirect to verification
    - Verified member: Activate plan immediately
    
    Request Body:
        {
            "plan_slug": "gold"  // or "platinum", "elite"
        }
    
    Response (Unverified):
        {
            "success": true,
            "message": "Gold plan selected. Waiting for account verification to activate.",
            "data": {
                "status": "pending_verification",
                "membership": {...},
                "next_action": "Complete your account verification"
            }
        }
    
    Response (Verified):
        {
            "success": true,
            "message": "Gold plan activated successfully!",
            "data": {
                "status": "active",
                "membership": {...}
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def post(self, request):
        from apps.core.serializers import MemberMembershipSerializer
        
        plan_slug = request.data.get('plan_slug', '').strip().lower()
        
        if not plan_slug:
            return ApiResponse(
                success=False,
                message='plan_slug is required.',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # During the current rollout a selected plan is active immediately.
        # The legacy verification workflow remains available behind its flag.
        if not getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
            success, message, membership = MembershipService.activate_plan(
                request.user,
                plan_slug,
                source='member_selection',
            )
            if not success:
                return ApiResponse(
                    success=False,
                    message=message,
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership_data = MemberMembershipSerializer(membership).data if membership else None
            return ApiResponse(
                success=True,
                message=message,
                data={
                    'status': 'active',
                    'membership': membership_data,
                },
                status=status.HTTP_200_OK,
            )

        # Check if account is verified when verification is enabled.
        is_verified = AccountVerificationService.is_account_verified(request.user)
        
        if not is_verified:
            # Unverified flow: save as pending_verification
            result = MembershipActivationService.select_plan_unverified(
                member=request.user,
                plan_slug=plan_slug,
                source='member_request'
            )
            
            if not result.success:
                return ApiResponse(
                    success=False,
                    message=result.message,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            membership_data = MemberMembershipSerializer(result.membership).data if result.membership else None
            
            return ApiResponse(
                success=True,
                message=result.message,
                data={
                    'status': 'pending_verification',
                    'membership': membership_data,
                    'next_action': 'Complete your account verification to activate this plan',
                    'verification_required': True
                },
                status=status.HTTP_200_OK
            )
        
        else:
            # Verified flow: activate immediately
            result = MembershipActivationService.select_plan_verified(
                member=request.user,
                plan_slug=plan_slug,
                source='member_request'
            )
            
            if not result.success:
                return ApiResponse(
                    success=False,
                    message=result.message,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            membership_data = MemberMembershipSerializer(result.membership).data if result.membership else None
            
            return ApiResponse(
                success=True,
                message=result.message,
                data={
                    'status': 'active',
                    'membership': membership_data
                },
                status=status.HTTP_200_OK
            )


class MembershipSummaryView(APIView):
    """
    GET /api/v1/member-auth/membership/summary/
    
    Get current membership summary.
    
    Response:
        {
            "success": true,
            "data": {
                "has_active_plan": true,
                "plan_name": "Gold",
                "plan_slug": "gold",
                "is_free": false,
                "status": "active" | "pending_verification" | "none",
                "start_date": "2026-07-16T10:30:00Z",
                "end_date": "2026-10-14T10:30:00Z",
                "days_remaining": 90
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def get(self, request):
        # Entitlements must always come from the active MemberMembership row.
        # The verification workflow may add a pending upgrade, but it must not
        # replace an already-active paid plan in the summary used by chat,
        # photos, and other gated features.
        summary = MembershipService.get_membership_summary(request.user)
        summary['status'] = 'active' if summary['has_active_plan'] else 'none'

        if (
            getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
            and not summary['has_active_plan']
        ):
            activation_summary = MembershipActivationService.get_membership_summary(request.user)
            if activation_summary.get('status') == 'pending_verification':
                summary.update({
                    'plan_name': activation_summary.get('plan_name', summary['plan_name']),
                    'plan_slug': activation_summary.get('plan_slug', summary['plan_slug']),
                    'is_free': False,
                    'status': 'pending_verification',
                    'next_action': activation_summary.get('next_action'),
                })
        
        return ApiResponse(
            success=True,
            data=summary,
            status=status.HTTP_200_OK
        )


class MembershipDeactivateView(APIView):
    """
    POST /api/v1/member-auth/membership/deactivate/
    
    Deactivate current membership (downgrade to Free).
    
    Response:
        {
            "success": true,
            "message": "Membership deactivated"
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def post(self, request):
        if not getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
            success, message = MembershipService.deactivate_membership(
                member=request.user,
                reason='member_requested',
            )
            return ApiResponse(
                success=success,
                message=message,
                status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST,
            )
        success, message = MembershipActivationService.deactivate_membership(
            member=request.user,
            reason='member_requested'
        )
        
        if not success:
            return ApiResponse(
                success=False,
                message=message,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return ApiResponse(
            success=True,
            message=message,
            status=status.HTTP_200_OK
        )


class PaymentOrderCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request):
        missing = missing_verification_checks(request.user)
        if missing:
            return ApiErrorResponse(
                code='ACCOUNT_NOT_VERIFIED',
                message='Your account must be fully verified before purchasing a membership.',
                errors={'missing': missing},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        plan_id = request.data.get('membership_plan_id')
        if not plan_id:
            return ApiErrorResponse(
                code='PLAN_REQUIRED',
                message='membership_plan_id is required.',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        plan = MembershipPlan.objects.filter(pk=plan_id, is_active=True).first()
        if not plan:
            return ApiErrorResponse(
                code='PLAN_NOT_FOUND',
                message='The selected membership plan is unavailable.',
                status=status.HTTP_404_NOT_FOUND
            )
        
        duration_days = request.data.get('duration_days')
        if duration_days is not None:
            try:
                duration_days = int(duration_days)
            except (ValueError, TypeError):
                duration_days = None
        
        # Strict upgrade-only validation - no downgrades allowed
        from apps.core.services.membership_lifecycle_service import MembershipLifecycleService
        current_slug = MembershipLifecycleService.get_current_plan_slug(request.user)
        
        if current_slug and current_slug != 'free':
            # User has an active paid plan - only allow upgrades
            if not MembershipLifecycleService.is_valid_upgrade(current_slug, plan.slug):
                return ApiErrorResponse(
                    code='UPGRADE_ONLY_POLICY',
                    message='You can only upgrade to a higher-tier plan. Downgrades are not allowed. Contact support to modify your membership.',
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        
        if plan.price <= 0:
            return ApiErrorResponse(
                code='PAID_PLAN_REQUIRED',
                message='Free plans do not require checkout.',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            order, _ = RazorpayMembershipService.create_order(member=request.user, plan=plan, duration_days=duration_days)
        except RazorpayGatewayError as error:
            logger.warning(
                'PaymentOrderCreate FAILED member=%s plan=%s key=%s exception=%s',
                request.user.pk, plan.pk, _mask_rp_key(settings.RAZORPAY_KEY_ID),
                error.__class__.__name__,
            )
            return ApiErrorResponse(
                code='ORDER_CREATION_FAILED',
                message=str(error),
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Validate the Razorpay order response
        rp_order_id = order.razorpay_order_id or ''
        if not rp_order_id.startswith('order_'):
            logger.error(
                'PaymentOrderCreate INVALID_ORDER_ID internal_order=%s razorpay_order=%s',
                order.internal_order_number, rp_order_id,
            )
            return ApiErrorResponse(
                code='ORDER_CREATION_FAILED',
                message='The payment gateway returned an invalid order reference.',
                status=status.HTTP_502_BAD_GATEWAY
            )

        logger.info(
            'PaymentOrderCreate SUCCESS internal_order=%s razorpay_order=%s '
            'key=%s mode=%s amount=%s currency=%s',
            order.internal_order_number, rp_order_id,
            _mask_rp_key(settings.RAZORPAY_KEY_ID),
            settings.RAZORPAY_MODE, order.amount_subunits, order.currency,
        )

        # Format the response
        contact = request.user.mobile_number or ''
        masked_contact = contact[:3] + '*****' + contact[-2:] if len(contact) >= 5 else contact

        return ApiResponse(
            data={
                'internal_order_id': str(order.pk),
                'razorpay_order_id': rp_order_id,
                'key_id': settings.RAZORPAY_KEY_ID,
                'amount': order.amount_subunits,
                'currency': order.currency,
                'mode': settings.RAZORPAY_MODE,
                'demo_mode': False,
                'plan': {
                    'id': str(plan.pk),
                    'name': plan.name,
                    'duration_days': plan.duration_days
                },
                'prefill': {
                    'name': request.user.get_full_name() or request.user.email,
                    'email': request.user.email,
                    'contact': request.user.mobile_number or ''
                }
            },
            status=status.HTTP_201_CREATED
        )


class PaymentVerifyView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request):
        internal_order_id = request.data.get('internal_order_id')
        payment_id = request.data.get('razorpay_payment_id')
        order_id = request.data.get('razorpay_order_id')
        signature = request.data.get('razorpay_signature')

        if not internal_order_id or not order_id or not all((payment_id, signature)):
            return ApiErrorResponse(
                code='PAYMENT_DETAILS_REQUIRED',
                message='Payment details are required.',
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            order = PaymentOrder.objects.get(pk=internal_order_id)
            if order.user != request.user:
                return ApiErrorResponse(
                    code='UNAUTHORIZED',
                    message='You are not authorized to verify this payment.',
                    status=status.HTTP_403_FORBIDDEN
                )

            if order.status in ('paid', 'captured'):
                # Already paid, find corresponding purchase
                tx = PaymentTransaction.objects.filter(payment_order=order, status='captured').first()
                purchase = MembershipPurchase.objects.filter(payment_transaction=tx).first() if tx else None
                if purchase:
                    return ApiResponse(
                        data={
                            'success': True,
                            'payment_status': 'captured',
                            'membership_status': 'active',
                            'membership': {
                                'plan_name': purchase.membership_plan.name,
                                'starts_at': purchase.starts_at.isoformat(),
                                'expires_at': purchase.expires_at.isoformat(),
                            }
                        }
                    )

            purchase = RazorpayMembershipService.verify_payment_details(
                order_id=order_id,
                payment_id=payment_id,
                signature=signature,
                member=request.user
            )
        except PaymentOrder.DoesNotExist:
            return ApiErrorResponse(
                code='ORDER_NOT_FOUND',
                message='The payment order was not found.',
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as error:
            return ApiErrorResponse(
                code='PAYMENT_VERIFICATION_FAILED',
                message=str(error),
                status=status.HTTP_400_BAD_REQUEST
            )
        except RazorpayGatewayError as error:
            return ApiErrorResponse(
                code='PAYMENT_VERIFICATION_FAILED',
                message=str(error),
                status=status.HTTP_502_BAD_GATEWAY
            )

        return ApiResponse(
            data={
                'success': True,
                'payment_status': 'captured',
                'membership_status': 'active',
                'membership': {
                    'plan_name': purchase.membership_plan.name,
                    'starts_at': purchase.starts_at.isoformat(),
                    'expires_at': purchase.expires_at.isoformat(),
                }
            }
        )


class PaymentOrderStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, id):
        order = get_object_or_404(PaymentOrder, pk=id)
        if order.user != request.user and not request.user.is_staff:
            return ApiErrorResponse(
                code='UNAUTHORIZED',
                message='You are not authorized to view this status.',
                status=status.HTTP_403_FORBIDDEN
            )

        tx = PaymentTransaction.objects.filter(payment_order=order, status='captured').first()
        purchase = MembershipPurchase.objects.filter(payment_transaction=tx).first() if tx else None

        refund_status = None
        ref = RefundRequest.objects.filter(payment_transaction=tx).first() if tx else None
        if ref:
            refund_status = ref.status

        # can_retry if failed or created and not captured
        can_retry = order.status in ('created', 'failed', 'cancelled')
        can_request_refund = order.status == 'paid' and (not ref or ref.status == 'failed')

        return ApiResponse(
            data={
                'order_status': order.status,
                'payment_status': tx.status if tx else None,
                'membership_status': purchase.status if purchase else None,
                'refund_status': refund_status,
                'can_retry': can_retry,
                'can_request_refund': can_request_refund
            }
        )


class PaymentHistoryView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        purchases = MembershipPurchase.objects.filter(user=request.user).select_related('membership_plan', 'payment_transaction').order_by('-created_at')
        results = []
        seen_ids = set()

        for p in purchases:
            seen_ids.add(str(p.pk))
            tx = p.payment_transaction
            results.append({
                'id': str(p.pk),
                'invoice_no': f'INV-2026-{str(p.id)[:8].upper()}',
                'plan_name': p.membership_plan.name if p.membership_plan else 'Premium Membership',
                'amount': str(p.price_snapshot),
                'currency': p.currency or 'INR',
                'status': p.status.upper(),
                'starts_at': p.starts_at.isoformat() if p.starts_at else None,
                'expires_at': p.expires_at.isoformat() if p.expires_at else None,
                'payment_id': tx.razorpay_payment_id if tx and tx.razorpay_payment_id else f'TXN-{str(p.id)[:8].upper()}',
                'created_at': p.created_at.isoformat() if hasattr(p, 'created_at') and p.created_at else p.starts_at.isoformat(),
                'member_name': request.user.get_full_name() or request.user.email,
                'member_email': request.user.email,
                'member_mobile': getattr(request.user, 'mobile_number', 'N/A'),
                'is_admin_grant': p.price_snapshot == 0,
            })

        purchased_plan_ids = {str(p.membership_plan_id) for p in purchases if p.membership_plan_id}
        memberships = MemberMembership.objects.filter(member=request.user).select_related('plan').order_by('-created_at')
        for m in memberships:
            if m.plan and m.plan.slug != 'free' and str(m.pk) not in seen_ids and str(m.plan_id) not in purchased_plan_ids:
                results.append({
                    'id': str(m.pk),
                    'invoice_no': f'INV-2026-{str(m.id)[:8].upper()}',
                    'plan_name': m.plan.name,
                    'amount': str(m.plan.price) if m.plan.price else '0.00',
                    'currency': m.plan.currency or 'INR',
                    'status': m.status.upper(),
                    'starts_at': m.start_date.isoformat() if m.start_date else None,
                    'expires_at': m.end_date.isoformat() if m.end_date else None,
                    'payment_id': f'ADM-{str(m.id)[:8].upper()}',
                    'created_at': m.created_at.isoformat() if hasattr(m, 'created_at') and m.created_at else m.start_date.isoformat(),
                    'member_name': request.user.get_full_name() or request.user.email,
                    'member_email': request.user.email,
                    'member_mobile': getattr(request.user, 'mobile_number', 'N/A'),
                    'is_admin_grant': True,
                })

        return ApiResponse(data=results)


class PaymentReceiptView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, id):
        order = get_object_or_404(PaymentOrder, pk=id)
        if order.user != request.user and not request.user.is_staff:
            return ApiErrorResponse(
                code='UNAUTHORIZED',
                message='You are not authorized to view this receipt.',
                status=status.HTTP_403_FORBIDDEN
            )

        tx = PaymentTransaction.objects.filter(payment_order=order, status='captured').first()
        if not tx:
            return ApiErrorResponse(
                code='RECEIPT_UNAVAILABLE',
                message='Receipt is only available for paid orders.',
                status=status.HTTP_400_BAD_REQUEST
            )

        purchase = MembershipPurchase.objects.filter(payment_transaction=tx).first()

        return ApiResponse(
            data={
                'receipt_number': order.receipt,
                'payment_id': tx.razorpay_payment_id,
                'order_id': order.razorpay_order_id,
                'member_name': order.user.get_full_name() or order.user.email,
                'plan_name': order.membership_plan.name,
                'amount': str(tx.amount),
                'currency': tx.currency,
                'payment_date': tx.captured_at.isoformat() if tx.captured_at else tx.created_at.isoformat(),
                'membership_start': purchase.starts_at.isoformat() if purchase else None,
                'membership_expiry': purchase.expires_at.isoformat() if purchase else None,
                'platform_details': {
                    'name': 'My Dear Partner',
                    'support_email': 'support@mydearpartner.com'
                }
            }
        )


class PaymentRefundRequestView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request, id):
        order = get_object_or_404(PaymentOrder, pk=id)
        if order.user != request.user:
            return ApiErrorResponse(
                code='UNAUTHORIZED',
                message='You are not authorized to request a refund for this order.',
                status=status.HTTP_403_FORBIDDEN
            )

        tx = PaymentTransaction.objects.filter(payment_order=order, status='captured').first()
        if not tx:
            return ApiErrorResponse(
                code='REFUND_NOT_ALLOWED',
                message='Only paid transactions can be refunded.',
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check existing refund request
        existing_ref = RefundRequest.objects.filter(payment_transaction=tx).first()
        if existing_ref:
            return ApiErrorResponse(
                code='REFUND_ALREADY_PROCESSED',
                message=f'A refund request with status {existing_ref.status} already exists.',
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'User requested refund')
        customer_note = request.data.get('details', '')

        refund = RefundRequest.objects.create(
            payment_transaction=tx,
            user=request.user,
            requested_amount=tx.amount,
            reason=reason,
            details=customer_note,
            status='requested'
        )

        audit(
            request, request.user, action='REFUND_REQUEST_INITIATED', module='payments',
            target_type='REFUND_REQUEST', target_id=refund.pk,
            new_data={'amount': str(tx.amount), 'reason': reason}
        )

        return ApiResponse(
            data={
                'refund_id': str(refund.pk),
                'refund_number': f'REQ-{refund.pk.hex[:8].upper()}',
                'status': refund.status,
                'amount': str(refund.requested_amount)
            },
            message='Refund request submitted successfully. Waiting for admin approval.',
            status=status.HTTP_201_CREATED
        )


class PaymentRefundStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, id):
        refund = get_object_or_404(RefundRequest, pk=id)
        if refund.payment_transaction.user != request.user and not request.user.is_staff:
            return ApiErrorResponse(
                code='UNAUTHORIZED',
                message='You are not authorized to view this refund status.',
                status=status.HTTP_403_FORBIDDEN
            )

        tx_ref = refund.transactions.first()

        return ApiResponse(
            data={
                'refund_number': f'REQ-{refund.pk.hex[:8].upper()}',
                'amount': str(refund.requested_amount),
                'currency': refund.payment_transaction.currency,
                'status': refund.status,
                'requested_at': refund.requested_at.isoformat(),
                'processed_at': tx_ref.processed_at.isoformat() if tx_ref and tx_ref.processed_at else None,
                'tracking_reference': tx_ref.razorpay_refund_id if tx_ref else None
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class RazorpayWebhookView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def post(self, request):
        signature = request.headers.get('X-Razorpay-Signature', '')

        # 1. Verify webhook signature using raw body bytes (untouched raw request body).
        # Signature verification is mandatory in BOTH test and live modes — never skipped.
        # Webhooks require their own Razorpay Dashboard signing secret. Do not
        # fall back to the API key secret, which would reuse a sensitive credential.
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        if not webhook_secret:
            return ApiErrorResponse(
                code='WEBHOOK_SECRET_NOT_CONFIGURED',
                message='Webhook secret is not configured.',
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        expected = hmac.new(webhook_secret.encode('utf-8'), request.body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return ApiErrorResponse(
                code='WEBHOOK_SIGNATURE_INVALID',
                message='Invalid signature.',
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Get event details
        event_id = request.headers.get('X-Razorpay-Event-Id') or request.data.get('id')
        event_type = request.data.get('event')
        
        if not event_type:
            return ApiErrorResponse(
                code='INVALID_PAYLOAD',
                message='Missing event type.',
                status=status.HTTP_400_BAD_REQUEST
            )

        if not event_id:
            # Deterministic fallback deduplication key using event type and payload hash
            payload_hash = hashlib.sha256(request.body).hexdigest()
            event_id = f"fallback_{event_type}_{payload_hash[:32]}"

        # 3. Persist the webhook event durably first
        with transaction.atomic():
            evt, created = RazorpayWebhookEvent.objects.get_or_create(
                razorpay_event_id=event_id,
                defaults={
                    'event_type': event_type,
                    'signature': signature,
                    'payload': request.data,
                    'status': 'received',
                }
            )

        # 4. Trigger Celery task for processing if it is a new event
        if created:
            try:
                from apps.core.tasks import process_webhook_event_task
                process_webhook_event_task.delay(str(evt.pk))
            except Exception as error:
                # If Celery is not configured or broker is down, log it but do not fail the webhook reception.
                # The CLI reconciler can pick up unprocessed webhook logs.
                evt.last_error = f"Celery dispatch failed: {str(error)}"
                evt.save(update_fields=('last_error',))

        # 5. Return HTTP 200 immediately
        return ApiResponse(
            success=True,
            message='Webhook received and queued.',
            status=status.HTTP_200_OK
        )
