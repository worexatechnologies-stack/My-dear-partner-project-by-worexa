import hashlib
import uuid
from datetime import datetime, timedelta, timezone as datetime_timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .audit import record_security_audit_event
from .models import (
    AccountType,
    Admin,
    AuthSession,
    Member,
    SuperAdmin,
)


ACCOUNT_MODEL_MAP = {
    AccountType.MEMBER: Member,
    AccountType.SUPER_ADMIN: SuperAdmin,
    AccountType.ADMIN: Admin,
}


ABSOLUTE_SESSION_LIFETIME = timedelta(days=7)
ACCESS_TOKEN_LIFETIME = timedelta(minutes=15)
REFRESH_TOKEN_LIFETIME = timedelta(days=7)


def account_model_for_type(account_type):
    try:
        return ACCOUNT_MODEL_MAP[str(account_type)]
    except KeyError as exc:
        raise AuthenticationFailed('Unknown account type.', code='invalid_account_type') from exc


def _digest_jti(jti):
    return hashlib.sha256(str(jti).encode('utf-8')).hexdigest()


def _token_expiry(token):
    return datetime.fromtimestamp(int(token['exp']), tz=datetime_timezone.utc)


def _set_account_claims(token, account, session_id):
    token['account_id'] = str(account.pk)
    token['account_type'] = str(account.account_type)
    token['session_id'] = str(session_id)
    token['token_version'] = account.token_version


def attach_auth_cookies(response, access_token: str, refresh_token: str):
    """Attach Secure, HttpOnly cookies to HTTP response."""
    is_secure = getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG)
    samesite = getattr(settings, 'AUTH_COOKIE_SAME_SITE', 'Lax')

    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=is_secure,
        samesite=samesite,
        path='/',
    )
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=int(REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=is_secure,
        samesite=samesite,
        path='/',
    )
    return response


def clear_auth_cookies(response):
    """Clear access_token and refresh_token cookies with matching parameters."""
    is_secure = getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG)
    samesite = getattr(settings, 'AUTH_COOKIE_SAME_SITE', 'Lax')

    response.delete_cookie(key='access_token', path='/', samesite=samesite)
    response.delete_cookie(key='refresh_token', path='/', samesite=samesite)
    return response


@transaction.atomic
def issue_account_tokens(account, *, session=None, token_family_id=None, request=None):
    """Issue a refresh/access pair without storing raw tokens in database.
    
    Enforces concurrency safety and 7-day maximum absolute session lifetime.
    """
    if not account.is_active or account.deleted_at is not None:
        raise AuthenticationFailed('Account is inactive or disabled.', code='account_inactive')

    now = timezone.now()
    session_id = session.pk if session else uuid.uuid4()
    family_id = token_family_id or (session.token_family_id if session else uuid.uuid4())
    abs_expires_at = session.absolute_expires_at if session and session.absolute_expires_at else (now + ABSOLUTE_SESSION_LIFETIME)

    refresh = RefreshToken()
    _set_account_claims(refresh, account, session_id)

    ip_address = None
    user_agent = ''
    if request:
        from apps.accounts.views import _client_ip
        ip_address = _client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    values = {
        'account_id': account.pk,
        'account_type': str(account.account_type),
        'token_family_id': family_id,
        'token_version': account.token_version,
        'refresh_jti_digest': _digest_jti(refresh['jti']),
        'expires_at': _token_expiry(refresh),
        'absolute_expires_at': abs_expires_at,
        'revoked_at': None,
        'revocation_reason': None,
    }
    if ip_address:
        values['ip_address'] = ip_address
    if user_agent:
        values['user_agent_summary'] = user_agent

    if session:
        AuthSession.objects.filter(pk=session.pk).update(**values, updated_at=now)
        session.refresh_from_db()
    else:
        session = AuthSession.objects.create(id=session_id, **values)

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'session_id': str(session.pk),
        'session_expires_at': session.absolute_expires_at.isoformat() if session.absolute_expires_at else None,
    }


def rotate_refresh_token(raw_refresh, *, expected_account_type=None, request=None):
    """Concurrency-safe refresh token rotation with Token Family Reuse Detection."""
    try:
        refresh = RefreshToken(raw_refresh)
    except TokenError as exc:
        raise AuthenticationFailed('Invalid or expired refresh token.', code='invalid_refresh') from exc

    account_type = refresh.get('account_type')
    account_id = refresh.get('account_id')
    session_id = refresh.get('session_id')
    token_version = refresh.get('token_version')
    if not all((account_type, account_id, session_id)) or token_version is None:
        raise AuthenticationFailed('Refresh token is missing required claims.', code='invalid_claims')
    if expected_account_type and account_type != str(expected_account_type):
        raise AuthenticationFailed('Token belongs to a different account type.', code='wrong_account_type')

    now = timezone.now()
    is_reused = False
    session = None

    with transaction.atomic():
        session = AuthSession.objects.select_for_update().filter(
            pk=session_id,
            account_id=account_id,
            account_type=account_type,
        ).first()

        is_reused = (
            session is None
            or session.revoked_at is not None
            or session.refresh_jti_digest != _digest_jti(refresh['jti'])
            or session.token_version != int(token_version)
        )

        if is_reused:
            family_id = session.token_family_id if session else None
            if family_id:
                AuthSession.objects.filter(token_family_id=family_id, revoked_at__isnull=True).update(
                    revoked_at=now,
                    revocation_reason='REUSE_DETECTED',
                    updated_at=now,
                )

    if is_reused:
        record_security_audit_event(
            'REFRESH_TOKEN_REUSE_DETECTED',
            request=request,
            account_id=account_id,
            account_type=account_type,
            token_family_id=session.token_family_id if session else None,
            session_id=session_id,
            details={'reason': 'Revoked or already-rotated refresh token was reused.'},
        )
        raise AuthenticationFailed(
            'Security alert: Token reuse detected. The session family has been terminated. Please log in again.',
            code='token_reuse_detected'
        )

    if session.absolute_expires_at and session.absolute_expires_at <= now:
        with transaction.atomic():
            session.revoked_at = now
            session.revocation_reason = 'ABSOLUTE_LIFETIME_EXPIRED'
            session.save(update_fields=('revoked_at', 'revocation_reason', 'updated_at'))
        record_security_audit_event(
            'SESSION_EXPIRED',
            request=request,
            account_id=account_id,
            account_type=account_type,
            session_id=session_id,
            details={'reason': 'Session reached 7-day maximum absolute lifetime.'},
        )
        raise AuthenticationFailed('Your 7-day session has expired. Please sign in again.', code='session_expired')

    model = account_model_for_type(account_type)
    account = model.objects.filter(pk=account_id, is_active=True, deleted_at__isnull=True).first()
    if account is None or account.token_version != int(token_version):
        with transaction.atomic():
            session.revoked_at = now
            session.revocation_reason = 'ACCOUNT_INACTIVE_OR_REVOKED'
            session.save(update_fields=('revoked_at', 'revocation_reason', 'updated_at'))
        raise AuthenticationFailed('This session has been revoked or account is inactive.', code='session_revoked')

    return issue_account_tokens(account, session=session, token_family_id=session.token_family_id, request=request)


@transaction.atomic
def revoke_session(raw_refresh, *, expected_account_type=None, reason='USER_LOGOUT'):
    try:
        refresh = RefreshToken(raw_refresh)
    except TokenError:
        return None
    account_type = refresh.get('account_type')
    if expected_account_type and account_type != str(expected_account_type):
        return None
    session = AuthSession.objects.select_for_update().filter(
        pk=refresh.get('session_id'),
        account_id=refresh.get('account_id'),
        account_type=account_type,
        refresh_jti_digest=_digest_jti(refresh.get('jti')),
        revoked_at__isnull=True,
    ).first()
    if session:
        session.revoked_at = timezone.now()
        session.revocation_reason = reason
        session.save(update_fields=('revoked_at', 'revocation_reason', 'updated_at'))
    return session


@transaction.atomic
def revoke_all_account_sessions(account, reason='PASSWORD_CHANGED_OR_LOGOUT_ALL'):
    locked = account.__class__.objects.select_for_update().get(pk=account.pk)
    locked.token_version += 1
    locked.save(update_fields=('token_version', 'updated_at'))
    account.token_version = locked.token_version
    now = timezone.now()
    return AuthSession.objects.filter(
        account_id=locked.pk,
        account_type=str(locked.account_type),
        revoked_at__isnull=True,
    ).update(revoked_at=now, revocation_reason=reason, updated_at=now)


# Compatibility aliases
issue_refresh_token = issue_account_tokens
revoke_all_user_sessions = revoke_all_account_sessions
