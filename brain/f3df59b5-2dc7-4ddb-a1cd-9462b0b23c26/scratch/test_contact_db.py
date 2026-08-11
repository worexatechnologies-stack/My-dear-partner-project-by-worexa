import sys
import os
import django

# Setup Django environment
sys.path.insert(0, r'c:\Users\ullas\Desktop\Company projects\matiromony\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.core.models import ContactEnquiry
from apps.core.serializers import ContactEnquirySerializer

print("--- Testing Database & ContactEnquiry Creation ---")

# 1. Create via ORM to verify Database schema
try:
    enquiry = ContactEnquiry.objects.create(
        name="Test User Phone",
        email="testphone@example.com",
        phone="+91 9876543210",
        subject="general",
        message="Testing phone number field saving to DB"
    )
    print(f"[SUCCESS] ContactEnquiry saved to DB! ID: {enquiry.id}, Phone: {enquiry.phone}")
except Exception as e:
    print(f"[ERROR] DB creation failed: {e}")

# 2. Test Serializer validation & serialization with phone
try:
    data = {
        "name": "Serializer Test",
        "email": "serializer@example.com",
        "phone": "+91 8888877777",
        "subject": "support",
        "message": "Testing serializer with phone"
    }
    serializer = ContactEnquirySerializer(data=data)
    if serializer.is_valid():
        saved_obj = serializer.save()
        print(f"[SUCCESS] Serializer validated & saved! ID: {saved_obj.id}, Phone: {saved_obj.phone}")
    else:
        print(f"[ERROR] Serializer invalid: {serializer.errors}")
except Exception as e:
    print(f"[ERROR] Serializer test failed: {e}")

# 3. Clean up test entries
ContactEnquiry.objects.filter(email__in=["testphone@example.com", "serializer@example.com"]).delete()
print("[CLEANUP] Deleted test entries cleanly!")
