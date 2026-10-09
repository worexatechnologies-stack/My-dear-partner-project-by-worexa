import uuid
from decimal import Decimal
from datetime import timedelta
import django

django.setup()

from django.utils import timezone
from apps.accounts.models import Member
from apps.core.models import MembershipPlan, MemberMembership, PaymentOrder, PaymentTransaction

def run():
    # 1. Update Plans
    elite_plan = MembershipPlan.objects.filter(slug='elite').first()
    if elite_plan:
        elite_plan.price = Decimal('1499.00')
        elite_plan.save()
    premium_plan = MembershipPlan.objects.filter(slug='premium').first()
    if premium_plan:
        premium_plan.price = Decimal('2499.00')
        premium_plan.save()
    gold_plan = MembershipPlan.objects.filter(slug='gold').first()
    if gold_plan:
        gold_plan.price = Decimal('1199.00')
        gold_plan.save()

    now = timezone.now()
    one_year_later = now + timedelta(days=365)

    # 2. Fix Member Memberships dates
    MemberMembership.objects.filter(member__email='fakeuser.female@mydearpartner.com').update(
        started_at=now - timedelta(days=1),
        expires_at=one_year_later,
        is_active=True
    )
    MemberMembership.objects.filter(member__email='ananya.iyer@mydearpartner.com').update(
        started_at=now - timedelta(days=1),
        expires_at=one_year_later,
        is_active=True
    )

    # 3. Clean up old test 1.00 transactions/orders
    PaymentTransaction.objects.filter(amount=Decimal('1.00')).delete()
    PaymentOrder.objects.filter(amount=Decimal('1.00')).delete()

    # Members
    ullas = Member.objects.filter(email='ullasgowda.worexa@gmail.com').first()
    priya = Member.objects.filter(email='fakeuser.female@mydearpartner.com').first()
    ananya = Member.objects.filter(email='ananya.iyer@mydearpartner.com').first()
    aarav = Member.objects.filter(email='fakeuser@mydearpartner.com').first()
    dummy_pending = Member.objects.filter(gender='Female', is_premium=False).first()
    dummy_failed = Member.objects.filter(gender='Male', is_premium=False).first()

    def ensure_tx(user, plan, amount, status, method, dt, p_id, o_id, card_last4='', vpa=''):
        int_num = f'ORD-{dt.strftime("%Y%m%d")}-{uuid.uuid4().hex[:8].upper()}'
        order, _ = PaymentOrder.objects.get_or_create(
            razorpay_order_id=o_id,
            defaults={
                'user': user,
                'membership_plan': plan,
                'internal_order_number': int_num,
                'amount': amount,
                'amount_subunits': int(amount * 100),
                'currency': 'INR',
                'plan_name_snapshot': plan.name,
                'plan_price_snapshot': plan.price,
                'duration_days_snapshot': plan.duration_days or 30,
                'receipt': f'rcpt_{int_num}',
                'status': 'paid' if status == 'captured' else ('created' if status == 'pending' else 'attempted'),
                'attempt_number': 1,
            }
        )
        if status in ('captured', 'failed'):
            tx, _ = PaymentTransaction.objects.get_or_create(
                razorpay_payment_id=p_id,
                defaults={
                    'payment_order': order,
                    'user': user,
                    'amount': amount,
                    'currency': 'INR',
                    'status': status,
                    'method': method,
                    'card_last4': card_last4,
                    'vpa_masked': vpa,
                    'razorpay_order_id': o_id,
                    'error_code': 'PAYMENT_FAILED' if status == 'failed' else '',
                    'error_description': 'Customer bank declined the transaction' if status == 'failed' else '',
                    'captured_at': dt if status == 'captured' else None,
                    'failed_at': dt if status == 'failed' else None,
                }
            )
            PaymentTransaction.objects.filter(id=tx.id).update(created_at=dt)
        PaymentOrder.objects.filter(id=order.id).update(created_at=dt)

    # Sep 2026 transactions:
    ensure_tx(ullas, premium_plan, Decimal('2499.00'), 'captured', 'netbanking', now.replace(month=9, day=16), 'pay_SepUllasPrem01', 'order_SepUllasPrem01')
    ensure_tx(aarav, gold_plan, Decimal('1199.00'), 'captured', 'card', now.replace(month=9, day=8), 'pay_SepAaravGold01', 'order_SepAaravGold01', card_last4='8890')

    # Oct 2026 transactions:
    ensure_tx(priya, premium_plan, Decimal('2499.00'), 'captured', 'card', now.replace(month=10, day=8), 'pay_OctPriyaPrem01', 'order_OctPriyaPrem01', card_last4='4242')
    ensure_tx(ananya, premium_plan, Decimal('2499.00'), 'captured', 'upi', now.replace(month=10, day=8), 'pay_OctAnanyaPrem01', 'order_OctAnanyaPrem01', vpa='ananya@okaxis')
    ensure_tx(aarav, elite_plan, Decimal('1499.00'), 'captured', 'upi', now.replace(month=10, day=8), 'pay_OctAaravElite01', 'order_OctAaravElite01', vpa='aarav@okaxis')

    # Pending payment:
    if dummy_pending:
        int_num = f'ORD-{now.strftime("%Y%m%d")}-{uuid.uuid4().hex[:8].upper()}'
        PaymentOrder.objects.get_or_create(
            razorpay_order_id='order_PendingDummy01',
            defaults={
                'user': dummy_pending,
                'membership_plan': elite_plan,
                'internal_order_number': int_num,
                'amount': Decimal('1499.00'),
                'amount_subunits': 149900,
                'currency': 'INR',
                'plan_name_snapshot': elite_plan.name,
                'plan_price_snapshot': elite_plan.price,
                'duration_days_snapshot': elite_plan.duration_days or 30,
                'receipt': f'rcpt_{int_num}',
                'status': 'created',
                'attempt_number': 1,
            }
        )

    # Failed payment:
    if dummy_failed:
        ensure_tx(dummy_failed, elite_plan, Decimal('1499.00'), 'failed', 'card', now.replace(month=10, day=9), 'pay_FailedDummy01', 'order_FailedDummy01', card_last4='1111')

    print('All data synchronized successfully!')

if __name__ == '__main__':
    run()
