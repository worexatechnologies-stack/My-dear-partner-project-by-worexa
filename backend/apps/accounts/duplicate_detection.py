"""
Duplicate account detection for My Dear Partner.

Runs soft duplicate checks after a member submits their profile.
Results are stored in DuplicateAccountFlag for Admin/Staff review.

Detection strategies:
    1. NAME_DOB_GENDER  — same first_name + date_of_birth + gender
    2. MOBILE_EXACT     — same mobile_number (edge-case: normally blocked at registration)
    3. EMAIL_EXACT      — same email (also normally blocked; guards against race conditions)
    4. PHOTO_HASH       — perceptual hash of primary profile photo image
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.db.models import Q

if TYPE_CHECKING:
    from apps.accounts.models import Member

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _photo_hash(member: 'Member') -> str | None:
    """
    Return the SHA-256 checksum of the primary approved WebP.
    Returns None if no approved primary photo exists.
    """
    try:
        from apps.profiles.models import ProfilePhoto

        photo = (
            ProfilePhoto.objects.without_binary()
            .filter(user=member, is_primary=True, status=ProfilePhoto.Status.APPROVED)
            .first()
        )
        if photo is None:
            photo = (
                ProfilePhoto.objects.without_binary()
                .filter(user=member, status=ProfilePhoto.Status.APPROVED)
                .order_by('display_order', 'created_at')
                .first()
            )
        if photo is None:
            return None
        return photo.checksum
    except Exception as exc:
        logger.warning('Photo hashing failed for member %s: %s', member.pk, exc)
        return None


def _create_flag(primary: 'Member', duplicate: 'Member', flag_type: str, detail: dict) -> None:
    """Create a DuplicateAccountFlag if one doesn't already exist."""
    from apps.accounts.models import DuplicateAccountFlag

    # Canonical ordering: lower UUID = primary
    a, b = sorted([primary, duplicate], key=lambda m: str(m.pk))
    try:
        DuplicateAccountFlag.objects.get_or_create(
            primary_member=a,
            duplicate_member=b,
            flag_type=flag_type,
            defaults={
                'match_detail': detail,
                'auto_detected': True,
            },
        )
    except Exception as exc:
        logger.error('Failed to create DuplicateAccountFlag (%s): %s', flag_type, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_duplicate_checks(member: 'Member') -> int:
    """
    Run all duplicate detection checks against active members.
    Returns the number of new flags raised.

    Should be called after a member submits their profile (asynchronously
    when Celery is available, or synchronously as a fallback).
    """
    from apps.accounts.models import Member as MemberModel, DuplicateAccountFlag

    flags_before = DuplicateAccountFlag.objects.filter(
        Q(primary_member=member) | Q(duplicate_member=member)
    ).count()

    active_others = MemberModel.objects.filter(
        is_active=True,
        deleted_at__isnull=True,
    ).exclude(pk=member.pk)

    # ── 1. Email exact match ─────────────────────────────────────────────────
    if member.email:
        for dup in active_others.filter(email__iexact=member.email):
            _create_flag(member, dup, DuplicateAccountFlag.FlagType.EMAIL_EXACT, {
                'email': member.email,
            })

    # ── 2. Mobile exact match ────────────────────────────────────────────────
    if member.mobile_number:
        for dup in active_others.filter(mobile_number=member.mobile_number):
            _create_flag(member, dup, DuplicateAccountFlag.FlagType.MOBILE_EXACT, {
                'mobile_number': member.mobile_number,
            })

    # ── 3. Name + DOB + Gender ───────────────────────────────────────────────
    if member.first_name and member.date_of_birth and member.gender:
        matches = active_others.filter(
            first_name__iexact=member.first_name,
            date_of_birth=member.date_of_birth,
            gender=member.gender,
        )
        for dup in matches:
            _create_flag(member, dup, DuplicateAccountFlag.FlagType.NAME_DOB_GENDER, {
                'first_name': member.first_name,
                'date_of_birth': str(member.date_of_birth),
                'gender': member.gender,
            })

    # ── 4. Photo hash match ──────────────────────────────────────────────────
    member_hash = _photo_hash(member)
    if member_hash:
        # Check against other members who have approved photos
        for dup in active_others:
            dup_hash = _photo_hash(dup)
            if dup_hash and dup_hash == member_hash:
                _create_flag(member, dup, DuplicateAccountFlag.FlagType.PHOTO_HASH, {
                    'photo_hash': member_hash,
                })

    flags_after = DuplicateAccountFlag.objects.filter(
        Q(primary_member=member) | Q(duplicate_member=member)
    ).count()

    new_flags = flags_after - flags_before
    if new_flags:
        logger.info(
            'Duplicate detection for member %s: %d new flag(s) raised.',
            member.pk, new_flags
        )
    return new_flags
