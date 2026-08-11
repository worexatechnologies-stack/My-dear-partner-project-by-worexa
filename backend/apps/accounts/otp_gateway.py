import logging
import json
import urllib.request
import urllib.parse
from typing import Optional
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger('accounts.otp')


class OTPChannel:
    SMS = 'SMS'
    WHATSAPP = 'WHATSAPP'
    EMAIL = 'EMAIL'


class RealtimeOTPDispatcher:
    """Multi-channel Real-time OTP Dispatcher supporting SMS, WhatsApp, and Email."""

    @classmethod
    def send_otp(
        cls,
        *,
        channel: str,
        recipient: str,
        code: str,
        purpose: str = 'verification',
        request=None,
    ) -> bool:
        """Dispatch real-time OTP over the specified channel (SMS, WHATSAPP, or EMAIL)."""
        channel_upper = (channel or OTPChannel.SMS).upper()
        logger.info("Dispatching %s OTP to %s for purpose: %s", channel_upper, recipient, purpose)

        if channel_upper == OTPChannel.EMAIL:
            return cls._send_email_otp(recipient=recipient, code=code, purpose=purpose)
        elif channel_upper == OTPChannel.WHATSAPP:
            return cls._send_whatsapp_otp(recipient=recipient, code=code, purpose=purpose)
        else:
            return cls._send_sms_otp(recipient=recipient, code=code, purpose=purpose)

    @classmethod
    def _send_sms_otp(cls, recipient: str, code: str, purpose: str) -> bool:
        provider = getattr(settings, 'OTP_PROVIDER', getattr(settings, 'SMS_PROVIDER', 'RENFLAIR')).upper()

        if provider in ('MOCK', 'DUMMY', 'CONSOLE', 'DEV'):
            logger.info("[OTP MOCK] SMS OTP generated for %s", recipient)
            return True
        elif provider in ('RENFLAIR', 'RENFLAIR_SMS'):
            return cls._send_renflair_sms(recipient, code)
        elif provider == 'MSG91':
            return cls._send_msg91_sms(recipient, code)
        elif provider == 'TWILIO':
            return cls._send_twilio_sms(recipient, code)
        else:
            return cls._send_renflair_sms(recipient, code)

    @classmethod
    def _send_renflair_sms(cls, recipient: str, code: str) -> bool:
        api_key = getattr(settings, 'RENFLAIR_API_KEY', '')
        raw_phone = recipient.replace('+', '').replace(' ', '').replace('-', '').strip()
        phone_10 = raw_phone[2:] if (len(raw_phone) == 12 and raw_phone.startswith('91')) else raw_phone
        if len(phone_10) != 10 or not phone_10.isdigit():
            logger.error("[RENFLAIR SMS] Invalid recipient format: %s", recipient)
            return False

        # Renflair's documented OTP API uses V1.php and sends the code as an
        # OTP parameter. The previous implementation called undocumented
        # notification endpoints and reported success when no SMS was sent.
        query = urllib.parse.urlencode({"API": api_key, "PHONE": phone_10, "OTP": code})
        try:
            request = urllib.request.Request(f"https://sms.renflair.in/V1.php?{query}", method='GET')
            with urllib.request.urlopen(request, timeout=8) as response:
                response.read()
                delivered = 200 <= response.status < 300
                if not delivered:
                    logger.error("[RENFLAIR SMS] Provider returned HTTP %s", response.status)
                return delivered
        except Exception as exc:
            logger.error("[RENFLAIR SMS] Delivery request failed for recipient %s: %s", recipient, exc)
            return False

    @classmethod
    def _send_whatsapp_otp(cls, recipient: str, code: str, purpose: str) -> bool:
        provider = getattr(settings, 'OTP_PROVIDER', 'MOCK').upper()

        if provider == 'MSG91':
            return cls._send_msg91_whatsapp(recipient, code)
        elif provider == 'TWILIO':
            return cls._send_twilio_whatsapp(recipient, code)
        else:
            # Development / Mock mode
            logger.info("[REALTIME OTP MOCK - WHATSAPP] Sent OTP %s to %s", code, recipient)
            return True

    @classmethod
    def _send_email_otp(cls, recipient: str, code: str, purpose: str) -> bool:
        from django.utils import timezone

        app_name = getattr(settings, 'APP_NAME', 'My Dear Partner')
        subject = f"Your {app_name} Verification Code"
        plain_message = (
            f"Hello,\n\n"
            f"Your one-time verification code for {app_name} is: {code}\n"
            f"This code will expire in 5 minutes. Please do not share this code with anyone.\n\n"
            f"Regards,\n{app_name} Team"
        )
        html_message = render_to_string('email/otp_email.html', {
            'code': code,
            'recipient': recipient,
            'purpose': purpose,
            'channel_label': 'email address',
            'validity': 5,
            'app_name': app_name,
            'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@mydearpartner.com'),
            'year': timezone.now().year,
        })

        try:
            send_mail(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@mydearpartner.com'),
                recipient_list=[recipient],
                fail_silently=False,
            )
            logger.info("[REALTIME OTP] Sent Email OTP to %s", recipient)
            return True
        except Exception as exc:
            # The email was NOT delivered. Report the failure loudly instead of
            # pretending it succeeded (old behaviour swallowed the error and the
            # user never received the code). Typical cause: SMTP relay rejecting
            # the caller's IP (e.g. Hostinger "Client host rejected").
            logger.error(
                "[REALTIME OTP] FAILED to deliver Email OTP to %s - code was NOT sent. "
                "Check EMAIL_HOST/SMTP credentials and that the outgoing IP is permitted. Error: %s",
                recipient, exc,
            )
            return False

    @classmethod
    def _send_msg91_sms(cls, recipient: str, code: str) -> bool:
        auth_key = getattr(settings, 'MSG91_AUTH_KEY', '')
        template_id = getattr(settings, 'MSG91_OTP_TEMPLATE_ID', '')
        if not auth_key:
            logger.warning("MSG91_AUTH_KEY not set. Falling back to mock dispatch.")
            return True

        clean_phone = recipient.replace('+', '').replace(' ', '').replace('-', '')
        url = "https://control.msg91.com/api/v5/otp"
        payload = {
            "template_id": template_id,
            "mobile": clean_phone,
            "otp": code,
        }
        headers = {
            "authkey": auth_key,
            "content-type": "application/json"
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                logger.info("MSG91 SMS API response: %s", res_data)
                return res_data.get('type') == 'success'
        except Exception as exc:
            logger.error("Failed to send MSG91 SMS: %s", exc)
            return False

    @classmethod
    def _send_msg91_whatsapp(cls, recipient: str, code: str) -> bool:
        auth_key = getattr(settings, 'MSG91_AUTH_KEY', '')
        if not auth_key:
            logger.warning("MSG91_AUTH_KEY not set for WhatsApp. Falling back to mock dispatch.")
            return True

        clean_phone = recipient.replace('+', '').replace(' ', '').replace('-', '')
        url = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/"
        payload = {
            "integrated_number": getattr(settings, 'MSG91_WHATSAPP_NUMBER', ''),
            "content_type": "template",
            "payload": {
                "to": clean_phone,
                "type": "template",
                "template": {
                    "name": getattr(settings, 'MSG91_WHATSAPP_TEMPLATE_NAME', 'otp_verification'),
                    "language": {"code": "en", "policy": "deterministic"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": code}]
                        }
                    ]
                }
            }
        }
        headers = {
            "authkey": auth_key,
            "content-type": "application/json"
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                logger.info("MSG91 WhatsApp API response: %s", res_data)
                return True
        except Exception as exc:
            logger.error("Failed to send MSG91 WhatsApp: %s", exc)
            return False

    @classmethod
    def _send_twilio_sms(cls, recipient: str, code: str) -> bool:
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '')
        if not (account_sid and auth_token and from_number):
            logger.warning("Twilio credentials incomplete. Falling back to mock dispatch.")
            return True

        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = urllib.parse.urlencode({
            'To': recipient,
            'From': from_number,
            'Body': f"Your My Dear Partner verification code is: {code}"
        }).encode('utf-8')

        try:
            req = urllib.request.Request(url, data=data, method='POST')
            base64string = urllib.request.base64.b64encode(f"{account_sid}:{auth_token}".encode('ascii')).decode('ascii')
            req.add_header("Authorization", f"Basic {base64string}")
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                logger.info("Twilio SMS API response: %s", res_data.get('sid'))
                return True
        except Exception as exc:
            logger.error("Failed to send Twilio SMS: %s", exc)
            return False

    @classmethod
    def _send_twilio_whatsapp(cls, recipient: str, code: str) -> bool:
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')
        if not (account_sid and auth_token):
            logger.warning("Twilio credentials incomplete for WhatsApp. Falling back to mock dispatch.")
            return True

        to_number = recipient if recipient.startswith('whatsapp:') else f"whatsapp:{recipient}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = urllib.parse.urlencode({
            'To': to_number,
            'From': from_number,
            'Body': f"Your My Dear Partner verification code is: {code}"
        }).encode('utf-8')

        try:
            req = urllib.request.Request(url, data=data, method='POST')
            import base64
            b64str = base64.b64encode(f"{account_sid}:{auth_token}".encode('ascii')).decode('ascii')
            req.add_header("Authorization", f"Basic {b64str}")
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                logger.info("Twilio WhatsApp API response: %s", res_data.get('sid'))
                return True
        except Exception as exc:
            logger.error("Failed to send Twilio WhatsApp: %s", exc)
            return False
