from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import override_settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import (
    AccountType,
    AdminLoginActivity,
    AuthSession,
    MemberLoginActivity,
    StaffLoginActivity,
    SuperAdminLoginActivity,
)
from apps.accounts.security import issue_account_tokens

from apps.conftest import PASSWORD


pytestmark = pytest.mark.django_db


def test_member_can_login_with_email_or_mobile(api_client, member):
    for identifier in (member.email, member.mobile_number):
        response = api_client.post(
            '/api/v1/member-auth/login/',
            {'identifier': identifier, 'password': PASSWORD},
            format='json',
        )
        assert response.status_code == 200
        payload = response.data['data']
        claims = AccessToken(payload['access'])
        assert claims['account_id'] == str(member.pk)
        assert claims['account_type'] == AccountType.MEMBER
        assert claims['session_id'] == payload['session_id']
        assert claims['token_version'] == member.token_version
    assert MemberLoginActivity.objects.filter(member=member, login_status='SUCCESS').count() == 2


def test_member_login_is_public_before_a_session_exists(api_client, member):
    response = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': PASSWORD},
        format='json',
    )

    assert response.status_code == 200


def test_member_email_remains_normal_account_data(authenticated_client, member):
    response = authenticated_client(member).get('/api/v1/member-auth/me/')

    assert response.status_code == 200
    assert response.data['data']['email'] == member.email


@patch('apps.accounts.views._challenge_code', return_value='123456')
def test_mobile_otp_login_accepts_indian_country_code_format(_code_stub, api_client, member):
    requested = api_client.post(
        '/api/v1/member-auth/otp/request/',
        {'identifier': f'+91 {member.mobile_number}', 'purpose': 'PASSWORDLESS_LOGIN'},
        format='json',
    )
    assert requested.status_code == 200
    verified = api_client.post(
        '/api/v1/member-auth/otp/verify/',
        {
            'identifier': f'91{member.mobile_number}',
            'code': '123456',
            'purpose': 'PASSWORDLESS_LOGIN',
        },
        format='json',
    )
    assert verified.status_code == 200
    assert verified.data['data']['verified'] is True


@patch('apps.accounts.views._challenge_code', return_value='123456')
def test_authenticated_mobile_verification_normalizes_country_code(_code_stub, api_client, member):
    token = issue_account_tokens(member)['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    requested = api_client.post(
        '/api/v1/member-auth/verification/mobile/send-otp/',
        {'mobile_number': f'+91 {member.mobile_number}'},
        format='json',
    )
    assert requested.status_code == 200
    verified = api_client.post(
        '/api/v1/member-auth/verification/mobile/verify-otp/',
        {'code': '123456'},
        format='json',
    )
    assert verified.status_code == 200
    member.refresh_from_db()
    assert member.mobile_number == '9876543210'
    assert member.is_mobile_verified is True


@patch('apps.accounts.views._challenge_code', return_value='123456')
def test_mobile_password_reset_accepts_country_code_format(_code_stub, api_client, member):
    requested = api_client.post(
        '/api/v1/member-auth/forgot-password/',
        {'identifier': f'+91 {member.mobile_number}', 'channel': 'mobile'},
        format='json',
    )
    assert requested.status_code == 200
    reset = api_client.post(
        '/api/v1/member-auth/reset-password/',
        {
            'identifier': f'+919{member.mobile_number[1:]}',
            'code': '123456',
            'new_password': 'NewPassword!743',
        },
        format='json',
    )
    assert reset.status_code == 200


@pytest.mark.parametrize(
    ('fixture_name', 'path', 'account_type', 'activity_model'),
    (
        ('super_admin', '/api/v1/super-admin-auth/login/', AccountType.SUPER_ADMIN, SuperAdminLoginActivity),
        ('admin_account', '/api/v1/admin-auth/login/', AccountType.ADMIN, AdminLoginActivity),
    ),
)
def test_each_administrative_table_has_its_own_login(
    request, api_client, fixture_name, path, account_type, activity_model
):
    account = request.getfixturevalue(fixture_name)
    response = api_client.post(path, {'email': account.email, 'password': PASSWORD}, format='json')
    assert response.status_code == 200
    claims = AccessToken(response.data['data']['access'])
    assert claims['account_type'] == account_type
    assert claims['account_id'] == str(account.pk)
    assert activity_model.objects.filter(login_status='SUCCESS').count() == 1


@override_settings(SUPER_ADMIN_2FA_REQUIRED=True)
def test_super_admin_uses_email_and_password_only_without_a_login_lock(api_client, super_admin):
    super_admin.two_factor_enabled = True
    super_admin.failed_login_attempts = 3
    super_admin.locked_until = timezone.now() + timedelta(minutes=2)
    super_admin.save(update_fields=('two_factor_enabled', 'failed_login_attempts', 'locked_until', 'updated_at'))

    path = '/api/v1/super-admin-auth/login/'
    for _ in range(4):
        response = api_client.post(
            path,
            {'email': super_admin.email, 'password': 'wrong-password'},
            format='json',
        )
        assert response.status_code == 401

    login = api_client.post(
        path,
        {'email': super_admin.email, 'password': PASSWORD},
        format='json',
    )
    assert login.status_code == 200
    assert 'requires_two_factor' not in login.data['data']

    super_admin.refresh_from_db()
    assert super_admin.failed_login_attempts == 0
    assert super_admin.locked_until is None
    assert SuperAdminLoginActivity.objects.filter(
        super_admin=super_admin,
        login_status='SUCCESS',
        two_factor_status='NOT_REQUIRED',
    ).exists()


def test_normal_admin_retains_login_lock_protection(api_client, admin_account):
    path = '/api/v1/admin-auth/login/'
    for _ in range(3):
        response = api_client.post(
            path,
            {'email': admin_account.email, 'password': 'wrong-password'},
            format='json',
        )

    assert response.status_code == 423
    admin_account.refresh_from_db()
    assert admin_account.failed_login_attempts == 3
    assert admin_account.locked_until is not None


def test_failed_login_attempt_is_recorded_without_sensitive_values(api_client, member):
    response = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': 'wrong-password'},
        format='json',
    )
    assert response.status_code == 401
    event = MemberLoginActivity.objects.get()
    assert event.login_identifier == member.email
    assert event.failure_reason == 'Invalid credentials'
    assert 'wrong-password' not in str(event.__dict__)


def test_member_is_locked_after_three_failed_logins_for_two_minutes(api_client, member):
    path = '/api/v1/member-auth/login/'
    credentials = {'identifier': member.email, 'password': 'wrong-password'}

    first = api_client.post(path, credentials, format='json')
    second = api_client.post(path, credentials, format='json')
    third = api_client.post(path, credentials, format='json')

    assert first.status_code == 401
    assert first.data['data']['attempts_remaining'] == 2
    assert second.status_code == 401
    assert second.data['data']['attempts_remaining'] == 1
    assert third.status_code == 423
    assert third.data['data'] == {'attempts_remaining': 0, 'retry_after_minutes': 2}

    member.refresh_from_db()
    assert member.failed_login_attempts == 3
    assert timezone.now() + timedelta(minutes=1, seconds=50) < member.locked_until

    still_locked = api_client.post(
        path,
        {'identifier': member.email, 'password': PASSWORD},
        format='json',
    )
    assert still_locked.status_code == 423

    member.locked_until = timezone.now() - timedelta(seconds=1)
    member.save(update_fields=('locked_until', 'updated_at'))
    unlocked = api_client.post(
        path,
        {'identifier': member.email, 'password': PASSWORD},
        format='json',
    )
    assert unlocked.status_code == 200

    member.refresh_from_db()
    assert member.failed_login_attempts == 0
    assert member.locked_until is None


def test_refresh_token_is_rejected_by_another_account_namespace(api_client, member):
    login = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': PASSWORD},
        format='json',
    )
    refresh = login.data['data']['refresh']
    response = api_client.post('/api/v1/admin-auth/token/refresh/', {'refresh': refresh}, format='json')
    assert response.status_code == 401


def test_me_endpoint_enforces_token_account_type(authenticated_client, member):
    client = authenticated_client(member)
    assert client.get('/api/v1/member-auth/me/').status_code == 200
    assert client.get('/api/v1/admin-auth/me/').status_code == 403


@pytest.mark.parametrize(
    'path',
    (
        '/api/v1/admin/dashboard/',
        '/api/v1/super-admin/dashboard/',
    ),
)
def test_member_is_blocked_from_all_operational_namespaces(authenticated_client, member, path):
    assert authenticated_client(member).get(path).status_code == 403


def test_cross_role_operational_isolation(
    authenticated_client, admin_account
):
    assert authenticated_client(admin_account).get('/api/v1/super-admin/admins/').status_code == 403


def test_logout_revokes_refresh_session_without_access_header(api_client, member):
    login = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': PASSWORD},
        format='json',
    ).data['data']
    response = api_client.post('/api/v1/member-auth/logout/', {'refresh': login['refresh']}, format='json')
    assert response.status_code == 200
    refresh = api_client.post(
        '/api/v1/member-auth/token/refresh/', {'refresh': login['refresh']}, format='json'
    )
    assert refresh.status_code == 401


@pytest.mark.parametrize(
    ('fixture_name', 'namespace'),
    (
        ('member', 'member-auth'),
        ('super_admin', 'super-admin-auth'),
        ('admin_account', 'admin-auth'),
    ),
)
def test_logout_all_is_authenticated_typed_and_revokes_every_session(
    request, api_client, fixture_name, namespace
):
    account = request.getfixturevalue(fixture_name)
    original_version = account.token_version
    first = issue_account_tokens(account)
    second = issue_account_tokens(account)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {first['access']}")

    response = api_client.post(f'/api/v1/{namespace}/logout-all/', format='json')

    assert response.status_code == 200, response.data
    account.refresh_from_db()
    assert account.token_version == original_version + 1
    assert not AuthSession.objects.filter(
        account_id=account.pk,
        account_type=str(account.account_type),
        revoked_at__isnull=True,
    ).exists()

    api_client.credentials()
    refresh = api_client.post(
        f'/api/v1/{namespace}/token/refresh/',
        {'refresh': second['refresh']},
        format='json',
    )
    assert refresh.status_code == 401


def test_logout_all_rejects_a_token_from_another_namespace(authenticated_client, member):
    original_version = member.token_version
    response = authenticated_client(member).post('/api/v1/admin-auth/logout-all/', format='json')

    assert response.status_code == 403
    member.refresh_from_db()
    assert member.token_version == original_version
