"""Management command to setup the dedicated demo account with OTP bypass.

Account Details:
- Mobile: 9187233618
- Password: Kvenki@2002
- Classification: Demo Account (OTP verification bypassed)
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from apps.accounts.demo import (
    DEMO_ACCOUNT_EMAIL,
    DEMO_ACCOUNT_MOBILE,
    DEMO_ACCOUNT_PASSWORD,
    ensure_demo_account_exists,
)


class Command(BaseCommand):
    help = "Creates or updates the dedicated demo account (9187233618) with OTP bypassed."

    def handle(self, *args, **options):
        self.stdout.write("Configuring demo account with OTP bypass...")
        member = ensure_demo_account_exists()
        self.stdout.write(self.style.SUCCESS("✓ Demo account configured successfully!"))
        self.stdout.write(f"  Mobile   : {DEMO_ACCOUNT_MOBILE}")
        self.stdout.write(f"  Password : {DEMO_ACCOUNT_PASSWORD}")
        self.stdout.write(f"  Email    : {member.email}")
        self.stdout.write(f"  Name     : {member.get_full_name()}")
        self.stdout.write(f"  Status   : {member.account_status}")
        self.stdout.write(f"  Mobile Verified: {member.is_mobile_verified}")
        self.stdout.write(self.style.NOTICE("  OTP Verification: BYPASSED (Instant sign-in without OTP)"))

