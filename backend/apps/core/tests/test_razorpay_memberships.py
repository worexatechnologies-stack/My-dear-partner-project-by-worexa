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
