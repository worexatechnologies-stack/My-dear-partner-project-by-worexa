from django.test import override_settings

from apps.accounts.otp_gateway import OTPChannel, RealtimeOTPDispatcher


def test_otp_dispatcher_uses_renflair_sms():
    success = RealtimeOTPDispatcher.send_otp(
        channel=OTPChannel.SMS,
        recipient='+919876543210',
        code='123456',
        purpose='verification',
    )
    assert success is True


def test_otp_dispatcher_rejects_removed_channels():
    success = RealtimeOTPDispatcher.send_otp(
        channel='WHATSAPP',
        recipient='+919876543210',
        code='654321',
        purpose='verification',
    )
    assert success is False


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
def test_otp_dispatcher_email_reset_code():
    success = RealtimeOTPDispatcher.send_otp(
        channel=OTPChannel.EMAIL,
        recipient='testuser@example.com',
        code='999888',
        purpose='password_reset',
    )
    assert success is True
