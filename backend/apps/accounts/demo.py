"""Demo account configuration and OTP bypass utilities.

This module provides bypass rules and management for the dedicated demo account:
- Mobile: 9187233618
- Password: Kvenki@2002
- Classification: Demo Account (OTP verification bypassed)
"""

from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

DEMO_ACCOUNT_MOBILE = "9187233618"
DEMO_ACCOUNT_PASSWORD = "Kvenki@2002"
DEMO_ACCOUNT_EMAIL = "demo.venki@mydearpartner.com"
DEMO_ACCOUNT_MOBILES = frozenset({"9187233618", "919187233618", "+919187233618"})
DEMO_ACCOUNT_EMAILS = frozenset({
    "demo.venki@mydearpartner.com",
    "demo9187233618@mydearpartner.com",
    "kvenki@mydearpartner.com",
})


def is_demo_mobile(mobile: str | None) -> bool:
    """Return True if the given mobile number belongs to the demo account."""
    if not mobile:
        return False
    from .mobile import normalize_mobile_number
    normalized = normalize_mobile_number(mobile)
    return normalized == DEMO_ACCOUNT_MOBILE or normalized in DEMO_ACCOUNT_MOBILES


def is_demo_account(account_or_identifier: Any) -> bool:
    """Check if the provided account model instance or login identifier is the demo account."""
    if not account_or_identifier:
        return False

    # Check model instance
    if hasattr(account_or_identifier, "mobile_number") or hasattr(account_or_identifier, "email"):
        mobile = getattr(account_or_identifier, "mobile_number", None)
        email = getattr(account_or_identifier, "email", None)
        if mobile and is_demo_mobile(mobile):
            return True
        if email and str(email).strip().lower() in DEMO_ACCOUNT_EMAILS:
            return True
        return False

    # Check raw string identifier
    raw = str(account_or_identifier).strip().lower()
    if is_demo_mobile(raw):
        return True
    if raw in DEMO_ACCOUNT_EMAILS:
        return True
    return False


def ensure_demo_account_exists():
    """Create or update the single demo account with OTP bypassed."""
    from apps.accounts.models import Member, MemberPreference, MemberProfile
    from apps.core.models import MemberMembership, MembershipPlan

    now = timezone.now()

    with transaction.atomic():
        # Search by mobile or email
        member = (
            Member.objects.filter(mobile_number__in=DEMO_ACCOUNT_MOBILES).first()
            or Member.objects.filter(email__in=DEMO_ACCOUNT_EMAILS).first()
        )

        if member is None:
            member = Member(
                email=DEMO_ACCOUNT_EMAIL,
                mobile_number=DEMO_ACCOUNT_MOBILE,
            )

        member.email = DEMO_ACCOUNT_EMAIL
        member.mobile_number = DEMO_ACCOUNT_MOBILE
        member.password = make_password(DEMO_ACCOUNT_PASSWORD)
        member.first_name = "Demo"
        member.last_name = "Account (Venki)"
        member.gender = Member.Gender.MALE
        member.date_of_birth = "2002-01-01"
        member.profile_created_by = Member.ProfileCreatedBy.SELF
        member.is_active = True
        member.is_email_verified = True
        member.is_mobile_verified = True
        member.is_premium = True
        member.account_status = Member.AccountStatus.ACTIVE
        member.profile_status = Member.VerificationStatus.APPROVED
        member.photo_status = Member.VerificationStatus.APPROVED
        member.document_status = Member.VerificationStatus.APPROVED
        member.failed_login_attempts = 0
        member.locked_until = None
        member.terms_accepted_at = now
        member.is_hidden = False
        member.deleted_at = None
        member.save()

        # Create or update profile
        MemberProfile.objects.update_or_create(
            member=member,
            defaults={
                "marital_status": "Never Married",
                "height": "5'10\"",
                "weight": "70 kg",
                "blood_group": "O+",
                "complexion": "Wheatish",
                "religion": "Hindu",
                "mother_tongue": "Kannada",
                "caste": "Vokkaliga",
                "highest_education": "B.Tech Computer Science",
                "occupation": "Software Engineer",
                "employed_in": "Private Sector",
                "company": "Tech Solutions",
                "work_location": "Bengaluru",
                "family_location": "Bengaluru",
                "annual_income": "25-35 LPA",
                "about": (
                    "[Demo Account - OTP Verification Bypassed] "
                    "Pre-verified demonstration account for platform review and testing."
                ),
                "family_type": "Joint",
                "family_status": "Upper Middle Class",
            },
        )

        # Create or update preferences
        MemberPreference.objects.update_or_create(
            member=member,
            defaults={
                "preferred_age_min": 21,
                "preferred_age_max": 28,
                "preferred_height_min": "5'0\"",
                "preferred_height_max": "5'8\"",
                "preferred_marital_status": "Never Married",
                "preferred_religion": "Hindu",
                "preferred_education": "Graduate",
                "preferred_occupation": "Any",
                "preferred_location": "Bengaluru",
                "preferred_family_type": "Nuclear / Joint",
            },
        )

        # Active membership
        plans = list(MembershipPlan.objects.filter(is_active=True).order_by("-rank"))
        plan = next((p for p in plans if "gold" in p.slug.lower() or "premium" in p.slug.lower()), None) or (plans[0] if plans else None)
        if plan:
            MemberMembership.objects.update_or_create(
                member=member,
                defaults={
                    "plan": plan,
                    "start_date": now,
                    "end_date": now + timezone.timedelta(days=365),
                    "is_active": True,
                    "status": MemberMembership.MembershipStatus.ACTIVE,
                    "created_by": "system",
                },
            )

        logger.info("Demo account ensured: %s (%s)", member.email, member.mobile_number)
        return member
