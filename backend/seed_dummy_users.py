import gzip
import hashlib
import uuid
from datetime import date
from io import BytesIO

from PIL import Image

from django.db import transaction

from apps.accounts.models import Member, MemberDocument
from apps.profiles.models import ProfilePhoto


def make_webp_bytes(width, height, rgb, quality=80):
    img = Image.new("RGB", (width, height), rgb)
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=quality)
    return buf.getvalue()


def make_doc_bytes(member, idx):
    text = (
        f"DUMMY DOCUMENT\n"
        f"Member: {member.email}\n"
        f"Index: {idx}\n"
        f"This is a generated placeholder document for demo purposes.\n"
        f"ABCD-1234-EFGH-5678\n"
    ).encode("utf-8")
    raw = text * 50
    compressed = gzip.compress(raw)
    return raw, compressed, len(raw), len(compressed)

def run():
    created = 0
    skipped = 0
    names_m = ["Aarav","Vihaan","Vivaan","Advik","Kabir","Arjun","Reyansh","Ayaan","Krishna","Ishaan",
               "Shaurya","Aarush","Dhruv","Yash","Aryan","Rohan","Kartik","Pranav","Dev","Aditya",
               "Harsh","Manish","Amit","Rajesh","Suresh","Deepak","Sanjay","Vijay","Ravi","Sohan",
               "Vikram","Siddharth","Neel","Om","Shiv","Anil","Kabir","Vihaan","Rohan","Aditya",
               "Arjun","Dhruv","Amit","Ravi","Yash","Dev","Om","Suresh","Deepak","Sanjay"]
    names_f = ["Aanya","Aarohi","Anaya","Diya","Ishita","Myra","Sara","Avni","Riya","Kavya",
               "Aditi","Shreya","Pari","Navya","Aadhya","Saanvi","Jiya","Anika","Tanvi","Pooja",
               "Neha","Priya","Sneha","Anjali","Kiran","Laxmi","Radha","Sita","Gauri","Meera",
               "Nandini","Varsha","Bhavna","Kriti","Vidya","Rekha","Shweta","Nitya","Aanya","Myra",
               "Ishita","Kavya","Aditi","Sara","Riya","Pooja","Priya","Neha","Nandini","Meera"]
    genders = (["Male"]*25) + (["Female"]*25) + (["Male"]*25) + (["Female"]*25)
    last_names = ["Sharma","Verma","Patel","Kumar","Singh","Reddy","Gupta","Joshi","Mishra","Iyer",
                  "Nair","Menon","Rao","Pillai","Deshmukh","Kulkarni","Chopra","Malhotra","Agarwal","Mehta",
                  "Bhatt","Shah","Das","Roy","Sen","Ghosh","Bose","Saxena","Trivedi","Thakur",
                  "Pandey","Tiwari","Dubey","Chauhan","Yadav","Kohli","Kapoor","Banerjee","Mukherjee","Gupta"]

    for i in range(100):
        gender = genders[i]
        first = (names_m if gender == "Male" else names_f)[i % 50]
        last = last_names[i % len(last_names)]
        email = f"dummy{i+1:03d}.{gender.lower()}.{last.lower()}@example.com"
        mobile = f"9{i+1:02d}0000{i+1:04d}"[-10:]
        if Member.objects.filter(mobile_number=mobile).exists():
            mobile = f"8{uuid.uuid4().int % 10**9:09d}"
        if Member.objects.filter(email=email).exists():
            skipped += 1
            continue


        try:
            with transaction.atomic():
                member = Member.objects.create_user(
                    email=email,
                    password="Dummy@123",
                    mobile_number=mobile,
                    first_name=first,
                    last_name=last,
                    gender=gender,
                    date_of_birth=date(1992 + (i % 8), 1 + (i % 12), 1 + (i % 27)),
                    is_active=True,
                    is_email_verified=True,
                    is_mobile_verified=True,
                    is_seed_data=True,
                    profile_status=Member.VerificationStatus.APPROVED,
                    photo_status=Member.VerificationStatus.APPROVED,
                    document_status=Member.VerificationStatus.APPROVED,
                )
                from apps.accounts.models import MemberProfile
                profile, created_p = MemberProfile.objects.get_or_create(member=member)
                profile.marital_status = "Never Married"
                profile.religion = "Hindu" if i % 2 == 0 else "Muslim"
                profile.mother_tongue = "Hindi" if i % 3 else "Telugu"
                profile.occupation = ["Software Engineer","Doctor","Teacher","Banker"][i % 4]
                profile.highest_education = ["B.Tech","M.Tech","MBA","MBBS"][i % 4]
                profile.annual_income = ["6-10 LPA","10-15 LPA","15-25 LPA","25+ LPA"][i % 4]
                profile.work_location = ["Mumbai","Delhi","Bangalore","Hyderabad"][i % 4]
                profile.about = f"Hi, I'm {first} {last}. A {gender.lower()} member profile."
                profile.hobbies = ["Reading","Traveling","Music"]
                profile.save()

                rgb = (188,48,77) if gender == "Female" else (40,55,80)
                image_data = make_webp_bytes(600, 750, rgb)
                thumb_data = make_webp_bytes(240, 300, rgb, quality=78)
                ProfilePhoto.objects.create(
                    user=member,
                    image_data=image_data,
                    thumbnail_data=thumb_data,
                    mime_type="image/webp",
                    original_filename=f"{first}_{last}.webp",
                    original_size_bytes=len(image_data),
                    compressed_size_bytes=len(image_data),
                    thumbnail_size_bytes=len(thumb_data),
                    width=600, height=750,
                    thumbnail_width=240, thumbnail_height=300,
                    checksum=hashlib.sha256(image_data).hexdigest(),
                    is_primary=True, display_order=0,
                    status=ProfilePhoto.Status.APPROVED,
                )

                raw, compressed, orig_size, comp_size = make_doc_bytes(member, i)
                MemberDocument.objects.create(
                    member=member,
                    document_type="AADHAAR",
                    original_file_name=f"{first}_{last}_aadhaar.txt",
                    file_data=compressed,
                    mime_type="text/plain",
                    file_size=orig_size,
                    compressed_size=comp_size,
                    file_hash=hashlib.sha256(raw).hexdigest(),
                    status=MemberDocument.Status.APPROVED,
                )
            created += 1
            print(f"[{created}] {email} (photo+doc)")
        except Exception as e:
            print(f"FAIL {email}: {e}")

    print(f"DONE created={created} skipped={skipped}")


if __name__ == "__main__":
    run()

