import os
import sys
import io
import gzip
import hashlib
from pathlib import Path

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
import django
django.setup()

from PIL import Image, ImageOps
from django.utils import timezone
from django.contrib.auth.hashers import make_password

from apps.accounts.models import (
    Member,
    MemberProfile,
    MemberPreference,
    MemberDocument,
)
from apps.profiles.models import ProfilePhoto
from apps.core.models import MemberMembership, MembershipPlan


def process_image(img_path: Path):
    if not img_path.exists():
        return None
    with Image.open(img_path) as source:
        normalized = ImageOps.exif_transpose(source)
        normalized.load()
        if normalized.mode in {"RGBA", "LA"} or "transparency" in normalized.info:
            rgba = normalized.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.getchannel("A"))
            rgb = bg
        else:
            rgb = normalized.convert("RGB")

    main_img = ImageOps.fit(rgb, (1200, 1500), centering=(0.5, 0.5))
    thumb_img = ImageOps.fit(rgb, (240, 300), centering=(0.5, 0.5))

    main_buf = io.BytesIO()
    main_img.save(main_buf, format="WEBP", quality=85, method=6)
    main_bytes = main_buf.getvalue()

    thumb_buf = io.BytesIO()
    thumb_img.save(thumb_buf, format="WEBP", quality=80, method=6)
    thumb_bytes = thumb_buf.getvalue()

    return {
        "image_bytes": main_bytes,
        "thumbnail_bytes": thumb_bytes,
        "filename": img_path.name,
        "orig_size": img_path.stat().st_size,
        "comp_size": len(main_bytes),
        "thumb_size": len(thumb_bytes),
        "checksum": hashlib.sha256(main_bytes).hexdigest(),
    }


def main():
    print("==================================================")
    print("  CREATING FULLY VERIFIED FEMALE MEMBER ACCOUNT   ")
    print("==================================================")

    now = timezone.now()
    email = "ananya.iyer@mydearpartner.com"
    plain_password = "Password@123"
    mobile = "9876543210"
    first_name = "Ananya"
    last_name = "Iyer"

    # 1. Create or update Member
    member, created = Member.objects.update_or_create(
        email=email.lower().strip(),
        defaults={
            "password": make_password(plain_password),
            "first_name": first_name,
            "last_name": last_name,
            "mobile_number": mobile,
            "gender": "Female",
            "date_of_birth": "1998-10-24",
            "profile_created_by": "Self",
            "is_active": True,
            "is_email_verified": True,
            "is_mobile_verified": True,
            "is_premium": True,
            "account_status": Member.AccountStatus.ACTIVE,
            "profile_status": Member.VerificationStatus.APPROVED,
            "photo_status": Member.VerificationStatus.APPROVED,
            "document_status": Member.VerificationStatus.APPROVED,
            "profile_submitted_at": now,
            "profile_reviewed_at": now,
            "photo_submitted_at": now,
            "photo_reviewed_at": now,
            "document_submitted_at": now,
            "document_reviewed_at": now,
            "terms_accepted_at": now,
            "is_seed_data": False,
            "is_hidden": False,
            "failed_login_attempts": 0,
            "locked_until": None,
        }
    )
    print(f"[{'CREATED' if created else 'UPDATED'}] Member: {member.email} ({member.get_full_name()})")

    # 2. Complete MemberProfile with ALL details
    profile, p_created = MemberProfile.objects.update_or_create(
        member=member,
        defaults={
            "marital_status": "Never Married",
            "height": "5'6\"",
            "weight": "54 kg",
            "blood_group": "B+",
            "complexion": "Fair",
            "religion": "Hindu",
            "mother_tongue": "Hindi",
            "caste": "Brahmin",
            "sub_caste": "Saraswat",
            "gothra": "Kashyap",
            "star_nakshatra": "Rohini",
            "manglik_status": "Non-Manglik",
            "highest_education": "M.S. in Computer Science",
            "education_detail": "Masters in Computer Science from BITS Pilani (Honors)",
            "occupation": "Senior Product Manager",
            "employed_in": "Private Sector",
            "company": "Microsoft India",
            "annual_income": "30-40 LPA",
            "work_location": "Bengaluru, Karnataka",
            "father_status": "Retired Government Officer (Class 1)",
            "mother_status": "Senior High School Principal",
            "num_brothers": 1,
            "num_sisters": 0,
            "family_type": "Nuclear Family",
            "family_status": "Upper Middle Class",
            "family_location": "Bengaluru, Karnataka",
            "about": (
                "Warm, ambitious, and grounded professional based in Bengaluru. "
                "I believe in building a relationship anchored in mutual respect, laughter, emotional depth, and shared dreams. "
                "Outside of work, I love exploring cozy cafes, playing classical sitar, weekend hiking, and reading philosophy and fiction. "
                "Looking for a cheerful, progressive, and supportive companion to embark on this beautiful life journey together."
            ),
            "hobbies": [
                "Reading",
                "Traveling",
                "Classical Music",
                "Hiking",
                "Baking & Cooking",
                "Yoga & Wellness",
                "Art & Design",
            ],
            "compatibility": 98,
            "submitted_at": now,
        }
    )
    print(f"[{'CREATED' if p_created else 'UPDATED'}] MemberProfile: All physical, career, family, and astrological details filled.")

    # 3. Complete Partner Preferences
    pref, pref_created = MemberPreference.objects.update_or_create(
        member=member,
        defaults={
            "preferred_age_min": 26,
            "preferred_age_max": 33,
            "preferred_height_min": "5'8\"",
            "preferred_height_max": "6'2\"",
            "preferred_religion": "Hindu",
            "preferred_caste": "Open to all / Brahmin",
            "preferred_location": "Bengaluru, Mumbai, Pune, Hyderabad",
            "preferred_education": "Bachelors or Masters Degree (B.Tech / MBA / MS)",
            "preferred_occupation": "Working Professional (Software / Management / Corporate)",
            "preferred_marital_status": "Never Married",
            "additional_expectations": (
                "Looking for an open-minded, intellectually curious, and family-oriented partner with good moral values. "
                "Someone who appreciates open communication, personal ambition, and shared quality time."
            ),
        }
    )
    print(f"[{'CREATED' if pref_created else 'UPDATED'}] MemberPreference: Full partner preferences populated.")

    # 4. Verified Profile Photos
    seed_dir = Path("/app/seed_photos")
    if not seed_dir.exists():
        seed_dir = Path("backend/seed_photos")

    ProfilePhoto.objects.filter(user=member).delete()

    photo1_data = process_image(seed_dir / "female_2.jpg") or process_image(seed_dir / "female_1.jpg")
    if photo1_data:
        p1 = ProfilePhoto.objects.create(
            user=member,
            image_data=photo1_data["image_bytes"],
            thumbnail_data=photo1_data["thumbnail_bytes"],
            mime_type="image/webp",
            original_filename=photo1_data["filename"],
            original_size_bytes=photo1_data["orig_size"],
            compressed_size_bytes=photo1_data["comp_size"],
            thumbnail_size_bytes=photo1_data["thumb_size"],
            width=1200,
            height=1500,
            thumbnail_width=240,
            thumbnail_height=300,
            checksum=photo1_data["checksum"],
            is_primary=True,
            display_order=0,
            status=ProfilePhoto.Status.APPROVED,
            verified_at=now,
        )
        print(f"[CREATED] Primary Photo: Verified WebP ({photo1_data['filename']})")

    photo2_data = process_image(seed_dir / "female_3.jpg")
    if photo2_data:
        p2 = ProfilePhoto.objects.create(
            user=member,
            image_data=photo2_data["image_bytes"],
            thumbnail_data=photo2_data["thumbnail_bytes"],
            mime_type="image/webp",
            original_filename=photo2_data["filename"],
            original_size_bytes=photo2_data["orig_size"],
            compressed_size_bytes=photo2_data["comp_size"],
            thumbnail_size_bytes=photo2_data["thumb_size"],
            width=1200,
            height=1500,
            thumbnail_width=240,
            thumbnail_height=300,
            checksum=photo2_data["checksum"],
            is_primary=False,
            display_order=1,
            status=ProfilePhoto.Status.APPROVED,
            verified_at=now,
        )
        print(f"[CREATED] Gallery Photo: Verified WebP ({photo2_data['filename']})")

    # 5. Verified Document (Aadhaar Card)
    MemberDocument.objects.filter(member=member).delete()
    dummy_doc_content = b"%PDF-1.4\n%Aadhaar Card Government of India Verified Document\n%%EOF"
    compressed_doc = gzip.compress(dummy_doc_content)
    doc = MemberDocument.objects.create(
        member=member,
        document_type=MemberDocument.DocumentType.AADHAAR,
        custom_document_name="Government ID Verification",
        original_file_name="aadhaar_card_ananya_iyer.pdf",
        file_data=compressed_doc,
        mime_type="application/pdf",
        file_size=len(dummy_doc_content),
        compressed_size=len(compressed_doc),
        file_hash=hashlib.sha256(dummy_doc_content).hexdigest(),
        status=MemberDocument.Status.APPROVED,
        admin_comment="Identity verified with government document.",
        reviewed_at=now,
    )
    print(f"[CREATED] MemberDocument: Verified Aadhaar Card (ID: {doc.pk}, status: APPROVED)")

    # 6. Active Membership Plan
    elite_plan = MembershipPlan.objects.filter(is_active=True).order_by("-rank").first()
    if elite_plan:
        MemberMembership.objects.update_or_create(
            member=member,
            defaults={
                "plan": elite_plan,
                "start_date": now,
                "end_date": now + timezone.timedelta(days=365),
                "is_active": True,
                "status": MemberMembership.MembershipStatus.ACTIVE,
                "created_by": "system",
            }
        )
        print(f"[ACTIVE] Membership: {elite_plan.name} (Valid for 365 days)")

    # 7. Verification Assertions
    member.refresh_from_db()
    print("\n--- Profile Verification Check ---")
    print(f"  * is_email_verified               : {member.is_email_verified}")
    print(f"  * is_mobile_verified              : {member.is_mobile_verified}")
    print(f"  * profile_status                  : {member.profile_status}")
    print(f"  * photo_status                    : {member.photo_status}")
    print(f"  * document_status                 : {member.document_status}")
    print(f"  * is_verified (property)          : {member.is_verified}")
    print(f"  * are_verification_checks_passed  : {member.are_verification_checks_passed}")
    print(f"  * profile_slug                    : {member.profile_slug}")
    print(f"  * password valid                  : {member.check_password(plain_password)}")
    print("==================================================")
    print("ACCOUNT READY FOR USE:")
    print(f"  Email    : {email}")
    print(f"  Password : {plain_password}")
    print(f"  Mobile   : {mobile}")
    print(f"  Name     : {member.get_full_name()}")
    print(f"  Slug     : {member.profile_slug}")
    print("==================================================")


if __name__ == '__main__':
    main()
