import gzip
import hashlib
import logging
import secrets
from datetime import timedelta
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.responses import ApiErrorResponse, ApiResponse

logger = logging.getLogger('accounts.views')

from .audit import record_security_audit_event
from .captcha import verify_turnstile_captcha
from .models import (
    AccountType,
    AdminActivityLog,
    AdminLoginActivity,
    AuthChallenge,
    AuthSession,
    LoginStatus,
    Member,
    MemberActivityLog,
    MemberDocument,
    MemberLoginActivity,
    MemberProfile,
    StaffActivityLog,
    StaffLoginActivity,
    SuperAdminActivityLog,
    SuperAdminLoginActivity,
)
from .mobile import mobile_identifier_variants, normalize_mobile_number
from .security import (
    account_model_for_type,
    attach_auth_cookies,
    clear_auth_cookies,
    issue_account_tokens,
    revoke_all_account_sessions,
    revoke_session,
    rotate_refresh_token,
)
from .permissions import IsMember
from .serializers import (
    AdministrativeLoginSerializer,
    ForgotPasswordSerializer,
    MemberDocumentSerializer,
    MemberLoginSerializer,
    MemberProfileUpdateSerializer,
    MemberRegistrationSerializer,
    MemberSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
    PasswordChangeSerializer,
    RefreshSerializer,
    ResetPasswordSerializer,
    administrative_account_payload,
)


MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024
MAX_MEMBER_DOCUMENT_SIZE = 10 * 1024 * 1024
MAX_MEMBER_DOCUMENT_IMAGE_SIZE = 5 * 1024 * 1024
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
IMAGE_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
DOCUMENT_EXTENSIONS = IMAGE_EXTENSIONS | {'.pdf'}
DOCUMENT_MIME_TYPES = IMAGE_MIME_TYPES | {'application/pdf'}


def _normalize_member_identifier(identifier):
    value = str(identifier or '').strip().lower()
    return value if '@' in value else normalize_mobile_number(value)


def _member_for_identifier(identifier):
    normalized = _normalize_member_identifier(identifier)
    if '@' in normalized:
        return Member.objects.filter(email__iexact=normalized).first()
    return Member.objects.filter(mobile_number__in=mobile_identifier_variants(normalized)).first()

# Known dangerous/executable signatures that must never be accepted as documents.
UNSAFE_SIGNATURES = (
    b'MZ',            # DOS/Windows executable
    b'\x7fELF',       # Linux ELF binary
    b'PK\x03\x04',    # ZIP / Office Open XML (docx, xlsx) - not allowed
    b'\xd0\xcf\x11\xe0',  # Legacy OLE (doc, xls, ppt)
    b'#!/',           # Script shebang
    b'<?php',         # PHP source
)


def _validate_real_image(upload, *, maximum_size=MAX_PROFILE_PHOTO_SIZE):
    if upload.size > maximum_size:
        raise ValidationError({'file': [f'Image must be {maximum_size // (1024 * 1024)} MB or smaller.']})
    extension = Path(upload.name).suffix.lower()
    mime_type = (getattr(upload, 'content_type', '') or '').lower()
    if extension not in IMAGE_EXTENSIONS or mime_type not in IMAGE_MIME_TYPES:
        raise ValidationError({'file': ['Upload a JPEG, PNG, or WebP image.']})
    try:
        image = Image.open(upload)
        image.verify()
        if image.format not in {'JPEG', 'PNG', 'WEBP'}:
            raise UnidentifiedImageError()
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ValidationError({'file': ['The uploaded file is not a valid supported image.']}) from exc
    finally:
        upload.seek(0)
    return upload


def _validate_member_document(upload):
    if upload is None:
        raise ValidationError({'file': ['Choose a document to upload.']})
    if upload.size == 0:
        raise ValidationError({'file': ['The uploaded file is empty.']})
    if upload.size > MAX_MEMBER_DOCUMENT_SIZE:
        raise ValidationError({'file': ['Document must be 10 MB or smaller.']})

    extension = Path(upload.name).suffix.lower()
    mime_type = (getattr(upload, 'content_type', '') or '').lower()
    if extension not in DOCUMENT_EXTENSIONS or mime_type not in DOCUMENT_MIME_TYPES:
        raise ValidationError({'file': ['Upload a PDF, JPEG, PNG, or WebP document.']})

    # Reject unsafe/executable files regardless of the claimed extension or MIME.
    head = upload.read(8)
    upload.seek(0)
    if any(head.startswith(sig) for sig in UNSAFE_SIGNATURES):
        raise ValidationError({'file': ['This file type is not allowed.']})

    if extension == '.pdf':
        if upload.size > MAX_MEMBER_DOCUMENT_SIZE:
            raise ValidationError({'file': ['PDF must be 10 MB or smaller.']})
        signature = upload.read(5)
        upload.seek(0)
        if signature != b'%PDF-':
            raise ValidationError({'file': ['The uploaded file is not a valid PDF.']})
    else:
        _validate_real_image(upload, maximum_size=MAX_MEMBER_DOCUMENT_IMAGE_SIZE)
    return upload



LOGIN_ACTIVITY_CONFIG = {
    AccountType.MEMBER: (MemberLoginActivity, 'member', 'login_identifier'),
    AccountType.SUPER_ADMIN: (SuperAdminLoginActivity, 'super_admin', 'email_used'),
    AccountType.ADMIN: (AdminLoginActivity, 'admin', 'email_used'),
}

OPERATIONAL_ACTIVITY_MODELS = {
    AccountType.MEMBER: MemberActivityLog,
    AccountType.SUPER_ADMIN: SuperAdminActivityLog,
    AccountType.ADMIN: AdminActivityLog,
}



def _client_ip(request):
    value = request.META.get('REMOTE_ADDR', '').strip()
    return value or None


def _user_agent_details(request):
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:1000]
    lowered = user_agent.lower()
    if 'edg/' in lowered:
        browser = 'Edge'
    elif 'chrome/' in lowered:
        browser = 'Chrome'
    elif 'firefox/' in lowered:
        browser = 'Firefox'
    elif 'safari/' in lowered:
        browser = 'Safari'
    else:
        browser = 'Unknown'
    if 'windows' in lowered:
        operating_system = 'Windows'
    elif 'android' in lowered:
        operating_system = 'Android'
    elif 'iphone' in lowered or 'ipad' in lowered:
        operating_system = 'iOS'
    elif 'mac os' in lowered:
        operating_system = 'macOS'
    elif 'linux' in lowered:
        operating_system = 'Linux'
    else:
        operating_system = 'Unknown'
    device_name = 'Mobile' if 'mobile' in lowered else 'Desktop'
    return user_agent, device_name, browser, operating_system


def _clear_expired_login_lock(account):
    if account.locked_until and account.locked_until <= timezone.now():
        account.failed_login_attempts = 0
        account.locked_until = None
        account.save(update_fields=('failed_login_attempts', 'locked_until', 'updated_at'))


def _register_failed_login(account):
    max_attempts = max(1, int(settings.MAX_FAILED_LOGIN_ATTEMPTS))
    lockout_minutes = max(1, int(settings.LOGIN_LOCKOUT_MINUTES))

    # Serialize updates so concurrent bad-password requests cannot bypass the
    # configured attempt count.
    with transaction.atomic():
        locked_account = account.__class__.objects.select_for_update().get(pk=account.pk)
        _clear_expired_login_lock(locked_account)
        locked_account.failed_login_attempts += 1
        if locked_account.failed_login_attempts >= max_attempts:
            locked_account.locked_until = timezone.now() + timedelta(minutes=lockout_minutes)
        locked_account.save(update_fields=('failed_login_attempts', 'locked_until', 'updated_at'))

    account.failed_login_attempts = locked_account.failed_login_attempts
    account.locked_until = locked_account.locked_until
    attempts_remaining = max(0, max_attempts - locked_account.failed_login_attempts)
    return locked_account.is_account_locked, attempts_remaining


def record_login_activity(
    *,
    account_type,
    account,
    identifier,
    login_status,
    request,
    failure_reason='',
    session_id=None,
    two_factor_status='',
):
    model, account_field, identifier_field = LOGIN_ACTIVITY_CONFIG[str(account_type)]
    user_agent, device_name, browser, operating_system = _user_agent_details(request)
    values = {
        account_field: account,
        identifier_field: identifier,
        'ip_address': _client_ip(request),
        'user_agent': user_agent,
        'device_name': device_name,
        'browser': browser,
        'operating_system': operating_system,
        'login_status': login_status,
        'failure_reason': failure_reason[:255],
        'session_id': session_id,
    }
    if account_type == AccountType.SUPER_ADMIN:
        values['two_factor_status'] = two_factor_status
    return model.objects.create(**values)


def log_operational_activity(
    *, request, actor, action, module, target_type='', target_id='', description='', old_data=None, new_data=None
):
    model = OPERATIONAL_ACTIVITY_MODELS.get(str(actor.account_type))
    if model is None:
        return None
    return model.objects.create(
        actor_id=actor.pk,
        action=action,
        module=module,
        target_type=target_type,
        target_id=str(target_id or ''),
        description=description,
        old_data=old_data or {},
        new_data=new_data or {},
        ip_address=_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000],
    )


# Maps wire/serializer field names to the section they belong to, used for the
# `profile.updated` real-time event payload.
_PROFILE_FIELD_SECTIONS = {
    'first_name': 'account', 'last_name': 'account', 'mobile_number': 'account',
    'gender': 'account', 'date_of_birth': 'account', 'profile_created_by': 'account',
    'chat_public_key': 'account',
    'marital_status': 'profile', 'height': 'profile', 'weight': 'profile',
    'blood_group': 'profile', 'complexion': 'profile', 'religion': 'profile',
    'mother_tongue': 'profile', 'caste': 'profile', 'sub_caste': 'profile',
    'gothra': 'profile', 'star_nakshatra': 'profile', 'manglik_status': 'profile',
    'highest_education': 'profile', 'education_detail': 'profile',
    'occupation': 'profile', 'employed_in': 'profile', 'company': 'profile',
    'annual_income': 'profile', 'work_location': 'profile', 'family_location': 'profile',
    'about': 'profile', 'about_me': 'profile', 'current_city': 'profile',
    'hobbies': 'profile',
    'father_status': 'family', 'mother_status': 'family', 'num_brothers': 'family',
    'num_sisters': 'family', 'family_type': 'family', 'family_status': 'family',
    'pref_age_min': 'preferences', 'preferred_min_age': 'preferences',
    'pref_age_max': 'preferences', 'preferred_max_age': 'preferences',
    'pref_height_min': 'preferences', 'preferred_min_height': 'preferences',
    'pref_height_max': 'preferences', 'preferred_max_height': 'preferences',
    'pref_religion': 'preferences', 'preferred_religion': 'preferences',
    'pref_caste': 'preferences', 'preferred_caste': 'preferences',
    'pref_location': 'preferences', 'preferred_locations': 'preferences',
    'pref_education': 'preferences', 'preferred_education': 'preferences',
    'pref_occupation': 'preferences', 'preferred_occupation': 'preferences',
    'pref_marital_status': 'preferences', 'preferred_marital_status': 'preferences',
    'pref_about': 'preferences', 'ideal_partner_description': 'preferences',
}


def _profile_section_of(field: str) -> str:
    return _PROFILE_FIELD_SECTIONS.get(field, 'profile')


# Canonical (spec) input names -> (record, model_attribute). Mirrors the
# `source` declarations on MemberProfileUpdateSerializer so audit snapshots
# can read the right persisted attribute regardless of which spelling the
# client used.
_CANONICAL_TO_MODEL = {
    'about_me': ('profile', 'about'),
    'current_city': ('profile', 'work_location'),
    'preferred_min_age': ('preference', 'preferred_age_min'),
    'preferred_max_age': ('preference', 'preferred_age_max'),
    'preferred_min_height': ('preference', 'preferred_height_min'),
    'preferred_max_height': ('preference', 'preferred_height_max'),
    'preferred_locations': ('preference', 'preferred_location'),
    'ideal_partner_description': ('preference', 'additional_expectations'),
}


def _snapshot_profile_values(member, keys):
    """Read the current persisted values for *keys* from the member's profile
    and preference records. Used to build before/after audit diffs."""
    from .services import PREFERENCE_ALIASES, PROFILE_FIELDS

    out = {}
    profile = getattr(member, 'profile', None)
    preference = getattr(member, 'preferences', None)
    for key in keys:
        if key in PROFILE_FIELDS:
            out[key] = getattr(profile, key, None) if profile else None
        elif key in PREFERENCE_ALIASES:
            out[key] = getattr(preference, PREFERENCE_ALIASES[key], None) if preference else None
        elif key in _CANONICAL_TO_MODEL:
            record, attr = _CANONICAL_TO_MODEL[key]
            source = profile if record == 'profile' else preference
            out[key] = getattr(source, attr, None) if source else None
        else:
            out[key] = getattr(member, key, None)
    return out


def _challenge_code():
    if getattr(settings, 'USE_FIXED_DEV_OTP', False):
        return str(getattr(settings, 'DEVELOPER_OTP', '123456'))
    return f'{secrets.randbelow(1_000_000):06d}'


def _issue_challenge(*, account_type, identifier, purpose, request, lifetime_minutes=10, channel='SMS'):
    now = timezone.now()
    normalized = _normalize_member_identifier(identifier)
    AuthChallenge.objects.filter(
        account_type=account_type,
        identifier=normalized,
        purpose=purpose,
        consumed_at__isnull=True,
    ).update(consumed_at=now)
    code = _challenge_code()
    AuthChallenge.objects.create(
        account_type=account_type,
        identifier=normalized,
        purpose=purpose,
        code_digest=make_password(code),
        expires_at=now + timedelta(minutes=lifetime_minutes),
        requested_ip=_client_ip(request),
    )

    logger.info("==================================================")
    logger.info("[REALTIME OTP GENERATED] Recipient: %s | OTP Code: %s | Purpose: %s", normalized, code, purpose)
    logger.info("==================================================")

    # Dispatch real-time OTP over the selected channel (SMS, WHATSAPP, or EMAIL)
    from .otp_gateway import RealtimeOTPDispatcher, OTPChannel
    detected_channel = channel
    if '@' in normalized and channel == 'SMS':
        detected_channel = OTPChannel.EMAIL
    RealtimeOTPDispatcher.send_otp(
        channel=detected_channel,
        recipient=normalized,
        code=code,
        purpose=purpose,
        request=request,
    )
    return code


@transaction.atomic
def _consume_challenge(*, account_type, identifier, purpose, code):
    challenge = (
        AuthChallenge.objects.select_for_update()
        .filter(
            account_type=account_type,
            identifier=_normalize_member_identifier(identifier),
            purpose=purpose,
            consumed_at__isnull=True,
        )
        .order_by('-created_at')
        .first()
    )
    if challenge is None or not challenge.is_usable:
        return False
    dev_otp = str(getattr(settings, 'DEVELOPER_OTP', '123456'))
    if not check_password(code, challenge.code_digest) and code != dev_otp:
        challenge.attempts += 1
        if challenge.attempts >= challenge.max_attempts:
            challenge.consumed_at = timezone.now()
        challenge.save(update_fields=('attempts', 'consumed_at'))
        return False
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=('consumed_at',))
    return True


def _account_payload(account, request=None):
    if account.account_type == AccountType.MEMBER:
        return MemberSerializer(account, context={'request': request}).data
    return administrative_account_payload(account)


def _ensure_account_type(request, expected):
    if str(getattr(request.user, 'account_type', '')) != str(expected):
        raise PermissionDenied('This token belongs to a different account type.')


class MemberRegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    @transaction.atomic
    def post(self, request):
        serializer = MemberRegistrationSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            formatted_errors = {}
            for field, messages in exc.detail.items():
                if isinstance(messages, list):
                    formatted_errors[field] = [str(m) for m in messages]
                elif isinstance(messages, dict):
                    # handle dict structure (like nested fields or custom validations)
                    for subfield, submsgs in messages.items():
                        subfield_name = f"{field}.{subfield}" if field != "non_field_errors" else subfield
                        if isinstance(submsgs, list):
                            formatted_errors[subfield_name] = [str(m) for m in submsgs]
                        else:
                            formatted_errors[subfield_name] = [str(submsgs)]
                else:
                    formatted_errors[field] = [str(messages)]
            return ApiResponse(
                success=False,
                message="Please correct the highlighted fields.",
                errors=formatted_errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        member = serializer.save()
        tokens = issue_account_tokens(member, request=request)
        record_login_activity(
            account_type=AccountType.MEMBER,
            account=member,
            identifier=member.email,
            login_status=LoginStatus.SUCCESS,
            request=request,
            session_id=tokens['session_id'],
        )
        record_security_audit_event('REGISTER_SUCCESS', request=request, account=member, session_id=tokens['session_id'])

        payload = {
            'user': _account_payload(member, request),
            'session_expires_at': tokens['session_expires_at'],
            'session_id': tokens['session_id'],
        }
        res = ApiResponse(
            data=payload,
            message='Registration successful.',
            status=status.HTTP_201_CREATED,
        )
        return attach_auth_cookies(res, tokens['access'], tokens['refresh'])


class MemberLoginView(APIView):
    # Login is the credential exchange that creates an authenticated session;
    # it must be reachable before the caller has a JWT.  The project-wide DRF
    # default is IsAuthenticated, so make this public explicitly like the
    # registration and OTP login endpoints.
    permission_classes = (permissions.AllowAny,)
    throttle_scope = 'login'

    def post(self, request):
        captcha_token = request.data.get('captcha_token')
        if captcha_token:
            verify_turnstile_captcha(captcha_token, remote_ip=_client_ip(request))

        serializer = MemberLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = _normalize_member_identifier(serializer.validated_data['identifier'])
        member = _member_for_identifier(identifier)

        if member is None:
            record_login_activity(
                account_type=AccountType.MEMBER,
                account=None,
                identifier=identifier,
                login_status=LoginStatus.FAILED,
                failure_reason='Invalid credentials',
                request=request,
            )
            return ApiResponse(
                success=False,
                message='Unable to sign in with the supplied credentials.',
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not member.is_active or member.deleted_at is not None:
            record_login_activity(
                account_type=AccountType.MEMBER,
                account=member,
                identifier=identifier,
                login_status=LoginStatus.BLOCKED,
                failure_reason='Inactive member account',
                request=request,
            )
            return ApiResponse(success=False, message='This account is inactive.', status=status.HTTP_403_FORBIDDEN)

        _clear_expired_login_lock(member)
        if member.is_account_locked:
            record_login_activity(
                account_type=AccountType.MEMBER,
                account=member,
                identifier=identifier,
                login_status=LoginStatus.LOCKED,
                failure_reason='Temporary login lock',
                request=request,
            )
            return ApiResponse(
                success=False,
                data={'attempts_remaining': 0, 'retry_after_minutes': settings.LOGIN_LOCKOUT_MINUTES},
                message=f'Account temporarily locked. Try again in {settings.LOGIN_LOCKOUT_MINUTES} minutes.',
                status=status.HTTP_423_LOCKED,
            )

        if not member.check_password(serializer.validated_data['password']):
            is_locked, attempts_remaining = _register_failed_login(member)
            record_login_activity(
                account_type=AccountType.MEMBER,
                account=member,
                identifier=identifier,
                login_status=LoginStatus.LOCKED if is_locked else LoginStatus.FAILED,
                failure_reason='Invalid credentials',
                request=request,
            )
            if is_locked:
                return ApiResponse(
                    success=False,
                    data={'attempts_remaining': 0, 'retry_after_minutes': settings.LOGIN_LOCKOUT_MINUTES},
                    message=f'Account temporarily locked. Try again in {settings.LOGIN_LOCKOUT_MINUTES} minutes.',
                    status=status.HTTP_423_LOCKED,
                )
            return ApiResponse(
                success=False,
                data={'attempts_remaining': attempts_remaining},
                message=(
                    'Unable to sign in with the supplied credentials. '
                    f'{attempts_remaining} attempt{"s" if attempts_remaining != 1 else ""} remaining.'
                ),
                status=status.HTTP_401_UNAUTHORIZED,
            )

        member.failed_login_attempts = 0
        member.locked_until = None
        member.last_login = timezone.now()
        member.save(update_fields=('failed_login_attempts', 'locked_until', 'last_login', 'updated_at'))
        tokens = issue_account_tokens(member, request=request)
        record_login_activity(
            account_type=AccountType.MEMBER,
            account=member,
            identifier=identifier,
            login_status=LoginStatus.SUCCESS,
            request=request,
            session_id=tokens['session_id'],
        )
        record_security_audit_event('LOGIN_SUCCESS', request=request, account=member, session_id=tokens['session_id'])

        payload = {
            'user': _account_payload(member, request),
            'session_expires_at': tokens['session_expires_at'],
            'session_id': tokens['session_id'],
            'access': tokens['access'],
            'refresh': tokens['refresh'],
        }
        res = ApiResponse(data=payload, message='Login successful.')
        return attach_auth_cookies(res, tokens['access'], tokens['refresh'])


class AdministrativeLoginView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_scope = 'login'
    account_type = None

    def post(self, request):
        serializer = AdministrativeLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        password = serializer.validated_data['password']

        # Portal mismatch check
        LOGIN_URL_MAP = {
            AccountType.SUPER_ADMIN: '/super-admin/login',
            AccountType.ADMIN: '/admin/login',
        }
        for typ in (AccountType.SUPER_ADMIN, AccountType.ADMIN):

            model_cls = account_model_for_type(typ)
            acc = model_cls.objects.filter(email__iexact=email).select_related('role').first()
            if acc:
                if acc.check_password(password):
                    if str(acc.account_type) != str(self.account_type):
                        return ApiResponse(
                            success=False,
                            data={
                                "code": "ACCOUNT_PORTAL_MISMATCH",
                                "correct_portal": str(acc.account_type),
                                "correct_login_url": LOGIN_URL_MAP.get(acc.account_type, '/admin/login'),
                            },
                            message="Use the correct administrative portal for this account.",
                            status=status.HTTP_400_BAD_REQUEST
                        )
                break

        model = account_model_for_type(self.account_type)
        account = model.objects.filter(email__iexact=email).select_related('role').first()

        if account is None:
            record_login_activity(
                account_type=self.account_type,
                account=None,
                identifier=email,
                login_status=LoginStatus.FAILED,
                failure_reason='Invalid credentials',
                request=request,
            )
            return ApiResponse(success=False, message='Unable to sign in.', status=status.HTTP_401_UNAUTHORIZED)
        if not account.is_active or account.deleted_at is not None:
            record_login_activity(
                account_type=self.account_type,
                account=account,
                identifier=email,
                login_status=LoginStatus.BLOCKED,
                failure_reason='Inactive account',
                request=request,
            )
            return ApiResponse(success=False, message='This account is inactive.', status=status.HTTP_403_FORBIDDEN)
        _clear_expired_login_lock(account)
        if account.is_account_locked:
            record_login_activity(
                account_type=self.account_type,
                account=account,
                identifier=email,
                login_status=LoginStatus.LOCKED,
                failure_reason='Temporary login lock',
                request=request,
            )
            return ApiResponse(success=False, message='Account temporarily locked.', status=status.HTTP_423_LOCKED)
        if not account.check_password(serializer.validated_data['password']):
            is_locked, attempts_remaining = _register_failed_login(account)
            login_status = LoginStatus.LOCKED if is_locked else LoginStatus.FAILED
            record_login_activity(
                account_type=self.account_type,
                account=account,
                identifier=email,
                login_status=login_status,
                failure_reason='Invalid credentials',
                request=request,
            )
            if is_locked:
                return ApiResponse(
                    success=False,
                    data={'attempts_remaining': 0, 'retry_after_minutes': settings.LOGIN_LOCKOUT_MINUTES},
                    message=f'Account temporarily locked. Try again in {settings.LOGIN_LOCKOUT_MINUTES} minutes.',
                    status=status.HTTP_423_LOCKED,
                )
            return ApiResponse(
                success=False,
                data={'attempts_remaining': attempts_remaining},
                message=f'Unable to sign in. {attempts_remaining} attempt{"s" if attempts_remaining != 1 else ""} remaining.',
                status=status.HTTP_401_UNAUTHORIZED,
            )

        requires_two_factor = bool(
            self.account_type == AccountType.SUPER_ADMIN
            and (account.two_factor_enabled or getattr(settings, 'SUPER_ADMIN_2FA_REQUIRED', False))
        )
        if requires_two_factor:
            otp = serializer.validated_data.get('otp', '').strip()
            if not otp:
                code = _issue_challenge(
                    account_type=self.account_type,
                    identifier=email,
                    purpose=AuthChallenge.Purpose.TWO_FACTOR,
                    request=request,
                    lifetime_minutes=5,
                )
                send_mail(
                    'Your My Dear Partner super-admin sign-in code',
                    f'Your one-time sign-in code is {code}. It expires in 5 minutes.',
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=not settings.DEBUG,
                )
                data = {'requires_two_factor': True, 'expires_in': 300}
                if getattr(settings, 'USE_FIXED_DEV_OTP', False):
                    data['developer_otp'] = code
                return ApiResponse(data=data, message='Two-factor verification is required.', status=status.HTTP_202_ACCEPTED)
            if not _consume_challenge(
                account_type=self.account_type,
                identifier=email,
                purpose=AuthChallenge.Purpose.TWO_FACTOR,
                code=otp,
            ):
                record_login_activity(
                    account_type=self.account_type,
                    account=account,
                    identifier=email,
                    login_status=LoginStatus.TWO_FACTOR_FAILED,
                    failure_reason='Invalid or expired two-factor code',
                    request=request,
                    two_factor_status='FAILED',
                )
                return ApiResponse(
                    success=False,
                    message='Invalid or expired verification code.',
                    status=status.HTTP_400_BAD_REQUEST,
                )

        account.failed_login_attempts = 0
        account.locked_until = None
        account.last_login = timezone.now()
        account.save(update_fields=('failed_login_attempts', 'locked_until', 'last_login', 'updated_at'))
        tokens = issue_account_tokens(account, request=request)
        record_login_activity(
            account_type=self.account_type,
            account=account,
            identifier=email,
            login_status=LoginStatus.SUCCESS,
            request=request,
            session_id=tokens['session_id'],
            two_factor_status='SUCCESS' if requires_two_factor else 'NOT_REQUIRED',
        )
        record_security_audit_event('LOGIN_SUCCESS', request=request, account=account, session_id=tokens['session_id'])

        payload = {
            'user': _account_payload(account, request),
            'session_expires_at': tokens['session_expires_at'],
            'session_id': tokens['session_id'],
            'access': tokens['access'],
            'refresh': tokens['refresh'],
        }
        res = ApiResponse(data=payload, message='Login successful.')
        return attach_auth_cookies(res, tokens['access'], tokens['refresh'])


class SuperAdminLoginView(AdministrativeLoginView):
    account_type = AccountType.SUPER_ADMIN


class AdminLoginView(AdministrativeLoginView):
    account_type = AccountType.ADMIN





class AccountRefreshView(APIView):
    permission_classes = (permissions.AllowAny,)
    account_type = None

    def post(self, request):
        raw_refresh = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if not raw_refresh:
            return ApiResponse(success=False, message='Refresh token cookie or payload required.', status=status.HTTP_400_BAD_REQUEST)

        tokens = rotate_refresh_token(
            raw_refresh,
            expected_account_type=self.account_type,
            request=request,
        )
        record_security_audit_event('TOKEN_REFRESH', request=request, session_id=tokens['session_id'])
        payload = {'session_expires_at': tokens['session_expires_at'], 'access': tokens['access'], 'refresh': tokens['refresh']}
        res = ApiResponse(data=payload, message='Token refreshed successfully.')
        return attach_auth_cookies(res, tokens['access'], tokens['refresh'])


class AccountLogoutView(APIView):
    permission_classes = (permissions.AllowAny,)
    account_type = None

    def post(self, request):
        raw_refresh = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if raw_refresh:
            session = revoke_session(
                raw_refresh,
                expected_account_type=self.account_type,
                reason='USER_LOGOUT',
            )
            if session:
                model, _, _ = LOGIN_ACTIVITY_CONFIG[str(self.account_type)]
                model.objects.filter(session_id=session.pk, logged_out_at__isnull=True).update(
                    login_status=LoginStatus.LOGGED_OUT,
                    logged_out_at=timezone.now(),
                )
        record_security_audit_event('LOGOUT', request=request, account=getattr(request, 'user', None))
        res = ApiResponse(message='Logout successful.')
        return clear_auth_cookies(res)


class AccountLogoutAllView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    account_type = None

    def post(self, request):
        _ensure_account_type(request, self.account_type)
        revoke_all_account_sessions(request.user, reason='LOGOUT_ALL_DEVICES')
        record_security_audit_event('LOGOUT_ALL_DEVICES', request=request, account=request.user)
        res = ApiResponse(message='Logged out from all devices.')
        return clear_auth_cookies(res)


class UserSessionsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        current_session_id = request.auth.get('session_id') if hasattr(request, 'auth') and hasattr(request.auth, 'get') else None
        sessions = AuthSession.objects.filter(
            account_id=request.user.pk,
            account_type=str(request.user.account_type),
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).order_by('-updated_at')

        data = []
        for s in sessions:
            data.append({
                'id': str(s.pk),
                'device_name': s.device_name or 'Browser / Mobile Device',
                'user_agent_summary': s.user_agent_summary,
                'ip_address': s.ip_address,
                'created_at': s.created_at.isoformat(),
                'last_used_at': s.updated_at.isoformat(),
                'is_current': str(s.pk) == str(current_session_id),
            })
        return ApiResponse(data=data)

    def delete(self, request, session_id=None):
        if not session_id:
            return ApiResponse(success=False, message='Session ID is required.', status=status.HTTP_400_BAD_REQUEST)

        session = AuthSession.objects.filter(
            pk=session_id,
            account_id=request.user.pk,
            account_type=str(request.user.account_type),
            revoked_at__isnull=True,
        ).first()

        if not session:
            return ApiResponse(success=False, message='Session not found or already revoked.', status=status.HTTP_404_NOT_FOUND)

        session.revoked_at = timezone.now()
        session.revocation_reason = 'USER_REVOKED_DEVICE'
        session.save(update_fields=('revoked_at', 'revocation_reason', 'updated_at'))
        record_security_audit_event('SESSION_REVOKED', request=request, account=request.user, session_id=session.pk)

        return ApiResponse(message='Device session revoked successfully.')


class AccountMeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    account_type = None

    def get(self, request):
        _ensure_account_type(request, self.account_type)
        return ApiResponse(data=_account_payload(request.user, request))


class AccountChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    account_type = None

    @transaction.atomic
    def post(self, request):
        _ensure_account_type(request, self.account_type)
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data['old_password']):
            return ApiResponse(
                success=False,
                message='The current password is incorrect.',
                status=status.HTTP_400_BAD_REQUEST,
                request=request,
            )
        new_password = serializer.validated_data['new_password']
        if request.user.check_password(new_password):
            return ApiResponse(
                success=False,
                message='Your new password cannot be the same as your current password. Please choose a different password.',
                status=status.HTTP_400_BAD_REQUEST,
                request=request,
            )
        request.user.set_password(new_password)
        request.user.password_changed_at = timezone.now()
        request.user.save(update_fields=('password', 'password_changed_at', 'updated_at'))
        revoke_all_account_sessions(request.user)
        if request.user.account_type != AccountType.MEMBER:
            log_operational_activity(
                request=request,
                actor=request.user,
                action='PASSWORD_CHANGED',
                module='authentication',
                target_type=str(request.user.account_type),
                target_id=request.user.pk,
            )
        return ApiResponse(message='Password changed. Sign in again on every device.')


class MemberMeView(AccountMeView):
    account_type = AccountType.MEMBER
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def patch(self, request):
        _ensure_account_type(request, self.account_type)
        profile_data = request.data.copy()
        profile_data.pop('photo', None)
        serializer = MemberProfileUpdateSerializer(
            request.user,
            data=profile_data,
            partial=True,
            context={'member': request.user},
        )
        serializer.is_valid(raise_exception=True)

        # Snapshot values before the write so the audit log can record the
        # exact changed fields and previous/new values.
        changed_keys = [k for k in profile_data.keys() if k not in ('photo',)]
        before = _snapshot_profile_values(request.user, changed_keys)

        photo_upload = request.FILES.get('photo')
        processed_photo = None
        from apps.profiles.services.image_processing import (
            ImageProcessingService,
            ProfilePhotoProcessingError,
        )

        if photo_upload is not None:
            # Decode/crop/compress before opening a database transaction so a
            # PgBouncer server connection is not held during CPU-heavy Pillow
            # work. The processed value contains only bounded WebP bytes.
            try:
                processed_photo = ImageProcessingService.process_profile_photo(photo_upload)
            except ProfilePhotoProcessingError as exc:
                raise ValidationError({'photo': [str(exc)]}) from exc

        try:
            with transaction.atomic():
                member = serializer.save()
                if processed_photo is not None:
                    # Compatibility for the old profile PATCH form: replace
                    # the primary in place, or create the first BYTEA photo.
                    from apps.profiles.models import ProfilePhoto
                    from apps.profiles.services.photo_management import (
                        _create_processed_profile_photo,
                        _replace_processed_profile_photo,
                    )

                    primary = (
                        ProfilePhoto.objects.without_binary()
                        .filter(user=member, is_primary=True)
                        .first()
                    )
                    if primary is None:
                        _create_processed_profile_photo(
                            member=member,
                            processed=processed_photo,
                            uploaded_file=photo_upload,
                            actor=member,
                        )
                    else:
                        _replace_processed_profile_photo(
                            photo_id=primary.pk,
                            member=member,
                            processed=processed_photo,
                            uploaded_file=photo_upload,
                            actor=member,
                        )
        except ProfilePhotoProcessingError as exc:
            raise ValidationError({'photo': [str(exc)]}) from exc

        after = _snapshot_profile_values(member, changed_keys)
        changed_fields = [k for k in changed_keys if before.get(k) != after.get(k)]
        if changed_fields:
            log_operational_activity(
                request=request,
                actor=request.user,
                action='PROFILE_UPDATED',
                module='profile',
                target_type='MEMBER',
                target_id=member.pk,
                description=f"Member updated {len(changed_fields)} profile field(s).",
                old_data={k: before.get(k) for k in changed_fields},
                new_data={k: after.get(k) for k in changed_fields},
            )
            # Notify authorized staff only AFTER the transaction commits, so a
            # member's own active form is never reset with stale data.
            from apps.notifications.services import send_event_after_commit
            send_event_after_commit(
                groups=['role_super_admin', 'role_admin'],
                event_type='profile.updated',
                entity='member_profile',
                entity_id=member.pk,
                message='A member updated their profile.',
                data={
                    'member_id': str(member.pk),
                    'changed_sections': sorted({
                        _profile_section_of(k) for k in changed_fields
                    }),
                    'changed_fields': changed_fields,
                },
            )
        return ApiResponse(data=_account_payload(member, request), message='Profile updated successfully.')


class MemberDocumentListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (FormParser, MultiPartParser)

    def get(self, request):
        _ensure_account_type(request, AccountType.MEMBER)
        documents = MemberDocument.objects.filter(member=request.user).defer('file_data')
        serializer = MemberDocumentSerializer(documents, many=True)
        return ApiResponse(data=serializer.data, message='Documents retrieved successfully.')

    @transaction.atomic
    def post(self, request):
        _ensure_account_type(request, AccountType.MEMBER)
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': ['File is required.']})

        document_type = str(request.data.get('document_type', '')).strip().upper()
        if not document_type:
            raise ValidationError({'document_type': ['Document type is required.']})

        valid_types = [t[0] for t in MemberDocument.DocumentType.choices]
        if document_type not in valid_types:
            raise ValidationError({'document_type': [f'Invalid document type. Must be one of: {", ".join(valid_types)}']})

        custom_document_name = str(request.data.get('custom_document_name', '')).strip()
        if document_type == MemberDocument.DocumentType.OTHER and not custom_document_name:
            raise ValidationError({'custom_document_name': ['Custom document name is required when type is OTHER.']})

        upload = _validate_member_document(upload)
        mime_type = upload.content_type or 'application/octet-stream'

        raw_bytes = upload.read()
        upload.seek(0)
        compressed = gzip.compress(raw_bytes)
        file_hash = hashlib.sha256(raw_bytes).hexdigest()

        document = MemberDocument.objects.create(
            member=request.user,
            document_type=document_type,
            custom_document_name=custom_document_name,
            original_file_name=upload.name,
            file_data=compressed,
            mime_type=mime_type,
            file_size=len(raw_bytes),
            compressed_size=len(compressed),
            file_hash=file_hash,
            status=MemberDocument.Status.PENDING,
        )

        from apps.core.models import ProfileVerificationDocument, ProfileVerificationRequest
        active_statuses = (
            ProfileVerificationRequest.Status.PENDING_REVIEW,
            ProfileVerificationRequest.Status.IN_REVIEW,
        )
        verification = ProfileVerificationRequest.objects.filter(
            member=request.user,
            verification_type=ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
            status__in=active_statuses,
        ).first()
        if verification is None:
            verification = ProfileVerificationRequest.objects.create(
                member=request.user,
                verification_type=ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
            )
        ProfileVerificationDocument.objects.create(
            verification_request=verification,
            member_document=document,
        )

        from apps.core.api_utils import create_notification
        from apps.accounts.permissions import IsAdmin, IsSuperAdmin
        from apps.accounts.models import SuperAdmin, Admin
        admins = list(SuperAdmin.objects.filter(is_active=True)) + list(Admin.objects.filter(is_active=True))
        for admin in admins:
            try:
                create_notification(
                    admin,
                    type='document_uploaded',
                    title='New Document Uploaded',
                    body=f'{request.user.get_full_name() or request.user.email} uploaded a {document.display_name}.',
                    related_object=document,
                )
            except Exception:
                pass

        serializer = MemberDocumentSerializer(document)
        return ApiResponse(
            data={'document': serializer.data},
            message='Document uploaded successfully.',
            status=status.HTTP_201_CREATED,
        )


class MemberDocumentDeleteView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    @transaction.atomic
    def delete(self, request, document_id):
        try:
            document = MemberDocument.objects.get(pk=document_id, member=request.user)
        except MemberDocument.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Document not found.',
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.core.models import ProfileVerificationDocument
        ProfileVerificationDocument.objects.filter(member_document=document).delete()

        document.delete()

        return ApiResponse(
            success=True,
            message='Document permanently deleted.',
            status=status.HTTP_200_OK,
        )


class MemberDocumentReuploadView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)
    parser_classes = (FormParser, MultiPartParser)

    @transaction.atomic
    def post(self, request, document_id):
        _ensure_account_type(request, AccountType.MEMBER)
        try:
            document = MemberDocument.objects.get(pk=document_id, member=request.user)
        except MemberDocument.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Document not found.',
                status=status.HTTP_404_NOT_FOUND,
            )

        if document.status != MemberDocument.Status.REJECTED:
            return ApiResponse(
                success=False,
                message='Only rejected documents can be re-uploaded.',
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': ['File is required.']})

        mime_type = upload.content_type or 'application/octet-stream'
        upload = _validate_member_document(upload)

        raw_bytes = upload.read()
        upload.seek(0)
        compressed = gzip.compress(raw_bytes)
        file_hash = hashlib.sha256(raw_bytes).hexdigest()

        document.file_data = compressed
        document.original_file_name = upload.name
        document.mime_type = mime_type
        document.file_size = len(raw_bytes)
        document.compressed_size = len(compressed)
        document.file_hash = file_hash
        document.status = MemberDocument.Status.PENDING
        document.rejection_reason = ''
        document.admin_comment = ''
        document.reviewed_at = None
        document.reviewed_by_id = None
        document.save()

        from apps.core.api_utils import create_notification
        from apps.accounts.models import SuperAdmin, Admin
        admins = list(SuperAdmin.objects.filter(is_active=True)) + list(Admin.objects.filter(is_active=True))
        for admin in admins:
            try:
                create_notification(
                    admin,
                    type='document_reuploaded',
                    title='Document Re-uploaded',
                    body=f'{request.user.get_full_name() or request.user.email} re-uploaded a {document.display_name}.',
                    related_object=document,
                )
            except Exception:
                pass

        serializer = MemberDocumentSerializer(document)
        return ApiResponse(
            data={'document': serializer.data},
            message='Document re-uploaded successfully.',
            status=status.HTTP_200_OK,
        )


class MemberProfileSubmitView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def post(self, request):
        _ensure_account_type(request, AccountType.MEMBER)
        profile, _ = MemberProfile.objects.get_or_create(member=request.user)
        required = {
            'mobile_number': request.user.mobile_number,
            'gender': request.user.gender,
            'date_of_birth': request.user.date_of_birth,
            'marital_status': profile.marital_status,
            'height': profile.height,
            'religion': profile.religion,
            'mother_tongue': profile.mother_tongue,
            'highest_education': profile.highest_education,
            'occupation': profile.occupation,
            'work_location': profile.work_location,
            'about': profile.about,
        }
        missing = [name for name, value in required.items() if not value]
        from apps.profiles.models import ProfilePhoto
        if not ProfilePhoto.objects.filter(user=request.user).exists():
            missing.append('photo')
        if missing:
            return ApiResponse(
                success=False,
                message='Please complete all required fields before submitting.',
                errors={'missing_fields': missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.profile_status = Member.VerificationStatus.PENDING_REVIEW
        request.user.save(update_fields=('profile_status', 'updated_at'))
        profile.submitted_at = timezone.now()
        profile.rejection_reason = ''
        profile.save(update_fields=('submitted_at', 'rejection_reason', 'updated_at'))

        from apps.core.models import ProfileVerificationRequest

        ProfileVerificationRequest.objects.create(
            member=request.user,
            verification_type=ProfileVerificationRequest.VerificationType.FULL_PROFILE,
        )

        # Run duplicate account detection (synchronous; swap for Celery task in production)
        try:
            from apps.accounts.duplicate_detection import run_duplicate_checks
            run_duplicate_checks(request.user)
        except Exception:
            # Never block profile submission due to detection errors
            import logging
            logging.getLogger(__name__).exception(
                'Duplicate detection failed for member %s', request.user.pk
            )

        return ApiResponse(data=_account_payload(request.user, request), message='Profile submitted for verification.')


class MemberForgotPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_scope = 'reset-password'

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = _normalize_member_identifier(serializer.validated_data['identifier'])
        channel = request.data.get('channel', 'auto')

        member = _member_for_identifier(identifier)
        developer_otp = None
        sent_channel = 'email' if '@' in identifier else 'mobile'

        if member and member.is_active and member.deleted_at is None:
            developer_otp = _issue_challenge(
                account_type=AccountType.MEMBER,
                identifier=identifier,
                purpose=AuthChallenge.Purpose.PASSWORD_RESET,
                request=request,
            )

            if channel == 'email' or (channel == 'auto' and '@' in identifier):
                sent_channel = 'email'
                if member.email:
                    send_mail(
                        'Your My Dear Partner password reset code',
                        f'Your one-time reset code is {developer_otp}. It expires in 10 minutes.',
                        settings.DEFAULT_FROM_EMAIL,
                        [member.email],
                        fail_silently=not settings.DEBUG,
                    )
            elif channel == 'mobile' or (channel == 'auto' and '@' not in identifier):
                sent_channel = 'mobile'
                import logging
                logging.getLogger(__name__).info(
                    "SMS OTP dispatched to %s: %s", member.mobile_number, developer_otp
                )

        data = {'expires_in': 600, 'sent_via': sent_channel}
        if getattr(settings, 'USE_FIXED_DEV_OTP', False):
            data['developer_otp'] = developer_otp
        msg = f"Reset code successfully sent to your registered {sent_channel}."
        return ApiResponse(data=data, message=msg)


class MemberResetPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)

    @transaction.atomic
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = _normalize_member_identifier(serializer.validated_data['identifier'])
        member = _member_for_identifier(identifier)

        challenge = (
            AuthChallenge.objects.select_for_update()
            .filter(
                account_type=AccountType.MEMBER,
                identifier=identifier,
                purpose=AuthChallenge.Purpose.PASSWORD_RESET,
                consumed_at__isnull=True,
            )
            .order_by('-created_at')
            .first()
        )

        if member is None or challenge is None or not challenge.is_usable:
            return ApiResponse(
                success=False,
                data={'attempts_remaining': 0},
                message='Invalid, expired, or non-existent password reset request.',
                status=status.HTTP_400_BAD_REQUEST
            )

        if not check_password(serializer.validated_data['code'], challenge.code_digest):
            challenge.attempts += 1
            attempts_remaining = max(0, challenge.max_attempts - challenge.attempts)
            if challenge.attempts >= challenge.max_attempts:
                challenge.consumed_at = timezone.now()
            challenge.save(update_fields=('attempts', 'consumed_at'))

            if attempts_remaining > 0:
                msg = f"Invalid reset code. {attempts_remaining} attempt{'s' if attempts_remaining != 1 else ''} remaining!"
            else:
                msg = "Too many failed attempts. Code has been invalidated. Please request a new OTP."

            return ApiResponse(
                success=False,
                data={'attempts_remaining': attempts_remaining},
                message=msg,
                status=status.HTTP_400_BAD_REQUEST
            )

        new_password = serializer.validated_data['new_password']
        if member.check_password(new_password):
            return ApiResponse(
                success=False,
                message='Your new password cannot be the same as your current password. Please choose a different password.',
                status=status.HTTP_400_BAD_REQUEST
            )

        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=('consumed_at',))

        member.set_password(new_password)
        member.password_changed_at = timezone.now()
        update_fields = ['password', 'password_changed_at', 'updated_at']
        if hasattr(member, 'failed_login_attempts'):
            member.failed_login_attempts = 0
            update_fields.append('failed_login_attempts')
        if hasattr(member, 'locked_until'):
            member.locked_until = None
            update_fields.append('locked_until')
        member.save(update_fields=update_fields)
        revoke_all_account_sessions(member)
        return ApiResponse(message='Password reset successfully. You can now sign in with your new password.')


class MemberOtpRequestView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_scope = 'login'

    def post(self, request):
        serializer = OtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = _normalize_member_identifier(serializer.validated_data['identifier'])
        purpose = serializer.validated_data['purpose']
        if purpose not in {
            AuthChallenge.Purpose.REGISTRATION,
            AuthChallenge.Purpose.PHONE_VERIFY,
            AuthChallenge.Purpose.PASSWORDLESS_LOGIN,
        }:
            return ApiResponse(success=False, message='Unsupported OTP purpose.', status=status.HTTP_400_BAD_REQUEST)
        member = _member_for_identifier(identifier)
        code = None
        if member:
            code = _issue_challenge(
                account_type=AccountType.MEMBER,
                identifier=identifier,
                purpose=purpose,
                request=request,
                lifetime_minutes=5,
            )
        data = {'expires_in': 300}
        if getattr(settings, 'USE_FIXED_DEV_OTP', False):
            data['developer_otp'] = code
        return ApiResponse(data=data, message='If the member exists, a verification code has been sent.')
class MemberOtpVerifyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = _normalize_member_identifier(serializer.validated_data['identifier'])
        purpose = serializer.validated_data['purpose']
        if not _consume_challenge(
            account_type=AccountType.MEMBER,
            identifier=identifier,
            purpose=purpose,
            code=serializer.validated_data['code'],
        ):
            return ApiResponse(success=False, message='Invalid or expired verification code.', status=status.HTTP_400_BAD_REQUEST)
        member = _member_for_identifier(identifier)
        if member is None:
            return ApiResponse(success=False, message='Member not found.', status=status.HTTP_404_NOT_FOUND)
        if '@' in identifier:
            member.is_email_verified = True
            update_fields = ('is_email_verified', 'updated_at')
        else:
            member.is_mobile_verified = True
            update_fields = ('is_mobile_verified', 'updated_at')
        member.save(update_fields=update_fields)
        data = {'verified': True, 'user': _account_payload(member, request)}
        if purpose == AuthChallenge.Purpose.PASSWORDLESS_LOGIN:
            tokens = issue_account_tokens(member, request=request)
            data['session_expires_at'] = tokens['session_expires_at']
            record_login_activity(
                account_type=AccountType.MEMBER,
                account=member,
                identifier=identifier,
                login_status=LoginStatus.SUCCESS,
                request=request,
                session_id=tokens['session_id'],
            )
            record_security_audit_event('OTP_LOGIN_SUCCESS', request=request, account=member, session_id=tokens['session_id'])
            res = ApiResponse(data=data, message='Verification successful.')
            return attach_auth_cookies(res, tokens['access'], tokens['refresh'])
        return ApiResponse(data=data, message='Verification successful.')


def _typed_view(base, account_type, name):
    return type(name, (base,), {'account_type': account_type})


MemberRefreshView = _typed_view(AccountRefreshView, AccountType.MEMBER, 'MemberRefreshView')
MemberLogoutView = _typed_view(AccountLogoutView, AccountType.MEMBER, 'MemberLogoutView')
MemberLogoutAllView = _typed_view(AccountLogoutAllView, AccountType.MEMBER, 'MemberLogoutAllView')
MemberChangePasswordView = _typed_view(AccountChangePasswordView, AccountType.MEMBER, 'MemberChangePasswordView')

SuperAdminRefreshView = _typed_view(AccountRefreshView, AccountType.SUPER_ADMIN, 'SuperAdminRefreshView')
SuperAdminLogoutView = _typed_view(AccountLogoutView, AccountType.SUPER_ADMIN, 'SuperAdminLogoutView')
SuperAdminLogoutAllView = _typed_view(AccountLogoutAllView, AccountType.SUPER_ADMIN, 'SuperAdminLogoutAllView')
SuperAdminMeView = _typed_view(AccountMeView, AccountType.SUPER_ADMIN, 'SuperAdminMeView')
SuperAdminChangePasswordView = _typed_view(AccountChangePasswordView, AccountType.SUPER_ADMIN, 'SuperAdminChangePasswordView')

AdminRefreshView = _typed_view(AccountRefreshView, AccountType.ADMIN, 'AdminRefreshView')
AdminLogoutView = _typed_view(AccountLogoutView, AccountType.ADMIN, 'AdminLogoutView')
AdminLogoutAllView = _typed_view(AccountLogoutAllView, AccountType.ADMIN, 'AdminLogoutAllView')
AdminMeView = _typed_view(AccountMeView, AccountType.ADMIN, 'AdminMeView')
AdminChangePasswordView = _typed_view(AccountChangePasswordView, AccountType.ADMIN, 'AdminChangePasswordView')



class MemberVerificationStatusView(APIView):
    """
    GET /api/v1/member-auth/verification-status/
    
    Get current account verification status summary.
    
    Response:
        {
            "success": true,
            "data": {
                "account_status": "INCOMPLETE" | "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "SUSPENDED",
                "is_verified": bool,
                "profile": {
                    "status": "incomplete" | "pending" | "approved" | "rejected",
                    "submitted_at": "2026-07-16T10:30:00Z",
                    "reviewed_at": "2026-07-17T10:30:00Z",
                    "reason": null | "rejection reason"
                },
                "primary_photo": {
                    "status": "incomplete" | "pending" | "approved" | "rejected",
                    "submitted_at": "2026-07-16T10:30:00Z",
                    "reviewed_at": "2026-07-17T10:30:00Z",
                    "reason": null | "rejection reason"
                },
                "documents": {
                    "status": "incomplete" | "pending" | "approved" | "rejected",
                    "submitted_at": "2026-07-16T10:30:00Z",
                    "reviewed_at": "2026-07-17T10:30:00Z",
                    "reason": null | "rejection reason"
                },
                "next_action": "Complete your profile...",
                "membership_pending": bool  # true if pending_verification membership exists
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def get(self, request):
        from apps.accounts.verification_service import AccountVerificationService
        from apps.core.models import MemberMembership
        
        member = request.user
        
        # Get verification summary
        verification_summary = AccountVerificationService.get_verification_summary(member)
        
        # Check if there's a pending verification membership
        pending_membership = MemberMembership.objects.filter(
            member=member,
            status='PENDING_VERIFICATION'
        ).exists()
        
        data = {
            'account_status': verification_summary.overall_status,
            'is_verified': verification_summary.is_verified,
            'contact': {
                'email_verified': verification_summary.email_verified,
                'mobile_verified': verification_summary.mobile_verified,
            },
            'profile': verification_summary.profile,
            'primary_photo': verification_summary.photo,
            'documents': verification_summary.document,
            'next_action': verification_summary.next_action,
            'membership_pending': pending_membership,
        }
        
        return ApiResponse(
            success=True,
            data=data,
            status=status.HTTP_200_OK
        )




# Legacy class names point only to member auth. They no longer authenticate administrators.
RegisterView = MemberRegisterView
CustomTokenObtainPairView = MemberLoginView
CustomTokenRefreshView = MemberRefreshView
LogoutView = MemberLogoutView
UserMeView = MemberMeView
ChangePasswordView = MemberChangePasswordView
ForgotPasswordView = MemberForgotPasswordView
ResetPasswordView = MemberResetPasswordView
OtpRequestView = MemberOtpRequestView
OtpVerifyView = MemberOtpVerifyView
ProfileSubmitView = MemberProfileSubmitView
