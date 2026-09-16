"""Management command to generate 100 new dummy member profiles in PENDING state.

Creates 50 female and 50 male member accounts with complete profiles,
partner preferences, a PENDING profile photo (using the seed_photos/
directory), and a PENDING Aadhaar document.  No memberships or
auto-approvals are applied -- the admin must approve each profile manually.

Emails use the pattern dummy2.female.XX / dummy2.male.XX so they never
clash with the existing seed_dummy_profiles command (dummy.female.XX /
dummy.male.XX).
"""

from __future__ import annotations

import gzip
import hashlib
import io
import logging
import textwrap
from pathlib import Path

from PIL import Image, ImageOps

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Member, MemberDocument, MemberPreference, MemberProfile
from apps.profiles.models import ProfilePhoto

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Image helper
# ---------------------------------------------------------------------------

def _process_image_to_webp(image_path: Path) -> dict:
    """Convert a JPEG seed photo to 4:5 WebP (1200x1500) + thumbnail (240x300)."""
    with Image.open(image_path) as src:
        img = ImageOps.exif_transpose(src)
        img.load()
        if img.mode in {"RGBA", "LA"} or "transparency" in img.info:
            rgba = img.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.getchannel("A"))
            rgb = bg
        else:
            rgb = img.convert("RGB")

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


def _make_fake_pdf_bytes(name: str, doc_type: str) -> bytes:
    """Return minimal gzip-compressed fake PDF bytes for the document."""
    content = textwrap.dedent(f"""\
        %PDF-1.4
        1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj
        2 0 obj<</Type /Pages /Kids[3 0 R]/Count 1>>endobj
        3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 595 842]
        /Contents 4 0 R /Resources<<>>>>endobj
        4 0 obj<</Length 44>>
        stream
        BT /F1 12 Tf 72 720 Td ({name} - {doc_type}) Tj ET
        endstream
        endobj
        xref
        0 5
        trailer<</Size 5/Root 1 0 R>>
        startxref
        0
        %%EOF
    """).encode()
    return gzip.compress(content)


# ---------------------------------------------------------------------------
# Data tables  (all NEW -- do not overlap with seed_dummy_profiles.py)
# ---------------------------------------------------------------------------

FEMALE_NAMES = [
    ("Akanksha", "Mehta"), ("Bhavika", "Shah"), ("Chitra", "Pillai"), ("Disha", "Kohli"),
    ("Esha", "Banerjee"), ("Falak", "Rao"), ("Garima", "Tiwari"), ("Hema", "Shetty"),
    ("Indira", "Negi"), ("Janhvi", "Srinivasan"), ("Kajal", "Pandya"), ("Lata", "Dube"),
    ("Manasi", "Kale"), ("Naina", "Garg"), ("Ojasvi", "Bhatt"), ("Pallavi", "Wagh"),
    ("Queenie", "Abraham"), ("Ranjana", "Iyengar"), ("Savita", "Lal"), ("Taruna", "Mistry"),
    ("Usha", "Vyas"), ("Vaidehi", "Jain"), ("Waheeda", "Begum"), ("Xenia", "DSouza"),
    ("Yamini", "Thampi"), ("Zara", "Khanna"), ("Anushka", "Dalvi"), ("Bharati", "Narayanan"),
    ("Chandrika", "Unni"), ("Devika", "Rajan"), ("Elina", "Chatterjee"), ("Falguni", "Modi"),
    ("Geetanjali", "Srivastava"), ("Harsha", "Bhosle"), ("Indrani", "Datta"),
    ("Jyotsna", "Kelkar"), ("Kamakshi", "Subramanian"), ("Laxmi", "Hegde"),
    ("Mythili", "Krishnamurthy"), ("Nirupama", "Shinde"), ("Oormila", "Bendre"),
    ("Padmaja", "Gokhale"), ("Reshma", "Tamboli"), ("Shalini", "Phadke"),
    ("Tejal", "Khatri"), ("Urmila", "Naik"), ("Veena", "Karmarkar"),
    ("Weena", "Serrao"), ("Yashodhara", "Limaye"), ("Zeenat", "Shaikh"),
]

MALE_NAMES = [
    ("Aarav", "Mehta"), ("Balaji", "Krishnaswamy"), ("Chirag", "Thakkar"), ("Dhruv", "Anand"),
    ("Ekansh", "Shukla"), ("Farhan", "Siddiqui"), ("Girish", "Nair"), ("Hardik", "Solanki"),
    ("Ishan", "Babu"), ("Jatin", "Kohli"), ("Kartik", "Malhotra"), ("Lokesh", "Verma"),
    ("Mihir", "Parikh"), ("Narayan", "Iyer"), ("Omkar", "Deshpande"), ("Parth", "Joshi"),
    ("Qasim", "Ansari"), ("Rohith", "Kamath"), ("Samir", "Ahuja"), ("Tejas", "Apte"),
    ("Uday", "Bhave"), ("Vikrant", "Kapse"), ("Wasim", "Shaikh"), ("Xavier", "Fernandes"),
    ("Yogesh", "Shintre"), ("Zaheer", "Khan"), ("Achyut", "Pillai"), ("Bhavesh", "Trivedi"),
    ("Chinmay", "Gharat"), ("Darshan", "Bhaskar"), ("Eshan", "Karnik"), ("Faisal", "Mir"),
    ("Gopal", "Warrier"), ("Hemang", "Desai"), ("Indrajit", "Bandyopadhyay"),
    ("Jeevan", "Nagesh"), ("Kaushik", "Raghunathan"), ("Lohit", "Belur"),
    ("Mrugesh", "Panchal"), ("Nachiket", "Lele"), ("Onkar", "Surve"),
    ("Pranav", "Ghodke"), ("Raghunandan", "Rao"), ("Sourabh", "Jog"),
    ("Tanmay", "Mahajan"), ("Uddhav", "Khedekar"), ("Vinayak", "Prabhu"),
    ("Waman", "Sawant"), ("Yatish", "Phansalkar"), ("Zubin", "Contractor"),
]

FEMALE_DETAILS = [
    {"dob": "1997-05-12", "edu": "M.Sc Nutrition & Dietetics", "occ": "Clinical Dietitian", "comp": "Manipal Hospitals", "inc": "10-15 LPA", "city": "Manipal", "rel": "Hindu", "lang": "Konkani", "caste": "GSB", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1999-09-08", "edu": "B.Tech Information Technology", "occ": "QA Automation Engineer", "comp": "Wipro", "inc": "12-18 LPA", "city": "Pune", "rel": "Hindu", "lang": "Gujarati", "caste": "Patel", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-02-28", "edu": "MA Malayalam Literature", "occ": "Content Strategist", "comp": "Manorama Online", "inc": "8-12 LPA", "city": "Kottayam", "rel": "Hindu", "lang": "Malayalam", "caste": "Pillai", "ht": "5'2\"", "ms": "Never Married"},
    {"dob": "1998-11-19", "edu": "B.Tech Computer Science", "occ": "Salesforce Developer", "comp": "Capgemini", "inc": "16-22 LPA", "city": "Noida", "rel": "Hindu", "lang": "Punjabi", "caste": "Khatri", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-06-03", "edu": "MA Journalism & Mass Comm", "occ": "Senior Journalist", "comp": "The Hindu", "inc": "10-14 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Bengali", "caste": "Brahmin", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "2000-01-15", "edu": "B.Sc Biomedical Science", "occ": "Lab Research Analyst", "comp": "Dr Reddys Labs", "inc": "8-12 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Rao", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1997-08-22", "edu": "MBA Human Resources", "occ": "Talent Acquisition Lead", "comp": "HCL Technologies", "inc": "14-20 LPA", "city": "Lucknow", "rel": "Hindu", "lang": "Hindi", "caste": "Tiwari", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-03-31", "edu": "B.Des Interior Design", "occ": "Interior Designer", "comp": "Studio Lotus", "inc": "12-18 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Shetty", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1998-10-07", "edu": "B.Sc Nursing", "occ": "Nursing Specialist", "comp": "AIIMS Rishikesh", "inc": "7-10 LPA", "city": "Dehradun", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1995-12-17", "edu": "LLB, LLM International Law", "occ": "Advocate", "comp": "Supreme Court Bar", "inc": "18-26 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Hindi", "caste": "Garg", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1999-04-24", "edu": "B.Tech Electrical Engineering", "occ": "Power Systems Engineer", "comp": "NTPC", "inc": "14-20 LPA", "city": "Nagpur", "rel": "Hindu", "lang": "Marathi", "caste": "Kale", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1997-07-13", "edu": "B.Com CA Inter", "occ": "Finance Analyst", "comp": "Godrej Industries", "inc": "12-16 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Shah", "ht": "5'2\"", "ms": "Never Married"},
    {"dob": "1996-09-28", "edu": "B.Tech Computer Science", "occ": "React Developer", "comp": "ThoughtWorks", "inc": "18-26 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Wagh", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-02-05", "edu": "M.Sc Environmental Science", "occ": "Environmental Consultant", "comp": "ERM India", "inc": "10-14 LPA", "city": "Nagpur", "rel": "Hindu", "lang": "Marathi", "caste": "Wagh", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-05-20", "edu": "MBA Finance & Strategy", "occ": "Business Finance Manager", "comp": "ICICI Bank", "inc": "22-30 LPA", "city": "Pune", "rel": "Christian", "lang": "Malayalam", "caste": "Syrian Christian", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "2000-11-11", "edu": "B.Tech Computer Science", "occ": "Junior ML Engineer", "comp": "Sigmoid", "inc": "14-20 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Tamil", "caste": "Iyengar", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1997-01-29", "edu": "BDS Dentistry", "occ": "Dentist", "comp": "Clove Dental", "inc": "10-16 LPA", "city": "Ahmedabad", "rel": "Hindu", "lang": "Gujarati", "caste": "Vyas", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1996-06-16", "edu": "M.A. Sociology", "occ": "NGO Program Director", "comp": "Pratham Foundation", "inc": "8-12 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Lal", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-12-03", "edu": "B.Tech Chemical Engg", "occ": "Formulations Scientist", "comp": "Cipla Ltd", "inc": "12-18 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Mistry", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-03-08", "edu": "M.Com Accounting", "occ": "Senior Accountant", "comp": "Reliance Retail", "inc": "10-14 LPA", "city": "Vadodara", "rel": "Hindu", "lang": "Gujarati", "caste": "Jain", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1999-08-21", "edu": "B.Tech Mechanical Engineering", "occ": "Product Design Engineer", "comp": "John Deere India", "inc": "14-20 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Bhave", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1997-04-06", "edu": "MBA Marketing", "occ": "E-commerce Category Manager", "comp": "Meesho", "inc": "16-22 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Jain", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-11-30", "edu": "B.Sc Statistics", "occ": "Actuarial Analyst", "comp": "LIC of India", "inc": "12-18 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Begum", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1998-07-14", "edu": "B.Tech Computer Science", "occ": "Cybersecurity Engineer", "comp": "Deloitte USI", "inc": "20-28 LPA", "city": "Pune", "rel": "Christian", "lang": "Konkani", "caste": "Catholic", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1995-09-19", "edu": "MBBS", "occ": "General Physician", "comp": "PHC Government", "inc": "10-16 LPA", "city": "Thiruvananthapuram", "rel": "Hindu", "lang": "Malayalam", "caste": "Thampi", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "2000-02-26", "edu": "B.Tech Computer Science", "occ": "SDE-1", "comp": "Zeta Tech", "inc": "14-20 LPA", "city": "Mumbai", "rel": "Muslim", "lang": "Urdu", "caste": "Khanna", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1997-10-10", "edu": "B.Tech IT", "occ": "iOS Developer", "comp": "Razorpay", "inc": "22-30 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Dalvi", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-05-05", "edu": "M.Sc Astrophysics", "occ": "Data Scientist - ISRO", "comp": "ISRO", "inc": "14-20 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Tamil", "caste": "Brahmin", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1998-03-23", "edu": "BAMS Ayurveda Medicine", "occ": "Ayurvedic Physician", "comp": "Kottakkal Arya Vaidya Sala", "inc": "8-12 LPA", "city": "Kottakkal", "rel": "Hindu", "lang": "Malayalam", "caste": "Unni", "ht": "5'2\"", "ms": "Never Married"},
    {"dob": "1995-01-01", "edu": "MBA International Business", "occ": "Export Manager", "comp": "Godrej Agrovet", "inc": "18-26 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Rajan", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1999-06-09", "edu": "B.Tech Electronics", "occ": "VLSI Engineer", "comp": "NXP Semiconductors", "inc": "18-26 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Bengali", "caste": "Chatterjee", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1997-12-18", "edu": "MBA Entrepreneurship", "occ": "Co-Founder", "comp": "D2C Fashion Startup", "inc": "16-25 LPA", "city": "Surat", "rel": "Hindu", "lang": "Gujarati", "caste": "Modi", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1996-08-04", "edu": "M.Tech Structural Engineering", "occ": "Structural Consultant", "comp": "WSP India", "inc": "16-22 LPA", "city": "Pune", "rel": "Hindu", "lang": "Hindi", "caste": "Srivastava", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1998-05-27", "edu": "B.Sc Physiotherapy", "occ": "Physiotherapist", "comp": "Narayana Health", "inc": "7-10 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Bhosle", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-11-14", "edu": "MBA Finance", "occ": "Credit Risk Manager", "comp": "Yes Bank", "inc": "18-26 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Bengali", "caste": "Datta", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "2000-04-01", "edu": "B.Tech Computer Science", "occ": "Graduate Engineer Trainee", "comp": "Tech Mahindra", "inc": "6-10 LPA", "city": "Nagpur", "rel": "Hindu", "lang": "Marathi", "caste": "Kelkar", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1997-09-25", "edu": "B.Com, MBA Finance", "occ": "Treasury Analyst", "comp": "Tata Consultancy Services", "inc": "14-20 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Subramanian", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-01-18", "edu": "B.Tech Computer Science", "occ": "Site Reliability Engineer", "comp": "ShareChat", "inc": "26-36 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Hegde", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-10-31", "edu": "MBBS, DNB Medicine", "occ": "Internal Medicine Specialist", "comp": "Columbia Asia Hospital", "inc": "22-30 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Marathi", "caste": "Phadke", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-07-07", "edu": "B.Tech Textile Technology", "occ": "Textile Export Head", "comp": "Alok Industries", "inc": "14-20 LPA", "city": "Surat", "rel": "Hindu", "lang": "Gujarati", "caste": "Khatri", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1999-02-15", "edu": "B.A. Fine Arts", "occ": "Graphic Designer", "comp": "Ogilvy India", "inc": "10-16 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Naik", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1997-06-23", "edu": "M.Sc Food Technology", "occ": "Product Development Scientist", "comp": "Britannia Industries", "inc": "12-18 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Karmarkar", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-04-09", "edu": "BBA, MBA International Business", "occ": "Global Account Manager", "comp": "Accenture", "inc": "22-30 LPA", "city": "Goa", "rel": "Christian", "lang": "Konkani", "caste": "Catholic", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-08-17", "edu": "M.Sc Mathematics", "occ": "Actuarial Fellow", "comp": "Bajaj Allianz Insurance", "inc": "20-28 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Limaye", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-10-02", "edu": "B.Tech Computer Science", "occ": "Engineering Manager", "comp": "Dunzo", "inc": "32-44 LPA", "city": "Bengaluru", "rel": "Muslim", "lang": "Urdu", "caste": "Shaikh", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "2000-05-19", "edu": "B.Sc Animation & VFX", "occ": "Junior VFX Artist", "comp": "Prime Focus", "inc": "7-11 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Sawant", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1997-03-14", "edu": "B.Tech Computer Science", "occ": "Data Analyst", "comp": "UrbanClap", "inc": "16-22 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Prabhu", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-07-30", "edu": "BHM Hotel Management", "occ": "F&B Operations Manager", "comp": "ITC Hotels", "inc": "10-14 LPA", "city": "Mysuru", "rel": "Hindu", "lang": "Kannada", "caste": "Phansalkar", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-01-06", "edu": "B.Tech Computer Science", "occ": "Blockchain Developer", "comp": "WazirX", "inc": "22-32 LPA", "city": "Mumbai", "rel": "Parsi", "lang": "Gujarati", "caste": "Zoroastrian", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1995-04-21", "edu": "M.Sc Clinical Psychology", "occ": "Child Psychologist", "comp": "iCall TISS", "inc": "10-16 LPA", "city": "Mumbai", "rel": "Muslim", "lang": "Urdu", "caste": "Shaikh", "ht": "5'3\"", "ms": "Never Married"},
]

MALE_DETAILS = [
    {"dob": "1993-04-14", "edu": "B.Tech + MBA IIM Kozhikode", "occ": "Senior Product Manager", "comp": "Ola Cabs", "inc": "38-50 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Gujarati", "caste": "Mehta", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1994-09-27", "edu": "B.Tech Computer Science IIT Bombay", "occ": "Staff Engineer", "comp": "Atlassian", "inc": "50+ LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Tamil", "caste": "Krishnaswamy", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-03-16", "edu": "B.Com, CA Final", "occ": "Senior Audit Manager", "comp": "Grant Thornton", "inc": "26-34 LPA", "city": "Ahmedabad", "rel": "Hindu", "lang": "Gujarati", "caste": "Thakkar", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1992-11-22", "edu": "MBBS, MD Psychiatry", "occ": "Consultant Psychiatrist", "comp": "NIMHANS", "inc": "32-45 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Anand", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-06-08", "edu": "B.Tech NIT Warangal", "occ": "Principal SDE", "comp": "Swiggy", "inc": "44-58 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Hindi", "caste": "Shukla", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1994-01-30", "edu": "MBA XLRI + B.Tech", "occ": "General Manager HR", "comp": "Tata Motors", "inc": "35-48 LPA", "city": "Pune", "rel": "Muslim", "lang": "Urdu", "caste": "Siddiqui", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1996-08-03", "edu": "B.Tech Electronics NIT Calicut", "occ": "Senior Embedded Engineer", "comp": "Continental India", "inc": "24-32 LPA", "city": "Pune", "rel": "Hindu", "lang": "Malayalam", "caste": "Nair", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-05-15", "edu": "MBBS, MS Urology", "occ": "Urologist", "comp": "Kokilaben Hospital", "inc": "40-55 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Solanki", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-12-31", "edu": "B.Tech + MS Georgia Tech", "occ": "Senior SDE", "comp": "Microsoft", "inc": "50+ LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Babu", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-07-19", "edu": "B.Tech Computer Science", "occ": "Startup CTO", "comp": "HealthTech Startup", "inc": "30-45 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Punjabi", "caste": "Kohli", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-02-07", "edu": "MBA INSEAD France", "occ": "Private Equity Associate", "comp": "Sequoia Capital India", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Punjabi", "caste": "Malhotra", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1993-10-11", "edu": "B.Tech + M.Tech IIT Roorkee", "occ": "AI Research Scientist", "comp": "DeepMind India", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Verma", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1995-04-25", "edu": "CA Final + MBA Finance", "occ": "CFO Startup", "comp": "EdTech Unicorn", "inc": "50+ LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Parikh", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-09-04", "edu": "MBBS, DM Nephrology", "occ": "Consultant Nephrologist", "comp": "Narayana Health", "inc": "45-60 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1996-05-21", "edu": "B.Tech Aerospace IIT Madras", "occ": "Scientist", "comp": "HAL", "inc": "18-26 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Tamil", "caste": "Deshpande", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1993-12-09", "edu": "LLB, LLM IP Law UK", "occ": "Partner - Intellectual Property", "comp": "AZB Partners", "inc": "40-55 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Marathi", "caste": "Joshi", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1995-07-28", "edu": "B.Tech Civil + MBA IIM C", "occ": "Infrastructure Finance Lead", "comp": "SBI Capital Markets", "inc": "35-48 LPA", "city": "Mumbai", "rel": "Muslim", "lang": "Urdu", "caste": "Ansari", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1994-03-17", "edu": "B.Tech Computer Science NITK", "occ": "Senior ML Engineer", "comp": "Cruise Automation", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Kamath", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1996-10-02", "edu": "MBA Marketing IIM L", "occ": "VP Marketing", "comp": "Boat Lifestyle", "inc": "40-55 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Punjabi", "caste": "Ahuja", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-08-24", "edu": "B.Tech Mechanical IIT K", "occ": "Director Manufacturing", "comp": "Mahindra Electric", "inc": "38-50 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Apte", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1995-01-13", "edu": "B.Tech Electronics + MBA", "occ": "General Manager Operations", "comp": "Vedanta Resources", "inc": "35-48 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Bhave", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-06-29", "edu": "B.Tech Computer Science", "occ": "Principal Engineer Platform", "comp": "Dunzo", "inc": "42-56 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Kapse", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-11-18", "edu": "MBBS, MS Ophthalmology", "occ": "Eye Specialist", "comp": "L.V. Prasad Eye Institute", "inc": "28-38 LPA", "city": "Hyderabad", "rel": "Muslim", "lang": "Urdu", "caste": "Shaikh", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1993-02-05", "edu": "B.Tech + MBA XIMB", "occ": "Country Manager West Africa", "comp": "ITC Agri", "inc": "45-60 LPA", "city": "Goa", "rel": "Christian", "lang": "Konkani", "caste": "Catholic", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1995-09-16", "edu": "B.Tech Electronics VJTI", "occ": "Senior Product Manager", "comp": "Juspay", "inc": "30-42 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Shintre", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-04-03", "edu": "MBBS, DM Oncology", "occ": "Cancer Specialist", "comp": "Tata Memorial Centre", "inc": "40-55 LPA", "city": "Mumbai", "rel": "Muslim", "lang": "Urdu", "caste": "Khan", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-12-22", "edu": "BBA MBA Strategy Rotman Canada", "occ": "Management Consultant", "comp": "Bain Company", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Pillai", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1993-07-10", "edu": "B.Tech Computer Science", "occ": "VP Engineering", "comp": "Zepto", "inc": "50+ LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Trivedi", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-03-28", "edu": "M.Tech Marine Engineering", "occ": "Ship Engineer", "comp": "Shipping Corporation of India", "inc": "30-45 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Konkani", "caste": "Gharat", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1994-10-15", "edu": "B.Tech + IAS Training", "occ": "Deputy Collector", "comp": "Government of Maharashtra", "inc": "16-22 LPA", "city": "Pune", "rel": "Hindu", "lang": "Kannada", "caste": "Bhaskar", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1996-06-04", "edu": "M.Tech Computer Science", "occ": "Senior NLP Researcher", "comp": "Samsung R&D", "inc": "34-46 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Karnik", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-01-19", "edu": "MBBS, MS Plastic Surgery", "occ": "Plastic Surgeon", "comp": "Fortis Hospital", "inc": "45-60 LPA", "city": "Delhi", "rel": "Muslim", "lang": "Kashmiri", "caste": "Mir", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1995-08-07", "edu": "B.Tech Electrical IIT Trivandrum", "occ": "Power Electronics Lead", "comp": "ABB India", "inc": "28-38 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Malayalam", "caste": "Warrier", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-05-24", "edu": "MBA Finance Harvard PGP", "occ": "Investment Director", "comp": "Temasek India", "inc": "50+ LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Gujarati", "caste": "Desai", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-11-30", "edu": "B.Tech + MS Purdue Mech", "occ": "Advanced Manufacturing Lead", "comp": "Boeing India", "inc": "40-55 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Bengali", "caste": "Bandyopadhyay", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-09-08", "edu": "B.Tech ECE PESIT", "occ": "Director of Engineering", "comp": "Zetwerk", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Nagesh", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1995-04-16", "edu": "M.Sc Physics + IIT JAM", "occ": "Quant Researcher", "comp": "WorldQuant India", "inc": "40-55 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Raghunathan", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-12-03", "edu": "B.Tech Civil MSRIT", "occ": "Senior Civil Engineer", "comp": "Navi Technologies", "inc": "22-30 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Belur", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1996-07-21", "edu": "MBA Entrepreneurship", "occ": "Co-Founder CEO", "comp": "D2C Brand Startup", "inc": "30-50 LPA", "city": "Ahmedabad", "rel": "Hindu", "lang": "Gujarati", "caste": "Panchal", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-02-28", "edu": "B.Tech + M.Tech IIT Guwahati", "occ": "Chief Architect", "comp": "Fintech Startup", "inc": "50+ LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Lele", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-10-05", "edu": "B.Tech Mechanical COEP", "occ": "Plant Manager", "comp": "Thermax India", "inc": "24-32 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Surve", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-06-18", "edu": "B.Tech + IIM Calcutta MBA", "occ": "Associate VP Strategy", "comp": "Byjus", "inc": "40-55 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Ghodke", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-01-26", "edu": "MBBS, MD Dermatology", "occ": "Dermatologist", "comp": "Private Skin Clinic", "inc": "35-50 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Rao", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-08-12", "edu": "B.Tech Computer Science + MS Stanford", "occ": "Engineering Director", "comp": "CRED", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Jog", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1995-03-01", "edu": "MBA Finance + CFA", "occ": "Head of Treasury", "comp": "Bajaj Finance", "inc": "40-55 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Mahajan", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1994-11-17", "edu": "B.Tech Electronics + MBA", "occ": "General Manager Projects", "comp": "Larsen Toubro", "inc": "38-50 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Khedekar", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1996-09-09", "edu": "B.Tech Computer Science BITS Goa", "occ": "Senior Backend Engineer", "comp": "Groww", "inc": "34-46 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Konkani", "caste": "Prabhu", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-04-26", "edu": "B.Com, FCA, DISA", "occ": "IT Auditor Partner", "comp": "BDO India", "inc": "30-42 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Sawant", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-07-13", "edu": "B.Tech Civil IIT Delhi", "occ": "Urban Mobility Lead", "comp": "BMRCL", "inc": "20-28 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Marathi", "caste": "Phansalkar", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-02-20", "edu": "B.E. Computer Science + MBA", "occ": "Chief Executive Officer", "comp": "Fintech Startup", "inc": "50+ LPA", "city": "Mumbai", "rel": "Parsi", "lang": "Gujarati", "caste": "Zoroastrian", "ht": "6'0\"", "ms": "Never Married"},
]

HOBBIES_POOL = [
    ["Hiking", "Sketching", "Classical Music", "Organic Farming", "Chess"],
    ["Scuba Diving", "Photography", "Stand-up Comedy", "Craft Beer", "Podcasting"],
    ["Kabaddi", "Calligraphy", "Astronomy", "Table Tennis", "Origami"],
    ["Mountain Biking", "Cooking", "Book Club", "Volunteering", "Travel Blogging"],
    ["Kathak Dancing", "Film Making", "Marathon Running", "Aquarium Keeping", "Pottery"],
]


class Command(BaseCommand):
    help = (
        "Generate 100 new dummy member profiles (50F + 50M) in PENDING state "
        "for manual admin approval. Uses seed_photos/ only; no auto-approval."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear-existing-seed",
            action="store_true",
            help="Remove previously generated pending-seed members before inserting.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting 100 pending profile generation...")

        # ------------------------------------------------------------------
        # Locate seed photos directory
        # ------------------------------------------------------------------
        candidates = [
            Path("/app/seed_photos"),
            Path(settings.BASE_DIR) / "seed_photos",
            Path(settings.BASE_DIR).parent / "backend" / "seed_photos",
        ]
        photos_dir = next(
            (p for p in candidates if p.is_dir() and (p / "female_1.jpg").exists()),
            None,
        )
        if not photos_dir:
            self.stderr.write(
                self.style.ERROR(
                    f"seed_photos directory not found. Checked: {candidates}"
                )
            )
            return

        self.stdout.write(self.style.SUCCESS(f"Using seed photos from: {photos_dir}"))

        # Pre-process female photos (female_1 through female_4)
        female_processed = []
        for i in range(1, 5):
            p = photos_dir / f"female_{i}.jpg"
            female_processed.append(_process_image_to_webp(p))
            self.stdout.write(
                f"  Processed female_{i}.jpg -> {female_processed[-1]['compressed_size_bytes']:,} bytes"
            )

        # Pre-process male photos (male_1 through male_4; skip male_2_cropped)
        male_processed = []
        for i in range(1, 5):
            p = photos_dir / f"male_{i}.jpg"
            male_processed.append(_process_image_to_webp(p))
            self.stdout.write(
                f"  Processed male_{i}.jpg -> {male_processed[-1]['compressed_size_bytes']:,} bytes"
            )

        hashed_password = make_password("Demo@123")
        now = timezone.now()

        # ------------------------------------------------------------------
        # Optionally clear existing pending-seed data
        # ------------------------------------------------------------------
        if options["clear_existing_seed"]:
            deleted, _ = Member.objects.filter(
                email__startswith="dummy2.",
                is_seed_data=True,
            ).delete()
            self.stdout.write(
                self.style.WARNING(f"Cleared {deleted} existing pending-seed records.")
            )

        created_females = 0
        created_males = 0

        with transaction.atomic():

            # ---------------------------------------------------------------
            # 1. Create 50 Female Profiles
            # ---------------------------------------------------------------
            for idx in range(50):
                first_name, last_name = FEMALE_NAMES[idx]
                details = FEMALE_DETAILS[idx]
                photo_data = female_processed[idx % 4]

                email = f"dummy2.female.{idx + 1:02d}@mydearpartner.com"
                mobile = f"91100{idx + 1:05d}"

                member, _ = Member.objects.update_or_create(
                    email=email,
                    defaults={
                        "password": hashed_password,
                        "first_name": first_name,
                        "last_name": last_name,
                        "mobile_number": mobile,
                        "gender": "Female",
                        "date_of_birth": details["dob"],
                        "profile_created_by": "Self" if idx % 3 != 0 else "Parent",
                        "is_active": True,
                        "is_email_verified": True,
                        "is_mobile_verified": True,
                        "is_premium": False,
                        "account_status": "ACTIVE",
                        # All statuses PENDING -- admin must approve manually
                        "profile_status": "pending_review",
                        "photo_status": "pending_review",
                        "document_status": "pending_review",
                        "profile_submitted_at": now,
                        "photo_submitted_at": now,
                        "document_submitted_at": now,
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES_POOL[idx % len(HOBBIES_POOL)]
                about_text = (
                    f"Hello! I am {first_name}, working as a {details['occ']} at "
                    f"{details['comp']} in {details['city']}. "
                    f"I hold a degree in {details['edu']}. Outside work, I enjoy "
                    f"{', '.join(hobbies[:3])}. "
                    f"I value honesty, mutual respect, and strong family traditions. "
                    f"Looking for an understanding, well-educated partner to build a "
                    f"beautiful life together."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": details["ms"],
                        "height": details["ht"],
                        "weight": "54 kg",
                        "blood_group": "A+",
                        "complexion": "Wheatish",
                        "religion": details["rel"],
                        "mother_tongue": details["lang"],
                        "caste": details["caste"],
                        "sub_caste": "General",
                        "gothra": "Kashyap" if idx % 2 == 0 else "Atreya",
                        "star_nakshatra": "Hasta" if idx % 2 == 0 else "Uttara",
                        "manglik_status": "No",
                        "highest_education": details["edu"],
                        "education_detail": f"{details['edu']} from a reputed institution",
                        "occupation": details["occ"],
                        "employed_in": "Private Sector",
                        "company": details["comp"],
                        "annual_income": details["inc"],
                        "work_location": details["city"],
                        "father_status": "Employed / Retired",
                        "mother_status": "Homemaker",
                        "num_brothers": 1 if idx % 2 == 0 else 0,
                        "num_sisters": 1 if idx % 3 == 0 else 0,
                        "family_type": "Nuclear Family" if idx % 2 == 0 else "Joint Family",
                        "family_status": "Upper Middle Class" if idx % 2 == 0 else "Middle Class",
                        "family_location": details["city"],
                        "about": about_text,
                        "hobbies": hobbies,
                        "compatibility": 80 + (idx % 18),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 25,
                        "preferred_age_max": 36,
                        "preferred_height_min": "5'7\"",
                        "preferred_height_max": "6'3\"",
                        "preferred_religion": details["rel"],
                        "preferred_caste": "Open to all / Same Caste",
                        "preferred_location": details["city"],
                        "preferred_education": "Bachelors or Masters Degree",
                        "preferred_occupation": "Working Professional / Business / Doctor",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": (
                            "Looking for a kind, progressive, and family-oriented partner."
                        ),
                    },
                )

                # Profile photo -- PENDING (not approved)
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
                    status=ProfilePhoto.Status.PENDING,
                )

                # Fake Aadhaar document -- PENDING (not approved)
                fake_pdf = _make_fake_pdf_bytes(member.get_full_name(), "Aadhaar Card")
                raw_pdf = gzip.decompress(fake_pdf)
                MemberDocument.objects.filter(member=member).delete()
                MemberDocument.objects.create(
                    member=member,
                    document_type=MemberDocument.DocumentType.AADHAAR,
                    original_file_name=f"aadhaar_{first_name.lower()}_{last_name.lower()}.pdf",
                    file_data=fake_pdf,
                    mime_type="application/pdf",
                    file_size=len(raw_pdf),
                    compressed_size=len(fake_pdf),
                    file_hash=hashlib.sha256(raw_pdf).hexdigest(),
                    status=MemberDocument.Status.PENDING,
                )

                created_females += 1

            # ---------------------------------------------------------------
            # 2. Create 50 Male Profiles
            # ---------------------------------------------------------------
            for idx in range(50):
                first_name, last_name = MALE_NAMES[idx]
                details = MALE_DETAILS[idx]
                photo_data = male_processed[idx % 4]

                email = f"dummy2.male.{idx + 1:02d}@mydearpartner.com"
                mobile = f"91200{idx + 1:05d}"

                member, _ = Member.objects.update_or_create(
                    email=email,
                    defaults={
                        "password": hashed_password,
                        "first_name": first_name,
                        "last_name": last_name,
                        "mobile_number": mobile,
                        "gender": "Male",
                        "date_of_birth": details["dob"],
                        "profile_created_by": "Self" if idx % 3 != 0 else "Parent",
                        "is_active": True,
                        "is_email_verified": True,
                        "is_mobile_verified": True,
                        "is_premium": False,
                        "account_status": "ACTIVE",
                        "profile_status": "pending_review",
                        "photo_status": "pending_review",
                        "document_status": "pending_review",
                        "profile_submitted_at": now,
                        "photo_submitted_at": now,
                        "document_submitted_at": now,
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES_POOL[idx % len(HOBBIES_POOL)]
                about_text = (
                    f"Hi! I am {first_name}, working as a {details['occ']} at "
                    f"{details['comp']} in {details['city']}. "
                    f"I completed my {details['edu']}. In my free time, I enjoy "
                    f"{', '.join(hobbies[:3])}. "
                    f"I consider myself ambitious, grounded and caring with a positive "
                    f"outlook on life. Looking for a partner who shares similar values "
                    f"and life goals."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": details["ms"],
                        "height": details["ht"],
                        "weight": "76 kg",
                        "blood_group": "O+",
                        "complexion": "Wheatish",
                        "religion": details["rel"],
                        "mother_tongue": details["lang"],
                        "caste": details["caste"],
                        "sub_caste": "General",
                        "gothra": "Vashistha" if idx % 2 == 0 else "Bharadwaj",
                        "star_nakshatra": "Rohini" if idx % 2 == 0 else "Chitra",
                        "manglik_status": "No",
                        "highest_education": details["edu"],
                        "education_detail": f"{details['edu']} from Premier Institute",
                        "occupation": details["occ"],
                        "employed_in": (
                            "Government Sector"
                            if "Government" in details["comp"] or "HAL" in details["comp"] or "BMRCL" in details["comp"]
                            else "Private Sector"
                        ),
                        "company": details["comp"],
                        "annual_income": details["inc"],
                        "work_location": details["city"],
                        "father_status": "Retired / Businessman",
                        "mother_status": "Homemaker",
                        "num_brothers": 1 if idx % 3 == 0 else 0,
                        "num_sisters": 1 if idx % 2 == 0 else 0,
                        "family_type": "Nuclear Family" if idx % 2 == 0 else "Joint Family",
                        "family_status": "Upper Middle Class" if idx % 2 == 0 else "Middle Class",
                        "family_location": details["city"],
                        "about": about_text,
                        "hobbies": hobbies,
                        "compatibility": 82 + (idx % 16),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 22,
                        "preferred_age_max": 31,
                        "preferred_height_min": "5'2\"",
                        "preferred_height_max": "5'9\"",
                        "preferred_religion": details["rel"],
                        "preferred_caste": "Open to all / Same Caste",
                        "preferred_location": details["city"],
                        "preferred_education": "Bachelors or Masters Degree",
                        "preferred_occupation": "Working Professional / Doctor / Engineer",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": (
                            "Looking for a well-educated, respectful and supportive partner."
                        ),
                    },
                )

                # Profile photo -- PENDING (not approved)
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
                    status=ProfilePhoto.Status.PENDING,
                )

                # Fake Aadhaar document -- PENDING (not approved)
                fake_pdf = _make_fake_pdf_bytes(member.get_full_name(), "Aadhaar Card")
                raw_pdf = gzip.decompress(fake_pdf)
                MemberDocument.objects.filter(member=member).delete()
                MemberDocument.objects.create(
                    member=member,
                    document_type=MemberDocument.DocumentType.AADHAAR,
                    original_file_name=f"aadhaar_{first_name.lower()}_{last_name.lower()}.pdf",
                    file_data=fake_pdf,
                    mime_type="application/pdf",
                    file_size=len(raw_pdf),
                    compressed_size=len(fake_pdf),
                    file_hash=hashlib.sha256(raw_pdf).hexdigest(),
                    status=MemberDocument.Status.PENDING,
                )

                created_males += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully seeded {created_females} female + {created_males} male"
                f" = {created_females + created_males} profiles in PENDING state.\n"
                f"  Password for all accounts : Demo@123\n"
                f"  Email pattern             : dummy2.female.NN / dummy2.male.NN\n"
                f"  Approve via admin panel   : Verifications -> Pending\n"
            )
        )
