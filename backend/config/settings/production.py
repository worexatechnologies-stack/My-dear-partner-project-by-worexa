from .base import *
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

# Security check to ensure a strong SECRET_KEY is supplied in production.
# env_validator guarantees a non-empty string; str() clarifies it to static checkers.
if not SECRET_KEY or str(SECRET_KEY).startswith('django-insecure'):
    raise ImproperlyConfigured('A strong, secure SECRET_KEY is required in production.')

# 12-factor overrides from env config
SECURE_SSL_REDIRECT = config['SECURE_SSL_REDIRECT']
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True

SECURE_HSTS_SECONDS = config['SECURE_HSTS_SECONDS']
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS = 'DENY'

# Secure Proxy Headers setup
if config['SECURE_PROXY_SSL_HEADER']:
    header_parts = [p.strip() for p in str(config['SECURE_PROXY_SSL_HEADER']).split(',')]
    if len(header_parts) == 2:
        SECURE_PROXY_SSL_HEADER = (header_parts[0], header_parts[1])

# Ensure Console Email Backend is disabled
if EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
    raise ImproperlyConfigured('Console email backend cannot be used in a production environment.')

# Development features are strictly disabled
ALLOW_DEVELOPMENT_SEED = False
ALLOW_DESTRUCTIVE_DEV_RESET = False

# Production Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': config['LOG_LEVEL'],
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': config['LOG_LEVEL'],
            'propagate': False,
        },
    },
}

# Optional Sentry integration
if config['SENTRY_DSN']:
    try:
        import sentry_sdk  # type: ignore[import-not-found]  # optional dependency
        from sentry_sdk.integrations.django import DjangoIntegration  # type: ignore[import-not-found]  # noqa: F401
        sentry_sdk.init(
            dsn=config['SENTRY_DSN'],
            integrations=[DjangoIntegration()],
            traces_sample_rate=1.0,
            send_default_pii=True
        )
    except ImportError:
        pass
