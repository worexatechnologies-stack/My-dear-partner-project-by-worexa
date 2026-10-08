#!/usr/bin/env python
"""Create test/fake member accounts with realistic profile details, photos, and active memberships."""

import hashlib
import io
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production" if os.getenv("DJANGO_ENV") == "production" else "config.settings.local")
try:
    import django
    django.setup()
except Exception:
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
    import django
    django.setup()

from PIL import Image, ImageOps
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from apps.accounts.models import Member, MemberPreference, MemberProfile
from apps.core.models import MemberMembership, MembershipPlan
from apps.profiles.models import ProfilePhoto


def process_image_to_webp(image_path: Path) -> dict:
    with Image.open(image_path) as source:
        normalized = ImageOps.exif_transpose(source)
        normalized.load()
        if normalized.mode in {"RGBA", "LA"} or "transparency" in normalized.info:
            rgba = normalized.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            rgb = background
        else:
            rgb = normalized.convert("RGB")

    main_img = ImageOps.fit(rgb, (1200, 1500), centering=(0.5, 0.5))
    thumb_img = ImageOps.fit(rgb, (240, 300), centering=(0.5, 0.5))

    main_buf = io.BytesIO()
    main_img.save(main_buf, format="WEBP", quality=82, method=6)
    main_bytes = main_buf.getvalue()

    thumb_buf = io.BytesIO()
    thumb_img.save(thumb_buf, format="WEBP", quality=80, method=6)
    thumb_bytes = thumb_buf.getvalue()

    return {
        "image_bytes": main_bytes,
        "thumbnail_bytes": thumb_bytes,
        "mime_type": "image/webp",
        "original_filename": image_path.name,
        "original_size_bytes": image_path.stat().st_size,
        "compressed_size_bytes": len(main_bytes),
        "thumbnail_size_bytes": len(thumb_bytes),
        "width": 1200,
        "height": 1500,
        "thumbnail_width": 240,
        "thumbnail_height": 300,
        "checksum": hashlib.sha256(main_bytes).hexdigest(),
    }


def create_or_update_account(
    email: str,
    password_plain: str,
    mobile: str,
    first_name: str,
    last_name: str,
    gender: str,
    dob: str,
    occupation: str,
    company: str,
    education: str,
    income: str,
    city: str,
    religion: str,
    caste: str,
    height: str,
    photo_file: str,
):
    print(f"Configuring account: {email}...")
    now = timezone.now()

    # Find photo
    candidates = [Path("/app/seed_photos"), backend_dir / "seed_photos", Path("seed_photos")]
    photos_dir = next((p for p in candidates if p.is_dir() and (p / photo_file).exists()), None)
    photo_path = (photos_dir / photo_file) if photos_dir else None
    photo_data = process_image_to_webp(photo_path) if (photo_path and photo_path.exists()) else None

    # Retrieve or create member
    member, _ = Member.objects.update_or_create(
        email=email.lower().strip(),
        defaults={
            "password": make_password(password_plain),
            "first_name": first_name,
            "last_name": last_name,
            "mobile_number": mobile,
            "gender": gender,
            "date_of_birth": dob,
            "profile_created_by": "Self",
            "is_active": True,
            "is_email_verified": True,
            "is_mobile_verified": True,
            "is_premium": True,
            "account_status": Member.AccountStatus.ACTIVE,
            "profile_status": Member.VerificationStatus.APPROVED,
            "photo_status": Member.VerificationStatus.APPROVED,
            "document_status": Member.VerificationStatus.APPROVED,
            "is_seed_data": False,
            "is_hidden": False,
            "failed_login_attempts": 0,
            "locked_until": None,
            "terms_accepted_at": now,
        },
    )

    # Profile
    MemberProfile.objects.update_or_create(
        member=member,
        defaults={
            "marital_status": "Never Married",
            "height": height,
            "weight": "70 kg" if gender == "Male" else "54 kg",
            "blood_group": "O+",
            "complexion": "Fair",
            "religion": religion,
            "mother_tongue": "Hindi",
            "caste": caste,
            "sub_caste": "General",
            "highest_education": education,
            "education_detail": f"{education} from Top University",
            "occupation": occupation,
            "employed_in": "Private Sector",
            "company": company,
            "annual_income": income,
            "work_location": city,
            "father_status": "Employed / Businessman",
            "mother_status": "Homemaker",
            "num_brothers": 1,
            "num_sisters": 0,
            "family_type": "Nuclear Family",
            "family_status": "Upper Middle Class",
            "family_location": city,
            "about": (
                f"Hello! I am {first_name}, working as a {occupation} at {company} in {city}. "
                f"I value family traditions, mutual respect, personal growth, and work-life balance. "
                f"Looking for an understanding and cheerful life partner to build a joyful future together."
            ),
            "hobbies": ["Reading", "Traveling", "Music", "Fitness & Gym", "Coffee & Cafes"],
            "compatibility": 95,
        },
    )

    # Preferences
    MemberPreference.objects.update_or_create(
        member=member,
        defaults={
            "preferred_age_min": 24 if gender == "Male" else 26,
            "preferred_age_max": 30 if gender == "Male" else 34,
            "preferred_height_min": "5'2\"" if gender == "Male" else "5'8\"",
            "preferred_height_max": "5'8\"" if gender == "Male" else "6'2\"",
            "preferred_religion": religion,
            "preferred_caste": "Open to all / Same Caste",
            "preferred_location": city,
            "preferred_education": "Bachelors or Masters Degree",
            "preferred_occupation": "Working Professional",
            "preferred_marital_status": "Never Married",
            "additional_expectations": "Looking for a well-educated, kind, and supportive partner.",
        },
    )

    # Photo
    if photo_data:
        ProfilePhoto.objects.filter(user=member).delete()
        ProfilePhoto.objects.create(
            user=member,
            image_data=photo_data["image_bytes"],
            thumbnail_data=photo_data["thumbnail_bytes"],
            mime_type="image/webp",
            original_filename=photo_data["original_filename"],
            original_size_bytes=photo_data["original_size_bytes"],
            compressed_size_bytes=photo_data["compressed_size_bytes"],
            thumbnail_size_bytes=photo_data["thumbnail_size_bytes"],
            width=photo_data["width"],
            height=photo_data["height"],
            thumbnail_width=photo_data["thumbnail_width"],
            thumbnail_height=photo_data["thumbnail_height"],
            checksum=photo_data["checksum"],
            is_primary=True,
            display_order=0,
            status=ProfilePhoto.Status.APPROVED,
            verified_at=now,
        )

    # Membership
    plans = list(MembershipPlan.objects.filter(is_active=True).order_by("-rank"))
    gold_plan = next((p for p in plans if "gold" in p.slug.lower() or "premium" in p.slug.lower()), None) or (plans[0] if plans else None)
    if gold_plan:
        MemberMembership.objects.update_or_create(
            member=member,
            defaults={
                "plan": gold_plan,
                "start_date": now,
                "end_date": now + timezone.timedelta(days=365),
                "is_active": True,
                "status": MemberMembership.MembershipStatus.ACTIVE,
                "created_by": "system",
            },
        )

    # Test password verification
    valid = member.check_password(password_plain)
    print(f"  -> Created/Updated successfully. Password valid: {valid}")
    return member


def main():
    print("=== Creating Fake Accounts ===")
    
    # 1. Male fake account
    create_or_update_account(
        email="fakeuser@mydearpartner.com",
        password_plain="Password@123",
        mobile="9876543299",
        first_name="Aarav",
        last_name="Sharma",
        gender="Male",
        dob="1998-05-15",
        occupation="Senior Software Engineer",
        company="Google India",
        education="B.Tech Computer Science",
        income="35-50 LPA",
        city="Bengaluru",
        religion="Hindu",
        caste="Brahmin",
        height="5'11\"",
        photo_file="male_1.jpg",
    )

    # 2. Female fake account
    create_or_update_account(
        email="fakeuser.female@mydearpartner.com",
        password_plain="Password@123",
        mobile="9876543298",
        first_name="Priya",
        last_name="Sharma",
        gender="Female",
        dob="1999-08-20",
        occupation="Product Designer",
        company="Flipkart",
        education="B.Des Product Design",
        income="25-35 LPA",
        city="Bengaluru",
        religion="Hindu",
        caste="Brahmin",
        height="5'5\"",
        photo_file="female_1.jpg",
    )

    print("\n=== Account Creation Complete ===")


if __name__ == "__main__":
    main()
