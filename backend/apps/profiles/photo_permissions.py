"""Authorization rules for private profile image endpoints."""

from __future__ import annotations

from django.db.models import Q

from apps.accounts.models import AccountType
from apps.core.models import ProfileBlock

from .models import ProfilePhoto


PHOTO_MODERATION_PERMISSIONS = (
    "verification.approve",
    "verification.reject",
)


def is_active_member(member) -> bool:
    return bool(
        member
        and getattr(member, "is_active", False)
        and getattr(member, "deleted_at", None) is None
        and getattr(member, "account_status", None) == "ACTIVE"
        and not getattr(member, "is_hidden", False)
    )


def _active_administrative_actor(user) -> bool:
    account_type = str(getattr(user, "account_type", ""))
    if account_type not in {AccountType.SUPER_ADMIN, AccountType.ADMIN}:
        return False
    return bool(getattr(user, "can_access_admin", False))


def _has_permission(user, code: str) -> bool:
    has_permission = getattr(user, "has_admin_permission", None)
    return bool(has_permission and has_permission(code))


def _is_assigned_photo_reviewer(user, photo: ProfilePhoto) -> bool:
    """Previously staff-scoped; ADMIN users with verification permission can review any photo."""
    if str(getattr(user, "account_type", "")) not in {AccountType.ADMIN, AccountType.SUPER_ADMIN}:
        return False
    return _has_permission(user, "verification.view_all") or any(
        _has_permission(user, code) for code in PHOTO_MODERATION_PERMISSIONS
    )


def can_view_restricted_profile_photo(user, photo: ProfilePhoto) -> bool:
    """Allow private moderation images only within an explicit review scope."""
    if not _active_administrative_actor(user):
        return False
    account_type = str(getattr(user, "account_type", ""))
    if account_type == AccountType.SUPER_ADMIN:
        return True
    if _has_permission(user, "verification.view_all"):
        return True
    return any(_has_permission(user, code) for code in PHOTO_MODERATION_PERMISSIONS)


def can_review_profile_photos(
    user,
    photo: ProfilePhoto | None = None,
    *,
    action: str | None = None,
) -> bool:
    """Require explicit action permission for photo review operations."""
    if not _active_administrative_actor(user):
        return False
    account_type = str(getattr(user, "account_type", ""))
    if account_type == AccountType.SUPER_ADMIN:
        return True

    permission = {
        "approve": "verification.approve",
        "reject": "verification.reject",
    }.get(action)
    if permission is None:
        # Compatibility for metadata serializers: actors who can see all
        # verification photos are considered unrestricted without an object.
        return _has_permission(user, "verification.view_all") or any(
            _has_permission(user, code) for code in PHOTO_MODERATION_PERMISSIONS
        )
    return _has_permission(user, permission)


def can_view_profile_photo(user, photo: ProfilePhoto) -> bool:
    """Apply owner, staff, visibility, state, and reciprocal block rules."""
    if photo.is_deleted:
        return False
    if not user or not getattr(user, "is_authenticated", False):
        return False

    account_type = str(getattr(user, "account_type", ""))
    if account_type == AccountType.MEMBER and user.pk == photo.user_id:
        # Owners may review all of their own photos, including pending/rejected.
        return bool(
            getattr(user, "is_active", False)
            and getattr(user, "deleted_at", None) is None
            and getattr(user, "account_status", None) == "ACTIVE"
        )
    if can_view_restricted_profile_photo(user, photo):
        return True
    if account_type != AccountType.MEMBER:
        return False
    if photo.status != ProfilePhoto.Status.APPROVED:
        return False
    # All approved photos are visible to active members. Photo approval,
    # member activity, and reciprocal blocks continue to protect visibility.
    if not is_active_member(user) or not is_active_member(photo.user):
        return False

    return not ProfileBlock.objects.filter(
        Q(blocker_id=user.pk, blocked_id=photo.user_id)
        | Q(blocker_id=photo.user_id, blocked_id=user.pk)
    ).exists()
