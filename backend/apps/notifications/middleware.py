import logging
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.authentication import AccountJWTAuthentication

logger = logging.getLogger(__name__)


MAX_TOKEN_LENGTH = 4096


def token_from_query_string(scope):
    """Extract JWT from ``?token=...`` query parameter."""
    qs = scope.get("query_string", b"").decode("utf-8", errors="ignore")
    params = parse_qs(qs, keep_blank_values=False)
    values = params.get("token") or params.get("access_token")
    if not values:
        return None
    token = values[0]
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return None
    return token


SUBPROTOCOL_SCHEMES = ("access_token", "jwt", "bearer")


def token_from_subprotocols(scope):
    """
    Extract a JWT from WebSocket subprotocol headers.

    Supports two client conventions:

    1. A single subprotocol that embeds the token after a separator, e.g.
       ``access_token.<JWT>`` / ``jwt.<JWT>`` / ``bearer.<JWT>``.
    2. A subprotocol pair ``['access_token', '<JWT>']`` where the first entry
       names the scheme and the second carries the raw token (the convention
       used by the Next.js client).

    Returns a ``(token_or_None, subprotocol_or_None)`` tuple. The second
    element is the negotiated scheme name (without a trailing dot) whenever a
    recognised scheme is declared, even if no token was supplied, so callers
    can tell whether a subprotocol auth scheme was attempted.
    """
    if isinstance(scope, dict):
        subprotocols = list(scope.get("subprotocols") or ())
    else:
        subprotocols = list(scope or ())
    scheme = None

    for index, proto in enumerate(subprotocols):
        lowered = str(proto).lower()
        for prefix in ("access_token.", "jwt.", "bearer."):
            if lowered.startswith(prefix):
                scheme = prefix.rstrip(".")
                token = str(proto)[len(prefix):]
                if token and len(token) <= MAX_TOKEN_LENGTH:
                    return token, scheme
                return None, scheme
        if lowered in SUBPROTOCOL_SCHEMES:
            scheme = lowered
            if index + 1 < len(subprotocols):
                token = str(subprotocols[index + 1])
                if token and len(token) <= MAX_TOKEN_LENGTH:
                    return token, scheme
                return None, scheme

    if scheme is not None:
        return None, scheme

    return None, None


@sync_to_async
def authenticate_token(raw_token):
    """Validate a JWT and return the authenticated account or AnonymousUser."""
    if not raw_token:
        return AnonymousUser()
    jwt_auth = AccountJWTAuthentication()
    try:
        validated = jwt_auth.get_validated_token(raw_token)
        return jwt_auth.get_user(validated)
    except (AuthenticationFailed, ValueError, TypeError):
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    """
    Django Channels middleware that authenticates WebSocket connections
    using a JWT access token.

    Token sources (checked in order):
      1. Subprotocol header (``access_token.<JWT>``)
      2. Query string parameter (``?token=<JWT>``)
    """

    async def __call__(self, scope, receive, send):
        raw_token, scheme = token_from_subprotocols(scope)

        if raw_token is None:
            # Fall back to a query-string token only when the client did not
            # declare a subprotocol auth scheme. If a scheme was declared but
            # carried no token, we must not silently downgrade to the query
            # string (the client explicitly chose subprotocol auth).
            if scheme is None:
                raw_token = token_from_query_string(scope)

        if raw_token:
            scope["user"] = await authenticate_token(raw_token)
        else:
            scope["user"] = AnonymousUser()

        scope["jwt_subprotocol"] = scheme
        return await super().__call__(scope, receive, send)
