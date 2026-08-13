import pytest

from apps.accounts.otp_gateway import RealtimeOTPDispatcher


@pytest.fixture(autouse=True)
def renflair_delivery_stub(monkeypatch):
    """Keep account tests offline while exercising the Renflair code path."""

    def deliver(_cls, _recipient, _code):
        return True

    monkeypatch.setattr(
        RealtimeOTPDispatcher,
        '_send_renflair_sms',
        classmethod(deliver),
    )
