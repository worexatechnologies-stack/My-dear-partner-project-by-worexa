"""Seed 10 female + 10 male demo accounts with pending photos/documents.

Uses the same seed_photos as seed_dummy_profiles. Photos are uploaded but
left in PENDING status so the admin can approve them manually.
Profile/photo/document statuses on the Member record are also set to 'pending'.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import logging
from pathlib import Path
from PIL import Image, ImageOps

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Member, MemberDocument, MemberPreference, MemberProfile
from apps.core.models import ProfileVerificationRequest, ProfileVerificationDocument
from apps.profiles.models import ProfilePhoto

logger = logging.getLogger(__name__)

PASSWORD = "Demo@123"


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

    checksum = hashlib.sha256(main_bytes).hexdigest()

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
        "checksum": checksum,
    }


FEMALES = [
    {"first": "Ananya",   "last": "Patel",    "dob": "1998-04-15", "edu": "B.Tech Computer Science",   "occ": "Software Engineer",        "comp": "Google India",    "inc": "25-35 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi",   "caste": "Brahmin",   "ht": '5\'5"', "ms": "Never Married"},
    {"first": "Priya",    "last": "Sharma",   "dob": "1996-08-22", "edu": "MBA Finance",               "occ": "Investment Banker",        "comp": "Goldman Sachs",   "inc": "35-50 LPA", "city": "Mumbai",    "rel": "Hindu", "lang": "Marathi",  "caste": "Maratha",   "ht": '5\'6"', "ms": "Never Married"},
    {"first": "Sneha",    "last": "Iyer",     "dob": "1999-01-10", "edu": "MBBS, MD Pediatrics",       "occ": "Doctor",                   "comp": "Apollo Hospitals","inc": "20-30 LPA", "city": "Chennai",   "rel": "Hindu", "lang": "Tamil",    "caste": "Iyer",      "ht": '5\'4"', "ms": "Never Married"},
    {"first": "Pooja",    "last": "Reddy",    "dob": "1997-11-05", "edu": "MS Data Science",           "occ": "Senior Data Scientist",    "comp": "Microsoft",       "inc": "30-40 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu",   "caste": "Reddy",     "ht": '5\'7"', "ms": "Never Married"},
    {"first": "Kavita",   "last": "Gupta",    "dob": "1995-03-18", "edu": "Chartered Accountant (CA)", "occ": "Financial Consultant",     "comp": "Deloitte",        "inc": "20-25 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi",    "caste": "Gupta",     "ht": '5\'3"', "ms": "Never Married"},
    {"first": "Deepika",  "last": "Nair",     "dob": "1998-09-25", "edu": "B.Arch Architecture",       "occ": "Senior Architect",         "comp": "Design Studio",   "inc": "15-20 LPA", "city": "Kochi",     "rel": "Hindu", "lang": "Malayalam","caste": "Nair",      "ht": '5\'5"', "ms": "Never Married"},
    {"first": "Ritu",     "last": "Joshi",    "dob": "1996-12-30", "edu": "M.Tech AI & Robotics",      "occ": "AI Research Scientist",    "comp": "Amazon AWS",      "inc": "35-50 LPA", "city": "Pune",      "rel": "Hindu", "lang": "Marathi",  "caste": "Brahmin",   "ht": '5\'4"', "ms": "Never Married"},
    {"first": "Meera",    "last": "Rao",      "dob": "2000-06-14", "edu": "B.Des Product Design",      "occ": "UI/UX Lead",               "comp": "Flipkart",        "inc": "18-25 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada",  "caste": "Brahmin",   "ht": '5\'6"', "ms": "Never Married"},
    {"first": "Shreya",   "last": "Verma",    "dob": "1997-02-28", "edu": "M.Sc Biotechnology",        "occ": "Research Scientist",       "comp": "Biocon",          "inc": "15-20 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi",    "caste": "Kshatriya", "ht": '5\'5"', "ms": "Never Married"},
    {"first": "Neha",     "last": "Agarwal",  "dob": "1995-07-19", "edu": "MBA Marketing",             "occ": "Brand Manager",            "comp": "Unilever",        "inc": "25-35 LPA", "city": "Mumbai",    "rel": "Hindu", "lang": "Hindi",    "caste": "Agarwal",   "ht": '5\'4"', "ms": "Never Married"},
]

MALES = [
    {"first": "Rahul",     "last": "Verma",    "dob": "1995-03-20", "edu": "B.Tech + M.Tech IIT Delhi",   "occ": "Lead Software Architect",   "comp": "Google India",    "inc": "45-60 LPA",  "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi",   "caste": "Kayastha",  "ht": '5\'11"', "ms": "Never Married"},
    {"first": "Rohan",     "last": "Sharma",   "dob": "1994-09-12", "edu": "MBA IIM Ahmedabad",           "occ": "VP - Investment Banking",    "comp": "Morgan Stanley",  "inc": "50+ LPA",    "city": "Mumbai",    "rel": "Hindu", "lang": "Hindi",   "caste": "Brahmin",   "ht": '6\'0"',  "ms": "Never Married"},
    {"first": "Aditya",    "last": "Patel",    "dob": "1996-01-25", "edu": "MS Computer Science (USA)",   "occ": "Sr Engineering Manager",     "comp": "Microsoft",       "inc": "50+ LPA",    "city": "Hyderabad", "rel": "Hindu", "lang": "Gujarati","caste": "Patel",     "ht": '5\'10"', "ms": "Never Married"},
    {"first": "Amit",      "last": "Iyer",     "dob": "1993-11-18", "edu": "MBBS, MS Orthopedics",        "occ": "Orthopedic Surgeon",         "comp": "Apollo Hospitals","inc": "35-50 LPA",  "city": "Chennai",   "rel": "Hindu", "lang": "Tamil",   "caste": "Iyer",      "ht": '5\'10"', "ms": "Never Married"},
    {"first": "Vikram",    "last": "Reddy",    "dob": "1995-07-04", "edu": "B.Tech NIT Trichy",           "occ": "Staff Engineer",             "comp": "Amazon AWS",      "inc": "40-55 LPA",  "city": "Bengaluru", "rel": "Hindu", "lang": "Telugu",  "caste": "Reddy",     "ht": '6\'1"',  "ms": "Never Married"},
    {"first": "Karthik",   "last": "Gupta",    "dob": "1997-04-19", "edu": "CA Rankholder",               "occ": "Partner - Audit & Assurance","comp": "KPMG",            "inc": "30-40 LPA",  "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi",   "caste": "Gupta",     "ht": '5\'9"',  "ms": "Never Married"},
    {"first": "Siddharth", "last": "Nair",     "dob": "1994-12-08", "edu": "B.Tech Mechanical",           "occ": "Chief Technical Officer",    "comp": "Tech Startup",    "inc": "40-50 LPA",  "city": "Kochi",     "rel": "Hindu", "lang": "Malayalam","caste": "Nair",     "ht": '5\'11"', "ms": "Never Married"},
    {"first": "Arjun",     "last": "Joshi",    "dob": "1996-05-30", "edu": "B.Tech Computer Science",     "occ": "Sr DevOps Consultant",       "comp": "Red Hat",         "inc": "28-36 LPA",  "city": "Pune",      "rel": "Hindu", "lang": "Marathi", "caste": "Joshi",     "ht": '5\'10"', "ms": "Never Married"},
    {"first": "Rajesh",    "last": "Rao",      "dob": "1993-08-14", "edu": "M.Tech Electronics",          "occ": "Principal Hardware Engineer", "comp": "Intel",           "inc": "35-48 LPA",  "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Rao",       "ht": '5\'9"',  "ms": "Never Married"},
    {"first": "Suresh",    "last": "Agarwal",  "dob": "1995-10-22", "edu": "MBA XLRI Jamshedpur",         "occ": "Head of Product",            "comp": "Paytm",           "inc": "40-55 LPA",  "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi",   "caste": "Agarwal",   "ht": '5\'11"', "ms": "Never Married"},
]

HOBBIES = [
    ["Reading", "Traveling", "Music", "Photography", "Cooking"],
    ["Trekking", "Fitness & Gym", "Movies", "Badminton", "Swimming"],
    ["Yoga & Meditation", "Classical Dance", "Gardening", "Baking", "Art & Painting"],
    ["Tech Gadgets", "Road Trips", "Board Games", "Coffee & Cafes", "Writing"],
    ["Cycling", "Running", "Podcasts", "Volunteering", "Fine Dining"],
]


class Command(BaseCommand):
    help = "Seed 10 female + 10 male demo accounts (photos/documents pending for manual approval)."

    def handle(self, *args, **options):
        # Find seed photos
        candidates = [
            Path("/app/seed_photos"),
            Path(settings.BASE_DIR) / "seed_photos",
        ]
        photos_dir = next((p for p in candidates if p.is_dir() and (p / "female_1.jpg").exists()), None)
        if not photos_dir:
            self.stderr.write(self.style.ERROR("seed_photos directory not found."))
            return

        self.stdout.write("Processing seed photos...")
        female_photos = [process_image_to_webp(photos_dir / f"female_{i}.jpg") for i in range(1, 5)]
        male_photos = [process_image_to_webp(photos_dir / f"male_{i}.jpg") for i in range(1, 5)]

        hashed_pw = make_password(PASSWORD)
        now = timezone.now()
        results = []

        with transaction.atomic():
            # --- Females ---
            for idx, d in enumerate(FEMALES):
                email = f"demo.female.{idx+1:02d}@mydearpartner.com"
                mobile = f"97100{idx+1:05d}"

                member, _ = Member.objects.update_or_create(
                    email=email,
                    defaults={
                        "password": hashed_pw,
                        "first_name": d["first"],
                        "last_name": d["last"],
                        "mobile_number": mobile,
                        "gender": "Female",
                        "date_of_birth": d["dob"],
                        "profile_created_by": "Self",
                        "is_active": True,
                        "is_email_verified": True,
                        "is_mobile_verified": True,
                        "is_premium": False,
                        "account_status": "ACTIVE",
                        # --- PENDING for manual approval ---
                        "profile_status": "pending",
                        "photo_status": "pending",
                        "document_status": "pending",
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES[idx % len(HOBBIES)]
                about = (
                    f"Hello! I am {d['first']}, working as a {d['occ']} at {d['comp']} in {d['city']}. "
                    f"I hold a degree in {d['edu']}. Outside work, I enjoy {', '.join(hobbies[:3])}. "
                    f"Looking for an understanding, well-educated partner with good values."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": d["ms"], "height": d["ht"], "weight": "55 kg",
                        "blood_group": "B+", "complexion": "Fair", "religion": d["rel"],
                        "mother_tongue": d["lang"], "caste": d["caste"], "sub_caste": "General",
                        "gothra": "Kashyap", "star_nakshatra": "Rohini", "manglik_status": "No",
                        "highest_education": d["edu"], "education_detail": f"{d['edu']} from Top University",
                        "occupation": d["occ"], "employed_in": "Private Sector",
                        "company": d["comp"], "annual_income": d["inc"], "work_location": d["city"],
                        "father_status": "Employed / Businessman", "mother_status": "Homemaker",
                        "num_brothers": 1, "num_sisters": 0,
                        "family_type": "Nuclear Family", "family_status": "Upper Middle Class",
                        "family_location": d["city"], "about": about, "hobbies": hobbies,
                        "compatibility": 85 + (idx % 14),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 25, "preferred_age_max": 35,
                        "preferred_height_min": '5\'7"', "preferred_height_max": '6\'3"',
                        "preferred_religion": d["rel"], "preferred_caste": "Open to all",
                        "preferred_location": d["city"],
                        "preferred_education": "Bachelors or Masters",
                        "preferred_occupation": "Working Professional",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": "Looking for a caring and family-oriented partner.",
                    },
                )

                # Photo — PENDING (not approved)
                photo_data = female_photos[idx % 4]
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
                    width=photo_data["width"], height=photo_data["height"],
                    thumbnail_width=photo_data["thumbnail_width"],
                    thumbnail_height=photo_data["thumbnail_height"],
                    checksum=photo_data["checksum"],
                    is_primary=True,
                    display_order=0,
                    status=ProfilePhoto.Status.PENDING,  # <-- NOT approved
                )

                # Document — PENDING (Aadhaar Card, not approved)
                doc_raw = photo_data["image_bytes"]
                doc_compressed = gzip.compress(doc_raw)
                MemberDocument.objects.filter(member=member).delete()
                mem_doc = MemberDocument.objects.create(
                    member=member,
                    document_type=MemberDocument.DocumentType.AADHAAR,
                    original_file_name=f"{d['first'].lower()}_aadhaar_card.webp",
                    file_data=doc_compressed,
                    mime_type="image/webp",
                    file_size=len(doc_raw),
                    compressed_size=len(doc_compressed),
                    file_hash=hashlib.sha256(doc_raw).hexdigest(),
                    status=MemberDocument.Status.PENDING,  # <-- NOT approved
                )

                # Queue verification requests for Photo and Document Approvals
                ProfileVerificationRequest.objects.update_or_create(
                    member=member,
                    verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
                    defaults={
                        "status": ProfileVerificationRequest.Status.PENDING_REVIEW,
                        "submitted_at": now,
                    },
                )
                doc_req, _ = ProfileVerificationRequest.objects.update_or_create(
                    member=member,
                    verification_type=ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
                    defaults={
                        "status": ProfileVerificationRequest.Status.PENDING_REVIEW,
                        "submitted_at": now,
                    },
                )
                ProfileVerificationDocument.objects.get_or_create(
                    verification_request=doc_req,
                    member_document=mem_doc,
                )

                results.append(("Female", d["first"], d["last"], email, mobile))

            # --- Males ---
            for idx, d in enumerate(MALES):
                email = f"demo.male.{idx+1:02d}@mydearpartner.com"
                mobile = f"97200{idx+1:05d}"

                member, _ = Member.objects.update_or_create(
                    email=email,
                    defaults={
                        "password": hashed_pw,
                        "first_name": d["first"],
                        "last_name": d["last"],
                        "mobile_number": mobile,
                        "gender": "Male",
                        "date_of_birth": d["dob"],
                        "profile_created_by": "Self",
                        "is_active": True,
                        "is_email_verified": True,
                        "is_mobile_verified": True,
                        "is_premium": False,
                        "account_status": "ACTIVE",
                        # --- PENDING for manual approval ---
                        "profile_status": "pending",
                        "photo_status": "pending",
                        "document_status": "pending",
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES[idx % len(HOBBIES)]
                about = (
                    f"Hi! I am {d['first']}, working as a {d['occ']} at {d['comp']} in {d['city']}. "
                    f"I completed my {d['edu']}. In my free time, I enjoy {', '.join(hobbies[:3])}. "
                    f"Looking for an affectionate, educated life partner."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": d["ms"], "height": d["ht"], "weight": "74 kg",
                        "blood_group": "O+", "complexion": "Wheatish", "religion": d["rel"],
                        "mother_tongue": d["lang"], "caste": d["caste"], "sub_caste": "General",
                        "gothra": "Vashistha", "star_nakshatra": "Pushya", "manglik_status": "No",
                        "highest_education": d["edu"], "education_detail": f"{d['edu']} from Premier Institute",
                        "occupation": d["occ"], "employed_in": "Private Sector",
                        "company": d["comp"], "annual_income": d["inc"], "work_location": d["city"],
                        "father_status": "Retired / Businessman", "mother_status": "Homemaker",
                        "num_brothers": 1, "num_sisters": 0,
                        "family_type": "Nuclear Family", "family_status": "Upper Middle Class",
                        "family_location": d["city"], "about": about, "hobbies": hobbies,
                        "compatibility": 86 + (idx % 13),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 22, "preferred_age_max": 30,
                        "preferred_height_min": '5\'2"', "preferred_height_max": '5\'9"',
                        "preferred_religion": d["rel"], "preferred_caste": "Open to all",
                        "preferred_location": d["city"],
                        "preferred_education": "Bachelors or Masters",
                        "preferred_occupation": "Working Professional",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": "Looking for a well-educated, supportive partner.",
                    },
                )

                # Photo — PENDING (not approved)
                photo_data = male_photos[idx % 4]
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
                    width=photo_data["width"], height=photo_data["height"],
                    thumbnail_width=photo_data["thumbnail_width"],
                    thumbnail_height=photo_data["thumbnail_height"],
                    checksum=photo_data["checksum"],
                    is_primary=True,
                    display_order=0,
                    status=ProfilePhoto.Status.PENDING,  # <-- NOT approved
                )

                # Document — PENDING (Aadhaar Card, not approved)
                doc_raw = photo_data["image_bytes"]
                doc_compressed = gzip.compress(doc_raw)
                MemberDocument.objects.filter(member=member).delete()
                mem_doc = MemberDocument.objects.create(
                    member=member,
                    document_type=MemberDocument.DocumentType.AADHAAR,
                    original_file_name=f"{d['first'].lower()}_aadhaar_card.webp",
                    file_data=doc_compressed,
                    mime_type="image/webp",
                    file_size=len(doc_raw),
                    compressed_size=len(doc_compressed),
                    file_hash=hashlib.sha256(doc_raw).hexdigest(),
                    status=MemberDocument.Status.PENDING,  # <-- NOT approved
                )

                # Queue verification requests for Photo and Document Approvals
                ProfileVerificationRequest.objects.update_or_create(
                    member=member,
                    verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
                    defaults={
                        "status": ProfileVerificationRequest.Status.PENDING_REVIEW,
                        "submitted_at": now,
                    },
                )
                doc_req, _ = ProfileVerificationRequest.objects.update_or_create(
                    member=member,
                    verification_type=ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
                    defaults={
                        "status": ProfileVerificationRequest.Status.PENDING_REVIEW,
                        "submitted_at": now,
                    },
                )
                ProfileVerificationDocument.objects.get_or_create(
                    verification_request=doc_req,
                    member_document=mem_doc,
                )

                results.append(("Male", d["first"], d["last"], email, mobile))

        # Print results
        self.stdout.write("\n" + "=" * 90)
        self.stdout.write(self.style.SUCCESS("  20 DEMO ACCOUNTS CREATED SUCCESSFULLY"))
        self.stdout.write("=" * 90)
        self.stdout.write(f"  Password for ALL accounts: {PASSWORD}")
        self.stdout.write(f"  Photo status: PENDING (approve manually in admin)")
        self.stdout.write(f"  Document status: PENDING (approve manually in admin)")
        self.stdout.write("=" * 90)
        self.stdout.write(f"  {'Gender':<8} {'Name':<22} {'Email':<42} {'Mobile'}")
        self.stdout.write("-" * 90)
        for gender, first, last, email, mobile in results:
            self.stdout.write(f"  {gender:<8} {first + ' ' + last:<22} {email:<42} {mobile}")
        self.stdout.write("=" * 90 + "\n")
