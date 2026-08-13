"""Tests for account-scoped authentication protection and API throttle policy."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from apps.accounts.throttling import OTPCooldownThrottle, get_client_ip
from apps.accounts.models import AccountType, AdminRole, AuthChallenge, RoleCode, SuperAdmin
from apps.accounts.views import _consume_challenge, _issue_challenge
from rest_framework.test import APIRequestFactory

pytestmark = pytest.mark.django_db

WRONG = "definitely-wrong-password"


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_login_locks_after_3_failed_attempts(api_client, member):
    statuses = []
    last = None
    for _ in range(3):
        last = api_client.post(
            "/api/v1/member-auth/login/",
            {"identifier": member.email, "password": WRONG},
            format="json",
        )
        statuses.append(last.status_code)
    assert statuses == [401, 401, 423]
    assert "Too many failed login attempts" in last.data["message"]


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_login_lock_resets_after_successful_login(api_client, member):
    from apps.conftest import PASSWORD

    for _ in range(2):
        api_client.post(
            "/api/v1/member-auth/login/",
            {"identifier": member.email, "password": WRONG},
            format="json",
        )
    ok = api_client.post(
        "/api/v1/member-auth/login/",
        {"identifier": member.email, "password": PASSWORD},
        format="json",
    )
    assert ok.status_code == 200
    member.refresh_from_db()
    assert member.failed_login_attempts == 0
    assert member.locked_until is None


def test_login_lock_is_isolated_to_the_affected_account(api_client, member, other_member):
    path = "/api/v1/member-auth/login/"
    for _ in range(3):
        response = api_client.post(
            path,
            {"identifier": member.email, "password": WRONG},
            format="json",
        )
    assert response.status_code == 423

    other = api_client.post(
        path,
        {"identifier": other_member.email, "password": "TestPassword!742"},
        format="json",
    )
    assert other.status_code == 200

    member.locked_until = timezone.now() - timedelta(seconds=1)
    member.save(update_fields=("locked_until", "updated_at"))
    unlocked = api_client.post(
        path,
        {"identifier": member.email, "password": "TestPassword!742"},
        format="json",
    )
    assert unlocked.status_code == 200


def test_mobile_otp_send_enforces_2min_cooldown(authenticated_client, member):
    client = authenticated_client(member)
    first = client.post(
        "/api/v1/member-auth/verification/mobile/send-otp/", {}, format="json"
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/member-auth/verification/mobile/send-otp/", {}, format="json"
    )
    assert second.status_code == 429
    assert "Please wait 2 minutes before requesting another OTP." in second.data["message"]
    assert second.get("Retry-After")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
def test_otp_cooldown_isolated_by_account(authenticated_client, member, other_member):
    first_client = authenticated_client(member)
    other_client = authenticated_client(other_member)

    assert first_client.post(
        "/api/v1/member-auth/verification/mobile/send-otp/", {}, format="json"
    ).status_code == 200
    assert first_client.post(
        "/api/v1/member-auth/verification/mobile/send-otp/", {}, format="json"
    ).status_code == 429
    assert other_client.post(
        "/api/v1/member-auth/verification/mobile/send-otp/", {}, format="json"
    ).status_code == 200


@pytest.mark.parametrize(
    "path",
    (
        "/api/v1/member-auth/verification/email/send-otp/",
        "/api/v1/member-auth/verification/email/verify-otp/",
    ),
)
def test_email_otp_verification_endpoints_are_removed(api_client, path):
    assert api_client.post(path, {}, format="json").status_code == 404


def test_generic_member_otp_rejects_email_identifiers(api_client, member):
    response = api_client.post(
        "/api/v1/member-auth/otp/request/",
        {"identifier": member.email, "purpose": "PHONE_VERIFY"},
        format="json",
    )
    assert response.status_code == 400


def test_forgot_password_cooldown_isolated_by_identifier(api_client, member, other_member):
    cache.clear()
    path = "/api/v1/member-auth/forgot-password/"
    assert api_client.post(path, {"identifier": member.mobile_number}, format="json").status_code == 200
    assert api_client.post(path, {"identifier": member.mobile_number}, format="json").status_code == 429
    assert api_client.post(path, {"identifier": other_member.mobile_number}, format="json").status_code == 200


def test_forgot_password_rejects_email_identifier(api_client, member):
    response = api_client.post(
        "/api/v1/member-auth/forgot-password/",
        {"identifier": member.email},
        format="json",
    )
    assert response.status_code == 400


def test_reset_password_attempts_are_bounded(api_client, member):
    cache.clear()
    forgot = api_client.post(
        "/api/v1/member-auth/forgot-password/",
        {"identifier": member.mobile_number},
        format="json",
    )
    assert forgot.status_code == 200

    payload = {
        "identifier": member.mobile_number,
        "code": "000000",
        "new_password": "NewPassword!743",
    }
    for _ in range(5):
        assert api_client.post(
            "/api/v1/member-auth/reset-password/", payload, format="json"
        ).status_code == 400
    assert api_client.post(
        "/api/v1/member-auth/reset-password/", payload, format="json"
    ).status_code == 429
    assert not AuthChallenge.objects.get(
        identifier=member.mobile_number, purpose=AuthChallenge.Purpose.PASSWORD_RESET
    ).is_usable


def test_otp_is_single_use_and_expires(api_client, member):
    request = APIRequestFactory().post("/api/v1/member-auth/otp/request/", {}, format="json")
    code, _delivered = _issue_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        request=request,
        lifetime_minutes=5,
    )
    assert _consume_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        code=code,
    ) is True
    assert _consume_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        code=code,
    ) is False

    expired_code, _delivered = _issue_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        request=request,
        lifetime_minutes=5,
    )
    AuthChallenge.objects.filter(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        consumed_at__isnull=True,
    ).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert _consume_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        code=expired_code,
    ) is False


def test_otp_is_invalidated_after_five_wrong_codes(api_client, member):
    request = APIRequestFactory().post("/api/v1/member-auth/otp/request/", {}, format="json")
    code, _delivered = _issue_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        request=request,
        lifetime_minutes=5,
    )
    for _ in range(5):
        assert _consume_challenge(
            account_type=AccountType.MEMBER,
            identifier=member.mobile_number,
            purpose=AuthChallenge.Purpose.PHONE_VERIFY,
            code="000000",
        ) is False
    assert _consume_challenge(
        account_type=AccountType.MEMBER,
        identifier=member.mobile_number,
        purpose=AuthChallenge.Purpose.PHONE_VERIFY,
        code=code,
    ) is False


@override_settings(TRUSTED_PROXY_IPS=["10.0.0.1"], NUM_PROXIES=1)
def test_client_ip_uses_the_verified_proxy_chain():
    request = APIRequestFactory().get("/api/v1/")
    request.META["REMOTE_ADDR"] = "10.0.0.1"
    request.META["HTTP_X_FORWARDED_FOR"] = "198.51.100.23, 203.0.113.4"
    assert get_client_ip(request) == "203.0.113.4"


@override_settings(TRUSTED_PROXY_IPS=[], NUM_PROXIES=1)
def test_client_ip_ignores_forwarded_headers_from_untrusted_peer():
    request = APIRequestFactory().get("/api/v1/")
    request.META["REMOTE_ADDR"] = "198.51.100.23"
    request.META["HTTP_X_FORWARDED_FOR"] = "203.0.113.4"
    assert get_client_ip(request) == "198.51.100.23"


@override_settings(OTP_COOLDOWN_SECONDS=120)
def test_super_admin_bypasses_authentication_throttles_but_admin_does_not(api_client, super_admin, admin_account):
    cache.clear()
    factory = APIRequestFactory()

    super_request = factory.post('/api/v1/super-admin-auth/otp/', {'identifier': super_admin.email}, format='json')
    super_request.user = super_admin
    assert OTPCooldownThrottle().allow_request(super_request, object()) is True
    assert OTPCooldownThrottle().allow_request(super_request, object()) is True

    admin_request = factory.post('/api/v1/admin-auth/otp/', {'identifier': admin_account.email}, format='json')
    admin_request.user = admin_account
    assert OTPCooldownThrottle().allow_request(admin_request, object()) is True
    assert OTPCooldownThrottle().allow_request(admin_request, object()) is False


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {
            "anon": "200/day",
            "user": None,
            "login": "40/minute",
        },
        "NUM_PROXIES": 1,
    }
)
def test_authenticated_api_has_no_daily_limit(authenticated_client, member):
    from rest_framework.settings import api_settings

    assert api_settings.DEFAULT_THROTTLE_RATES["user"] is None
    # A burst of authenticated calls is not capped by a daily limit.
    client = authenticated_client(member)
    for _ in range(5):
        resp = client.get("/api/v1/member-auth/verification/status/")
        assert resp.status_code == 200


def test_default_api_throttling_is_disabled():
    from rest_framework.settings import api_settings

    assert api_settings.DEFAULT_THROTTLE_CLASSES == []
    assert api_settings.DEFAULT_THROTTLE_RATES == {}
