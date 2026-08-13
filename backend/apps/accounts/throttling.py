"""Endpoint-specific throttles for authentication-sensitive operations."""

import hashlib
import ipaddress
import re

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


def _valid_ip(value):
    try:
        return str(ipaddress.ip_address(str(value).strip()))
    except (ValueError, TypeError):
        return None


def _trusted_proxy_networks():
    networks = []
    for value in getattr(settings, "TRUSTED_PROXY_IPS", ()):
        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except (ValueError, TypeError):
            continue
    return networks


def get_client_ip(request):
    """Return the client address only when the immediate proxy is trusted.

    Nginx appends its connection peer to X-Forwarded-For. Walking the
    configured trusted-proxy count from the right ignores arbitrary left-most
    values supplied by a direct caller. A request that did not come through a
    configured proxy uses REMOTE_ADDR and ignores forwarded headers.
    """
    if not request or not hasattr(request, "META"):
        return None

    remote_addr = _valid_ip(request.META.get("REMOTE_ADDR"))
    if not remote_addr:
        return None

    if not any(ipaddress.ip_address(remote_addr) in network for network in _trusted_proxy_networks()):
        return remote_addr

    forwarded = [
        address
        for address in (
            _valid_ip(value)
            for value in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")
        )
        if address
    ]
    proxy_count = max(0, int(getattr(settings, "NUM_PROXIES", 0)))
    if forwarded and proxy_count:
        client_index = len(forwarded) - proxy_count
        if client_index >= 0:
            return forwarded[client_index]
    return remote_addr


def _request_data(request):
    try:
        return request.data
    except Exception:
        return {}


def _request_identifier(request):
    data = _request_data(request)
    target = None
    for field in ("identifier", "email", "email_address", "mobile_number", "mobile", "phone"):
        value = data.get(field)
        if value:
            target = _normalize_identifier(value)
            break

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        account = f"account:{getattr(user, 'account_type', 'unknown')}:{user.pk}"
        return account
    return target


def _normalize_identifier(value):
    raw = str(value).strip().casefold()
    if "@" in raw:
        return raw

    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        return digits[1:]
    return digits or raw


def _identifier_cache_key(request, view, scope):
    identifier = _request_identifier(request)
    if identifier is None:
        identifier = f"ip:{get_client_ip(request) or 'unknown'}"

    data = _request_data(request)
    purpose = str(data.get("purpose", "")).strip().casefold()
    endpoint = str(getattr(request, "path", "")).casefold()
    raw_key = f"{scope}|{endpoint}|{identifier}|{purpose}"
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return f"{scope}:{digest}"


class _AuthenticationThrottle(SimpleRateThrottle):
    # DRF uses this only as a non-null sentinel; subclasses set the actual
    # request count and duration from environment-backed settings.
    rate = "1/s"

    def allow_request(self, request, view):
        user = getattr(request, 'user', None)
        if (
            user is not None
            and getattr(user, 'is_authenticated', False)
            and str(getattr(user, 'account_type', '')) == 'SUPER_ADMIN'
        ):
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        return _identifier_cache_key(request, view, self.scope)


class OTPCooldownThrottle(_AuthenticationThrottle):
    """Allow one OTP request per account/identifier during the cooldown."""

    scope = "otp-cooldown"

    def __init__(self):
        from django.conf import settings as dj_settings

        self.cooldown_seconds = max(
            1, int(getattr(dj_settings, "OTP_COOLDOWN_SECONDS", 120))
        )
        self.num_requests = 1
        self.duration = self.cooldown_seconds


class PasswordResetAttemptThrottle(_AuthenticationThrottle):
    """Bound reset-code submissions per account/identifier."""

    scope = "password-reset-attempt"

    def __init__(self):
        from django.conf import settings as dj_settings

        self.num_requests = max(1, int(getattr(dj_settings, "RESET_PASSWORD_MAX_ATTEMPTS", 5)))
        self.duration = max(1, int(getattr(dj_settings, "RESET_PASSWORD_WINDOW_SECONDS", 120)))
