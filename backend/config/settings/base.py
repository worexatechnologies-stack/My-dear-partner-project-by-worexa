import os
import sys
import socket
import urllib.parse
from pathlib import Path
from datetime import timedelta
from config.env_validator import config

TESTING = len(sys.argv) > 1 and sys.argv[1] == 'test'

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Read configurations from our validation engine
ENVIRONMENT = config['ENVIRONMENT']
IS_PRODUCTION = ENVIRONMENT == 'production'

SECRET_KEY = config['SECRET_KEY']
DEBUG = config['DEBUG']
ALLOWED_HOSTS = config['ALLOWED_HOSTS']

APP_NAME = config['APP_NAME']
APP_URL = config['APP_URL']
FRONTEND_URL = config['FRONTEND_URL']
BACKEND_URL = config['BACKEND_URL']
API_VERSION = config['API_VERSION']

# Security features & Flags
OTP_PROVIDER = 'renflair'
RENFLAIR_API_KEY = config['RENFLAIR_API_KEY']

PAYMENT_MODE = config['PAYMENT_MODE']
MEMBERSHIP_ACTIVATION_MODE = config['MEMBERSHIP_ACTIVATION_MODE']
RAZORPAY_KEY_ID = config['RAZORPAY_KEY_ID']
RAZORPAY_KEY_SECRET = config['RAZORPAY_KEY_SECRET']
RAZORPAY_WEBHOOK_SECRET = config['RAZORPAY_WEBHOOK_SECRET']
RAZORPAY_MODE = config['RAZORPAY_MODE']
REQUIRE_MEMBER_VERIFICATION = config['REQUIRE_MEMBER_VERIFICATION']
ENABLE_ADMIN_PORTAL = config['ENABLE_ADMIN_PORTAL']

# Permanent deletion never retains identity-document binary files.  A legal
# hold may explicitly preserve only the non-file metadata in the operational
# audit record by selecting ``retain_metadata``.
PERMANENT_DELETE_DOCUMENT_POLICY = config['PERMANENT_DELETE_DOCUMENT_POLICY']

FREE_PROFILE_VIEW_LIMIT = int(os.environ.get('FREE_PROFILE_VIEW_LIMIT', 5))

ALLOW_DEVELOPMENT_SEED = config['ENABLE_DEVELOPMENT_SEED']
ALLOW_DESTRUCTIVE_DEV_RESET = os.environ.get('ALLOW_DESTRUCTIVE_DEV_RESET', 'False') == 'True' and (ENVIRONMENT == 'local')
ENABLE_TWO_FACTOR = config['ENABLE_TWO_FACTOR']
SUPERADMIN_EMAIL = config['SUPERADMIN_EMAIL']
SUPERADMIN_PASSWORD = config['SUPERADMIN_PASSWORD']
SUPERADMIN_MOBILE = config['SUPERADMIN_MOBILE']
SUPERADMIN_FIRST_NAME = config['SUPERADMIN_FIRST_NAME']
SUPERADMIN_LAST_NAME = config['SUPERADMIN_LAST_NAME']

# Application definition
INSTALLED_APPS = [
    'daphne',
    'config.admin.SuperAdminConfig',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'channels',
    'django_celery_beat',
    
    # Local apps
    'apps.accounts',
    'apps.core',
    'apps.common',
    'apps.profiles',
    'apps.matching',
    'apps.messaging',
    'apps.memberships',
    'apps.notifications',
]

MIDDLEWARE = [
    'apps.core.middleware.RequestIDMiddleware',
    'config.middleware.AdminPortalDisabledMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.routing.application'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'  # Consistent with Indian localized client
USE_I18N = True
USE_TZ = True

# Redis & Celery Settings
CELERY_BROKER_URL = config.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Redis stores only short-lived metadata/permission cache entries. Profile
# image bytes remain exclusively in PostgreSQL and image responses read them
# from BYTEA after authorization.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config['CACHE_URL'],
        'TIMEOUT': 300,
        'OPTIONS': {
            'socket_connect_timeout': 2,
            'socket_timeout': 2,
        },
    },
}

# Channel Layer parsing
try:
    r_url = urllib.parse.urlparse(config['REDIS_URL'])
    redis_host = r_url.hostname or 'localhost'
    redis_port = r_url.port or 6379
except Exception:
    redis_host = 'localhost'
    redis_port = 6379

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(redis_host, int(redis_port))],
        },
    },
}

# Database definition
DATABASES = {
    'default': {
        'ENGINE': config['DB_ENGINE'],
        'NAME': config['DB_NAME'],
        'USER': config['DB_USER'],
        'PASSWORD': config['DB_PASSWORD'],
        'HOST': config['DB_HOST'],
        'PORT': config['DB_PORT'],
        'CONN_MAX_AGE': config['DB_CONN_MAX_AGE'],
        'CONN_HEALTH_CHECKS': config['DB_CONN_HEALTH_CHECKS'],
        # Required when DB_HOST points to PgBouncer in transaction-pooling
        # mode.  It remains configurable for direct PostgreSQL deployments.
        'DISABLE_SERVER_SIDE_CURSORS': config['DB_DISABLE_SERVER_SIDE_CURSORS'],
    }
}

# Fallback only when not in staging/production environments
if ENVIRONMENT not in ('staging', 'production'):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect((config['DB_HOST'], int(config['DB_PORT'])))
        s.close()
    except (socket.error, ValueError):
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTH_USER_MODEL = 'accounts.Member'

# Profile-photo uploads are capped at 10 MiB by the API and must be processed
# from memory.  Keeping accepted files below this threshold prevents Django's
# temporary-file upload handler from writing profile images to local storage.
FILE_UPLOAD_MAX_MEMORY_SIZE = 11 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024

# Static files (CSS, JavaScript, Images)
STATIC_URL = config['STATIC_URL']
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = config['MEDIA_URL']
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
PRIVATE_MEDIA_ROOT = os.path.join(BASE_DIR, 'private_media')

if config['USE_S3']:
    AWS_ACCESS_KEY_ID = config['AWS_ACCESS_KEY_ID']
    AWS_SECRET_ACCESS_KEY = config['AWS_SECRET_ACCESS_KEY']
    AWS_STORAGE_BUCKET_NAME = config['AWS_STORAGE_BUCKET_NAME']
    AWS_S3_REGION_NAME = config['AWS_REGION']
    STORAGES = {
        'default': {'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage'},
        'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
    }
else:
    STORAGES = {
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
    }

# Durable file-deletion tasks resolve this stable alias during retries.  It is
# intentionally private and has no URL surface.
STORAGES['private_media'] = {'BACKEND': 'apps.accounts.storage.PrivateMediaStorage'}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.AccountJWTAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'apps.core.renderers.StandardizedJSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardizedPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
# Normal APIs are intentionally not rate limited. Authentication-sensitive
    # views opt into their own account/identifier-scoped throttles.
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
    # Retained for DRF compatibility; endpoint throttles use the validated
    # proxy-aware helper in apps.accounts.throttling.
    'NUM_PROXIES': config['NUM_PROXIES'],
}

# JWT Settings
ACCESS_TOKEN_MINUTES = config['JWT_ACCESS_TOKEN_MINUTES']
REFRESH_TOKEN_DAYS = config['JWT_REFRESH_TOKEN_DAYS']
MAX_FAILED_LOGIN_ATTEMPTS = config['MAX_FAILED_LOGIN_ATTEMPTS']
LOGIN_LOCKOUT_MINUTES = config['LOGIN_LOCKOUT_MINUTES']
OTP_COOLDOWN_SECONDS = config['OTP_COOLDOWN_SECONDS']
RESET_PASSWORD_MAX_ATTEMPTS = config['RESET_PASSWORD_MAX_ATTEMPTS']
RESET_PASSWORD_WINDOW_SECONDS = config['RESET_PASSWORD_WINDOW_SECONDS']
NUM_PROXIES = config['NUM_PROXIES']
TRUSTED_PROXY_IPS = config['TRUSTED_PROXY_IPS']

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=ACCESS_TOKEN_MINUTES),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=REFRESH_TOKEN_DAYS),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': config['JWT_ALGORITHM'],
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# CORS configuration
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = config['CORS_ALLOWED_ORIGINS']
CSRF_TRUSTED_ORIGINS = config['CSRF_TRUSTED_ORIGINS']

# OpenAPI Spec
SPECTACULAR_SETTINGS = {
    'TITLE': f'{APP_NAME} API',
    'DESCRIPTION': f'API endpoints documentation for the {APP_NAME} platform.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Email configurations
EMAIL_BACKEND = config['EMAIL_BACKEND']
EMAIL_HOST = config['EMAIL_HOST']
EMAIL_PORT = config['EMAIL_PORT']
EMAIL_HOST_USER = config['EMAIL_HOST_USER']
EMAIL_HOST_PASSWORD = config['EMAIL_HOST_PASSWORD']
EMAIL_USE_TLS = config['EMAIL_USE_TLS']
EMAIL_USE_SSL = config['EMAIL_USE_SSL']
DEFAULT_FROM_EMAIL = config['DEFAULT_FROM_EMAIL']
CONTACT_ENQUIRY_RECIPIENT = config['CONTACT_ENQUIRY_RECIPIENT']

# Mobile OTP gateway: Renflair only. Email reset codes use the SMTP settings
# above and are not part of the mobile provider selection.
