import uuid
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.services import create_member


INDIAN_FIRST_NAMES_MALE = [
    "Aarav", "Vihaan", "Vivaan", "Ananya", "Diya", "Advik", "Kabir", "Arjun",
    "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya", "Aarush", "Rudra",
    "Dhruv", "Yash", "Aryan", "Rohan", "Kartik", "Pranav", "Neel", "Dev",
    "Om", "Shiv", "Ravi", "Sohan", "Mohan", "Vikram", "Aditya", "Siddharth",
    "Harsh", "Manish", "Amit", "Rajesh", "Suresh", "Deepak", "Sanjay", "Vijay", "Anil",
]

INDIAN_FIRST_NAMES_FEMALE = [
    "Aanya", "Aarohi", "Anaya", "Diya", "Ishita", "Myra", "Sara", "Ananya",
    "Avni", "Riya", "Kavya", "Aditi", "Shreya", "Pari", "Navya", "Aadhya",
    "Saanvi", "Jiya", "Anika", "Tanvi", "Pooja", "Neha", "Priya", "Sneha",
    "Anjali", "Kiran", "Laxmi", "Radha", "Sita", "Gauri", "Meera", "Nandini",
    "Varsha", "Bhavna", "Kriti", "Anupama", "Vidya", "Rekha", "Shweta", "Nitya",
]

INDIAN_LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Kumar", "Singh", "Reddy", "Gupta", "Joshi",
    "Mishra", "Iyer", "Nair", "Menon", "Rao", "Pillai", "Deshmukh", "Kulkarni",
    "Chopra", "Malhotra", "Agarwal", "Mehta", "Bhatt", "Shah", "Das", "Roy",
    "Sen", "Ghosh", "Bose", "Chakraborty", "Banerjee", "Mukherjee", "Saxena",
    "Trivedi", "Thakur", "Pandey", "Tiwari", "Dubey", "Chauhan", "Yadav", "Kohli", "Kapoor",
]

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist"]
MOTHER_TONGUES = ["Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Gujarati", "Bengali", "Punjabi", "Odia"]
EDUCATION = ["B.Tech", "M.Tech", "B.Sc", "M.Sc", "B.Com", "M.Com", "B.A.", "M.A.", "MBBS", "MBA", "Ph.D", "BCA", "MCA"]
OCCUPATIONS = ["Software Engineer", "Doctor", "Teacher", "Banker", "Civil Engineer", "Accountant", "Lawyer", "Nurse", "Architect", "Business Owner", "Professor", "Scientist", "Chartered Accountant", "Dentist", "Marketing Manager"]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"]
CASTE = ["General", "OBC", "SC", "ST"]
INCOME_SLABS = ["₹2-4 LPA", "₹4-6 LPA", "₹6-10 LPA", "₹10-15 LPA", "₹15-25 LPA", "₹25+ LPA"]


def _rand(items, seed_offset=0):
    import hashlib
    idx = int(hashlib.md5(f"{seed_offset}".encode()).hexdigest(), 16) % len(items)
    return items[idx]


class Command(BaseCommand):
    help = "Seed ~40 test member profiles (20 male, 20 female)"

    def add_arguments(self, parser):
        parser.add_argument("--password", default="Test@123", help="Password for all seed accounts")
        parser.add_argument("--clear", action="store_true", help="Remove existing seed members before creating")

    def handle(self, *args, **options):
        password = options["password"]
        do_clear = options["clear"]

        if do_clear:
            from apps.accounts.models import Member
            deleted = Member.objects.filter(is_seed_data=True).delete()
            self.stdout.write(f"Cleared {deleted[0]} seed members.")

        self._create_batch("Male", INDIAN_FIRST_NAMES_MALE, password)
        self._create_batch("Female", INDIAN_FIRST_NAMES_FEMALE, password)

    def _create_batch(self, gender, first_names, password):
        from apps.accounts.models import Member

        count = 0
        for i, first_name in enumerate(first_names):
            last_name = _rand(INDIAN_LAST_NAMES, i)
            email = f"{first_name.lower()}.{last_name.lower()}.{gender.lower()}{uuid.uuid4().hex[:4]}@example.com"
            mobile = f"9{str(uuid.uuid4().int)[:9]}"[:10]

            # Ensure unique mobile
            from apps.accounts.models import Member
            if Member.objects.filter(mobile_number=mobile).exists():
                mobile = f"8{str(uuid.uuid4().int)[:9]}"[:10]
                while Member.objects.filter(mobile_number=mobile).exists():
                    mobile = f"7{str(uuid.uuid4().int)[:9]}"[:10]

            birth_year = 1990 + (i % 10)
            birth_month = 1 + (i % 12)
            birth_day = 1 + (i % 28)

            try:
                with transaction.atomic():
                    create_member(
                        email=email,
                        password=password,
                        mobile_number=mobile,
                        first_name=first_name,
                        last_name=last_name,
                        gender=gender,
                        date_of_birth=date(birth_year, birth_month, birth_day),
                        profile_created_by="Self",
                        is_email_verified=True,
                        is_mobile_verified=True,
                        is_seed_data=True,
                        is_active=True,
                        # Profile fields
                        religion=_rand(RELIGIONS, i),
                        mother_tongue=_rand(MOTHER_TONGUES, i + 50),
                        caste=_rand(CASTE, i + 100),
                        highest_education=_rand(EDUCATION, i + 150),
                        occupation=_rand(OCCUPATIONS, i + 200),
                        annual_income=_rand(INCOME_SLABS, i + 250),
                        work_location=_rand(CITIES, i + 300),
                        marital_status="Never Married",
                        about=f"Hi, I'm {first_name}. Looking for a compatible partner.",
                        hobbies=["Reading", "Traveling", "Music"],
                    )
                count += 1
                self.stdout.write(f"  [{count}/{len(first_names)}] Created {gender}: {first_name} {last_name} ({email})")
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  Failed to create {first_name} {last_name}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Created {count} {gender} profiles."))
