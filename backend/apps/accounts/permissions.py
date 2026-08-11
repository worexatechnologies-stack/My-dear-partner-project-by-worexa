from django.conf import settings
from rest_framework import permissions

from .models import AccountType


class IsAccountType(permissions.BasePermission):
    expected_account_type = None
    message = 'This endpoint is not available to the authenticated account type.'

    def has_permission(self, request, view):
        expected = self.expected_account_type or getattr(view, 'expected_account_type', None)
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.deleted_at is None
            and str(user.account_type) == str(expected)
        )


class IsMember(IsAccountType):
    expected_account_type = AccountType.MEMBER


class IsVerifiedMember(permissions.BasePermission):
    message = 'Required verification is pending. Complete your profile, photos, documents, and verify contact info.'

    def has_permission(self, request, view):
        user = request.user
        is_active_member = bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.deleted_at is None
            and str(user.account_type) == str(AccountType.MEMBER)
            and getattr(user, 'account_status', 'ACTIVE') == 'ACTIVE'
        )
        if not is_active_member:
            return False
        return (
            not getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
            or getattr(user, 'are_verification_checks_passed', False)
        )



class IsSuperAdmin(IsAccountType):
    expected_account_type = AccountType.SUPER_ADMIN


class IsAdminAccount(IsAccountType):
    expected_account_type = AccountType.ADMIN


class IsAdministrativeUser(permissions.BasePermission):
    message = 'An active administrative account is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and str(getattr(user, 'account_type', '')) in {
                AccountType.SUPER_ADMIN,
                AccountType.ADMIN,
            }
            and getattr(user, 'can_access_admin', False)
        )



class HasAdminPermission(permissions.BasePermission):
    message = 'You do not have permission to perform this administrative action.'

    def _required(self, request, view):
        permission_map = getattr(view, 'admin_permission_map', {}) or {}
        action = getattr(view, 'action', None)
        required = permission_map.get(action) if action else None
        if required is None:
            required = permission_map.get(request.method)
        if required is None:
            required = getattr(view, 'required_admin_permission', None)
        if isinstance(required, str):
            return (required,)
        return tuple(required or ())

    def has_permission(self, request, view):
        if not IsAdministrativeUser().has_permission(request, view):
            return False
        required = self._required(request, view)
        if not required:
            return False
        checks = [request.user.has_admin_permission(code) for code in required]
        return any(checks) if getattr(view, 'admin_permissions_any', False) else all(checks)


class IsAdmin(permissions.BasePermission):
    """Compatibility guard for operational APIs: Super Admin or Admin only."""

    def has_permission(self, request, view):
        return str(getattr(request.user, 'account_type', '')) in {
            AccountType.SUPER_ADMIN,
            AccountType.ADMIN,
        } and getattr(request.user, 'can_access_admin', False)


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'member_id'):
            return obj.member_id == request.user.pk
        return getattr(obj, 'pk', None) == request.user.pk


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return IsAdmin().has_permission(request, view) or IsOwner().has_object_permission(request, view, obj)
