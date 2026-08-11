import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.profiles.models import ProfilePhoto
from apps.profiles.photo_permissions import can_review_profile_photos
from apps.profiles.serializers import ProfilePhotoSerializer

from .models import Member, MemberDocument, MemberPreference, MemberProfile
from .mobile import normalize_mobile_number
from .services import create_member, update_member


MOBILE_PATTERN = re.compile(r'^[6-9]\d{9}$')


def validate_mobile_number(value):
    value = normalize_mobile_number(value)
    if value and not MOBILE_PATTERN.fullmatch(value):
        raise serializers.ValidationError('Enter a valid 10-digit Indian mobile number.')
    return value or None


# Compatibility export for callers that imported the old serializer name.  It
# serializes metadata/endpoints only; image BYTEA fields are never exposed.
MemberPhotoSerializer = ProfilePhotoSerializer


class MemberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    is_verified = serializers.SerializerMethodField()
    is_fully_verified = serializers.SerializerMethodField()
    account_type = serializers.CharField(read_only=True)
    admin_role = serializers.SerializerMethodField()
    admin_role_display = serializers.SerializerMethodField()
    admin_permissions = serializers.SerializerMethodField()
    completion_percentage = serializers.SerializerMethodField()
    missing_fields = serializers.SerializerMethodField()
    can_submit = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            'id', 'email', 'mobile_number', 'first_name', 'last_name', 'full_name',
            'gender', 'date_of_birth', 'profile_created_by', 'is_email_verified',
            'is_mobile_verified', 'is_verified', 'is_fully_verified', 'is_active', 'is_premium',
            'profile_status', 'photo_status', 'document_status', 'last_login',
            'password_changed_at', 'created_at', 'updated_at', 'date_joined', 'account_type',
            'admin_role', 'admin_role_display', 'admin_permissions', 'photo',
            'photos', 'documents', 'completion_percentage', 'missing_fields', 'can_submit',
            'chat_public_key', 'deleted_at', 'is_deleted', 'terms_accepted_at',
        )

    def get_admin_role(self, obj):
        return None

    def get_admin_role_display(self, obj):
        return None

    def get_admin_permissions(self, obj):
        return []

    def get_is_verified(self, obj):
        # "Verified" means the member's identity contacts are confirmed: both
        # email and mobile must be verified. This is the lightweight check used
        # for badges and membership-unlock gating. The stricter, all-steps
        # state lives in `is_fully_verified` / `are_verification_checks_passed`.
        return bool(obj.is_email_verified and obj.is_mobile_verified)

    def get_is_fully_verified(self, obj):
        return obj.are_verification_checks_passed

    def _required_values(self, obj):
        cached = getattr(obj, '_required_values_cache', None)
        if cached is not None:
            return cached
        try:
            profile = obj.profile
        except ObjectDoesNotExist:
            profile = None
        try:
            preference = obj.preferences
        except ObjectDoesNotExist:
            preference = None
        values = {
            'mobile_number': obj.mobile_number,
            'gender': obj.gender,
            'profile_created_by': obj.profile_created_by,
            'date_of_birth': obj.date_of_birth,
            'religion': getattr(profile, 'religion', ''),
            'mother_tongue': getattr(profile, 'mother_tongue', ''),
            'highest_education': getattr(profile, 'highest_education', ''),
            'occupation': getattr(profile, 'occupation', ''),
            'work_location': getattr(profile, 'work_location', ''),
            'about': getattr(profile, 'about', ''),
            'photo': self.get_photo(obj),
            'marital_status': getattr(profile, 'marital_status', ''),
            'height': getattr(profile, 'height', ''),
            'family_type': getattr(profile, 'family_type', ''),
            'employed_in': getattr(profile, 'employed_in', ''),
            'pref_age_min': getattr(preference, 'preferred_age_min', None),
            'pref_age_max': getattr(preference, 'preferred_age_max', None),
        }
        obj._required_values_cache = values
        return values

    def get_completion_percentage(self, obj):
        values = self._required_values(obj)
        filled = sum(1 for v in values.values() if v is not None and v != '' and v != 0 and v != 0.0)
        total = len(values)
        return int(filled / total * 100) if total else 0

    def get_missing_fields(self, obj):
        return [name for name, value in self._required_values(obj).items() if not value]

    def get_can_submit(self, obj):
        return len(self.get_missing_fields(obj)) == 0

    def get_photo(self, obj):
        photos = self._visible_photos(obj)
        photo = photos.filter(is_primary=True).first()
        return ProfilePhotoSerializer(photo, context=self.context).data['image_url'] if photo else None

    def _visible_photos(self, obj):
        photos = ProfilePhoto.objects.without_binary().filter(user=obj, is_deleted=False)
        request = self.context.get('request')
        viewer = getattr(request, 'user', None)
        is_owner = bool(viewer and str(getattr(viewer, 'account_type', '')) == 'MEMBER' and viewer.pk == obj.pk)
        if not is_owner and not can_review_profile_photos(viewer):
            photos = photos.filter(status=ProfilePhoto.Status.APPROVED)
        return photos.order_by('-is_primary', 'display_order', 'created_at')

    def get_photos(self, obj):
        return ProfilePhotoSerializer(
            self._visible_photos(obj),
            many=True,
            context=self.context,
        ).data

    def get_documents(self, obj):
        request = self.context.get('request')
        rows = []
        for document in obj.documents.all():
            path = f'/api/v1/verification/documents/{document.pk}/download/'
            rows.append({
                'id': str(document.pk),
                'document_type': document.document_type,
                'status': document.status,
                'rejection_reason': document.rejection_reason,
                'uploaded_at': document.uploaded_at,
                'download_url': request.build_absolute_uri(path) if request else path,
            })
        return rows

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            profile = instance.profile
        except ObjectDoesNotExist:
            profile = None
        try:
            preference = instance.preferences
        except ObjectDoesNotExist:
            preference = None
        if profile:
            for field in (
                'marital_status', 'height', 'weight', 'blood_group', 'complexion',
                'religion', 'mother_tongue', 'caste', 'sub_caste', 'gothra',
                'star_nakshatra', 'manglik_status', 'highest_education',
                'education_detail', 'occupation', 'employed_in', 'company',
                'annual_income', 'work_location', 'father_status', 'mother_status',
                'num_brothers', 'num_sisters', 'family_type', 'family_status',
                'family_location', 'about', 'hobbies', 'compatibility',
                'submitted_at', 'rejection_reason',
            ):
                data[field] = getattr(profile, field)
            # Canonical output aliases so consumers can use the spec names too.
            profile_aliases = {
                'about_me': 'about',
                'current_city': 'work_location',
            }
            for output_name, model_name in profile_aliases.items():
                data[output_name] = getattr(profile, model_name)
        if preference:
            aliases = {
                'pref_age_min': 'preferred_age_min',
                'pref_age_max': 'preferred_age_max',
                'pref_height_min': 'preferred_height_min',
                'pref_height_max': 'preferred_height_max',
                'pref_religion': 'preferred_religion',
                'pref_caste': 'preferred_caste',
                'pref_location': 'preferred_location',
                'pref_education': 'preferred_education',
                'pref_occupation': 'preferred_occupation',
                'pref_marital_status': 'preferred_marital_status',
                'pref_about': 'additional_expectations',
                'preferred_min_age': 'preferred_age_min',
                'preferred_max_age': 'preferred_age_max',
                'preferred_min_height': 'preferred_height_min',
                'preferred_max_height': 'preferred_height_max',
                'preferred_religion': 'preferred_religion',
                'preferred_caste': 'preferred_caste',
                'preferred_locations': 'preferred_location',
                'preferred_education': 'preferred_education',
                'preferred_occupation': 'preferred_occupation',
                'preferred_marital_status': 'preferred_marital_status',
                'ideal_partner_description': 'additional_expectations',
            }
            for output_name, model_name in aliases.items():
                data[output_name] = getattr(preference, model_name)

        # Get active membership — use prefetched data when available
        from apps.core.models import MemberMembership, MembershipRequest, ProfileUnlock, Interest
        from django.utils import timezone
        import zoneinfo
        kolkata_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        context_today = (self.context or {}).get('today')
        today = context_today or timezone.now().astimezone(kolkata_tz).date()

        active_memberships = getattr(instance, '_prefetched_active_memberships', None)
        if active_memberships is not None:
            active_membership = active_memberships[0] if active_memberships else None
        else:
            active_membership = MemberMembership.objects.filter(member=instance, is_active=True).first()
        if active_membership:
            plan = active_membership.plan
            days_remaining = None
            if active_membership.end_date:
                delta = active_membership.end_date - timezone.now()
                days_remaining = max(0, delta.days)
            
            # calculate limits used today
            today_unlocks = getattr(instance, '_prefetched_today_unlocks', None)
            if today_unlocks is not None:
                views_today = len(today_unlocks)
            else:
                views_today = ProfileUnlock.objects.filter(viewer=instance, usage_date=today).count()
            today_interests = getattr(instance, '_prefetched_today_interests', None)
            if today_interests is not None:
                interests_today = len(today_interests)
            else:
                interests_today = Interest.objects.filter(sender=instance, created_at__date=today).count()
            
            data['active_membership'] = {
                'plan_name': plan.name if plan else 'Free',
                'plan_slug': plan.slug if plan else 'free',
                'start_date': active_membership.start_date,
                'end_date': active_membership.end_date,
                'days_remaining': days_remaining,
                'is_active': active_membership.is_active,
                'features': plan.features if plan else [],
                'limits': {
                    'daily_views_limit': plan.daily_profile_unlock_limit if (plan and plan.daily_profile_unlock_limit is not None) else 5,
                    'daily_views_used': views_today,
                    'daily_interests_limit': plan.interest_limit_daily if plan else 5,
                    'daily_interests_used': interests_today,
                }
            }
        else:
            # Fallback to default Free plan
            today_unlocks = getattr(instance, '_prefetched_today_unlocks', None)
            if today_unlocks is not None:
                views_today = len(today_unlocks)
            else:
                views_today = ProfileUnlock.objects.filter(viewer=instance, usage_date=today).count()
            today_interests = getattr(instance, '_prefetched_today_interests', None)
            if today_interests is not None:
                interests_today = len(today_interests)
            else:
                interests_today = Interest.objects.filter(sender=instance, created_at__date=today).count()
            data['active_membership'] = {
                'plan_name': 'Free',
                'plan_slug': 'free',
                'start_date': None,
                'end_date': None,
                'days_remaining': None,
                'is_active': True,
                'features': [
                    'Create your profile',
                    'Browse profiles',
                    'Send 5 interests per day',
                    'Basic search filters',
                    'View limited photos',
                ],
                'limits': {
                    'daily_views_limit': 5,
                    'daily_views_used': views_today,
                    'daily_interests_limit': 5,
                    'daily_interests_used': interests_today,
                }
            }

        # Get pending verification membership
        pending_memberships = getattr(instance, '_prefetched_pending_memberships', None)
        if pending_memberships is not None:
            pending_membership = pending_memberships[0] if pending_memberships else None
        else:
            pending_membership = MemberMembership.objects.filter(member=instance, status='PENDING_VERIFICATION').first()
        if pending_membership:
            plan = pending_membership.plan
            data['pending_membership'] = {
                'plan_name': plan.name if plan else '',
                'plan_slug': plan.slug if plan else '',
                'status': 'PENDING_VERIFICATION'
            }
        else:
            data['pending_membership'] = None

        # Get pending request
        pending_requests = getattr(instance, '_prefetched_pending_requests', None)
        if pending_requests is not None:
            pending_req = pending_requests[0] if pending_requests else None
        else:
            pending_req = MembershipRequest.objects.filter(user=instance, status='pending').first()
        if pending_req:
            data['pending_request'] = {
                'plan_name': pending_req.selected_plan.name,
                'plan_slug': pending_req.selected_plan.slug,
                'requested_at': pending_req.requested_at,
                'status': pending_req.status
            }
        else:
            data['pending_request'] = None

        return data


def administrative_account_payload(account):
    from django.utils import timezone
    payload = {
        'id': str(account.pk),
        'email': account.email,
        'mobile_number': account.mobile_number,
        'first_name': account.first_name,
        'last_name': account.last_name,
        'full_name': account.get_full_name(),
        'account_type': str(account.account_type),
        'admin_role': account.admin_role_code,
        'admin_role_display': account.admin_role_display,
        'admin_permissions': sorted(account.get_effective_admin_permissions()),
        'is_active': account.is_active,
        'is_email_verified': account.is_email_verified,
        'is_verified': account.is_email_verified,
        'is_staff': True,
        'is_superuser': account.is_super_admin,
        'last_login': account.last_login,
        'created_at': account.created_at,
        'updated_at': account.updated_at,
        'role': str(account.account_type),
        'role_display': account.admin_role_display,
    }
    
    if hasattr(account, 'employee_code'):
        payload['employee_code'] = account.employee_code

    if hasattr(account, 'photo'):
        payload['photo'] = account.photo or ''

    if hasattr(account, 'bio'):
        payload['bio'] = account.bio or ''

    if hasattr(account, 'admin_id'):
        payload['admin_id'] = account.admin_id or ''

    if hasattr(account, 'support_level'):
        payload['support_level'] = account.support_level
        payload['support_level_display'] = account.get_support_level_display() if hasattr(account, 'get_support_level_display') else account.support_level

    if hasattr(account, 'specialization'):
        payload['specialization'] = account.specialization
        payload['specialization_display'] = account.get_specialization_display() if hasattr(account, 'get_specialization_display') else account.specialization

    if hasattr(account, 'manager_admin') and account.manager_admin:
        payload['manager_admin'] = {
            'id': str(account.manager_admin.id),
            'email': account.manager_admin.email,
            'full_name': account.manager_admin.get_full_name(),
        }
    else:
        payload['manager_admin'] = None

    from apps.core.models import WorkAssignment, SupportTicket
    if str(account.account_type) == 'STAFF':
        assigned_count = getattr(account, 'assigned_count', None)
        in_progress_count = getattr(account, 'in_progress_count', None)
        completed_count = getattr(account, 'completed_count', None)
        overdue_count = getattr(account, 'overdue_count', None)
        payload['workload'] = {
            'assigned': assigned_count if assigned_count is not None else WorkAssignment.objects.filter(assigned_to_staff_id=account.pk, status='ASSIGNED').count(),
            'in_progress': in_progress_count if in_progress_count is not None else WorkAssignment.objects.filter(assigned_to_staff_id=account.pk, status='IN_PROGRESS').count(),
            'completed': completed_count if completed_count is not None else WorkAssignment.objects.filter(assigned_to_staff_id=account.pk, status='COMPLETED').count(),
            'overdue': overdue_count if overdue_count is not None else WorkAssignment.objects.filter(assigned_to_staff_id=account.pk, status='ASSIGNED', due_at__lt=timezone.now()).count(),
        }
    else:
        payload['workload'] = None

    return payload


class MemberRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mobile_number = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default='')
    gender = serializers.ChoiceField(
        choices=Member.Gender.choices,
        error_messages={
            'required': 'Please select your gender.',
            'invalid_choice': 'Please select your gender.',
            'null': 'Please select your gender.',
            'blank': 'Please select your gender.'
        }
    )
    date_of_birth = serializers.DateField(required=True)
    accept_terms = serializers.BooleanField(required=True)

    profile_created_by = serializers.ChoiceField(
        choices=Member.ProfileCreatedBy.choices,
        required=False,
        allow_blank=True,
        allow_null=True
    )
    marital_status = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    religion = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mother_tongue = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    caste = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    highest_education = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    occupation = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    work_location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    about = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    terms_accepted_at = serializers.DateTimeField(required=False, allow_null=True)

    def _validate_name(self, value, field_name, required=True):
        if not value or not value.strip():
            if not required:
                return ""
            raise serializers.ValidationError(f"{field_name} is required.")
        value = " ".join(value.split())
        min_len = 2 if required else 1
        if len(value) < min_len:
            raise serializers.ValidationError(f"{field_name} must contain at least {min_len} character{'s' if min_len > 1 else ''}.")
        if len(value) > 50:
            raise serializers.ValidationError(f"{field_name} must contain at most 50 characters.")
        if not re.match(r"^[a-zA-Z\s'-]+$", value):
            raise serializers.ValidationError(f"{field_name} contains invalid characters.")
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError(f"{field_name} contains invalid characters.")
        return value

    def validate_first_name(self, value):
        return self._validate_name(value, "First name", required=True)

    def validate_last_name(self, value):
        return self._validate_name(value, "Last name", required=False)

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email address is required.")
        value = value.strip().lower()
        if " " in value:
            raise serializers.ValidationError("Email address cannot contain spaces.")
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", value):
            raise serializers.ValidationError("Enter a valid email address, for example name@gmail.com.")
        if Member.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email address is already registered.")
        return value

    def validate_mobile_number(self, value):
        if not value:
            raise serializers.ValidationError("Mobile number is required.")
        normalized = str(value).replace(" ", "").replace("-", "")
        if normalized.startswith("+91"):
            normalized = normalized[3:]
        elif normalized.startswith("91") and len(normalized) == 12:
            normalized = normalized[2:]

        if not normalized:
            raise serializers.ValidationError("Mobile number is required.")
        if not normalized.isdigit():
            raise serializers.ValidationError("Mobile number must contain digits only.")
        if len(normalized) != 10:
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        if len(set(normalized)) == 1:
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        if normalized[0] not in "6789":
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        
        if Member.objects.filter(mobile_number=normalized).exists():
            raise serializers.ValidationError("This mobile number is already registered.")
        return normalized

    def validate_date_of_birth(self, value):
        if not value:
            raise serializers.ValidationError("Date of birth is required.")
        today = timezone.localdate()
        if value > today:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError("You must be at least 18 years old to register.")
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the Terms of Service and Privacy Policy to continue.")
        return value

    def validate(self, data):
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        email = data.get('email', '')
        mobile_number = data.get('mobile_number', '')

        if not password:
            raise serializers.ValidationError({'password': ["Password is required."]})
        if not confirm_password:
            raise serializers.ValidationError({'confirm_password': ["Confirm your password."]})
        if password != confirm_password:
            raise serializers.ValidationError({'confirm_password': ["Passwords do not match."]})

        errors = []
        if len(password) < 8:
            errors.append("Password must contain at least 8 characters.")
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter.")
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter.")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number.")
        if not any(c in "!@#$%^&*()_+=-{}[]|\\:;\"'<>,.?/~`" for c in password):
            errors.append("Password must contain at least one special character.")

        if email and email in password:
            errors.append("Password must not contain your email address or mobile number.")
        if mobile_number and mobile_number in password:
            errors.append("Password must not contain your email address or mobile number.")

        if errors:
            raise serializers.ValidationError({'password': errors})

        try:
            validate_password(password)
        except ValidationError as exc:
            django_errors = []
            for msg in exc.messages:
                if "too common" in msg.lower() or "commonly used" in msg.lower():
                    django_errors.append("This password is too common. Choose a stronger password.")
                else:
                    django_errors.append(msg)
            raise serializers.ValidationError({'password': django_errors})

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        validated_data.pop('accept_terms', None)
        password = validated_data.pop('password')
        email = validated_data.pop('email')
        return create_member(email, password, **validated_data)


class MemberLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True)


class AdministrativeLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    otp = serializers.CharField(required=False, allow_blank=True, write_only=True)


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)


def validate_new_password_field(value):
    try:
        validate_password(value)
    except ValidationError as e:
        raise serializers.ValidationError(list(e.messages))
    return value


class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    code = serializers.CharField(max_length=10)
    new_password = serializers.CharField(write_only=True, validators=[validate_new_password_field])


class OtpRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    purpose = serializers.CharField(required=False, default='PHONE_VERIFY')


class OtpVerifySerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    code = serializers.CharField(max_length=10)
    purpose = serializers.CharField(required=False, default='PHONE_VERIFY')


class MemberProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, max_length=150)
    last_name = serializers.CharField(required=False, max_length=150, allow_blank=True)
    mobile_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.ChoiceField(choices=Member.Gender.choices, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    profile_created_by = serializers.ChoiceField(
        choices=Member.ProfileCreatedBy.choices, required=False, allow_blank=True
    )
    marital_status = serializers.CharField(required=False, allow_blank=True)
    height = serializers.CharField(required=False, allow_blank=True)
    weight = serializers.CharField(required=False, allow_blank=True)
    religion = serializers.CharField(required=False, allow_blank=True)
    mother_tongue = serializers.CharField(required=False, allow_blank=True)
    caste = serializers.CharField(required=False, allow_blank=True)
    highest_education = serializers.CharField(required=False, allow_blank=True)
    occupation = serializers.CharField(required=False, allow_blank=True)
    annual_income = serializers.CharField(required=False, allow_blank=True)
    work_location = serializers.CharField(required=False, allow_blank=True)
    family_location = serializers.CharField(required=False, allow_blank=True)
    family_type = serializers.CharField(required=False, allow_blank=True)
    family_status = serializers.CharField(required=False, allow_blank=True)
    blood_group = serializers.CharField(required=False, allow_blank=True)
    complexion = serializers.CharField(required=False, allow_blank=True)
    sub_caste = serializers.CharField(required=False, allow_blank=True)
    gothra = serializers.CharField(required=False, allow_blank=True)
    star_nakshatra = serializers.CharField(required=False, allow_blank=True)
    manglik_status = serializers.CharField(required=False, allow_blank=True)
    education_detail = serializers.CharField(required=False, allow_blank=True)
    employed_in = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)
    father_status = serializers.CharField(required=False, allow_blank=True)
    mother_status = serializers.CharField(required=False, allow_blank=True)
    num_brothers = serializers.IntegerField(required=False, min_value=0)
    num_sisters = serializers.IntegerField(required=False, min_value=0)
    about = serializers.CharField(required=False, allow_blank=True)
    hobbies = serializers.ListField(child=serializers.CharField(max_length=80), required=False)
    pref_age_min = serializers.IntegerField(required=False, min_value=18, max_value=100)
    pref_age_max = serializers.IntegerField(required=False, min_value=18, max_value=100)
    pref_height_min = serializers.CharField(required=False, allow_blank=True)
    pref_height_max = serializers.CharField(required=False, allow_blank=True)
    pref_religion = serializers.CharField(required=False, allow_blank=True)
    pref_caste = serializers.CharField(required=False, allow_blank=True)
    pref_location = serializers.CharField(required=False, allow_blank=True)
    pref_education = serializers.CharField(required=False, allow_blank=True)
    pref_occupation = serializers.CharField(required=False, allow_blank=True)
    pref_marital_status = serializers.CharField(required=False, allow_blank=True)
    pref_about = serializers.CharField(required=False, allow_blank=True)
    chat_public_key = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # Canonical aliases (spec names). Accepted in addition to the existing wire
    # names so neither spelling is silently dropped, and the API response also
    # exposes the canonical names. `source` renames the validated_data key so
    # `update_member` maps it to the correct model field.
    about_me = serializers.CharField(source='about', required=False, allow_blank=True)
    current_city = serializers.CharField(source='work_location', required=False, allow_blank=True)
    preferred_min_age = serializers.IntegerField(source='pref_age_min', required=False, min_value=18, max_value=100)
    preferred_max_age = serializers.IntegerField(source='pref_age_max', required=False, min_value=18, max_value=100)
    preferred_min_height = serializers.CharField(source='pref_height_min', required=False, allow_blank=True)
    preferred_max_height = serializers.CharField(source='pref_height_max', required=False, allow_blank=True)
    preferred_locations = serializers.CharField(source='pref_location', required=False, allow_blank=True)
    ideal_partner_description = serializers.CharField(source='pref_about', required=False, allow_blank=True)

    def validate_mobile_number(self, value):
        value = validate_mobile_number(value)
        member = self.context.get('member')
        if value and Member.objects.filter(mobile_number=value).exclude(pk=getattr(member, 'pk', None)).exists():
            raise serializers.ValidationError('A member with this mobile number already exists.')
        return value

    def validate(self, attrs):
        minimum = attrs.get('pref_age_min')
        maximum = attrs.get('pref_age_max')
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({'pref_age_min': 'Minimum age cannot exceed maximum age.'})
        # Reject unknown fields instead of silently dropping them. A field sent
        # under the wrong name (e.g. `about_me` instead of `about`) would
        # otherwise vanish without any error, which is the root cause of
        # "saved" values never reaching the database.
        unknown = set(self.initial_data.keys()) - set(self.fields.keys())
        if unknown:
            errors = {field: ['This field name is not supported.'] for field in sorted(unknown)}
            raise serializers.ValidationError(errors, code='UNKNOWN_PROFILE_FIELD')
        return attrs

    def update(self, instance, validated_data):
        return update_member(instance, **validated_data)


class MemberDocumentSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    can_delete = serializers.BooleanField(read_only=True)
    can_reupload = serializers.BooleanField(read_only=True)

    class Meta:
        model = MemberDocument
        fields = (
            'id', 'document_type', 'custom_document_name', 'display_name',
            'original_file_name', 'mime_type', 'file_size',
            'status', 'admin_comment', 'rejection_reason',
            'uploaded_at', 'reviewed_at',
            'can_delete', 'can_reupload',
        )


class AdminDocumentSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    member_id = serializers.UUIDField(read_only=True)
    member_name = serializers.SerializerMethodField()
    member_email = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = MemberDocument
        fields = (
            'id', 'member_id', 'member_name', 'member_email',
            'document_type', 'custom_document_name', 'display_name',
            'original_file_name', 'mime_type', 'file_size',
            'status', 'admin_comment', 'rejection_reason',
            'uploaded_at', 'reviewed_at', 'reviewed_by_id', 'reviewer_name',
            'updated_at',
        )

    def get_member_name(self, obj):
        return obj.member.get_full_name() or obj.member.email

    def get_member_email(self, obj):
        return obj.member.email

    def get_reviewer_name(self, obj):
        reviewer = obj.reviewed_by
        return reviewer.get_full_name() if reviewer else None


# Compatibility aliases for internal imports while all callers move to member terminology.
UserSerializer = MemberSerializer
UserRegistrationSerializer = MemberRegistrationSerializer
UserProfileUpdateSerializer = MemberProfileUpdateSerializer
