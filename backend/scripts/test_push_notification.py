#!/usr/bin/env python
"""Standalone script to test Firebase Cloud Messaging (FCM) push notifications.

Usage:
  python scripts/test_push_notification.py --token <FCM_TOKEN> --type chat
  python scripts/test_push_notification.py --token <FCM_TOKEN> --type interest
  python scripts/test_push_notification.py --token <FCM_TOKEN> --credentials /path/to/service-account.json
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Configure django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
try:
    import django
    django.setup()
except Exception:
    # If production settings needed
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
    import django
    django.setup()

from apps.notifications.push import send_chat_push, send_interest_push, firebase_app


def main():
    parser = argparse.ArgumentParser(description="Send test push notification for MyDearPartner")
    parser.add_argument("--token", required=True, help="Target FCM device token")
    parser.add_argument(
        "--type",
        choices=["chat", "interest"],
        default="chat",
        help="Notification type ('chat' or 'interest')",
    )
    parser.add_argument("--title", default=None, help="Custom title")
    parser.add_argument("--body", default=None, help="Custom body")
    parser.add_argument(
        "--credentials",
        default=None,
        help="Optional path to service account JSON file",
    )

    args = parser.parse_args()

    if args.credentials:
        os.environ["FIREBASE_SERVICE_ACCOUNT_FILE"] = args.credentials

    app = firebase_app()
    if not app:
        print("[ERROR] Could not initialize Firebase Admin SDK. Please check credentials.")
        sys.exit(1)

    print(f"[INFO] Firebase Admin initialized for project: {getattr(app, 'project_id', 'unknown')}")
    print(f"[INFO] Sending test '{args.type}' push notification to token: {args.token[:20]}...")

    if args.type == "interest":
        msg_id = send_interest_push(
            device=args.token,
            sender_name="MyDearPartner Test",
            interest_id="test-script-001",
            sender_id="admin-test",
            receiver_id="target-test",
            title=args.title or "New Interest",
            body=args.body or "Someone sent you an interest",
        )
    else:
        msg_id = send_chat_push(
            device=args.token,
            sender_name="MyDearPartner Test",
            message_id="test-script-001",
            conversation_id="test-conv-001",
            sender_id="admin-test",
            receiver_id="target-test",
            title=args.title or "New message",
            body=args.body or "You have a new message",
        )

    if msg_id:
        print(f"[SUCCESS] Test push notification delivered! Message ID: {msg_id}")
    else:
        print(f"[FAILED] Push delivery failed. Check backend logs above for error details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
