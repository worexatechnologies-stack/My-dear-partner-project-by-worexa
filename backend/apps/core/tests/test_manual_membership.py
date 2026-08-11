import json
import hashlib
import hmac

import pytest

from apps.core.models import PaymentOrder, MembershipPurchase, RazorpayWebhookEvent

pytestmark = pytest.mark.django_db

RAZORPAY_WEBHOOK_PATH = '/api/v1/payments/webhooks/razorpay/'


def test_online_payment_endpoints_exist(api_client):
    response = api_client.post('/api/v1/payments/orders/', {'plan_slug': 'gold'}, format='json')
    assert response.status_code in (200, 400, 401, 403)
    assert response.status_code != 404


def test_verify_endpoint_exists_and_requires_fields(api_client):
    response = api_client.post('/api/v1/payments/verify/', {'payment_id': 'x'}, format='json')
    assert response.status_code != 404
    assert response.status_code in (400, 401, 403)


def test_razorpay_webhook_rejects_unsigned_requests(api_client):
    event_data = {'event': 'payment.captured', 'payload': {'payment': {'entity': {}}}}
    payload = json.dumps(event_data).encode('utf-8')
    response = api_client.post(
        RAZORPAY_WEBHOOK_PATH,
        data=payload,
        content_type='application/json',
        HTTP_X_RAZORPAY_EVENT_ID='evt_test_unsigned',
    )

    assert response.status_code == 400
    assert response.json()['code'] == 'WEBHOOK_SIGNATURE_INVALID'
    assert RazorpayWebhookEvent.objects.count() == 0
