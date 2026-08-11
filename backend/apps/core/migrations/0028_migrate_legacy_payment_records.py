import uuid
from datetime import timedelta
from decimal import Decimal
from django.db import migrations
from django.db.models import Sum
from django.utils import timezone


def migrate_legacy_data(apps, schema_editor):
    # Load models dynamically via apps registry to stay migration-safe
    LegacyPayment = apps.get_model('core', 'Payment')
    LegacyRefundRequest = apps.get_model('core', 'LegacyRefundRequest')
    
    PaymentOrder = apps.get_model('core', 'PaymentOrder')
    PaymentTransaction = apps.get_model('core', 'PaymentTransaction')
    MembershipPurchase = apps.get_model('core', 'MembershipPurchase')
    RefundRequest = apps.get_model('core', 'RefundRequest')
    RefundTransaction = apps.get_model('core', 'RefundTransaction')
    
    print("\n[Data Migration] Starting migration of financial records...")
    
    # 1. Count legacy records
    legacy_payments_count = LegacyPayment.objects.count()
    legacy_refunds_count = LegacyRefundRequest.objects.count()
    
    total_legacy_captured = LegacyPayment.objects.filter(status='SUCCESS').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    total_legacy_refunded = LegacyPayment.objects.aggregate(total=Sum('refunded_amount'))['total'] or Decimal('0.00')
    
    migrated_orders = 0
    migrated_transactions = 0
    migrated_purchases = 0
    migrated_requests = 0
    migrated_refund_txs = 0
    
    # Iterate legacy payments
    for payment in LegacyPayment.objects.all():
        # Avoid duplicating if already migrated
        order_key = f"MIGRATED-ORD-{payment.pk.hex[:8].upper()}"
        order = PaymentOrder.objects.filter(internal_order_number=order_key).first()
        
        if not order:
            # Map plan snapshots safely
            plan = payment.plan
            plan_name = plan.name if plan else "Gold Plan"
            plan_price = plan.price if plan else payment.amount
            duration_days = plan.duration_days if plan else 30
            
            # Map status
            if payment.status == 'SUCCESS':
                order_status = 'paid'
            elif payment.status == 'FAILED':
                order_status = 'failed'
            elif payment.status in ('REFUNDED', 'PARTIALLY_REFUNDED'):
                order_status = 'refunded' if payment.status == 'REFUNDED' else 'partially_refunded'
            else:
                order_status = 'created'
                
            rzp_order_id = payment.gateway_reference if (payment.gateway_reference and payment.gateway_reference.startswith('order_')) else f"demo_order_{payment.pk.hex[:12]}"
            amount_subunits = int((payment.amount * 100))
            
            order = PaymentOrder.objects.create(
                id=payment.pk,
                user=payment.member,
                membership_plan=plan,
                internal_order_number=order_key,
                razorpay_order_id=rzp_order_id,
                amount=payment.amount,
                amount_subunits=amount_subunits,
                currency=payment.currency,
                plan_name_snapshot=plan_name,
                plan_price_snapshot=plan_price,
                duration_days_snapshot=duration_days,
                receipt=f"rcpt_{order_key}",
                status=order_status,
                expires_at=payment.created_at + timedelta(hours=24),
                created_at=payment.created_at,
                updated_at=payment.updated_at
            )
            migrated_orders += 1
            
        # Create transaction for successful/refunded records
        if payment.status in ('SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED'):
            tx_key = payment.gateway_reference if (payment.gateway_reference and payment.gateway_reference.startswith('pay_')) else f"demo_pay_{payment.pk.hex[:12]}"
            tx = PaymentTransaction.objects.filter(razorpay_payment_id=tx_key).first()
            
            if not tx:
                tx = PaymentTransaction.objects.create(
                    payment_order=order,
                    user=payment.member,
                    razorpay_payment_id=tx_key,
                    razorpay_order_id=order.razorpay_order_id,
                    amount=payment.amount,
                    currency=payment.currency,
                    status='captured',
                    method='migrated',
                    captured_at=payment.created_at,
                    safe_metadata={'migrated_from_legacy': True},
                    created_at=payment.created_at,
                    updated_at=payment.updated_at
                )
                migrated_transactions += 1
                
                # Active purchase mapping
                if plan:
                    starts = payment.created_at
                    expires = starts + timedelta(days=duration_days)
                    status_val = 'active' if payment.status == 'SUCCESS' else 'refunded'
                    
                    purchase = MembershipPurchase.objects.create(
                        user=payment.member,
                        membership_plan=plan,
                        payment_transaction=tx,
                        price_snapshot=payment.amount,
                        currency=payment.currency,
                        duration_days_snapshot=duration_days,
                        starts_at=starts,
                        expires_at=expires,
                        status=status_val,
                        activated_at=starts,
                        created_at=payment.created_at,
                        updated_at=payment.updated_at
                    )
                    migrated_purchases += 1

    # Migrate legacy refund requests
    for ref_req in LegacyRefundRequest.objects.all():
        payment = ref_req.payment
        tx_key = payment.gateway_reference if (payment.gateway_reference and payment.gateway_reference.startswith('pay_')) else f"demo_pay_{payment.pk.hex[:12]}"
        tx = PaymentTransaction.objects.filter(razorpay_payment_id=tx_key).first()
        
        if tx:
            # Map status
            if ref_req.status == 'COMPLETED':
                new_status = 'processed'
            elif ref_req.status == 'FAILED':
                new_status = 'failed'
            elif ref_req.status == 'PROCESSING':
                new_status = 'processing'
            else:
                new_status = 'requested'
                
            rr = RefundRequest.objects.create(
                payment_transaction=tx,
                user=ref_req.requested_by_member,
                requested_amount=ref_req.amount,
                reason=ref_req.reason or 'legacy_migrated_refund',
                details=ref_req.error_message,
                status=new_status,
                requested_at=ref_req.created_at,
                reviewed_at=ref_req.completed_at,
                reviewed_by=ref_req.processed_by_admin or ref_req.processed_by_super_admin,
                admin_note=f"Legacy idempotency key: {ref_req.idempotency_key}"
            )
            migrated_requests += 1
            
            if new_status in ('processed', 'processing', 'failed'):
                internal_ref = f"MIGRATED-REF-{ref_req.pk.hex[:8].upper()}"
                rt = RefundTransaction.objects.create(
                    refund_request=rr,
                    payment_transaction=tx,
                    razorpay_refund_id=ref_req.gateway_reference or f"demo_rfnd_{ref_req.pk.hex[:12]}",
                    internal_refund_number=internal_ref,
                    amount=ref_req.amount,
                    currency=tx.currency,
                    status='processed' if new_status == 'processed' else ('failed' if new_status == 'failed' else 'processing'),
                    processed_at=ref_req.completed_at,
                    safe_metadata={'migrated': True},
                    created_at=ref_req.created_at,
                    updated_at=ref_req.updated_at
                )
                migrated_refund_txs += 1

    # Print verification metrics
    new_captured = PaymentTransaction.objects.filter(status='captured').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    new_refunded = RefundTransaction.objects.filter(status='processed').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    unresolved_refunds = RefundRequest.objects.exclude(status__in=('processed', 'rejected', 'failed')).count()
    
    print("\n================ DATA MIGRATION VERIFICATION ================")
    print(f"Legacy payments counted: {legacy_payments_count} | New orders created: {migrated_orders}")
    print(f"New transactions created: {migrated_transactions} | New active purchases: {migrated_purchases}")
    print(f"Legacy refund requests: {legacy_refunds_count} | New refund requests: {migrated_requests}")
    print(f"New refund transactions: {migrated_refund_txs}")
    print(f"Legacy Total Captured: INR {total_legacy_captured} | New Total Captured: INR {new_captured}")
    print(f"Legacy Total Refunded: INR {total_legacy_refunded} | New Total Refunded: INR {new_refunded}")
    print(f"Unresolved refund status requests: {unresolved_refunds}")
    print("=============================================================\n")


def reverse_legacy_migration(apps, schema_editor):
    PaymentOrder = apps.get_model('core', 'PaymentOrder')
    PaymentTransaction = apps.get_model('core', 'PaymentTransaction')
    MembershipPurchase = apps.get_model('core', 'MembershipPurchase')
    RefundRequest = apps.get_model('core', 'RefundRequest')
    RefundTransaction = apps.get_model('core', 'RefundTransaction')
    
    print("\n[Rollback] Reversing financial records migration...")
    
    # Delete objects matching migration keys
    PaymentOrder.objects.filter(internal_order_number__startswith="MIGRATED-").delete()
    RefundTransaction.objects.filter(internal_refund_number__startswith="MIGRATED-").delete()
    
    print("[Rollback] Reversal finished successfully.")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_legacyrefundrequest_refundtransaction_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_data, reverse_legacy_migration),
    ]
