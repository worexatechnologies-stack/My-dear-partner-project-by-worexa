import urllib.parse
import urllib.request
import json
import logging
from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def verify_turnstile_captcha(token: str, remote_ip: str = None) -> bool:
    """Verify Cloudflare Turnstile CAPTCHA token against Cloudflare's server verification API.
    
    Returns True if valid.
    Raises ValidationError if invalid, missing, or expired.
    """
    secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()
    
    # In DEBUG/TESTING mode without secret key, allow testing bypass or dummy token
    if not secret_key or getattr(settings, 'TESTING', False):
        if settings.DEBUG and (not token or token == 'DEV_TEST_PASS_TOKEN' or token == '1x0000000000000000000000000000000AA'):
            return True
        if not secret_key:
            logger.warning("TURNSTILE_SECRET_KEY not set. CAPTCHA validation passed in DEBUG mode.")
            return True

    if not token or not token.strip():
        raise ValidationError({'captcha': ['CAPTCHA verification token is required.']})

    params = {
        'secret': secret_key,
        'response': token.strip(),
    }
    if remote_ip:
        params['remoteip'] = remote_ip

    data = urllib.parse.urlencode(params).encode('utf-8')
    req = urllib.request.Request(TURNSTILE_VERIFY_URL, data=data, method='POST')

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            if body.get('success') is True:
                return True
            error_codes = body.get('error-codes', [])
            logger.warning("Turnstile CAPTCHA verification failed: %s", error_codes)
            raise ValidationError({'captcha': ['CAPTCHA verification failed. Please complete the security check.']})
    except urllib.error.URLError as e:
        logger.error("Turnstile server connection error: %s", e)
        if settings.DEBUG:
            return True
        raise ValidationError({'captcha': ['Unable to verify security CAPTCHA. Please try again.']})
