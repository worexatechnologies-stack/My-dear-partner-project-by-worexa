import sys
from django.core.management.base import BaseCommand
from apps.notifications.models import Device
from apps.notifications.push import send_chat_push, send_interest_push


class Command(BaseCommand):
    help = "Send a test FCM/APNs push notification to a specific token or user ID"

    def add_arguments(self, parser):
        parser.add_argument(
            "--token",
            type=str,
            help="Target FCM device token",
        )
        parser.add_argument(
            "--user-id",
            type=str,
            help="Target user ID (sends to all active registered devices of this user)",
        )
        parser.add_argument(
            "--type",
            type=str,
            default="chat",
            choices=["chat", "interest"],
            help="Notification type: 'chat' (channel mdp_messages_v2) or 'interest' (channel mdp_interests_v2)",
        )
        parser.add_argument(
            "--title",
            type=str,
            default=None,
            help="Custom notification title",
        )
        parser.add_argument(
            "--body",
            type=str,
            default=None,
            help="Custom notification body",
        )

    def handle(self, *args, **options):
        token = options.get("token")
        user_id = options.get("user_id")
        push_type = options.get("type", "chat")
        title = options.get("title")
        body = options.get("body")

        if not token and not user_id:
            self.stderr.write(self.style.ERROR("Error: You must provide either --token or --user-id"))
            sys.exit(1)

        tokens = []
        if token:
            tokens.append(token.strip())

        if user_id:
            user_devices = list(Device.objects.filter(user_id=user_id, active=True))
            for dev in user_devices:
                if dev.token not in tokens:
                    tokens.append(dev.token)
            if not tokens and not token:
                self.stderr.write(self.style.WARNING(f"No active devices found for user_id={user_id}"))
                return

        self.stdout.write(
            self.style.NOTICE(
                f"Starting test push: type={push_type}, target_tokens={len(tokens)}"
            )
        )

        for target_token in tokens:
            self.stdout.write(f"Sending to token: {target_token[:20]}...")
            if push_type == "interest":
                msg_id = send_interest_push(
                    device=target_token,
                    sender_name="MyDearPartner Test",
                    interest_id="test-cmd-001",
                    sender_id="admin",
                    receiver_id=user_id or "target",
                    title=title or "New Interest",
                    body=body or "Someone sent you an interest",
                )
            else:
                msg_id = send_chat_push(
                    device=target_token,
                    sender_name="MyDearPartner Test",
                    message_id="test-cmd-001",
                    conversation_id="test-conv-001",
                    sender_id="admin",
                    receiver_id=user_id or "target",
                    title=title or "New message",
                    body=body or "You have a new message",
                )

            if msg_id:
                self.stdout.write(
                    self.style.SUCCESS(f" [OK] Successfully delivered! Firebase Message ID: {msg_id}")
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f" [FAIL] Delivery failed for token: {target_token[:20]}... Check logs for details.")
                )
