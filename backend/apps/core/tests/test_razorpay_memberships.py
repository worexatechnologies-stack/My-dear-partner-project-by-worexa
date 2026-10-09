import hashlib
import hmac
import json
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

import pytest
from django.conf import settings
from django.test import override_settings
from django.core.management import call_command

from apps.accounts.models import Member
from apps.core.models import (
    MembershipPlan,
    PaymentOrder,
    PaymentTransaction,
    RefundRequest,
    RefundTransaction,
    RazorpayWebhookEvent,
    MembershipPurchase,
    MemberMembership,
    Notification,
)
from apps.core.services import razorpay_memberships as rz_module
from apps.core.services.razorpay_memberships import RazorpayMembershipService


pytestmark = pytest.mark.django_db

RAZORPAY_PATCH = override_settings(
    RAZORPAY_KEY_ID='rzp_test_key',
    RAZORPAY_KEY_SECRET='secret',
    RAZORPAY_WEBHOOK_SECRET='webhook_secret',
    RAZORPAY_MODE='test',
)


def _order_ctx(order_id='order_test_abc123'):
    class _Resp:
        def __enter__(self):
            self._data = json.dumps({'id': order_id}).encode('utf-8')
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return self._data

    return _Resp()


def _payment_ctx(payment_id='pay_test_123', order_id='order_test_abc123',
                 amount=49900, currency='INR', status='captured'):
    payload = {
        'id': payment_id,
        'order_id': order_id,
        'amount': amount,
        'currency': currency,
        'status': status,
        'method': 'card',
        'captured': True,
        'card': {'network': 'Visa', 'last4': '1111'},
        'email': 'member@example.com',
        'contact': '9999999999',
    }

    class _Resp:
        def __enter__(self):
            self._data = json.dumps(payload).encode('utf-8')
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return self._data

    return _Resp()


def _valid_signature(order_id, payment_id, secret='secret'):
    return hmac.new(secret.encode(), f'{order_id}|{payment_id}'.encode(), hashlib.sha256).hexdigest()


@pytest.fixture
def plan():
    plan_obj, _ = MembershipPlan.objects.get_or_create(
        slug='gold',
        defaults={
            'name': 'Gold',
            'price': Decimal('499.00'),
            'currency': 'INR',
            'duration_days': 30,
            'is_active': True,
        }
    )
    return plan_obj


@pytest.fixture
def verified_member(member):
    member.is_email_verified = True
    member.is_mobile_verified = True
    member.save()
    return member


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_payment_order_creation_success(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/orders/',
        {'membership_plan_id': str(plan.pk)},
        format='json'
    )
    assert response.status_code == 201
    data = response.json()['data']
    assert data['razorpay_order_id'].startswith('order_')
    assert data['amount'] == int(plan.price * 100)
    assert data['currency'] == 'INR'
    assert data['demo_mode'] is False
    assert PaymentOrder.objects.filter(pk=data['internal_order_id']).exists()


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_plan_base_price_is_used_for_its_configured_duration_after_admin_edit(mock_urlopen, verified_member, plan):
    """An optional duration price must not override an edited base plan price."""
    plan.price = Decimal('1.00')
    plan.duration_days = 90
    plan.price_3m = Decimal('2999.00')  # stale optional value from before the edit
    plan.save(update_fields=('price', 'duration_days', 'price_3m'))
    mock_urlopen.return_value = _order_ctx('order_test_current_base_price')

    order, missing = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=90,
    )

    assert missing == []
    assert order.amount == Decimal('1.00')
    assert order.amount_subunits == 100
    assert order.duration_days_snapshot == 90
    sent_payload = json.loads(mock_urlopen.call_args.args[0].data.decode('utf-8'))
    assert sent_payload['amount'] == 100


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_alternative_duration_uses_its_configured_price(mock_urlopen, verified_member, plan):
    plan.duration_days = 30
    plan.price = Decimal('499.00')
    plan.price_3m = Decimal('999.00')
    plan.save(update_fields=('duration_days', 'price', 'price_3m'))
    mock_urlopen.return_value = _order_ctx('order_test_alternative_duration')

    order, missing = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=90,
    )

    assert missing == []
    assert order.amount == Decimal('999.00')
    assert order.amount_subunits == 99900
    assert order.duration_days_snapshot == 90


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_one_month_order_yields_thirty_days_snapshot(mock_urlopen, verified_member, plan):
    plan.duration_days = 30
    plan.price = Decimal('999.00')
    plan.price_3m = Decimal('2499.00')
    plan.save(update_fields=('duration_days', 'price', 'price_3m'))
    mock_urlopen.return_value = _order_ctx('order_test_one_month')

    order, missing = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=30,
    )

    assert missing == []
    assert order.amount == Decimal('999.00')
    assert order.duration_days_snapshot == 30


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_one_month_requested_on_legacy_ninety_day_plan_yields_thirty_days(mock_urlopen, verified_member, plan):
    plan.duration_days = 90
    plan.price = Decimal('2999.00')
    plan.price_3m = Decimal('2999.00')
    plan.save(update_fields=('duration_days', 'price', 'price_3m'))
    mock_urlopen.return_value = _order_ctx('order_test_one_month_on_90d')

    order, missing = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=30,
    )

    assert missing == []
    assert order.duration_days_snapshot == 30


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_six_and_twelve_months_orders(mock_urlopen, verified_member, plan):
    plan.duration_days = 30
    plan.price = Decimal('999.00')
    plan.price_6m = Decimal('4999.00')
    plan.price_1y = Decimal('7999.00')
    plan.save(update_fields=('duration_days', 'price', 'price_6m', 'price_1y'))
    mock_urlopen.side_effect = [_order_ctx('order_test_6m'), _order_ctx('order_test_12m')]

    order_6m, _ = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=180,
    )
    assert order_6m.amount == Decimal('4999.00')
    assert order_6m.duration_days_snapshot == 180

    order_12m, _ = RazorpayMembershipService.create_order(
        member=verified_member,
        plan=plan,
        duration_days=365,
    )
    assert order_12m.amount == Decimal('7999.00')
    assert order_12m.duration_days_snapshot == 365



@patch.object(rz_module, 'urlopen')
def test_unverified_member_order_forbidden(mock_urlopen, authenticated_client, member, plan):
    member.is_email_verified = False
    member.save()
    response = authenticated_client(member).post(
        '/api/v1/payments/orders/',
        {'membership_plan_id': str(plan.pk)},
        format='json'
    )
    assert response.status_code == 403
    assert response.json()['code'] == 'ACCOUNT_NOT_VERIFIED'


@RAZORPAY_PATCH
def test_cannot_purchase_lower_or_equal_rank_plan(authenticated_client, verified_member, plan):
    from django.utils import timezone
    from datetime import timedelta
    from apps.core.models import MemberMembership
    
    # Give the member an active gold membership
    MemberMembership.objects.create(
        member=verified_member,
        plan=plan,
        status=MemberMembership.MembershipStatus.ACTIVE,
        is_active=True,
        start_date=timezone.now(),
        end_date=timezone.now() + timedelta(days=30),
        expires_at=timezone.now() + timedelta(days=30),
    )
    
    # Attempting to buy Gold again (equal rank) should fail
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/orders/',
        {'membership_plan_id': str(plan.pk)},
        format='json'
    )
    assert response.status_code == 400
    assert response.json()['code'] == 'UPGRADE_ONLY_POLICY'
    
    # Attempting to buy a lower rank plan (e.g. Free or dummy with lower rank) should fail
    lower_plan, _ = MembershipPlan.objects.get_or_create(
        slug='free',
        defaults={
            'name': 'Free Dummy',
            'price': Decimal('199.00'),
            'currency': 'INR',
            'duration_days': 30,
            'is_active': True,
            'rank': 1,  # Lower than gold (2)
        }
    )
    response_lower = authenticated_client(verified_member).post(
        '/api/v1/payments/orders/',
        {'membership_plan_id': str(lower_plan.pk)},
        format='json'
    )
    assert response_lower.status_code == 400
    assert response_lower.json()['code'] == 'UPGRADE_ONLY_POLICY'
    
    # Attempting to buy a higher rank plan (e.g. Elite) should succeed
    elite_plan, _ = MembershipPlan.objects.get_or_create(
        slug='elite',
        defaults={
            'name': 'Elite Dummy',
            'price': Decimal('9999.00'),
            'currency': 'INR',
            'duration_days': 30,
            'is_active': True,
            'rank': 4,  # Higher than gold (2)
        }
    )
    with patch.object(rz_module, 'urlopen') as mock_urlopen:
        mock_urlopen.return_value = _order_ctx()
        response_higher = authenticated_client(verified_member).post(
            '/api/v1/payments/orders/',
            {'membership_plan_id': str(elite_plan.pk)},
            format='json'
        )
        assert response_higher.status_code == 201
        


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_verify_payment_details_activates_membership(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_verify_1'
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))
    signature = _valid_signature(order.razorpay_order_id, payment_id)

    response = authenticated_client(verified_member).post(
        '/api/v1/payments/verify/',
        {
            'internal_order_id': str(order.pk),
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        },
        format='json'
    )
    assert response.status_code == 200, response.json()
    res_data = response.json()['data']
    assert res_data['success'] is True
    assert res_data['payment_status'] == 'captured'
    assert res_data['membership_status'] == 'active'

    purchase = MembershipPurchase.objects.get(user=verified_member, status='active')
    assert purchase.membership_plan == plan
    assert purchase.price_snapshot == plan.price

    # Verify MemberMembership is also successfully stored
    membership = MemberMembership.objects.get(member=verified_member, is_active=True)
    assert membership.plan == plan
    assert membership.status == MemberMembership.MembershipStatus.ACTIVE
    assert membership.razorpay_order_id == order.razorpay_order_id
    assert membership.razorpay_payment_id == payment_id

    verified_member.refresh_from_db()
    assert verified_member.is_premium is True


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_verify_payment_details_without_internal_order_id(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_no_internal'
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))
    signature = _valid_signature(order.razorpay_order_id, payment_id)

    # Calling verify with only standard Razorpay fields (no internal_order_id)
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/verify/',
        {
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        },
        format='json'
    )
    assert response.status_code == 200, response.json()
    res_data = response.json()['data']
    assert res_data['success'] is True
    assert res_data['payment_status'] == 'captured'
    assert res_data['membership_status'] == 'active'


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_verify_payment_details_nested_payload(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_nested'
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))
    signature = _valid_signature(order.razorpay_order_id, payment_id)

    # Calling verify with nested payment_details format
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/verify/',
        {
            'payment_details': {
                'razorpay_order_id': order.razorpay_order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature,
            }
        },
        format='json'
    )
    assert response.status_code == 200, response.json()
    res_data = response.json()['data']
    assert res_data['success'] is True


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_create_order_by_slug_or_plan_id(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx('order_test_slug')
    # Using slug 'gold' in membership_plan_id
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/orders/',
        {'membership_plan_id': 'gold'},
        format='json'
    )
    assert response.status_code == 201, response.json()
    assert response.json()['data']['razorpay_order_id'] == 'order_test_slug'

    # Using plan_slug with a higher-tier plan
    elite_plan, _ = MembershipPlan.objects.get_or_create(
        slug='elite',
        defaults={
            'name': 'Elite Dummy',
            'price': Decimal('9999.00'),
            'currency': 'INR',
            'duration_days': 30,
            'is_active': True,
            'rank': 4,
        }
    )
    mock_urlopen.return_value = _order_ctx('order_test_slug_2')
    response2 = authenticated_client(verified_member).post(
        '/api/v1/payments/orders/',
        {'plan_slug': 'elite'},
        format='json'
    )
    assert response2.status_code == 201, response2.json()


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_invalid_signature_rejected(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    response = authenticated_client(verified_member).post(
        '/api/v1/payments/verify/',
        {
            'internal_order_id': str(order.pk),
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': 'pay_test_x',
            'razorpay_signature': 'deadbeef',
        },
        format='json'
    )
    assert response.status_code == 400
    assert response.json()['code'] == 'PAYMENT_VERIFICATION_FAILED'


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_duplicate_verification_idempotent(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_dup_1'
    signature = _valid_signature(order.razorpay_order_id, payment_id)
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))

    first = authenticated_client(verified_member).post('/api/v1/payments/verify/', {
        'internal_order_id': str(order.pk),
        'razorpay_order_id': order.razorpay_order_id,
        'razorpay_payment_id': payment_id,
        'razorpay_signature': signature,
    }, format='json')
    assert first.status_code == 200, first.json()

    second = authenticated_client(verified_member).post('/api/v1/payments/verify/', {
        'internal_order_id': str(order.pk),
        'razorpay_order_id': order.razorpay_order_id,
        'razorpay_payment_id': payment_id,
        'razorpay_signature': signature,
    }, format='json')
    assert second.status_code == 200
    assert MembershipPurchase.objects.filter(user=verified_member, status='active').count() == 1


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_payment_status_polling_endpoint(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)

    response = authenticated_client(verified_member).get(
        f'/api/v1/payments/orders/{order.pk}/status/'
    )
    assert response.status_code == 200
    data = response.json()['data']
    assert data['order_status'] == 'created'
    assert data['can_retry'] is True
    assert data['can_request_refund'] is False


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_payment_history_and_receipt_endpoints(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_hist_1'
    signature = _valid_signature(order.razorpay_order_id, payment_id)
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))

    RazorpayMembershipService.verify_payment_details(
        order_id=order.razorpay_order_id,
        payment_id=payment_id,
        signature=signature,
        member=verified_member
    )

    response = authenticated_client(verified_member).get('/api/v1/payments/history/')
    assert response.status_code == 200
    assert len(response.json()['data']) == 1

    response = authenticated_client(verified_member).get(f'/api/v1/payments/{order.pk}/receipt/')
    assert response.status_code == 200
    data = response.json()['data']
    assert data['receipt_number'] == order.receipt
    assert data['amount'] == str(plan.price)


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_refund_request_flow(mock_urlopen, authenticated_client, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    payment_id = 'pay_test_refund_1'
    signature = _valid_signature(order.razorpay_order_id, payment_id)
    mock_urlopen.return_value = _payment_ctx(
        payment_id=payment_id, order_id=order.razorpay_order_id,
        amount=int(order.amount * 100))

    RazorpayMembershipService.verify_payment_details(
        order_id=order.razorpay_order_id,
        payment_id=payment_id,
        signature=signature,
        member=verified_member
    )

    response = authenticated_client(verified_member).post(
        f'/api/v1/payments/{order.pk}/refund-request/',
        {'reason': 'accidental_purchase', 'details': 'Bought plan by mistake.'},
        format='json'
    )
    assert response.status_code == 201
    data = response.json()['data']
    assert data['status'] == 'requested'

    refund_id = data['refund_id']
    status_resp = authenticated_client(verified_member).get(f'/api/v1/payments/refunds/{refund_id}/')
    assert status_resp.status_code == 200
    assert status_resp.json()['data']['status'] == 'requested'


@override_settings(RAZORPAY_WEBHOOK_SECRET='webhook_secret')
def test_webhook_event_verification_signature_checking(client):
    event_data = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_999",
                    "order_id": "order_test_999",
                    "amount": 49900,
                    "currency": "INR",
                    "method": "card",
                    "captured": True,
                    "card": {"network": "Visa", "last4": "1111"},
                    "email": "member@example.com",
                    "contact": "9999999999",
                }
            }
        }
    }
    payload = json.dumps(event_data).encode('utf-8')
    signature = hmac.new(b'webhook_secret', payload, hashlib.sha256).hexdigest()

    response = client.post(
        '/api/v1/payments/webhooks/razorpay/',
        data=payload,
        content_type='application/json',
        HTTP_X_RAZORPAY_SIGNATURE=signature,
        HTTP_X_RAZORPAY_EVENT_ID='evt_test_999'
    )
    assert response.status_code == 200
    assert response.json()['success'] is True


@override_settings(RAZORPAY_WEBHOOK_SECRET='webhook_secret')
def test_webhook_invalid_signature_rejected(client):
    event_data = {"event": "payment.captured", "payload": {"payment": {"entity": {}}}}
    payload = json.dumps(event_data).encode('utf-8')
    response = client.post(
        '/api/v1/payments/webhooks/razorpay/',
        data=payload,
        content_type='application/json',
        HTTP_X_RAZORPAY_SIGNATURE='invalid',
        HTTP_X_RAZORPAY_EVENT_ID='evt_test_bad'
    )
    assert response.status_code == 400
    assert response.json()['code'] == 'WEBHOOK_SIGNATURE_INVALID'


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_reconciliation_management_command(mock_urlopen, verified_member, plan):
    mock_urlopen.return_value = _order_ctx()
    order, _ = RazorpayMembershipService.create_order(member=verified_member, plan=plan)
    order.expires_at = order.created_at
    order.save(update_fields=('expires_at',))

    out = StringIO()
    call_command('reconcile_razorpay_payments', minutes=0, stdout=out)

    order.refresh_from_db()
    assert order.status in ('expired', 'created')
    assert 'Reconciliation' in out.getvalue()


@pytest.fixture
def production_plans():
    """Create plans mimicking production database state."""
    gold, _ = MembershipPlan.objects.update_or_create(
        slug='gold',
        defaults={
            'name': 'Gold',
            'price': Decimal('99.00'),
            'duration_days': 30,
            'duration': '30 Days',
            'price_3m': Decimal('199.00'),
            'price_6m': Decimal('399.00'),
            'price_1y': Decimal('999.00'),
            'currency': 'INR',
            'is_active': True,
            'rank': 2,
        }
    )
    elite, _ = MembershipPlan.objects.update_or_create(
        slug='elite',
        defaults={
            'name': 'Elite',
            'price': Decimal('1999.00'),
            'duration_days': 30,
            'duration': '30 Days',
            'price_3m': Decimal('3499.00'),
            'price_6m': Decimal('5999.00'),
            'price_1y': Decimal('9999.00'),
            'currency': 'INR',
            'is_active': True,
            'rank': 3,
        }
    )
    premium, _ = MembershipPlan.objects.update_or_create(
        slug='premium',
        defaults={
            'name': 'Premium',
            'price': Decimal('199.00'),
            'duration_days': 30,
            'duration': '30 Days',
            'price_3m': Decimal('4999.00'),
            'price_6m': Decimal('8999.00'),
            'price_1y': Decimal('14999.00'),
            'currency': 'INR',
            'is_active': True,
            'rank': 4,
        }
    )
    return {'gold': gold, 'elite': elite, 'premium': premium}


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_production_plans_billing_durations_pricing(mock_urlopen, verified_member, production_plans):
    """Test 30d, 90d, 180d, 365d pricing for all production tiers."""
    cases = [
        # Gold: duration 90 days, price 99, price_3m 199, price_6m 399, price_1y 999
        ('gold', 30, Decimal('99.00'), 30),
        ('gold', 90, Decimal('199.00'), 90),
        ('gold', 180, Decimal('399.00'), 180),
        ('gold', 365, Decimal('999.00'), 365),
        ('gold', 360, Decimal('999.00'), 365),
        # Elite: duration 180 days, price 1999, price_3m 3499, price_6m 5999, price_1y 9999
        ('elite', 30, Decimal('1999.00'), 30),
        ('elite', 90, Decimal('3499.00'), 90),
        ('elite', 180, Decimal('5999.00'), 180),
        ('elite', 365, Decimal('9999.00'), 365),
        # Premium: duration 360 days, price 199, price_3m 4999, price_6m 8999, price_1y 14999
        ('premium', 30, Decimal('199.00'), 30),
        ('premium', 90, Decimal('4999.00'), 90),
        ('premium', 180, Decimal('8999.00'), 180),
        ('premium', 365, Decimal('14999.00'), 365),
    ]
    for i, (slug, req_duration, expected_price, expected_duration) in enumerate(cases):
        plan_obj = production_plans[slug]
        mock_urlopen.return_value = _order_ctx(f'order_prod_test_{slug}_{req_duration}_{i}')
        order, missing = RazorpayMembershipService.create_order(
            member=verified_member,
            plan=plan_obj,
            duration_days=req_duration,
        )
        assert missing == []
        assert order.amount == expected_price, f"{slug} for {req_duration}d expected {expected_price}, got {order.amount}"
        assert order.duration_days_snapshot == expected_duration
        assert order.amount_subunits == int(expected_price * 100)


@RAZORPAY_PATCH
@patch.object(rz_module, 'urlopen')
def test_production_plans_activation_and_expiry_lifecycle(mock_urlopen, verified_member, production_plans):
    """Test payment verification, activation, and expiration calculation."""
    for duration in [30, 90, 180, 365]:
        plan_obj = production_plans['gold']
        order_id = f'order_act_{duration}'
        payment_id = f'pay_act_{duration}'
        mock_urlopen.return_value = _order_ctx(order_id)

        order, _ = RazorpayMembershipService.create_order(
            member=verified_member,
            plan=plan_obj,
            duration_days=duration,
        )
        assert order.duration_days_snapshot == duration

        mock_urlopen.return_value = _payment_ctx(
            payment_id=payment_id,
            order_id=order.razorpay_order_id,
            amount=int(order.amount * 100),
        )
        sig = _valid_signature(order.razorpay_order_id, payment_id)

        purchase = RazorpayMembershipService.verify_payment_details(
            order_id=order.razorpay_order_id,
            payment_id=payment_id,
            signature=sig,
            member=verified_member,
        )

        assert purchase.duration_days_snapshot == duration
        assert purchase.status == 'active'
        delta = (purchase.expires_at - purchase.starts_at).total_seconds()
        assert abs(delta - (duration * 86400)) < 10

        mem = MemberMembership.objects.get(member=verified_member, is_active=True)
        assert mem.plan == plan_obj
        mem_delta = (mem.expires_at - mem.started_at).total_seconds()
        assert abs(mem_delta - (duration * 86400)) < 10


def test_existing_active_memberships_independent_of_plan_duration_days_change(verified_member):
    """Verify existing active memberships do not rely dynamically on plan.duration_days."""
    from django.utils import timezone
    from datetime import timedelta
    plan_obj = MembershipPlan.objects.create(
        slug='test_legacy_plan',
        name='Legacy Plan',
        price=Decimal('99.00'),
        duration_days=90,
        is_active=True,
    )
    now = timezone.now()
    original_expiry = now + timedelta(days=90)
    membership = MemberMembership.objects.create(
        member=verified_member,
        plan=plan_obj,
        start_date=now,
        end_date=original_expiry,
        started_at=now,
        expires_at=original_expiry,
        is_active=True,
        status=MemberMembership.MembershipStatus.ACTIVE,
    )
    MembershipPurchase.objects.create(
        user=verified_member,
        membership_plan=plan_obj,
        price_snapshot=Decimal('99.00'),
        currency='INR',
        duration_days_snapshot=90,
        starts_at=now,
        expires_at=original_expiry,
        status='active',
    )

    # Change plan.duration_days from 90 to 30 (simulating migration 0051)
    plan_obj.duration_days = 30
    plan_obj.save(update_fields=['duration_days'])

    membership.refresh_from_db()
    # Expiry dates must NOT change
    assert membership.expires_at == original_expiry
    assert membership.end_date == original_expiry
    assert membership.is_active is True

    # Expiry service must not prematurely expire the membership
    from apps.core.services.membership_service import MembershipService
    has_expired = MembershipService.check_membership_expiry(verified_member)
    assert has_expired is False
    membership.refresh_from_db()
    assert membership.is_active is True
    assert MembershipService.get_effective_plan(verified_member) == plan_obj


def test_migration_0051_preserves_manually_configured_production_prices():
    """Verify migration 0051 normalizes duration without overwriting production prices."""
    import importlib
    mig_0051 = importlib.import_module('apps.core.migrations.0051_normalize_membership_durations')
    normalize_durations = mig_0051.normalize_durations
    reverse_normalize = mig_0051.reverse_normalize
    from django.apps import apps

    # Setup production plans in pre-migration state
    gold, _ = MembershipPlan.objects.update_or_create(
        slug='gold',
        defaults={
            'name': 'Gold',
            'price': Decimal('99.00'),
            'duration_days': 90,
            'duration': '3 Months',
            'price_3m': Decimal('199.00'),
            'price_6m': Decimal('399.00'),
            'price_1y': Decimal('999.00'),
            'is_active': True,
        }
    )
    elite, _ = MembershipPlan.objects.update_or_create(
        slug='elite',
        defaults={
            'name': 'Elite',
            'price': Decimal('1999.00'),
            'duration_days': 180,
            'duration': '6 Months',
            'price_3m': Decimal('3499.00'),
            'price_6m': Decimal('5999.00'),
            'price_1y': Decimal('9999.00'),
            'is_active': True,
        }
    )
    premium, _ = MembershipPlan.objects.update_or_create(
        slug='premium',
        defaults={
            'name': 'Premium',
            'price': Decimal('199.00'),
            'duration_days': 360,
            'duration': '12 Months',
            'price_3m': Decimal('4999.00'),
            'price_6m': Decimal('8999.00'),
            'price_1y': Decimal('14999.00'),
            'is_active': True,
        }
    )

    # Run forward migration
    normalize_durations(apps, None)

    gold.refresh_from_db()
    elite.refresh_from_db()
    premium.refresh_from_db()

    # Durations are normalized to 30 days
    assert gold.duration_days == 30
    assert gold.duration == '30 Days'
    assert elite.duration_days == 30
    assert elite.duration == '30 Days'
    assert premium.duration_days == 30
    assert premium.duration == '30 Days'

    # Production prices must remain strictly intact
    assert gold.price == Decimal('99.00')
    assert gold.price_3m == Decimal('199.00')
    assert gold.price_6m == Decimal('399.00')
    assert gold.price_1y == Decimal('999.00')

    assert elite.price == Decimal('1999.00')
    assert elite.price_3m == Decimal('3499.00')
    assert elite.price_6m == Decimal('5999.00')
    assert elite.price_1y == Decimal('9999.00')

    assert premium.price == Decimal('199.00')
    assert premium.price_3m == Decimal('4999.00')
    assert premium.price_6m == Decimal('8999.00')
    assert premium.price_1y == Decimal('14999.00')

    # Run reverse migration
    reverse_normalize(apps, None)

    gold.refresh_from_db()
    elite.refresh_from_db()
    premium.refresh_from_db()

    assert gold.duration_days == 90
    assert elite.duration_days == 180
    assert premium.duration_days == 360

    # Clean up: restore to 30 days so subsequent tests have normalized state
    normalize_durations(apps, None)
