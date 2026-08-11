from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import AccountType, AuthSession, Member
from apps.accounts.security import (
    ABSOLUTE_SESSION_LIFETIME,
    issue_account_tokens,
    rotate_refresh_token,
    revoke_all_account_sessions,
)
from apps.accounts.captcha import verify_turnstile_captcha


class SecurityArchitectureTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.member = Member.objects.create_user(
            email='security.test@example.com',
            mobile_number='9876543299',
            password='SecurityPassword123!',
            first_name='Security',
            last_name='Tester',
            gender='Male',
        )

    def test_login_attaches_httponly_cookies_and_no_raw_tokens_in_json(self):
        response = self.client.post('/api/v1/member-auth/login/', {
            'identifier': 'security.test@example.com',
            'password': 'SecurityPassword123!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify JSON payload does NOT contain raw tokens
        data = response.json().get('data', {})
        self.assertNotIn('access', data)
        self.assertNotIn('refresh', data)
        self.assertIn('user', data)
        self.assertIn('session_expires_at', data)

        # Verify HttpOnly cookies are attached
        cookies = response.cookies
        self.assertIn('access_token', cookies)
        self.assertIn('refresh_token', cookies)
        self.assertTrue(cookies['access_token']['httponly'])
        self.assertTrue(cookies['refresh_token']['httponly'])

    def test_refresh_token_rotation_and_cookies(self):
        tokens = issue_account_tokens(self.member)
        refresh_token = tokens['refresh']

        rotated = rotate_refresh_token(refresh_token)
        self.assertIn('access', rotated)
        self.assertIn('refresh', rotated)
        self.assertNotEqual(refresh_token, rotated['refresh'])

    def test_token_family_reuse_detection_revokes_all_sessions(self):
        tokens = issue_account_tokens(self.member)
        first_refresh = tokens['refresh']

        # First rotation succeeds
        rotated1 = rotate_refresh_token(first_refresh)

        # Attempting to reuse first_refresh must trigger token family revocation
        with self.assertRaises(Exception) as ctx:
            rotate_refresh_token(first_refresh)

        self.assertIn('reuse detected', str(ctx.exception).lower())

        # Verify all sessions in that family are marked revoked
        session = AuthSession.objects.filter(id=tokens['session_id']).first()
        self.assertIsNotNone(session.revoked_at)
        self.assertEqual(session.revocation_reason, 'REUSE_DETECTED')

    def test_absolute_seven_day_session_expiry(self):
        session = AuthSession.objects.create(
            account_id=self.member.pk,
            account_type=AccountType.MEMBER,
            token_version=self.member.token_version,
            refresh_jti_digest='dummy_digest_123',
            expires_at=timezone.now() + timedelta(days=1),
            absolute_expires_at=timezone.now() - timedelta(minutes=1), # Expired absolute lifetime
        )
        self.assertFalse(session.is_usable)

    def test_password_change_revokes_all_existing_sessions(self):
        tokens = issue_account_tokens(self.member)
        session_id = tokens['session_id']

        revoke_all_account_sessions(self.member)

        session = AuthSession.objects.get(id=session_id)
        self.assertIsNotNone(session.revoked_at)

    def test_turnstile_captcha_verification_validation(self):
        # Valid dev token in debug/test mode
        with override_settings(DEBUG=True, TURNSTILE_SECRET_KEY=''):
            self.assertTrue(verify_turnstile_captcha('DEV_TEST_PASS_TOKEN'))
