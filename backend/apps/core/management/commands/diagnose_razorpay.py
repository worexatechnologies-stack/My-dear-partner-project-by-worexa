"""
Management command to diagnose Razorpay configuration and connectivity.

Usage:
    python manage.py diagnose_razorpay

Reports:
    - Configured mode (test/live)
    - Masked key ID (never the full key)
    - Key prefix validity
    - Successful authenticated API call to Razorpay Orders API
    - Never returns the key secret.
"""
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


def _mask_key_id(key_id):
    if not key_id:
        return '(none)'
    if len(key_id) <= 8:
        return key_id[:4] + '****'
    return key_id[:6] + '****' + key_id[-4:]


class Command(BaseCommand):
    help = 'Diagnose Razorpay configuration and API connectivity.'

    def handle(self, *args, **options):
        self.stdout.write('=== Razorpay Diagnostic ===\n')

        # 1. Environment mode
        dj_env = settings.ENVIRONMENT
        rp_mode = settings.RAZORPAY_MODE
        self.stdout.write(f'  Django environment : {dj_env}')
        self.stdout.write(f'  RAZORPAY_MODE     : {rp_mode}')

        # 2. Key presence and prefix check
        key_id = settings.RAZORPAY_KEY_ID or ''
        secret = settings.RAZORPAY_KEY_SECRET or ''
        webhook = settings.RAZORPAY_WEBHOOK_SECRET or ''

        if not key_id:
            self.stdout.write(self.style.WARNING('  RAZORPAY_KEY_ID  : NOT SET'))
        else:
            self.stdout.write(f'  RAZORPAY_KEY_ID  : {_mask_key_id(key_id)}')
            if key_id.startswith('rzp_test_'):
                self.stdout.write('    Prefix check    : rzp_test_ (TEST mode)')
                if rp_mode != 'test':
                    self.stdout.write(self.style.WARNING('    WARNING: key prefix is "rzp_test_" but RAZORPAY_MODE is not "test"'))
            elif key_id.startswith('rzp_live_'):
                self.stdout.write('    Prefix check    : rzp_live_ (LIVE mode)')
                if rp_mode != 'live':
                    self.stdout.write(self.style.WARNING('    WARNING: key prefix is "rzp_live_" but RAZORPAY_MODE is not "live"'))
            else:
                self.stdout.write(self.style.ERROR(f'    INVALID PREFIX: must start with "rzp_test_" or "rzp_live_"'))

        if not secret:
            self.stdout.write(self.style.WARNING('  RAZORPAY_KEY_SECRET: NOT SET'))
        else:
            self.stdout.write(f'  RAZORPAY_KEY_SECRET: {"****" + secret[-4:] if len(secret) > 4 else "****"}')

        if not webhook:
            self.stdout.write(self.style.WARNING('  RAZORPAY_WEBHOOK_SECRET: NOT SET'))
        else:
            webhook_masked = webhook[:2] + '****' + webhook[-4:] if len(webhook) > 6 else '****'
            self.stdout.write(f'  RAZORPAY_WEBHOOK_SECRET: {webhook_masked}')

        # 3. Check key/secret balancing
        if key_id.startswith('rzp_test_') and not key_id.startswith('rzp_test_replace_me'):
            self.stdout.write(self.style.SUCCESS('  Key/secret balance: rzp_test_ + test mode (OK for development)'))
        elif key_id.startswith('rzp_live_'):
            self.stdout.write(self.style.SUCCESS('  Key/secret balance: rzp_live_ + live mode (OK for production)'))

        # 4. Test authenticated API call
        if not key_id or not secret:
            self.stdout.write(self.style.WARNING('\n--- Credentials not fully configured, skipping API test ---'))
            return

        self.stdout.write('\n--- Testing Razorpay API connectivity ---')
        import base64
        credentials = base64.b64encode(
            f'{key_id}:{secret}'.encode('utf-8')
        ).decode('ascii')

        try:
            request = Request(
                'https://api.razorpay.com/v1/orders?count=1',
                headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
                method='GET',
            )
            with urlopen(request, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                self.stdout.write(self.style.SUCCESS('  API call: SUCCESS'))
                items = data.get('items', [])
                self.stdout.write(f'  Existing orders: {len(items)}')
                if items:
                    sample = items[0]
                    self.stdout.write(f'  Sample order ID: {sample.get("id", "N/A")}')
                    self.stdout.write(f'  Sample amount   : {sample.get("amount", "N/A")}')
                    self.stdout.write(f'  Sample currency : {sample.get("currency", "N/A")}')
                    self.stdout.write(f'  Sample status   : {sample.get("status", "N/A")}')
        except HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')[:500]
            self.stdout.write(self.style.ERROR(f'  API call: FAILED (HTTP {e.code})'))
            self.stdout.write(self.style.ERROR(f'  Response: {body}'))
            if e.code == 401:
                self.stdout.write(self.style.ERROR(
                    '\n  ROOT CAUSE: The Razorpay API returned 401 Unauthorized.\n'
                    '  This means the key and secret are not a valid matching pair,\n'
                    '  the key has expired, or has been deleted/disabled.\n\n'
                    '  FIX: Generate a fresh key-secret pair from the Razorpay Dashboard\n'
                    '  (Settings -> API Keys) and update RAZORPAY_KEY_ID and\n'
                    '  RAZORPAY_KEY_SECRET in the .env file.'
                ))
        except URLError as e:
            self.stdout.write(self.style.ERROR(f'  API call: NETWORK ERROR ({e.reason})'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  API call: ERROR ({e.__class__.__name__}: {e})'))

        # 5. Database check for stale orders
        self.stdout.write('\n--- Stale PaymentOrders ---')
        from django.utils import timezone
        from datetime import timedelta
        from apps.core.models import PaymentOrder
        stale = PaymentOrder.objects.filter(
            status='created',
            created_at__lt=timezone.now() - timedelta(hours=1)
        ).count()
        total_created = PaymentOrder.objects.filter(status='created').count()
        self.stdout.write(f'  Total "created" orders: {total_created}')
        self.stdout.write(f'  Stale unpaid (>1hr)  : {stale}')

        self.stdout.write('\n=== Diagnostic Complete ===')
