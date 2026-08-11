from django.db import migrations

SETTINGS = [
    {
        'key': 'GENERAL',
        'is_public': True,
        'description': 'General platform branding, metadata and contact info.',
        'value': {
            'app_name': 'My Dear Partner',
            'logo_url': '',
            'favicon_url': '',
            'primary_color': '#6f2845',
            'secondary_color': '#c99c53',
            'footer_text': '© 2026 My Dear Partner. All rights reserved.',
            'contact_email': 'support@mydearpartner.com',
            'contact_phone': '+91 98765 43210',
            'maintenance_mode': False,
        }
    },
    {
        'key': 'REGISTRATION',
        'is_public': False,
        'description': 'Onboarding and registration validation policies.',
        'value': {
            'enable_registration': True,
            'require_email_verification': True,
            'require_mobile_verification': False,
            'require_profile_verification': True,
            'require_document_verification': False,
        }
    },
    {
        'key': 'DUPLICATE_DETECTION',
        'is_public': False,
        'description': 'Platform duplicate profile detection thresholds and checks.',
        'value': {
            'auto_duplicate_detection': True,
            'similarity_percentage': 85,
            'face_match': True,
            'photo_hash_match': True,
            'email_match': True,
            'phone_match': True,
        }
    },
    {
        'key': 'MEMBERSHIP',
        'is_public': True,
        'description': 'Plan configurations, limits and discount rules.',
        'value': {
            'pricing_model': 'fixed',
            'discounts_enabled': True,
            'free_plan_limits': {
                'daily_interests': 5,
                'profile_views': 10,
            }
        }
    },
    {
        'key': 'PAYMENT',
        'is_public': False,
        'description': 'Razorpay gateway API keys and webhook configurations.',
        'value': {
            'razorpay_key_id': 'rzp_test_placeholder',
            'razorpay_key_secret': 'placeholder_secret',
            'webhook_secret': 'placeholder_webhook_secret',
            'currency': 'INR',
            'refund_days_limit': 7,
        }
    },
    {
        'key': 'EMAIL',
        'is_public': False,
        'description': 'SMTP server credentials and notification sender configs.',
        'value': {
            'smtp_host': 'smtp.mailtrap.io',
            'smtp_port': 587,
            'smtp_user': 'placeholder',
            'smtp_password': 'placeholder',
            'from_email': 'no-reply@mydearpartner.com',
            'templates': {
                'welcome': 'Welcome to My Dear Partner!',
                'verification': 'Verify your account',
            }
        }
    },
    {
        'key': 'NOTIFICATIONS',
        'is_public': False,
        'description': 'SMS Gateway keys, WhatsApp toggles, and push configs.',
        'value': {
            'sms_gateway_api_key': '',
            'enable_whatsapp': False,
            'enable_push': False,
        }
    },
    {
        'key': 'SUPPORT',
        'is_public': False,
        'description': 'SLA ticket assignment, priority templates and rules.',
        'value': {
            'auto_assignment_enabled': True,
            'escalation_hours': 24,
            'priority_rules': {
                'URGENT': 'Immediate triage required',
            }
        }
    },
    {
        'key': 'VERIFICATION',
        'is_public': False,
        'description': 'AI background verification desk and rules.',
        'value': {
            'required_documents': ['Aadhaar', 'PAN', 'Passport'],
            'ai_verification_enabled': False,
        }
    },
    {
        'key': 'SECURITY',
        'is_public': False,
        'description': 'Min password complexity, 2FA, session timeout settings.',
        'value': {
            'password_min_length': 8,
            'password_require_uppercase': True,
            'password_require_lowercase': True,
            'password_require_number': True,
            'password_require_special': True,
            'session_timeout_minutes': 30,
            'jwt_lifetime_hours': 24,
            'max_login_attempts': 5,
            'enable_2fa': False,
            'ip_whitelist': [],
        }
    },
    {
        'key': 'STORAGE',
        'is_public': False,
        'description': 'Media file providers (Local filesystem, AWS S3, Cloudflare R2).',
        'value': {
            'provider': 'local',
            's3_bucket': '',
            'r2_endpoint': '',
            'upload_limit_mb': 5,
        }
    },
    {
        'key': 'BACKUP',
        'is_public': False,
        'description': 'Automatic database cron backups schedule.',
        'value': {
            'auto_backup': True,
            'schedule': '0 2 * * *',
        }
    },
    {
        'key': 'FEATURE_FLAGS',
        'is_public': True,
        'description': 'Enable/Disable optional application modules.',
        'value': {
            'enable_chat': True,
            'enable_astrology': True,
            'enable_mbti': True,
            'enable_match_suggestions': True,
        }
    }
]

def seed_settings(apps, _schema_editor):
    PlatformSetting = apps.get_model('core', 'PlatformSetting')
    for item in SETTINGS:
        PlatformSetting.objects.get_or_create(
            key=item['key'],
            defaults={
                'is_public': item['is_public'],
                'description': item['description'],
                'value': item['value']
            }
        )

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0008_remove_profileverificationassignment_verification_assignment_exactly_one_assigner_and_more'),
    ]
    operations = [
        migrations.RunPython(seed_settings, migrations.RunPython.noop)
    ]
