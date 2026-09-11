"""Management command to generate 100 realistic dummy member profiles.

Generates 50 female and 50 male member accounts with complete profiles,
partner preferences, active memberships, and real portrait images stored
directly in PostgreSQL ProfilePhoto (repeating the 4 female photos and 4 male photos).
"""

from __future__ import annotations

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

from apps.accounts.models import Member, MemberPreference, MemberProfile
from apps.core.models import MemberMembership, MembershipPlan
from apps.profiles.models import ProfilePhoto

logger = logging.getLogger(__name__)


def process_image_to_webp(image_path: Path) -> dict:
    """Process an image file into 4:5 WebP main (1200x1500) and thumbnail (240x300)."""
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


FEMALE_NAMES = [
    ("Ananya", "Patel"), ("Priya", "Sharma"), ("Sneha", "Iyer"), ("Pooja", "Reddy"),
    ("Kavita", "Gupta"), ("Deepika", "Nair"), ("Ritu", "Joshi"), ("Meera", "Rao"),
    ("Shreya", "Verma"), ("Neha", "Agarwal"), ("Divya", "Kulkarni"), ("Aishwarya", "Menon"),
    ("Tanvi", "Kapoor"), ("Radhika", "Deshmukh"), ("Swati", "Nambiar"), ("Bhavna", "Bhat"),
    ("Rashmi", "Patil"), ("Shilpa", "Chatterjee"), ("Shruti", "Sen"), ("Sonali", "Bose"),
    ("Sunita", "Mukherjee"), ("Vandana", "Pillai"), ("Preeti", "Choudhury"), ("Payal", "Das"),
    ("Nikita", "Ghosh"), ("Sangeeta", "Roy"), ("Aditi", "Saxena"), ("Trisha", "Dubey"),
    ("Lavanya", "Tripathi"), ("Ishita", "Mishra"), ("Rashi", "Pandey"), ("Mallika", "Shukla"),
    ("Jyoti", "Tiwari"), ("Prerna", "Thakur"), ("Sakshi", "Chauhan"), ("Nidhi", "Rathore"),
    ("Kriti", "Yadav"), ("Mahima", "Prasad"), ("Rohini", "Shetty"), ("Natasha", "Hegde"),
    ("Simran", "Gowda"), ("Harini", "Naidu"), ("Keerthi", "Balakrishnan"), ("Gayatri", "Swaminathan"),
    ("Rekha", "Ranganathan"), ("Aarti", "Natarajan"), ("Komal", "Chawla"), ("Parul", "Malhotra"),
    ("Anjali", "Bhatia"), ("Meenakshi", "Soni"),
]

MALE_NAMES = [
    ("Rahul", "Verma"), ("Rohan", "Sharma"), ("Aditya", "Patel"), ("Amit", "Iyer"),
    ("Vikram", "Reddy"), ("Karthik", "Gupta"), ("Siddharth", "Nair"), ("Arjun", "Joshi"),
    ("Rajesh", "Rao"), ("Suresh", "Agarwal"), ("Abhinav", "Kulkarni"), ("Nikhil", "Menon"),
    ("Gaurav", "Kapoor"), ("Varun", "Deshmukh"), ("Kunal", "Nambiar"), ("Manish", "Bhat"),
    ("Sameer", "Patil"), ("Alok", "Chatterjee"), ("Mohit", "Sen"), ("Tarun", "Bose"),
    ("Vishal", "Mukherjee"), ("Pradeep", "Pillai"), ("Deepak", "Choudhury"), ("Mayank", "Das"),
    ("Yash", "Ghosh"), ("Harish", "Roy"), ("Ankit", "Saxena"), ("Vivek", "Dubey"),
    ("Abhishek", "Tripathi"), ("Rakesh", "Mishra"), ("Sandeep", "Pandey"), ("Saurabh", "Shukla"),
    ("Akshay", "Tiwari"), ("Hemant", "Thakur"), ("Chetan", "Chauhan"), ("Arvind", "Rathore"),
    ("Bharat", "Yadav"), ("Dev", "Prasad"), ("Gautam", "Shetty"), ("Ishaan", "Hegde"),
    ("Jayesh", "Gowda"), ("Madhav", "Naidu"), ("Naveen", "Balakrishnan"), ("Omkar", "Swaminathan"),
    ("Parag", "Ranganathan"), ("Ritesh", "Natarajan"), ("Shailesh", "Chawla"), ("Tushar", "Malhotra"),
    ("Utkarsh", "Bhatia"), ("Vaibhav", "Soni"),
]

FEMALE_DETAILS = [
    {"dob": "1998-04-15", "edu": "B.Tech Computer Science", "occ": "Software Engineer", "comp": "Google India", "inc": "25-35 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-08-22", "edu": "MBA Finance", "occ": "Investment Banker", "comp": "Goldman Sachs", "inc": "35-50 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Marathi", "caste": "Maratha", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1999-01-10", "edu": "MBBS, MD Pediatrics", "occ": "Doctor", "comp": "Apollo Hospitals", "inc": "20-30 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1997-11-05", "edu": "MS Data Science", "occ": "Senior Data Scientist", "comp": "Microsoft", "inc": "30-40 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Reddy", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1995-03-18", "edu": "Chartered Accountant (CA)", "occ": "Financial Consultant", "comp": "Deloitte", "inc": "20-25 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Gupta", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1998-09-25", "edu": "B.Arch Architecture", "occ": "Senior Architect", "comp": "Design Studio", "inc": "15-20 LPA", "city": "Kochi", "rel": "Hindu", "lang": "Malayalam", "caste": "Nair", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-12-30", "edu": "M.Tech AI & Robotics", "occ": "AI Research Scientist", "comp": "Amazon AWS", "inc": "35-50 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Deshastha Brahmin", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "2000-06-14", "edu": "B.Des Product Design", "occ": "UI/UX Lead", "comp": "Flipkart", "inc": "18-25 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Brahmin", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1997-02-28", "edu": "M.Sc Biotechnology", "occ": "Research Scientist", "comp": "Biocon", "inc": "15-20 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Kshatriya", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-07-19", "edu": "MBA Marketing", "occ": "Brand Manager", "comp": "Unilever", "inc": "25-35 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Hindi", "caste": "Agarwal", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1998-10-12", "edu": "B.Tech IT", "occ": "Cloud Solutions Architect", "comp": "TCS", "inc": "18-25 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Kulkarni", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-05-03", "edu": "M.Com, CS", "occ": "Company Secretary", "comp": "Adani Group", "inc": "16-22 LPA", "city": "Ahmedabad", "rel": "Hindu", "lang": "Gujarati", "caste": "Patel", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1999-09-17", "edu": "B.E. Electronics", "occ": "Hardware Engineer", "comp": "Qualcomm", "inc": "22-30 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Punjabi", "caste": "Khatri", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1997-04-20", "edu": "MBBS, MS Ophthalmology", "occ": "Eye Surgeon", "comp": "Fortis Hospital", "inc": "28-38 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-11-08", "edu": "LLM Corporate Law", "occ": "Legal Counsel", "comp": "Khaitan & Co", "inc": "24-32 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1998-01-24", "edu": "B.Tech Computer Science", "occ": "Frontend Tech Lead", "comp": "Swiggy", "inc": "26-36 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Bhat", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "2000-03-09", "edu": "BBA, MBA HR", "occ": "HR Business Partner", "comp": "Infosys", "inc": "12-18 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Patil", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-09-14", "edu": "M.A. English Literature", "occ": "Senior Editor & Writer", "comp": "Penguin Random House", "inc": "14-18 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1997-07-22", "edu": "B.Sc, M.Sc Economics", "occ": "Economic Consultant", "comp": "KPMG", "inc": "18-26 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Kayastha", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1999-12-01", "edu": "B.Tech Chemical Engg", "occ": "Process Engineer", "comp": "Reliance Industries", "inc": "16-24 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Bengali", "caste": "Bose", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1995-04-11", "edu": "BDS, MDS Orthodontics", "occ": "Dental Specialist", "comp": "Private Clinic", "inc": "20-28 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-06-29", "edu": "B.Tech Civil Engg", "occ": "Project Manager", "comp": "L&T Construction", "inc": "16-22 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Malayalam", "caste": "Pillai", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1996-02-14", "edu": "M.Sc Mathematics", "occ": "Quantitative Analyst", "comp": "Morgan Stanley", "inc": "30-45 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Bengali", "caste": "Choudhury", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1997-10-31", "edu": "B.Pharma, MBA Pharma", "occ": "Regulatory Affairs Lead", "comp": "Sun Pharma", "inc": "18-25 LPA", "city": "Ahmedabad", "rel": "Hindu", "lang": "Bengali", "caste": "Das", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1999-05-18", "edu": "B.Tech Electronics", "occ": "Embedded Systems Engineer", "comp": "Bosch", "inc": "18-24 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Bengali", "caste": "Ghosh", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-08-07", "edu": "MBA Supply Chain", "occ": "Operations Director", "comp": "Amazon India", "inc": "32-42 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Bengali", "caste": "Roy", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1998-11-20", "edu": "B.Tech Computer Science", "occ": "Full Stack Developer", "comp": "Zomato", "inc": "22-30 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Kayastha", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-03-05", "edu": "M.Com, CFA", "occ": "Portfolio Manager", "comp": "HDFC Mutual Fund", "inc": "28-38 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "2000-08-16", "edu": "B.Sc Computer Science", "occ": "Mobile App Developer", "comp": "PhonePe", "inc": "20-28 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1997-01-27", "edu": "B.Tech Mechanical", "occ": "Design Engineer", "comp": "Tata Motors", "inc": "14-20 LPA", "city": "Pune", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-10-03", "edu": "MA Clinical Psychology", "occ": "Clinical Psychologist", "comp": "Max Healthcare", "inc": "15-22 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1998-07-12", "edu": "B.Tech IT", "occ": "Cybersecurity Analyst", "comp": "PwC", "inc": "18-26 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1996-11-23", "edu": "M.Sc Physics, B.Ed", "occ": "Senior Lecturer", "comp": "Delhi University", "inc": "12-16 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'3\"", "ms": "Never Married"},
    {"dob": "1999-04-02", "edu": "B.Des Fashion Design", "occ": "Fashion Designer", "comp": "FabIndia", "inc": "14-20 LPA", "city": "Jaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1997-09-09", "edu": "B.Tech Computer Science", "occ": "DevOps Engineer", "comp": "Cisco", "inc": "24-32 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-05-15", "edu": "MBA Finance", "occ": "Risk Manager", "comp": "Axis Bank", "inc": "22-30 LPA", "city": "Jaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1998-02-18", "edu": "MBBS", "occ": "Resident Doctor", "comp": "AIIMS New Delhi", "inc": "18-24 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Hindi", "caste": "Yadav", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1996-06-27", "edu": "B.Tech Electronics", "occ": "Telecom Engineer", "comp": "Jio Platforms", "inc": "16-22 LPA", "city": "Lucknow", "rel": "Hindu", "lang": "Hindi", "caste": "Kayastha", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1999-10-05", "edu": "B.Sc Hotel Management", "occ": "Hospitality Manager", "comp": "Taj Hotels", "inc": "14-20 LPA", "city": "Mangalore", "rel": "Hindu", "lang": "Kannada", "caste": "Bunt", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1997-03-31", "edu": "M.Tech Computer Science", "occ": "Backend Engineer", "comp": "Oracle", "inc": "26-36 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Brahmin", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1995-12-19", "edu": "MBA International Business", "occ": "Export Manager", "comp": "ITC Limited", "inc": "22-30 LPA", "city": "Mysuru", "rel": "Hindu", "lang": "Kannada", "caste": "Vokkaliga", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1998-08-11", "edu": "B.Tech Computer Science", "occ": "Product Specialist", "comp": "Salesforce", "inc": "28-38 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Kamma", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1996-01-08", "edu": "M.Sc Statistics", "occ": "Business Analytics Lead", "comp": "Target India", "inc": "22-30 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1999-07-29", "edu": "B.Tech Civil Engg", "occ": "Structural Engineer", "comp": "Atkins", "inc": "16-22 LPA", "city": "Coimbatore", "rel": "Hindu", "lang": "Tamil", "caste": "Iyengar", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1997-12-14", "edu": "MBBS, DGO", "occ": "Gynecologist", "comp": "Manipal Hospitals", "inc": "24-34 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Mudaliar", "ht": "5'4\"", "ms": "Never Married"},
    {"dob": "1995-02-22", "edu": "MBA Operations", "occ": "Senior Consultant", "comp": "EY", "inc": "24-32 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Pillai", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1998-05-07", "edu": "B.Com, MBA Marketing", "occ": "Digital Marketing Lead", "comp": "Nykaa", "inc": "18-26 LPA", "city": "Chandigarh", "rel": "Hindu", "lang": "Punjabi", "caste": "Arora", "ht": "5'7\"", "ms": "Never Married"},
    {"dob": "1996-10-25", "edu": "B.Tech Computer Science", "occ": "Solution Architect", "comp": "Wipro", "inc": "20-28 LPA", "city": "Ludhiana", "rel": "Hindu", "lang": "Punjabi", "caste": "Khatri", "ht": "5'5\"", "ms": "Never Married"},
    {"dob": "1999-03-16", "edu": "BBA, MA Public Relations", "occ": "Corporate Communications Manager", "comp": "Godrej", "inc": "16-22 LPA", "city": "Amritsar", "rel": "Hindu", "lang": "Punjabi", "caste": "Bhatia", "ht": "5'6\"", "ms": "Never Married"},
    {"dob": "1997-06-01", "edu": "M.Sc Chemistry", "occ": "Senior Chemist", "comp": "Cipla", "inc": "14-20 LPA", "city": "Jaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Soni", "ht": "5'3\"", "ms": "Never Married"},
]

MALE_DETAILS = [
    {"dob": "1995-03-20", "edu": "B.Tech + M.Tech IIT Delhi", "occ": "Lead Software Architect", "comp": "Google India", "inc": "45-60 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Hindi", "caste": "Kayastha", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1994-09-12", "edu": "MBA IIM Ahmedabad", "occ": "Vice President - Investment Banking", "comp": "Morgan Stanley", "inc": "50+ LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-01-25", "edu": "MS Computer Science (USA)", "occ": "Senior Engineering Manager", "comp": "Microsoft", "inc": "50+ LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Gujarati", "caste": "Patel", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-11-18", "edu": "MBBS, MS Orthopedics", "occ": "Orthopedic Surgeon", "comp": "Apollo Hospitals", "inc": "35-50 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-07-04", "edu": "B.Tech NIT Trichy", "occ": "Staff Engineer", "comp": "Amazon AWS", "inc": "40-55 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Telugu", "caste": "Reddy", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1997-04-19", "edu": "CA Rankholder", "occ": "Partner - Audit & Assurance", "comp": "KPMG", "inc": "30-40 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Gupta", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-12-08", "edu": "B.Tech Mechanical", "occ": "Chief Technical Officer", "comp": "Tech Startup", "inc": "40-50 LPA", "city": "Kochi", "rel": "Hindu", "lang": "Malayalam", "caste": "Nair", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-05-30", "edu": "B.Tech Computer Science", "occ": "Senior DevOps Consultant", "comp": "Red Hat", "inc": "28-36 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Joshi", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-08-14", "edu": "M.Tech Electronics", "occ": "Principal Hardware Engineer", "comp": "Intel", "inc": "35-48 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Rao", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1995-10-22", "edu": "MBA XLRI Jamshedpur", "occ": "Head of Product", "comp": "Paytm", "inc": "40-55 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Agarwal", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1997-02-11", "edu": "B.Tech IT", "occ": "Senior Backend Developer", "comp": "Flipkart", "inc": "30-40 LPA", "city": "Pune", "rel": "Hindu", "lang": "Marathi", "caste": "Kulkarni", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-06-17", "edu": "MBBS, DM Cardiology", "occ": "Interventional Cardiologist", "comp": "Fortis Healthcare", "inc": "50+ LPA", "city": "Trivandrum", "rel": "Hindu", "lang": "Malayalam", "caste": "Menon", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-03-29", "edu": "B.Tech + MBA SPJIMR", "occ": "Strategy Consultant", "comp": "McKinsey & Company", "inc": "45-60 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Punjabi", "caste": "Kapoor", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1993-09-05", "edu": "B.E. Civil Engineering", "occ": "Infrastructure Director", "comp": "L&T Infrastructure", "inc": "32-42 LPA", "city": "Nagpur", "rel": "Hindu", "lang": "Marathi", "caste": "Deshmukh", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1995-12-03", "edu": "MS Robotics (Germany)", "occ": "Automation Lead", "comp": "Siemens India", "inc": "30-40 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Malayalam", "caste": "Nambiar", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1997-08-27", "edu": "B.Tech Computer Science", "occ": "Engineering Lead", "comp": "Uber", "inc": "42-55 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Bhat", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-04-16", "edu": "M.Sc Agriculture, MBA", "occ": "Agri-Tech Business Head", "comp": "DeHaat", "inc": "24-32 LPA", "city": "Kolhapur", "rel": "Hindu", "lang": "Marathi", "caste": "Patil", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1996-10-09", "edu": "B.Tech + M.Tech IIT Kharagpur", "occ": "Senior Data Scientist", "comp": "Walmart Labs", "inc": "36-48 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Brahmin", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-07-21", "edu": "MBA Foreign Trade", "occ": "International Business Head", "comp": "Tata International", "inc": "35-45 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Kayastha", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1995-01-31", "edu": "B.Tech Chemical Engg", "occ": "Senior Project Manager", "comp": "IOCL", "inc": "22-30 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Bose", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1997-11-14", "edu": "Chartered Financial Analyst (CFA)", "occ": "Senior Equity Analyst", "comp": "Nomura", "inc": "32-42 LPA", "city": "Mumbai", "rel": "Hindu", "lang": "Bengali", "caste": "Brahmin", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-02-06", "edu": "B.Tech Electronics", "occ": "Systems Architect", "comp": "Qualcomm", "inc": "34-45 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Malayalam", "caste": "Pillai", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-08-18", "edu": "MS Biotechnology", "occ": "Senior Bio-informatics Specialist", "comp": "AstraZeneca", "inc": "26-35 LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Bengali", "caste": "Choudhury", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1993-05-24", "edu": "B.Tech Computer Science", "occ": "Technical Lead", "comp": "Oracle", "inc": "30-40 LPA", "city": "Bhubaneswar", "rel": "Hindu", "lang": "Bengali", "caste": "Das", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1995-09-02", "edu": "MBBS, MS General Surgery", "occ": "Consultant Surgeon", "comp": "Medanta Hospital", "inc": "40-55 LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Bengali", "caste": "Ghosh", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1997-06-13", "edu": "B.Arch, M.Des Urban Planning", "occ": "Urban Planner & Architect", "comp": "Smart City Project", "inc": "20-28 LPA", "city": "Kolkata", "rel": "Hindu", "lang": "Bengali", "caste": "Roy", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-10-30", "edu": "B.Tech + MBA IIM Lucknow", "occ": "Associate Director", "comp": "Boston Consulting Group", "inc": "50+ LPA", "city": "Delhi NCR", "rel": "Hindu", "lang": "Hindi", "caste": "Kayastha", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-12-15", "edu": "B.Tech Mechanical", "occ": "Automotive Specialist", "comp": "Mahindra & Mahindra", "inc": "20-28 LPA", "city": "Lucknow", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1993-03-08", "edu": "B.Com, CA, CS", "occ": "Senior Tax Consultant", "comp": "PwC India", "inc": "28-38 LPA", "city": "Varanasi", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1995-08-23", "edu": "B.Tech Computer Science", "occ": "AI Cloud Engineer", "comp": "Adobe India", "inc": "38-50 LPA", "city": "Noida", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1997-01-19", "edu": "M.Sc Economics", "occ": "Senior Policy Advisor", "comp": "NITI Aayog", "inc": "22-30 LPA", "city": "Delhi", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-05-12", "edu": "B.Tech Electrical", "occ": "Renewable Energy Lead", "comp": "Tata Power Solar", "inc": "24-32 LPA", "city": "Kanpur", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-07-07", "edu": "MBA Supply Chain", "occ": "Global Operations Manager", "comp": "DHL Express", "inc": "26-36 LPA", "city": "Prayagraj", "rel": "Hindu", "lang": "Hindi", "caste": "Brahmin", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-10-17", "edu": "B.Tech Civil Engg", "occ": "Real Estate Developer & Builder", "comp": "Family Construction Business", "inc": "45-60 LPA", "city": "Jaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1995-04-28", "edu": "Indian Air Force Officer", "occ": "Flight Lieutenant / Pilot", "comp": "Indian Air Force", "inc": "20-28 LPA", "city": "Jodhpur", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1997-09-03", "edu": "B.Tech + MBA NMIMS", "occ": "Product Marketing Lead", "comp": "PayU", "inc": "28-38 LPA", "city": "Udaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Rajput", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-01-26", "edu": "IAS / Civil Services", "occ": "Assistant Commissioner", "comp": "Government of India", "inc": "18-24 LPA", "city": "Patna", "rel": "Hindu", "lang": "Hindi", "caste": "Yadav", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1996-11-11", "edu": "B.Tech Electronics", "occ": "Firmware Development Lead", "comp": "Texas Instruments", "inc": "32-42 LPA", "city": "Ranchi", "rel": "Hindu", "lang": "Hindi", "caste": "Kayastha", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-06-04", "edu": "B.Com, Hotel Management", "occ": "Managing Director - Hospitality", "comp": "Resort Chain Owner", "inc": "50+ LPA", "city": "Mangalore", "rel": "Hindu", "lang": "Kannada", "caste": "Bunt", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1995-02-17", "edu": "B.Tech + MS Carnegie Mellon", "occ": "Principal Software Engineer", "comp": "Atlassian", "inc": "50+ LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Brahmin", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1997-08-01", "edu": "MBA Finance", "occ": "Senior Wealth Advisor", "comp": "Kotak Mahindra Bank", "inc": "24-34 LPA", "city": "Bengaluru", "rel": "Hindu", "lang": "Kannada", "caste": "Vokkaliga", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1994-12-29", "edu": "B.Tech Computer Science", "occ": "Director of Engineering", "comp": "Freshworks", "inc": "50+ LPA", "city": "Hyderabad", "rel": "Hindu", "lang": "Telugu", "caste": "Kamma", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1996-04-14", "edu": "MBBS, MD Radiology", "occ": "Radiologist Specialist", "comp": "Kauvery Hospital", "inc": "35-48 LPA", "city": "Chennai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyer", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1993-09-20", "edu": "B.Tech Mechanical IIT Madras", "occ": "Automotive Engineering Manager", "comp": "Hyundai R&D", "inc": "32-42 LPA", "city": "Madurai", "rel": "Hindu", "lang": "Tamil", "caste": "Iyengar", "ht": "5'11\"", "ms": "Never Married"},
    {"dob": "1995-05-09", "edu": "B.Tech + MBA Great Lakes", "occ": "Supply Chain Lead", "comp": "Caterpillar", "inc": "26-36 LPA", "city": "Salem", "rel": "Hindu", "lang": "Tamil", "caste": "Mudaliar", "ht": "5'10\"", "ms": "Never Married"},
    {"dob": "1997-10-23", "edu": "B.Tech IT", "occ": "Cybersecurity Consultant", "comp": "EY", "inc": "24-34 LPA", "city": "Coimbatore", "rel": "Hindu", "lang": "Tamil", "caste": "Pillai", "ht": "5'9\"", "ms": "Never Married"},
    {"dob": "1994-08-05", "edu": "MBA Marketing & Strategy", "occ": "Chief Marketing Officer", "comp": "Consumer Brand Startup", "inc": "45-60 LPA", "city": "Chandigarh", "rel": "Hindu", "lang": "Punjabi", "caste": "Arora", "ht": "6'2\"", "ms": "Never Married"},
    {"dob": "1996-02-28", "edu": "B.Tech Computer Science", "occ": "Senior Cloud Infrastructure Architect", "comp": "IBM India", "inc": "30-40 LPA", "city": "Jalandhar", "rel": "Hindu", "lang": "Punjabi", "caste": "Khatri", "ht": "6'1\"", "ms": "Never Married"},
    {"dob": "1993-11-30", "edu": "B.Com, MBA Foreign Trade", "occ": "Senior Director - Global Exports", "comp": "International Trading Firm", "inc": "40-55 LPA", "city": "Amritsar", "rel": "Hindu", "lang": "Punjabi", "caste": "Bhatia", "ht": "6'0\"", "ms": "Never Married"},
    {"dob": "1995-06-25", "edu": "B.Tech Jewellery Design & Tech", "occ": "Jewellery Designer & Business Owner", "comp": "Family Jewellery House", "inc": "50+ LPA", "city": "Jaipur", "rel": "Hindu", "lang": "Hindi", "caste": "Soni", "ht": "5'11\"", "ms": "Never Married"},
]

HOBBIES_POOL = [
    ["Reading", "Traveling", "Music", "Photography", "Cooking"],
    ["Trekking", "Fitness & Gym", "Movies", "Badminton", "Swimming"],
    ["Yoga & Meditation", "Classical Dance", "Gardening", "Baking", "Art & Painting"],
    ["Tech Gadgets", "Road Trips", "Board Games", "Coffee & Cafes", "Writing"],
    ["Cycling", "Running", "Podcasts", "Volunteering", "Fine Dining"],
]


class Command(BaseCommand):
    help = "Generate 100 realistic dummy member profiles with repeating 4 female and 4 male photos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear-existing-seed",
            action="store_true",
            help="Remove previously generated seed dummy members before inserting new ones.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting 100 dummy profile generation...")

        # Locate seed photos
        candidates = [
            Path("/app/seed_photos"),
            Path(settings.BASE_DIR) / "seed_photos",
            Path(settings.BASE_DIR).parent / "backend" / "seed_photos",
            Path(settings.BASE_DIR) / "apps" / "accounts" / "fixtures" / "dummy_assets",
        ]
        photos_dir = next((p for p in candidates if p.is_dir() and (p / "female_1.jpg").exists()), None)
        if not photos_dir:
            self.stderr.write(self.style.ERROR(f"Could not find seed_photos directory in {candidates}"))
            return

        self.stdout.write(self.style.SUCCESS(f"Found seed photos directory: {photos_dir}"))

        # Pre-process the 4 female and 4 male photos
        female_processed = []
        for i in range(1, 5):
            p_path = photos_dir / f"female_{i}.jpg"
            female_processed.append(process_image_to_webp(p_path))
            self.stdout.write(f"Processed female_{i}.jpg: {female_processed[-1]['compressed_size_bytes']} bytes")

        male_processed = []
        for i in range(1, 5):
            p_path = photos_dir / f"male_{i}.jpg"
            male_processed.append(process_image_to_webp(p_path))
            self.stdout.write(f"Processed male_{i}.jpg: {male_processed[-1]['compressed_size_bytes']} bytes")

        hashed_password = make_password("Demo@123")
        now = timezone.now()

        plans = list(MembershipPlan.objects.filter(is_active=True).order_by("rank", "display_order"))
        gold_plan = next((p for p in plans if "gold" in p.slug.lower() or "premium" in p.slug.lower()), None) or (plans[0] if plans else None)

        if options["clear_existing_seed"]:
            deleted_count, _ = Member.objects.filter(is_seed_data=True).delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted_count} existing seed member records."))

        created_females = 0
        created_males = 0

        with transaction.atomic():
            # 1. Create 50 Female Profiles
            for idx in range(50):
                first_name, last_name = FEMALE_NAMES[idx]
                details = FEMALE_DETAILS[idx]
                photo_data = female_processed[idx % 4]  # Cycle through 4 female photos

                email = f"dummy.female.{idx+1:02d}@mydearpartner.com"
                mobile = f"98100{idx+1:05d}"

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
                        "is_premium": (idx % 3 == 0),
                        "account_status": "ACTIVE",
                        "profile_status": "approved",
                        "photo_status": "approved",
                        "document_status": "approved",
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES_POOL[idx % len(HOBBIES_POOL)]
                about_text = (
                    f"Hello! I am {first_name}, working as a {details['occ']} at {details['comp']} in {details['city']}. "
                    f"I hold a degree in {details['edu']}. Outside work, I enjoy {', '.join(hobbies[:3])}. "
                    f"I value honesty, mutual respect, and strong family traditions. "
                    f"Looking for an understanding, well-educated partner with good values to share life's journey together."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": details["ms"],
                        "height": details["ht"],
                        "weight": "55 kg",
                        "blood_group": "B+",
                        "complexion": "Fair",
                        "religion": details["rel"],
                        "mother_tongue": details["lang"],
                        "caste": details["caste"],
                        "sub_caste": "General",
                        "gothra": "Kashyap" if idx % 2 == 0 else "Bharadwaj",
                        "star_nakshatra": "Rohini" if idx % 2 == 0 else "Swati",
                        "manglik_status": "No",
                        "highest_education": details["edu"],
                        "education_detail": f"{details['edu']} from Top University",
                        "occupation": details["occ"],
                        "employed_in": "Private Sector",
                        "company": details["comp"],
                        "annual_income": details["inc"],
                        "work_location": details["city"],
                        "father_status": "Employed / Businessman",
                        "mother_status": "Homemaker",
                        "num_brothers": 1 if idx % 2 == 0 else 0,
                        "num_sisters": 1 if idx % 3 == 0 else 0,
                        "family_type": "Nuclear Family" if idx % 2 == 0 else "Joint Family",
                        "family_status": "Upper Middle Class" if idx % 2 == 0 else "Middle Class",
                        "family_location": details["city"],
                        "about": about_text,
                        "hobbies": hobbies,
                        "compatibility": 85 + (idx % 14),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 25,
                        "preferred_age_max": 35,
                        "preferred_height_min": "5'7\"",
                        "preferred_height_max": "6'3\"",
                        "preferred_religion": details["rel"],
                        "preferred_caste": "Open to all / Same Caste",
                        "preferred_location": details["city"],
                        "preferred_education": "Bachelors or Masters Degree",
                        "preferred_occupation": "Working Professional / Business",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": "Looking for a caring, progressive, and family-oriented partner.",
                    },
                )

                # Attach ProfilePhoto
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

                if gold_plan:
                    MemberMembership.objects.update_or_create(
                        member=member,
                        defaults={
                            "plan": gold_plan,
                            "start_date": now,
                            "end_date": now + timezone.timedelta(days=90),
                            "is_active": True,
                            "status": MemberMembership.MembershipStatus.ACTIVE,
                            "created_by": "system",
                        },
                    )

                created_females += 1

            # 2. Create 50 Male Profiles
            for idx in range(50):
                first_name, last_name = MALE_NAMES[idx]
                details = MALE_DETAILS[idx]
                photo_data = male_processed[idx % 4]  # Cycle through 4 male photos

                email = f"dummy.male.{idx+1:02d}@mydearpartner.com"
                mobile = f"98200{idx+1:05d}"

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
                        "is_premium": (idx % 3 == 0),
                        "account_status": "ACTIVE",
                        "profile_status": "approved",
                        "photo_status": "approved",
                        "document_status": "approved",
                        "is_seed_data": True,
                        "is_hidden": False,
                    },
                )

                hobbies = HOBBIES_POOL[idx % len(HOBBIES_POOL)]
                about_text = (
                    f"Hi there! I am {first_name}, working as a {details['occ']} at {details['comp']} in {details['city']}. "
                    f"I completed my {details['edu']}. In my free time, I enjoy {', '.join(hobbies[:3])}. "
                    f"I consider myself ambitious, grounded, and caring with a positive outlook on life. "
                    f"Looking for an affectionate, educated life partner to build a wonderful future together."
                )

                MemberProfile.objects.update_or_create(
                    member=member,
                    defaults={
                        "marital_status": details["ms"],
                        "height": details["ht"],
                        "weight": "74 kg",
                        "blood_group": "O+",
                        "complexion": "Wheatish",
                        "religion": details["rel"],
                        "mother_tongue": details["lang"],
                        "caste": details["caste"],
                        "sub_caste": "General",
                        "gothra": "Vashistha" if idx % 2 == 0 else "Garg",
                        "star_nakshatra": "Pushya" if idx % 2 == 0 else "Anuradha",
                        "manglik_status": "No",
                        "highest_education": details["edu"],
                        "education_detail": f"{details['edu']} from Premier Institute",
                        "occupation": details["occ"],
                        "employed_in": "Private Sector",
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
                        "compatibility": 86 + (idx % 13),
                    },
                )

                MemberPreference.objects.update_or_create(
                    member=member,
                    defaults={
                        "preferred_age_min": 22,
                        "preferred_age_max": 30,
                        "preferred_height_min": "5'2\"",
                        "preferred_height_max": "5'9\"",
                        "preferred_religion": details["rel"],
                        "preferred_caste": "Open to all / Same Caste",
                        "preferred_location": details["city"],
                        "preferred_education": "Bachelors or Masters Degree",
                        "preferred_occupation": "Working Professional / Doctor / Engineer",
                        "preferred_marital_status": "Never Married",
                        "additional_expectations": "Looking for a well-educated, respectful and supportive partner.",
                    },
                )

                # Attach ProfilePhoto
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

                if gold_plan:
                    MemberMembership.objects.update_or_create(
                        member=member,
                        defaults={
                            "plan": gold_plan,
                            "start_date": now,
                            "end_date": now + timezone.timedelta(days=90),
                            "is_active": True,
                            "status": MemberMembership.MembershipStatus.ACTIVE,
                            "created_by": "system",
                        },
                    )

                created_males += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {created_females} female profiles and {created_males} male profiles (Total: {created_females + created_males}) with real photos."
            )
        )
