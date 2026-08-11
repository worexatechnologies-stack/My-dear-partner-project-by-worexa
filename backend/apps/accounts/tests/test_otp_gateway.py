import pytest
from django.conf import settings
from django.test import override_settings
from apps.accounts.otp_gateway import RealtimeOTPDispatcher, OTPChannel


@pytest.mark.django_db
@override_settings(OTP_PROVIDER='MOCK')
def test_otp_dispatcher_sms_mock():
    success = RealtimeOTPDispatcher.send_otp(
        channel=OTPChannel.SMS,
        recipient='+919876543210',
        code='123456',
        purpose='verification',
    )
    assert success is True


@pytest.mark.django_db
@override_settings(OTP_PROVIDER='MOCK')
def test_otp_dispatcher_whatsapp_mock():
    success = RealtimeOTPDispatcher.send_otp(
        channel=OTPChannel.WHATSAPP,
        recipient='+919876543210',
        code='654321',
        purpose='verification',
    )
    assert success is True


@pytest.mark.django_db
@override_settings(OTP_PROVIDER='MOCK', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
def test_otp_dispatcher_email_mock():
    success = RealtimeOTPDispatcher.send_otp(
        channel=OTPChannel.EMAIL,
        recipient='testuser@example.com',
        code='999888',
        purpose='verification',
    )
    assert success is True
