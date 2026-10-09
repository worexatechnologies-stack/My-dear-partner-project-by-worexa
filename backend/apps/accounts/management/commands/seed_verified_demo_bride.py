"""Seed ONE clearly-labeled DEMO female test profile, fully verified.

NOT a deceptive fake: marked is_seed_data=True, @example.com email,
90000xxxxx test mobile, [DEMO TEST PROFILE] bio. Dev only.
Usage: python manage.py seed_verified_demo_bride
"""
from __future__ import annotations

import gzip
import hashlib
import io
from pathlib import Path

from PIL import Image, ImageOps

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Member, MemberDocument, MemberPreference, MemberProfile
from apps.core.models import (
    MemberMembership,
    MembershipPlan,
    ProfileVerificationDocument,
    ProfileVerificationRequest,
)
from apps.profiles.models import ProfilePhoto

PASSWORD = "Demo@123"
DEMO_PREFIX = "[DEMO TEST PROFILE - NOT A REAL PERSON] "


def process_image_to_webp(image_path: Path) -> dict:
    with Image.open(image_path) as source:
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
    main_img.save(main_buf, format="WEBP", quality=82, method=6)
    main_bytes = main_buf.getvalue()
    thumb_buf = io.BytesIO()
    thumb_img.save(thumb_buf, format="WEBP", quality=80, method=6)
    thumb_bytes = thumb_buf.getvalue()
    return {
        "image_bytes": main_bytes,
        "thumbnail_bytes": thumb_bytes,
        "original_filename": image_path.name,
        "original_size_bytes": image_path.stat().st_size,
        "compressed_size_bytes": len(main_bytes),
        "thumbnail_size_bytes": len(thumb_bytes),
        "checksum": hashlib.sha256(main_bytes).hexdigest(),
    }


class Command(BaseCommand):
    help = "Create one fully-detailed VERIFIED demo female test profile (dev only)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="demo.bride.verified@example.com")
        parser.add_argument("--mobile", default="9000000041")
        parser.add_argument("--password", default=PASSWORD)
        parser.add_argument("--photo", default="female_1.jpg")

    def handle(self, *args, **options):
        env = str(getattr(settings, "ENVIRONMENT", "") or "").lower()
        if env in ("production", "staging"):
            raise CommandError("Refusing to seed demo data in '%s'." % env)
        email = options["email"].strip().lower()
        mobile = options["mobile"].strip()
        password = options["password"]
        if not email.endswith("@example.com"):
            raise CommandError("Demo email must end with @example.com")
        if not (mobile.startswith("90000") or mobile.startswith("99999")):
            raise CommandError("Demo mobile must use 90000xxxxx / 99999xxxxx range.")
        seed_dir = Path(settings.BASE_DIR) / "seed_photos"
        image_path = seed_dir / options["photo"]
        if not image_path.exists():
            cands = sorted(seed_dir.glob("female_*.jpg"))
            if not cands:
                raise CommandError(f"No seed photos in {seed_dir}")
            image_path = cands[0]
        photo_data = process_image_to_webp(image_path)
        now = timezone.now()
        with transaction.atomic():
            Member.objects.filter(email=email).delete()
            Member.objects.filter(mobile_number=mobile).delete()
            member = Member(
                email=email,
                mobile_number=mobile,
                password=make_password(password),
                first_name="Demo_Aarohi",
                last_name="TestBride",
                gender=Member.Gender.FEMALE,
                date_of_birth="1997-06-18",
                profile_created_by=Member.ProfileCreatedBy.SELF,
                is_email_verified=True,
                is_mobile_verified=True,
                account_status=Member.AccountStatus.ACTIVE,
                profile_status=Member.VerificationStatus.APPROVED,
                photo_status=Member.VerificationStatus.APPROVED,
                document_status=Member.VerificationStatus.APPROVED,
                profile_submitted_at=now,
                profile_reviewed_at=now,
                photo_submitted_at=now,
                photo_reviewed_at=now,
                document_submitted_at=now,
                document_reviewed_at=now,
                terms_accepted_at=now,
                is_seed_data=True,
                is_active=True,
            )
            member.save()
            MemberProfile.objects.update_or_create(
                member=member,
                defaults={
                    "marital_status": "Never Married",
                    "height": "5'5\"", "weight": "55 kg",
                    "blood_group": "O+", "complexion": "Fair",
                    "religion": "Hindu", "mother_tongue": "Hindi",
                    "caste": "Brahmin", "sub_caste": "General",
                    "gothra": "Vashistha", "star_nakshatra": "Pushya",
                    "manglik_status": "No",
                    "highest_education": "B.Tech Computer Science",
                    "education_detail": "B.Tech IIIT Bengaluru (Demo)",
                    "occupation": "Software Engineer",
                    "employed_in": "Private Sector",
                    "company": "DemoTech Labs (test)",
                    "annual_income": "12-15 LPA",
                    "work_location": "Bengaluru",
                    "father_status": "Retired Bank Officer",
                    "mother_status": "Homemaker",
                    "num_brothers": 1, "num_sisters": 1,
                    "family_type": "Nuclear Family",
                    "family_status": "Middle Class",
                    "family_location": "Lucknow",
                    "about": DEMO_PREFIX + "Demo test profile. Reading/music/treks.",
                    "hobbies": ["Reading", "Music", "Travel", "Cooking"],
                    "compatibility": 92, "submitted_at": now,
                },
            )
            MemberPreference.objects.update_or_create(
                member=member,
                defaults={
                    "preferred_age_min": 25, "preferred_age_max": 32,
                    "preferred_height_min": "5'6\"",
                    "preferred_height_max": "6'0\"",
                    "preferred_religion": "Hindu",
                    "preferred_caste": "Open to all",
                    "preferred_location": "Bengaluru / Hyderabad",
                    "preferred_education": "Bachelors or Masters",
                    "preferred_occupation": "Working Professional",
                    "preferred_marital_status": "Never Married",
                    "additional_expectations": "[DEMO] Test record.",
                },
            )

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
                width=1200, height=1500,
                thumbnail_width=240, thumbnail_height=300,
                checksum=photo_data["checksum"],
                is_primary=True, display_order=0,
                status=ProfilePhoto.Status.APPROVED,
                verified_at=now,
            )
            doc_raw = photo_data["image_bytes"]
            doc_comp = gzip.compress(doc_raw)
            MemberDocument.objects.filter(member=member).delete()
            mem_doc = MemberDocument.objects.create(
                member=member,
                document_type=MemberDocument.DocumentType.AADHAAR,
                original_file_name="demo_bride_aadhaar_test.webp",
                file_data=doc_comp,
                mime_type="image/webp",
                file_size=len(doc_raw),
                compressed_size=len(doc_comp),
                file_hash=hashlib.sha256(doc_raw).hexdigest(),
                status=MemberDocument.Status.APPROVED,
                admin_comment="Demo seed test document.",
                reviewed_at=now,
            )
            vtypes = (
                ProfileVerificationRequest.VerificationType.FULL_PROFILE,
                ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
                ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
            )
            for vtype in vtypes:
                req, _ = ProfileVerificationRequest.objects.update_or_create(
                    member=member, verification_type=vtype,
                    defaults={
                        "status": ProfileVerificationRequest.Status.APPROVED,
                        "submitted_at": now,
                        "reviewed_at": now,
                        "approved_at": now,
                    },
                )
                is_doc = vtype == ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT
                if is_doc:
                    ProfileVerificationDocument.objects.get_or_create(
                        verification_request=req, member_document=mem_doc,
                    )
            plan = MembershipPlan.objects.filter(is_active=True).first()
            if plan:
                MemberMembership.objects.update_or_create(
                    member=member,
                    defaults={
                        "plan": plan, "start_date": now,
                        "end_date": now + timezone.timedelta(days=90),
                        "is_active": True,
                        "status": MemberMembership.MembershipStatus.ACTIVE,
                        "created_by": "system", "notes": "Demo seed",
                    },
                )
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.SUCCESS("  VERIFIED DEMO BRIDE (TEST DATA ONLY)"))
        self.stdout.write("  Email: %s | Mobile: %s | Pass: %s" % (email, mobile, password))
        self.stdout.write("  profile/photo/document = approved, seed=True")
        self.stdout.write("  Slug: %s | ID: %s" % (member.profile_slug, member.pk))
        self.stdout.write(self.style.SUCCESS("=" * 70))