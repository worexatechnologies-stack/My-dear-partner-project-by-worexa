"""Synchronize the one configured Super Admin without exposing its secret."""

from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from .models import Admin, AdminRole, Member, RoleCode, Staff, SuperAdmin
from .rbac import seed_rbac
from .security import revoke_all_account_sessions


class SuperAdminSyncError(ImproperlyConfigured):
    """Raised when the configured super-admin account cannot be synchronized."""


@dataclass(frozen=True)
class SuperAdminSyncResult:
    created: bool = False
    updated: bool = False
    skipped: bool = False


def _configured_credentials():
    email = str(getattr(settings, 'SUPERADMIN_EMAIL', '') or '').strip().lower()
    password = str(getattr(settings, 'SUPERADMIN_PASSWORD', '') or '')

    if not email and not password:
        return None
    if not email or not password:
        raise SuperAdminSyncError(
            'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be configured together.'
        )

    try:
        validate_email(email)
    except ValidationError as exc:
        raise SuperAdminSyncError('SUPERADMIN_EMAIL must be a valid email address.') from exc

    return email, password


def _ensure_email_is_not_owned_by_another_account(email):
    for model in (Member, Admin, Staff):
        if model.objects.filter(email__iexact=email).exists():
            raise SuperAdminSyncError(
                'Configured super-admin email is already assigned to another account type.'
            )


@transaction.atomic
def sync_super_admin_from_environment():
    """Create or update the singleton Super Admin from server-side settings.

    The SuperAdmin table and its SUPER_ADMIN role identify the account; the
    configured email is only a mutable credential, never the account identity.
    """

    credentials = _configured_credentials()
    if credentials is None:
        return SuperAdminSyncResult(skipped=True)

    email, password = credentials
    seed_rbac()

    # Serializing on the system role prevents concurrent service starts from
    # creating two super-admin records.
    role = AdminRole.objects.select_for_update().get(code=RoleCode.SUPER_ADMIN)
    accounts = list(SuperAdmin.objects.select_for_update().order_by('created_at', 'pk'))
    if len(accounts) > 1:
        raise SuperAdminSyncError(
            'More than one Super Admin exists. Resolve the duplicate accounts before synchronization.'
        )

    if not accounts:
        _ensure_email_is_not_owned_by_another_account(email)
        SuperAdmin.objects.create_user(
            email=email,
            password=password,
            mobile_number=str(getattr(settings, 'SUPERADMIN_MOBILE', '') or '').strip() or None,
            first_name=str(getattr(settings, 'SUPERADMIN_FIRST_NAME', 'Super') or 'Super').strip(),
            last_name=str(getattr(settings, 'SUPERADMIN_LAST_NAME', 'Admin') or 'Admin').strip(),
            role=role,
            is_email_verified=True,
            two_factor_enabled=False,
        )
        return SuperAdminSyncResult(created=True)

    account = accounts[0]
    changes = []
    password_changed = False

    if account.email.casefold() != email.casefold():
        _ensure_email_is_not_owned_by_another_account(email)
        account.email = email
        changes.append('email')
    if account.role_id != role.pk:
        account.role = role
        changes.append('role')
    if not account.is_active:
        account.is_active = True
        changes.append('is_active')
    if account.deleted_at is not None:
        account.deleted_at = None
        changes.append('deleted_at')
    if account.two_factor_enabled:
        account.two_factor_enabled = False
        changes.append('two_factor_enabled')
    if not account.check_password(password):
        account.set_password(password)
        account.password_changed_at = timezone.now()
        password_changed = True
        changes.extend(('password', 'password_changed_at'))

    if changes:
        account.save(update_fields=tuple(changes) + ('updated_at',))
    if password_changed:
        revoke_all_account_sessions(account, reason='ENV_PASSWORD_CHANGED')

    return SuperAdminSyncResult(updated=bool(changes))
