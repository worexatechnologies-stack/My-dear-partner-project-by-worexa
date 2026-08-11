import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

try:
    import environ
except ImportError:  # Allows diagnostics before dependencies are installed.
    environ = None

BASE_DIR = Path(__file__).resolve().parent.parent

# 1. Detect environment and load matching env file
DJANGO_ENV = os.environ.get('DJANGO_ENV', 'local').lower()
if DJANGO_ENV not in ('local', 'staging', 'production'):
    DJANGO_ENV = 'local'

# Prioritize unified single .env file, fallback to environment-specific file
env_path = BASE_DIR / '.env'
if not env_path.exists():
    env_path = BASE_DIR / f'.env.{DJANGO_ENV}'

if env_path.exists():
    if environ is not None:
        environ.Env.read_env(str(env_path), overwrite=False)
    else:
        load_dotenv(env_path)
else:
    # Fallback to standard .env if needed
    fallback_path = BASE_DIR / '.env'
    if fallback_path.exists():
        if environ is not None:
            environ.Env.read_env(str(fallback_path), overwrite=False)
        else:
            load_dotenv(fallback_path)

# Helper functions for types
def get_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ('true', '1', 'yes')

def get_int(key, default=0):
    val = os.environ.get(key)
    if val is None:
        return default
    try:
        return int(val.strip())
    except ValueError:
        return default

def get_list(key, default=None):
    if default is None:
        default = []
    val = os.environ.get(key)
    if not val:
        return default
    return [item.strip() for item in val.split(',') if item.strip()]

# 2. Schema definition and validation
errors = []
PAYMENT_MODE = os.environ.get('PAYMENT_MODE', 'manual_approval').strip().lower()
if PAYMENT_MODE not in ('manual_approval', 'razorpay'):
    errors.append(
        "PAYMENT_MODE: Only 'manual_approval' or 'razorpay' is supported."
    )

MEMBERSHIP_ACTIVATION_MODE = os.environ.get(
    'MEMBERSHIP_ACTIVATION_MODE', 'manual_approval'
).strip().lower()
if MEMBERSHIP_ACTIVATION_MODE not in ('manual_approval', 'payment_verified', 'instant'):
    errors.append(
        "MEMBERSHIP_ACTIVATION_MODE: Must be 'manual_approval', 'payment_verified', or 'instant'."
    )

# Razorpay environment startup verification
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '').strip()
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '').strip()
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '').strip()
RAZORPAY_MODE = os.environ.get('RAZORPAY_MODE', 'test').strip().lower()

if PAYMENT_MODE == 'razorpay' or RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET:
    if not RAZORPAY_KEY_ID:
        errors.append("RAZORPAY_KEY_ID: Required when payment mode is razorpay.")
    if not RAZORPAY_KEY_SECRET:
        errors.append("RAZORPAY_KEY_SECRET: Required when payment mode is razorpay.")
    if not RAZORPAY_WEBHOOK_SECRET:
        errors.append("RAZORPAY_WEBHOOK_SECRET: Required when payment mode is razorpay.")
    if RAZORPAY_MODE not in ('test', 'live'):
        errors.append("RAZORPAY_MODE: Must be 'test' or 'live'.")

    # Reject whitespace-only or malformed values
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_ID.strip() == '':
        errors.append("RAZORPAY_KEY_ID: Value is empty or contains only whitespace.")
    if RAZORPAY_KEY_SECRET and RAZORPAY_KEY_SECRET.strip() == '':
        errors.append("RAZORPAY_KEY_SECRET: Value is empty or contains only whitespace.")
    # Reject accidentally quoted values (e.g. copied from .env with quotes)
    if RAZORPAY_KEY_ID and (RAZORPAY_KEY_ID.startswith(("'", '"')) or RAZORPAY_KEY_ID.endswith(("'", '"'))):
        errors.append("RAZORPAY_KEY_ID: Value contains surrounding quotes. Remove the quotes.")
    if RAZORPAY_KEY_SECRET and (RAZORPAY_KEY_SECRET.startswith(("'", '"')) or RAZORPAY_KEY_SECRET.endswith(("'", '"'))):
        errors.append("RAZORPAY_KEY_SECRET: Value contains surrounding quotes. Remove the quotes.")

    # Validate key prefix matches configured mode
    if RAZORPAY_KEY_ID:
        if RAZORPAY_MODE == 'live' and not RAZORPAY_KEY_ID.startswith('rzp_live_'):
            errors.append("RAZORPAY_KEY_ID: Must start with 'rzp_live_' when RAZORPAY_MODE is 'live'.")
        if RAZORPAY_MODE == 'test' and not RAZORPAY_KEY_ID.startswith('rzp_test_'):
            errors.append("RAZORPAY_KEY_ID: Must start with 'rzp_test_' when RAZORPAY_MODE is 'test'.")
        if not RAZORPAY_KEY_ID.startswith(('rzp_test_', 'rzp_live_')):
            errors.append("RAZORPAY_KEY_ID: Must start with 'rzp_test_' (test) or 'rzp_live_' (live).")

    # Prevent accidental crossover between environment tiers
    if DJANGO_ENV in ('staging', 'production'):
        if RAZORPAY_MODE != 'live':
            errors.append("RAZORPAY_MODE: Must be 'live' in production/staging environments to prevent test mode transactions.")
        if RAZORPAY_KEY_ID and not RAZORPAY_KEY_ID.startswith('rzp_live_'):
            errors.append("RAZORPAY_KEY_ID: Must start with 'rzp_live_' in production/staging environments.")
    elif DJANGO_ENV == 'local':
        # Allow demo keys or test keys in local mode
        if RAZORPAY_MODE != 'test':
            errors.append("RAZORPAY_MODE: Must be 'test' in local development environment.")
        if RAZORPAY_KEY_ID and not RAZORPAY_KEY_ID.startswith('rzp_test_') and RAZORPAY_KEY_ID != 'rzp_test_replace_me':
            errors.append("RAZORPAY_KEY_ID: Must start with 'rzp_test_' in local development.")

PERMANENT_DELETE_DOCUMENT_POLICY = os.environ.get(
    'PERMANENT_DELETE_DOCUMENT_POLICY', 'delete_immediately'
).strip().lower()
if PERMANENT_DELETE_DOCUMENT_POLICY not in ('delete_immediately', 'retain_metadata'):
    errors.append(
        "PERMANENT_DELETE_DOCUMENT_POLICY: Unsupported value. Use "
        "'delete_immediately' or 'retain_metadata'. Document binary files are "
        "always deleted during permanent account deletion."
    )

# Required vars check helper
def require_env(key, description):
    val = os.environ.get(key)
    if not val or not val.strip():
        errors.append(f"{key}: Missing. ({description})")
        return None
    return val.strip()

# Optional vars check helper
def optional_env(key, default=""):
    return os.environ.get(key, default).strip()

# Run checks based on env
SECRET_KEY = os.environ.get('SECRET_KEY', '').strip()
if DJANGO_ENV in ('staging', 'production'):
    # In production/staging, SECRET_KEY is strictly required and must not be insecure/empty
    if not SECRET_KEY:
        errors.append("SECRET_KEY: Value is required but missing.")
    elif SECRET_KEY.startswith('django-insecure') or len(SECRET_KEY) < 30:
        errors.append("SECRET_KEY: Value is insecure. Must be at least 30 characters and not start with 'django-insecure'.")
    
    # Database password should be set
    db_pass = os.environ.get('DB_PASSWORD')
    if not db_pass:
        errors.append("DB_PASSWORD: Database password is required and cannot be empty in production/staging.")
else:
    # Development defaults
    if not SECRET_KEY:
        SECRET_KEY = 'django-insecure-development-key-my-dear-partner-2026'

# Let's collect all other config variables
config = {
    'DEBUG': get_bool('DEBUG', default=(DJANGO_ENV == 'local')),
    'ENVIRONMENT': DJANGO_ENV,
    'SECRET_KEY': SECRET_KEY,
    'ALLOWED_HOSTS': get_list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1']),
    'APP_NAME': optional_env('APP_NAME', 'My Dear Partner'),
    'APP_URL': optional_env('APP_URL', 'http://localhost:8000'),
    'FRONTEND_URL': optional_env('FRONTEND_URL', 'http://localhost:3000'),
    'BACKEND_URL': optional_env('BACKEND_URL', 'http://localhost:8000'),
    'API_VERSION': optional_env('API_VERSION', 'v1'),
    
    # Database
    'DB_ENGINE': optional_env('DB_ENGINE', 'django.db.backends.postgresql'),
    'DB_NAME': optional_env('DB_NAME', 'matiromony'),
    'DB_USER': optional_env('DB_USER', 'postgres'),
    'DB_PASSWORD': os.environ.get(
        'DB_PASSWORD', 'postgres' if DJANGO_ENV == 'local' else ''
    ),
    'DB_HOST': optional_env('DB_HOST', 'localhost'),
    'DB_PORT': optional_env('DB_PORT', '5432'),
    # Keep direct Django connections short-lived. Production traffic goes
    # through PgBouncer; this prevents worker reloads from exhausting native
    # PostgreSQL connections when a pooler is unavailable.
    'DB_CONN_MAX_AGE': get_int('DB_CONN_MAX_AGE', 0),
    'DB_CONN_HEALTH_CHECKS': get_bool('DB_CONN_HEALTH_CHECKS', default=True),
    # PgBouncer transaction pooling releases the server connection after each
    # transaction, so Django server-side cursors must be opt-in only.
    'DB_DISABLE_SERVER_SIDE_CURSORS': get_bool('DB_DISABLE_SERVER_SIDE_CURSORS', default=False),
    
    # Redis & Cache
    'REDIS_URL': optional_env('REDIS_URL', 'redis://localhost:6379/0'),
    'CACHE_URL': optional_env('CACHE_URL', 'redis://localhost:6379/1'),
    'CELERY_BROKER_URL': optional_env('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    # JWT
    'JWT_ACCESS_TOKEN_MINUTES': get_int('JWT_ACCESS_TOKEN_MINUTES', 1440),
    'JWT_REFRESH_TOKEN_DAYS': get_int('JWT_REFRESH_TOKEN_DAYS', 7),
    'JWT_ALGORITHM': optional_env('JWT_ALGORITHM', 'HS256'),
    
    # Email
    'EMAIL_BACKEND': optional_env('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend'),
    'EMAIL_HOST': optional_env('EMAIL_HOST', 'smtp.gmail.com'),
    'EMAIL_PORT': get_int('EMAIL_PORT', 587),
    'EMAIL_HOST_USER': optional_env('EMAIL_HOST_USER', 'info.mydearpartnersupport@gmail.com'),
    'EMAIL_HOST_PASSWORD': optional_env('EMAIL_HOST_PASSWORD', ''),
    'EMAIL_USE_TLS': get_bool('EMAIL_USE_TLS', default=True),
    'EMAIL_USE_SSL': get_bool('EMAIL_USE_SSL', default=False),
    'DEFAULT_FROM_EMAIL': optional_env('DEFAULT_FROM_EMAIL', 'info.mydearpartnersupport@gmail.com'),
    'CONTACT_ENQUIRY_RECIPIENT': optional_env(
        'CONTACT_ENQUIRY_RECIPIENT', 'info.mydearpartnersupport@gmail.com'
    ),
    
    # SMS / OTP
    'SMS_PROVIDER': optional_env('SMS_PROVIDER', 'renflair'),
    'OTP_PROVIDER': optional_env('OTP_PROVIDER', 'renflair'),
    'RENFLAIR_API_KEY': optional_env('RENFLAIR_API_KEY', ''),
    'TWILIO_ACCOUNT_SID': optional_env('TWILIO_ACCOUNT_SID', ''),
    'TWILIO_AUTH_TOKEN': optional_env('TWILIO_AUTH_TOKEN', ''),
    'TWILIO_PHONE_NUMBER': optional_env('TWILIO_PHONE_NUMBER', ''),
    'FIREBASE_CREDENTIALS_PATH': optional_env('FIREBASE_CREDENTIALS_PATH', ''),
    
    # Payments
    'PAYMENT_MODE': PAYMENT_MODE,
    'MEMBERSHIP_ACTIVATION_MODE': MEMBERSHIP_ACTIVATION_MODE,
    'RAZORPAY_KEY_ID': optional_env('RAZORPAY_KEY_ID', ''),
    'RAZORPAY_KEY_SECRET': optional_env('RAZORPAY_KEY_SECRET', ''),
    'RAZORPAY_WEBHOOK_SECRET': optional_env('RAZORPAY_WEBHOOK_SECRET', ''),
    'RAZORPAY_MODE': optional_env('RAZORPAY_MODE', 'off'),
    'PERMANENT_DELETE_DOCUMENT_POLICY': PERMANENT_DELETE_DOCUMENT_POLICY,
    'REQUIRE_MEMBER_VERIFICATION': get_bool('REQUIRE_MEMBER_VERIFICATION', default=False),
    'ENABLE_ADMIN_PORTAL': get_bool('ENABLE_ADMIN_PORTAL', default=False),
    
    # Storage
    'USE_S3': get_bool('USE_S3', default=False),
    'AWS_ACCESS_KEY_ID': optional_env('AWS_ACCESS_KEY_ID', ''),
    'AWS_SECRET_ACCESS_KEY': optional_env('AWS_SECRET_ACCESS_KEY', ''),
    'AWS_STORAGE_BUCKET_NAME': optional_env('AWS_STORAGE_BUCKET_NAME', ''),
    'AWS_REGION': optional_env('AWS_REGION', 'ap-south-1'),
    'MEDIA_URL': optional_env('MEDIA_URL', '/media/'),
    'STATIC_URL': optional_env('STATIC_URL', '/static/'),
    
    # Security Headers
    'SECURE_SSL_REDIRECT': get_bool('SECURE_SSL_REDIRECT', default=(DJANGO_ENV in ('staging', 'production'))),
    'SESSION_COOKIE_SECURE': get_bool('SESSION_COOKIE_SECURE', default=(DJANGO_ENV in ('staging', 'production'))),
    'CSRF_COOKIE_SECURE': get_bool('CSRF_COOKIE_SECURE', default=(DJANGO_ENV in ('staging', 'production'))),
    'CORS_ALLOWED_ORIGINS': get_list('CORS_ALLOWED_ORIGINS', default=['http://localhost:3000']),
    'CSRF_TRUSTED_ORIGINS': get_list('CSRF_TRUSTED_ORIGINS', default=['http://localhost:3000', 'http://localhost:8000']),
    'SECURE_HSTS_SECONDS': get_int('SECURE_HSTS_SECONDS', 31536000 if DJANGO_ENV in ('staging', 'production') else 0),
    'SECURE_PROXY_SSL_HEADER': optional_env('SECURE_PROXY_SSL_HEADER', ''),
    
    # Logging & Monitoring
    'LOG_LEVEL': optional_env('LOG_LEVEL', 'INFO'),
    'SENTRY_DSN': optional_env('SENTRY_DSN', ''),
    
    # Rate Limiting
    'LOGIN_RATE_LIMIT': optional_env('LOGIN_RATE_LIMIT', '5/minute'),
    'OTP_RATE_LIMIT': optional_env('OTP_RATE_LIMIT', '3/minute'),
    'API_RATE_LIMIT': optional_env('API_RATE_LIMIT', '1000/day'),
    'ANON_RATE_LIMIT': optional_env('ANON_RATE_LIMIT', '100/day'),
    'MAX_FAILED_LOGIN_ATTEMPTS': get_int('MAX_FAILED_LOGIN_ATTEMPTS', 3),
    'LOGIN_LOCKOUT_MINUTES': get_int('LOGIN_LOCKOUT_MINUTES', 15),
    
    # Feature Flags
    'ENABLE_SIGNUP': get_bool('ENABLE_SIGNUP', default=True),
    'ENABLE_EMAIL_VERIFICATION': get_bool('ENABLE_EMAIL_VERIFICATION', default=True),
    'ENABLE_MOBILE_VERIFICATION': get_bool('ENABLE_MOBILE_VERIFICATION', default=False),
    'ENABLE_TWO_FACTOR': get_bool('ENABLE_TWO_FACTOR', default=False),
    'ENABLE_DEVELOPMENT_SEED': get_bool('ENABLE_DEVELOPMENT_SEED', default=(DJANGO_ENV == 'local')),
    'ENABLE_DEBUG_TOOLBAR': get_bool('ENABLE_DEBUG_TOOLBAR', default=False),
    'ENABLE_SWAGGER': get_bool('ENABLE_SWAGGER', default=(DJANGO_ENV == 'local')),
    'ENABLE_API_DOCS': get_bool('ENABLE_API_DOCS', default=(DJANGO_ENV == 'local')),

    # Super Admin Configuration
    'SUPERADMIN_EMAIL': optional_env('SUPERADMIN_EMAIL', 'admin@mydearpartner.com'),
    'SUPERADMIN_PASSWORD': os.environ.get('SUPERADMIN_PASSWORD', ''),
    'SUPERADMIN_MOBILE': optional_env('SUPERADMIN_MOBILE', '9876543200'),
    'SUPERADMIN_FIRST_NAME': optional_env('SUPERADMIN_FIRST_NAME', 'Super'),
    'SUPERADMIN_LAST_NAME': optional_env('SUPERADMIN_LAST_NAME', 'Admin'),
}

# Production must fail closed.  A missing or insecure deployment setting is
# safer as a startup error than as a live application with a false sense of
# security.
if DJANGO_ENV in ('staging', 'production'):
    if config['DEBUG']:
        errors.append('DEBUG: Must be False in staging/production.')
    for key in ('SECURE_SSL_REDIRECT', 'SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE'):
        if not config[key]:
            errors.append(f'{key}: Must be True in staging/production.')
    if config['SECURE_HSTS_SECONDS'] < 15_552_000:
        errors.append('SECURE_HSTS_SECONDS: Must be at least 180 days in staging/production.')
    if not config['SECURE_PROXY_SSL_HEADER']:
        errors.append('SECURE_PROXY_SSL_HEADER: Required behind the TLS-terminating proxy.')
    if config['ENABLE_DEVELOPMENT_SEED'] or config['ENABLE_DEBUG_TOOLBAR']:
        errors.append('Development seed and debug toolbar features must be disabled.')
    if config['ENABLE_SWAGGER'] or config['ENABLE_API_DOCS']:
        errors.append('Interactive API documentation must be disabled in staging/production.')
    if config['OTP_PROVIDER'].lower() in ('mock', 'dummy', 'console', 'dev'):
        errors.append('OTP_PROVIDER: A real provider is required in staging/production.')
    if config['EMAIL_BACKEND'] == 'django.core.mail.backends.console.EmailBackend':
        errors.append('EMAIL_BACKEND: Console email is not allowed in staging/production.')
    if config['EMAIL_BACKEND'].endswith('smtp.EmailBackend') and (
        not config['EMAIL_HOST_USER'] or not config['EMAIL_HOST_PASSWORD']
    ):
        errors.append('EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are required for SMTP email.')
    if config['OTP_PROVIDER'].lower() in ('renflair', 'renflair_sms') and not config['RENFLAIR_API_KEY']:
        errors.append('RENFLAIR_API_KEY: Required when using the Renflair OTP provider.')
    if config['USE_S3'] and (
        not config['AWS_ACCESS_KEY_ID']
        or not config['AWS_SECRET_ACCESS_KEY']
        or not config['AWS_STORAGE_BUCKET_NAME']
    ):
        errors.append('AWS credentials and bucket are required when USE_S3 is enabled.')

# If errors occurred, raise a startup crash block explaining which keys failed
if errors:
    error_header = (
        "\n========================================================================\n"
        "DJANGO STARTUP CONFIGURATION ERROR:\n"
        "The following required environment variables are missing or invalid:\n"
    )
    error_body = "\n".join(f"- {err}" for err in errors)
    error_footer = (
        "\n========================================================================\n"
    )
    raise ImproperlyConfigured(f"{error_header}{error_body}{error_footer}")
