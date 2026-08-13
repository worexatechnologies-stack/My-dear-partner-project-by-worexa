import hashlib
import uuid
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Member


FIRST_NAMES_MALE = [
    "Aarav", "Vihaan", "Vivaan", "Advik", "Kabir", "Arjun", "Reyansh", "Ayaan",
    "Krishna", "Ishaan", "Shaurya", "Aarush", "Dhruv", "Yash", "Aryan", "Rohan",
    "Kartik", "Pranav", "Dev", "Aditya", "Harsh", "Manish", "Amit", "Rajesh",
    "Suresh", "Deepak", "Sanjay", "Vijay", "Ravi", "Sohan",
]

FIRST_NAMES_FEMALE = [
    "Aanya", "Aarohi", "Anaya", "Diya", "Ishita", "Myra", "Sara", "Avni",
    "Riya", "Kavya", "Aditi", "Shreya", "Pari", "Navya", "Aadhya", "Saanvi",
    "Jiya", "Anika", "Tanvi", "Pooja", "Neha", "Priya", "Sneha", "Anjali",
    "Kiran", "Laxmi", "Radha", "Gauri", "Meera", "Nandini",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Kumar", "Singh", "Reddy", "Gupta", "Joshi",
    "Mishra", "Iyer", "Nair", "Menon", "Rao", "Pillai", "Deshmukh", "Kulkarni",
    "Chopra", "Malhotra", "Agarwal", "Mehta", "Shah", "Das", "Roy", "Sen",
    "Ghosh", "Bose", "Saxena", "Trivedi", "Thakur", "Yadav",
]

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist"]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"]
EDUCATION = ["B.Tech", "M.Tech", "B.Sc", "B.Com", "MBA", "MBBS", "M.A.", "Ph.D", "BCA", "MCA"]
OCCUPATIONS = ["Software Engineer", "Doctor", "Teacher", "Banker", "Accountant", "Lawyer", "Nurse", "Architect", "Business Owner", "Professor"]


def _pick(items, salt):
    return items[int(hashlib.md5(salt.encode()).hexdigest(), 16) % len(items)]


class Command(BaseCommand):
    help = "Seed 20-30 unapproved (pending review) test members so the admin can approve them."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=25, help="Number of members to create (default 25, range 20-30)")
        parser.add_argument("--password", default="Test@123", help="Password for all seed accounts")
        parser.add_argument("--clear", action="store_true", help="Remove existing seed members before creating")

    def handle(self, *args, **options):
        count = max(20, min(30, options["count"]))
        password = options["password"]

        if options["clear"]:
            deleted = Member.objects.filter(is_seed_data=True).delete()
            self.stdout.write(f"Cleared {deleted[0]} existing seed members.")

        created = []
        skipped = 0

        for i in range(count):
            gender = "Male" if i % 2 == 0 else "Female"
            first = _pick(FIRST_NAMES_MALE if gender == "Male" else FIRST_NAMES_FEMALE, f"f{i}")
            last = _pick(LAST_NAMES, f"l{i}")
            email = f"pending{first.lower()}.{last.lower()}{i:02d}@example.com"
            mobile = f"9{str(uuid.uuid4().int)[:9]}"[:10]

            if Member.objects.filter(email=email).exists() or Member.objects.filter(mobile_number=mobile).exists():
                skipped += 1
                continue

            try:
                with transaction.atomic():
                    member = Member.objects.create_user(
                        email=email,
                        password=password,
                        mobile_number=mobile,
                        first_name=first,
                        last_name=last,
                        gender=gender,
                        date_of_birth=date(1992 + (i % 8), 1 + (i % 12), 1 + (i % 27)),
                        profile_created_by="Self",
                        is_active=True,
                        is_email_verified=False,
                        is_mobile_verified=False,
                        is_seed_data=True,
                        # NOT approved: leave pending_review for the admin to approve.
                        profile_status=Member.VerificationStatus.PENDING_REVIEW,
                        photo_status=Member.VerificationStatus.NOT_STARTED,
                        document_status=Member.VerificationStatus.NOT_STARTED,
                    )
                    created.append((email, password, first, last, gender))

                self.stdout.write(self.style.SUCCESS(f"  created pending member: {first} {last} <{email}>"))
            except Exception as exc:  # noqa: BLE001
                self.stdout.write(self.style.WARNING(f"  failed {email}: {exc}"))

        # Write a downloadable reference file of the created credentials.
        out_path = Path(__file__).resolve().parents[2] / "seed_members.txt"
        with out_path.open("w", encoding="utf-8") as fh:
            fh.write("# Pending seed members (created, awaiting admin approval)\n")
            fh.write("# Password for all: {}\n\n".format(password))
            fh.write("Email\tFirst Name\tLast Name\tGender\n")
            for email, _pw, first, last, gender in created:
                fh.write(f"{email}\t{first}\t{last}\t{gender}\n")
        self.stdout.write(self.style.SUCCESS(f"Reference written to {out_path}"))

        self.stdout.write(
            self.style.SUCCESS(f"Done: created {len(created)} pending members, skipped {skipped}.")
        )