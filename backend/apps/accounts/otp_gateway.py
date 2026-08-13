import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger('accounts.otp')


class OTPChannel:
    SMS = 'SMS'
    EMAIL = 'EMAIL'


class RealtimeOTPDispatcher:
    """Send mobile OTPs through Renflair and reset codes through SMTP email."""

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
        channel_upper = (channel or OTPChannel.SMS).upper()
        logger.info("Dispatching %s OTP for purpose: %s", channel_upper, purpose)
        if channel_upper == OTPChannel.EMAIL:
            return cls._send_email_otp(recipient=recipient, code=code, purpose=purpose)
        if channel_upper != OTPChannel.SMS:
            logger.error("Unsupported OTP channel: %s", channel_upper)
            return False
        return cls._send_renflair_sms(recipient, code)

    @classmethod
    def _send_renflair_sms(cls, recipient: str, code: str) -> bool:
        api_key = str(getattr(settings, 'RENFLAIR_API_KEY', '') or '').strip()
        raw_phone = recipient.replace('+', '').replace(' ', '').replace('-', '').strip()
        phone_10 = raw_phone[2:] if len(raw_phone) == 12 and raw_phone.startswith('91') else raw_phone
        if not api_key:
            logger.error('[RENFLAIR SMS] RENFLAIR_API_KEY is not configured.')
            return False
        if len(phone_10) != 10 or not phone_10.isdigit():
            logger.error('[RENFLAIR SMS] Invalid recipient format.')
            return False

        query = urllib.parse.urlencode({'API': api_key, 'PHONE': phone_10, 'OTP': code})
        try:
            provider_request = urllib.request.Request(
                f'https://sms.renflair.in/V1.php?{query}',
                method='GET',
            )
            with urllib.request.urlopen(provider_request, timeout=8) as response:
                response.read()
                delivered = 200 <= response.status < 300
                if not delivered:
                    logger.error('[RENFLAIR SMS] Provider returned HTTP %s', response.status)
                return delivered
        except Exception as exc:
            logger.error('[RENFLAIR SMS] Delivery request failed: %s', exc)
            return False

    @classmethod
    def _send_email_otp(cls, recipient: str, code: str, purpose: str) -> bool:
        from django.utils import timezone

        app_name = getattr(settings, 'APP_NAME', 'My Dear Partner')
        subject = f'Your {app_name} Verification Code'
        plain_message = (
            f'Hello,\n\nYour one-time verification code for {app_name} is: {code}\n'
            'This code will expire in 5 minutes. Please do not share this code with anyone.\n\n'
            f'Regards,\n{app_name} Team'
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
            return True
        except Exception as exc:
            logger.error('[EMAIL OTP] Delivery failed: %s', exc)
            return False
