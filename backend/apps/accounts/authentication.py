from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import AccountType, AuthSession
from .security import account_model_for_type


class AccountJWTAuthentication(BaseAuthentication):
    """Authenticate JWTs from Authorization header OR HttpOnly access_token cookie."""

    keyword = b'Bearer'

    def authenticate(self, request):
        raw_token = None
        header = get_authorization_header(request).split()

        if header:
            if len(header) != 2 or header[0].lower() != self.keyword.lower():
                raise AuthenticationFailed('Invalid authorization header.', code='bad_authorization_header')
            try:
                raw_token = header[1].decode('utf-8')
            except UnicodeDecodeError as exc:
                raise AuthenticationFailed('Invalid or expired access token.', code='invalid_token') from exc
        else:
            raw_token = request.COOKIES.get('access_token')

        if not raw_token:
            return None

        token = self.get_validated_token(raw_token)
        return self.get_user(token), token

    def get_validated_token(self, raw_token):
        try:
            return AccessToken(raw_token)
        except TokenError as exc:
            raise AuthenticationFailed('Invalid or expired access token.', code='invalid_token') from exc

    def get_user(self, token):
        account_type = token.get('account_type')
        account_id = token.get('account_id')
        session_id = token.get('session_id')
        token_version = token.get('token_version')
        if not all((account_type, account_id, session_id)) or token_version is None:
            raise AuthenticationFailed('Token is missing required account claims.', code='invalid_claims')
        if account_type not in AccountType.values:
            raise AuthenticationFailed('Unknown token account type.', code='invalid_account_type')

        model = account_model_for_type(account_type)
        account = model.objects.filter(pk=account_id).select_related('role') if account_type != AccountType.MEMBER else model.objects.filter(pk=account_id)
        account = account.first()
        if account is None or not account.is_active or account.deleted_at is not None:
            raise AuthenticationFailed('Account is inactive or unavailable.', code='account_unavailable')
        if int(token_version) != account.token_version:
            raise AuthenticationFailed('This session has been revoked.', code='session_revoked')

        session = AuthSession.objects.filter(
            pk=session_id,
            account_id=account.pk,
            account_type=account_type,
            token_version=account.token_version,
        ).first()
        if session is None or not session.is_usable:
            raise AuthenticationFailed('This session has been revoked or expired.', code='session_revoked')

        return account

    def authenticate_header(self, request):
        return 'Bearer'


# Compatibility name
VersionedJWTAuthentication = AccountJWTAuthentication

try:
    from drf_spectacular.extensions import OpenApiAuthenticationExtension

    class AccountJWTAuthenticationScheme(OpenApiAuthenticationExtension):
        target_class = 'apps.accounts.authentication.AccountJWTAuthentication'
        name = 'JWTAuth'

        def get_security_definition(self, auto_schema):
            return {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
except ImportError:
    pass
