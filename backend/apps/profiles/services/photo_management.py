"""Transactional lifecycle operations for PostgreSQL profile photos."""

from __future__ import annotations

from collections.abc import Iterable
import logging
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AccountType, Member
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog

from .image_processing import (
    ImageProcessingService,
    ProcessedProfilePhoto,
    ProfilePhotoProcessingError,
)


MAX_PROFILE_PHOTOS = 6
logger = logging.getLogger(__name__)


class PrimaryPhotoNotVerifiedError(ProfilePhotoProcessingError):
    """Raised when a gallery upload would bypass primary-photo moderation."""


def _actor_type(actor) -> str:
    return str(getattr(actor, "account_type", ""))


def _record_audit(*, photo_id, member_id, actor, action, details=None) -> None:
    ProfilePhotoAuditLog.objects.create(
        photo_id=photo_id,
        member_id=member_id,
        actor_id=getattr(actor, "pk", None),
        actor_type=_actor_type(actor),
        action=action,
        details=details or {},
    )


def _invalidate_profile_caches(member_id) -> None:
    """Invalidate metadata after commit without coupling writes to Redis."""
    keys = (f"profile:{member_id}", f"member:{member_id}:profile")

    def invalidate() -> None:
        try:
            cache.delete_many(keys)
        except Exception:
            # Redis is temporary infrastructure. A cache outage must never
            # roll back PostgreSQL photo bytes, deletion, or moderation state.
            logger.warning("Profile metadata cache invalidation failed", exc_info=True)

    transaction.on_commit(invalidate)


def _reviewer_fields(actor) -> dict:
    """Map the project's separate administrative account tables safely."""
    account_type = _actor_type(actor)
    fields = {
        "verified_by_admin": None,
        "verified_by_staff": None,
        "verified_by_super_admin": None,
    }
    if account_type == AccountType.ADMIN:
        fields["verified_by_admin"] = actor
    elif account_type == AccountType.SUPER_ADMIN:
        fields["verified_by_super_admin"] = actor
    return fields


def _clear_reviewer_fields() -> dict:
    return {
        "verified_by_admin": None,
        "verified_by_staff": None,
        "verified_by_super_admin": None,
        "verified_at": None,
    }


def _initial_status() -> str:
    """Photos default to review; development can opt into explicit auto-approval."""
    if getattr(settings, "AUTO_APPROVE_PROFILE_PHOTOS", False):
        return ProfilePhoto.Status.APPROVED
    return ProfilePhoto.Status.PENDING


def _create_photo_verification_request(member: Member) -> None:
    """Create at most one active member-level photo verification work item."""
    from apps.core.models import ProfileVerificationRequest

    active_statuses = (
        ProfileVerificationRequest.Status.PENDING_REVIEW,
        ProfileVerificationRequest.Status.IN_REVIEW,
    )
    if not ProfileVerificationRequest.objects.filter(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
        status__in=active_statuses,
    ).exists():
        ProfileVerificationRequest.objects.create(
            member=member,
            verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
        )


def _verification_history_actor_fields(actor) -> dict:
    """Return the one reviewer field required by verification history."""
    account_type = _actor_type(actor)
    if account_type == AccountType.ADMIN:
        return {"changed_by_admin": actor}
    if account_type == AccountType.SUPER_ADMIN:
        return {"changed_by_super_admin": actor}
    return {}


def _resolve_completed_photo_verification_requests(*, member: Member, reviewer, reason: str) -> None:
    """Close the member-level queue item after direct per-photo moderation.

    The existing verification queue predates per-photo review.  It remains a
    work-item grouping only; direct moderation must not leave it pending once
    no pending photo remains, otherwise a later worker could re-review an
    already decided gallery.
    """
    from apps.core.models import (
        ProfileVerificationAssignment,
        ProfileVerificationHistory,
        ProfileVerificationRequest,
        WorkAssignment,
    )

    if ProfilePhoto.objects.active().filter(user=member, status=ProfilePhoto.Status.PENDING).exists():
        return

    active_statuses = (
        ProfileVerificationRequest.Status.PENDING_REVIEW,
        ProfileVerificationRequest.Status.IN_REVIEW,
    )
    requests = ProfileVerificationRequest.objects.select_for_update().filter(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
        status__in=active_statuses,
    )
    approved = ProfilePhoto.objects.active().filter(
        user=member, status=ProfilePhoto.Status.APPROVED
    ).exists()
    new_status = (
        ProfileVerificationRequest.Status.APPROVED
        if approved
        else ProfileVerificationRequest.Status.REJECTED
    )
    now = timezone.now()
    history_actor_fields = _verification_history_actor_fields(reviewer)

    for verification in requests:
        old_status = verification.status
        verification.status = new_status
        verification.reviewed_at = now
        verification.approved_at = now if approved else None
        verification.rejected_at = None if approved else now
        verification.rejection_reason = "" if approved else reason.strip()
        verification.save(
            update_fields=(
                "status",
                "reviewed_at",
                "approved_at",
                "rejected_at",
                "rejection_reason",
                "updated_at",
            )
        )
        ProfileVerificationAssignment.objects.filter(
            verification_request=verification,
            is_current=True,
        ).update(is_current=False, completed_at=now)
        WorkAssignment.objects.filter(
            related_profile_verification=verification,
            status__in=(
                WorkAssignment.Status.ASSIGNED,
                WorkAssignment.Status.IN_PROGRESS,
            ),
        ).update(status=WorkAssignment.Status.COMPLETED, completed_at=now)
        if history_actor_fields:
            ProfileVerificationHistory.objects.create(
                verification_request=verification,
                old_status=old_status,
                new_status=new_status,
                reason="" if approved else reason.strip(),
                **history_actor_fields,
            )


def _sync_member_photo_status(member: Member) -> None:
    """Keep the lightweight member status aligned with the primary photo."""
    photo_statuses = list(
        ProfilePhoto.objects.active().filter(user=member)
        .without_binary()
        .values_list("status", "is_primary")
    )
    if not photo_statuses:
        # ``photo_status`` predates the new photo table and its enum has no
        # NOT_SUBMITTED value.  PENDING is its established empty-gallery state.
        target = Member.VerificationStatus.PENDING_REVIEW
    else:
        primary_status = next((status for status, primary in photo_statuses if primary), None)
        if primary_status == ProfilePhoto.Status.APPROVED:
            target = Member.VerificationStatus.APPROVED
        elif primary_status == ProfilePhoto.Status.PENDING or any(
            status == ProfilePhoto.Status.PENDING for status, _ in photo_statuses
        ):
            target = Member.VerificationStatus.PENDING_REVIEW
        else:
            target = Member.VerificationStatus.REJECTED
    if member.photo_status != target:
        member.photo_status = target
        member.save(update_fields=("photo_status", "updated_at"))


def _choose_primary_photo(member: Member, *, exclude_photo_id=None) -> ProfilePhoto | None:
    """Select approved, then pending, then rejected for owner-only continuity."""
    base = ProfilePhoto.objects.active().select_for_update().without_binary().filter(user=member)
    if exclude_photo_id:
        base = base.exclude(pk=exclude_photo_id)
    candidate = (
        base.filter(status=ProfilePhoto.Status.APPROVED)
        .order_by("display_order", "created_at")
        .first()
    )
    if candidate is None:
        candidate = (
            base.filter(status=ProfilePhoto.Status.PENDING)
            .order_by("created_at")
            .first()
        )
    if candidate is None:
        candidate = (
            base.filter(status=ProfilePhoto.Status.REJECTED)
            .order_by("created_at")
            .first()
        )
    ProfilePhoto.objects.filter(user=member, is_primary=True).update(is_primary=False)
    if candidate is not None:
        candidate.is_primary = True
        candidate.save(update_fields=("is_primary", "updated_at"))
    return candidate


def _primary_is_approved(member: Member) -> bool:
    return ProfilePhoto.objects.active().filter(
        user=member,
        is_primary=True,
        status=ProfilePhoto.Status.APPROVED,
    ).exists()


def _photo_defaults(processed: ProcessedProfilePhoto, uploaded_file) -> dict:
    filename = Path(str(getattr(uploaded_file, "name", "") or "")).name[:255]
    return {
        "image_data": processed.image_bytes,
        "thumbnail_data": processed.thumbnail_bytes,
        "mime_type": processed.mime_type,
        "original_filename": filename,
        "original_size_bytes": processed.original_size_bytes,
        "compressed_size_bytes": processed.compressed_size_bytes,
        "thumbnail_size_bytes": processed.thumbnail_size_bytes,
        "width": processed.width,
        "height": processed.height,
        "thumbnail_width": processed.thumbnail_width,
        "thumbnail_height": processed.thumbnail_height,
        "checksum": processed.checksum,
    }


def create_profile_photo(*, member: Member, uploaded_file, actor=None) -> ProfilePhoto:
    """Process and insert a new photo atomically, enforcing the six-photo cap."""
    processed = ImageProcessingService.process_profile_photo(uploaded_file)
    return _create_processed_profile_photo(
        member=member,
        processed=processed,
        uploaded_file=uploaded_file,
        actor=actor or member,
    )


@transaction.atomic
def _create_processed_profile_photo(*, member: Member, processed, uploaded_file, actor) -> ProfilePhoto:
    # Locking the owner row serializes concurrent uploads, primary selection,
    # and the per-user six-photo limit without loading BLOB data.
    member = Member.objects.select_for_update().get(pk=member.pk)
    existing_count = ProfilePhoto.objects.active().filter(user=member).count()
    if existing_count > 0 and not _primary_is_approved(member):
        raise PrimaryPhotoNotVerifiedError("Your primary photo must be approved before adding more photos.")
    from apps.core.entitlements import get_active_entitlements
    max_photos = get_active_entitlements(member).max_photos
    if existing_count >= max_photos:
        raise ProfilePhotoProcessingError(f"Your {get_active_entitlements(member).plan_name} plan allows a maximum of {max_photos} profile photos.")
    if ImageProcessingService.check_duplicate(processed.checksum, member.pk):
        raise ProfilePhotoProcessingError("This photo is already in your gallery. Please choose a different image.")

    initial_status = _initial_status()
    photo = ProfilePhoto.objects.create(
        user=member,
        is_primary=existing_count == 0,
        display_order=existing_count,
        status=initial_status,
        verified_at=timezone.now() if initial_status == ProfilePhoto.Status.APPROVED else None,
        **_photo_defaults(processed, uploaded_file),
    )
    if not _primary_is_approved(member):
        # Repairs a historic/manual zero-primary gallery and promotes a new
        # approved/pending upload ahead of a rejected owner-only primary.
        _choose_primary_photo(member)
        photo.refresh_from_db(fields=("is_primary", "updated_at"))
    if initial_status == ProfilePhoto.Status.PENDING:
        _create_photo_verification_request(member)
    _sync_member_photo_status(member)
    _record_audit(
        photo_id=photo.pk,
        member_id=member.pk,
        actor=actor,
        action=ProfilePhotoAuditLog.Action.UPLOADED,
        details={"status": photo.status, "is_primary": photo.is_primary},
    )
    _invalidate_profile_caches(member.pk)
    from apps.notifications.services import send_event_after_commit
    send_event_after_commit(
        groups=("role_super_admin", "role_admin", "role_staff"),
        event_type="photo.uploaded",
        entity="member_photo",
        entity_id=photo.pk,
        message="A member uploaded a new photo",
        data={
            "member_id": str(member.pk),
            "member_name": member.get_full_name(),
            "photo_id": str(photo.pk),
            "status": photo.status,
            "is_primary": photo.is_primary,
        },
    )
    return photo


def replace_profile_photo(*, photo_id, member: Member, uploaded_file, actor=None) -> ProfilePhoto:
    """Replace bytes in an existing photo record; the URL id stays stable."""
    processed = ImageProcessingService.process_profile_photo(uploaded_file)
    return _replace_processed_profile_photo(
        photo_id=photo_id,
        member=member,
        processed=processed,
        uploaded_file=uploaded_file,
        actor=actor or member,
    )


@transaction.atomic
def _replace_processed_profile_photo(*, photo_id, member, processed, uploaded_file, actor) -> ProfilePhoto:
    member = Member.objects.select_for_update().get(pk=member.pk)
    photo = ProfilePhoto.objects.select_for_update().without_binary().get(pk=photo_id, user=member)
    if ImageProcessingService.check_duplicate(
        processed.checksum, member.pk, exclude_photo_id=photo.pk
    ):
        raise ProfilePhotoProcessingError("This photo is already in your gallery. Please choose a different image.")

    photo.status = _initial_status()
    photo.rejection_reason = ""
    for field, value in _photo_defaults(processed, uploaded_file).items():
        setattr(photo, field, value)
    for field, value in _clear_reviewer_fields().items():
        setattr(photo, field, value)
    photo.save()
    if photo.status == ProfilePhoto.Status.PENDING:
        _create_photo_verification_request(member)
    if not _primary_is_approved(member):
        _choose_primary_photo(member)
    _sync_member_photo_status(member)
    _record_audit(
        photo_id=photo.pk,
        member_id=member.pk,
        actor=actor,
        action=ProfilePhotoAuditLog.Action.REPLACED,
        details={"status": photo.status},
    )
    _invalidate_profile_caches(member.pk)
    photo.refresh_from_db(fields=("is_primary", "status", "updated_at"))
    return photo


@transaction.atomic
def delete_profile_photo(*, photo_id, member: Member, actor=None) -> ProfilePhoto | None:
    """Hard-delete a member-owned photo regardless of status, then promote a valid primary."""
    member = Member.objects.select_for_update().get(pk=member.pk)
    photo = ProfilePhoto.objects.select_for_update().without_binary().get(pk=photo_id, user=member)
    was_primary = photo.is_primary
    was_status = photo.status
    deleted_id = photo.pk
    photo.delete()
    replacement = _choose_primary_photo(member) if was_primary else None
    _sync_member_photo_status(member)
    _record_audit(
        photo_id=deleted_id,
        member_id=member.pk,
        actor=actor or member,
        action=ProfilePhotoAuditLog.Action.DELETED,
        details={
            "deleted_by": "member",
            "was_primary": was_primary,
            "was_status": was_status,
            "replacement_id": str(replacement.pk) if replacement else None,
        },
    )
    _invalidate_profile_caches(member.pk)
    from apps.notifications.services import send_event_after_commit
    send_event_after_commit(
        groups=("role_super_admin", "role_admin", "role_staff"),
        event_type="photo.deleted",
        entity="member_photo",
        entity_id=deleted_id,
        message=f"Photo deleted for {member.get_full_name()}",
        data={
            "member_id": str(member.pk),
            "member_name": member.get_full_name(),
            "photo_id": str(deleted_id),
            "was_primary": was_primary,
            "was_status": was_status,
            "replacement_id": str(replacement.pk) if replacement else None,
        },
    )
    if replacement and replacement.pk != deleted_id:
        send_event_after_commit(
            groups=("role_super_admin", "role_admin", "role_staff", f"user_{member.pk}"),
            event_type="photo.primary_changed",
            entity="member_photo",
            entity_id=replacement.pk,
            message=f"Primary photo changed for {member.get_full_name()}",
            data={
                "member_id": str(member.pk),
                "member_name": member.get_full_name(),
                "photo_id": str(replacement.pk),
                "status": replacement.status,
            },
        )
    return replacement


@transaction.atomic
def set_primary_profile_photo(*, photo_id, member: Member, actor=None) -> ProfilePhoto:
    member = Member.objects.select_for_update().get(pk=member.pk)
    photo = ProfilePhoto.objects.select_for_update().without_binary().get(pk=photo_id, user=member)
    if photo.status != ProfilePhoto.Status.APPROVED:
        raise ProfilePhotoProcessingError("Only approved photos can be set as primary.")
    ProfilePhoto.objects.filter(user=member, is_primary=True).exclude(pk=photo.pk).update(
        is_primary=False
    )
    if not photo.is_primary:
        photo.is_primary = True
        photo.save(update_fields=("is_primary", "updated_at"))
    _sync_member_photo_status(member)
    _record_audit(
        photo_id=photo.pk,
        member_id=member.pk,
        actor=actor or member,
        action=ProfilePhotoAuditLog.Action.SET_PRIMARY,
    )
    _invalidate_profile_caches(member.pk)
    from apps.notifications.services import send_event_after_commit
    send_event_after_commit(
        groups=("role_super_admin", "role_admin", "role_staff", f"user_{member.pk}"),
        event_type="photo.primary_changed",
        entity="member_photo",
        entity_id=photo.pk,
        message=f"Primary photo changed for {member.get_full_name()}",
        data={
            "member_id": str(member.pk),
            "member_name": member.get_full_name(),
            "photo_id": str(photo.pk),
            "status": photo.status,
        },
    )
    return photo


@transaction.atomic
def reorder_profile_photos(*, member: Member, photo_ids: Iterable, actor=None) -> list[ProfilePhoto]:
    ordered_ids = list(photo_ids)
    if not ordered_ids:
        raise ProfilePhotoProcessingError("Provide every current photo id in display order.")
    if len({str(photo_id) for photo_id in ordered_ids}) != len(ordered_ids):
        raise ProfilePhotoProcessingError("Photo ids must not contain duplicates.")

    member = Member.objects.select_for_update().get(pk=member.pk)
    photos = list(
        ProfilePhoto.objects.select_for_update().without_binary().filter(user=member)
    )
    by_id = {str(photo.pk): photo for photo in photos}
    if set(str(photo_id) for photo_id in ordered_ids) != set(by_id):
        raise ProfilePhotoProcessingError("Photo ids must include every photo you own exactly once.")
    for order, photo_id in enumerate(ordered_ids):
        photo = by_id[str(photo_id)]
        if photo.display_order != order:
            photo.display_order = order
            photo.save(update_fields=("display_order", "updated_at"))
    _record_audit(
        photo_id=ordered_ids[0],
        member_id=member.pk,
        actor=actor or member,
        action=ProfilePhotoAuditLog.Action.REORDERED,
        details={"photo_ids": [str(photo_id) for photo_id in ordered_ids]},
    )
    _invalidate_profile_caches(member.pk)
    return sorted(photos, key=lambda photo: photo.display_order)


@transaction.atomic
def review_profile_photo(
    *,
    photo_id,
    reviewer,
    approve: bool,
    reason: str = "",
    sync_verification_request: bool = True,
) -> ProfilePhoto:
    """Approve or reject one photo and keep member/primary state consistent."""
    photo = (
        ProfilePhoto.objects.select_for_update()
        .without_binary()
        .select_related("user")
        .get(pk=photo_id)
    )
    member = Member.objects.select_for_update().get(pk=photo.user_id)
    if not approve and not reason.strip():
        raise ProfilePhotoProcessingError("A rejection reason is required.")

    photo.status = ProfilePhoto.Status.APPROVED if approve else ProfilePhoto.Status.REJECTED
    photo.rejection_reason = "" if approve else reason.strip()
    photo.verified_at = timezone.now()
    for field, value in _reviewer_fields(reviewer).items():
        setattr(photo, field, value)
    photo.save()

    # An approved photo should become the public primary if the current primary
    # is pending/rejected.  Rejection reassigns to approved, then pending.
    if approve and not _primary_is_approved(member):
        _choose_primary_photo(member)
    elif not approve and photo.is_primary:
        replacement = _choose_primary_photo(member, exclude_photo_id=photo.pk)
        if replacement is None:
            # A rejected-only one-photo gallery still keeps exactly one owner-
            # visible primary; unrelated members cannot fetch rejected bytes.
            photo.is_primary = True
            photo.save(update_fields=("is_primary", "updated_at"))
    _sync_member_photo_status(member)
    _record_audit(
        photo_id=photo.pk,
        member_id=member.pk,
        actor=reviewer,
        action=(
            ProfilePhotoAuditLog.Action.APPROVED
            if approve
            else ProfilePhotoAuditLog.Action.REJECTED
        ),
        details={"reason": photo.rejection_reason} if not approve else {},
    )
    from apps.core.api_utils import notify
    if approve:
        notify(
            member,
            notification_type="PROFILE_PHOTO_APPROVED",
            title="Photo approved",
            message="Your photo has been approved and is now visible on your profile.",
            related_object=photo,
        )
    else:
        notify(
            member,
            notification_type="PROFILE_PHOTO_REJECTED",
            title="Photo needs attention",
            message=f"Your photo was not approved: {photo.rejection_reason}. Please upload a new one.",
            related_object=photo,
            priority="HIGH",
        )
    if sync_verification_request:
        _resolve_completed_photo_verification_requests(
            member=member,
            reviewer=reviewer,
            reason=photo.rejection_reason,
        )
    _invalidate_profile_caches(member.pk)
    from apps.notifications.services import send_event_after_commit
    event_type = "photo.approved" if approve else "photo.rejected"
    send_event_after_commit(
        groups=("role_super_admin", "role_admin", "role_staff", f"user_{member.pk}"),
        event_type=event_type,
        entity="member_photo",
        entity_id=photo.pk,
        message=f"Photo {'approved' if approve else 'rejected'} for {member.get_full_name()}",
        data={
            "member_id": str(member.pk),
            "member_name": member.get_full_name(),
            "photo_id": str(photo.pk),
            "status": photo.status,
            "rejection_reason": photo.rejection_reason if not approve else "",
        },
    )
    photo.refresh_from_db(fields=("is_primary", "status", "updated_at"))
    return photo


def review_all_pending_profile_photos(*, member: Member, reviewer, approve: bool, reason: str = "") -> int:
    """Compatibility bridge for the existing member-level verification queue."""
    count = 0
    for photo_id in ProfilePhoto.objects.filter(
        user=member, status=ProfilePhoto.Status.PENDING
    ).values_list("pk", flat=True):
        review_profile_photo(
            photo_id=photo_id,
            reviewer=reviewer,
            approve=approve,
            reason=reason or "Rejected by profile verification review",
            sync_verification_request=False,
        )
        count += 1
    return count
