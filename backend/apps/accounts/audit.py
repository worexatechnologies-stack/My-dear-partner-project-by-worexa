import logging
import uuid
from django.utils import timezone

logger = logging.getLogger('security.audit')


def record_security_audit_event(
    event_type: str,
    *,
    request=None,
    account=None,
    account_id=None,
    account_type=None,
    token_family_id=None,
    session_id=None,
    details=None,
):
    """Record a structured security audit event.
    
    NEVER log raw passwords, raw JWTs, raw refresh tokens, OTP values, or CAPTCHA secrets.
    """
    now = timezone.now().isoformat()
    ip_address = None
    user_agent = None

    if request:
        from apps.accounts.views import _client_ip
        ip_address = _client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    acc_id = str(account.pk) if account else (str(account_id) if account_id else None)
    acc_type = str(account.account_type) if account else (str(account_type) if account_type else None)

    audit_payload = {
        'event_id': str(uuid.uuid4()),
        'event_type': event_type,
        'timestamp': now,
        'account_id': acc_id,
        'account_type': acc_type,
        'token_family_id': str(token_family_id) if token_family_id else None,
        'session_id': str(session_id) if session_id else None,
        'ip_address': ip_address,
        'user_agent_summary': user_agent,
        'details': details or {},
    }

    logger.warning(
        "SECURITY_AUDIT: event_type=%s account_id=%s ip=%s details=%s",
        event_type,
        acc_id,
        ip_address,
        details or {},
    )

    return audit_payload
