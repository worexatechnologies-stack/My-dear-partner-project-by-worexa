from .base import *

DEBUG = True
DEVELOPER_OTP = '123456'

# The integration suite exercises the real API routing surface.  Production
# may intentionally pause the back-office portal, but doing so in tests turns
# every administrative authorization assertion into a route-level 404.
ENABLE_ADMIN_PORTAL = True
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']

# Most security tests use the reviewed-member policy.  Rollout tests that
# specifically cover the opt-out path override this setting locally.
REQUIRE_MEMBER_VERIFICATION = True

# Speed up password hashing for tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Unit/integration tests deliberately do not require an external Redis
# process; cache-loss behavior remains identical because no image binary is
# ever written to any cache backend.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'profile-photo-tests',
    },
}

# Disable rate limiting for tests
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': None,
        'user': None,
        'login': None,
        'reset-password': None,
    }
}

SMS_OTP_SENDER = 'apps.accounts.services.dummy_sms_sender'
TESTING = True
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
