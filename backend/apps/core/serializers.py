from pathlib import Path

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Member, MemberDocument, MemberPreference, MemberProfile
from apps.profiles.models import ProfilePhoto
from apps.profiles.photo_permissions import can_view_profile_photo
from apps.profiles.serializers import ProfilePhotoSerializer, photo_endpoint_urls

from .models import (
    AdminTicketReadState,
    ChatMessage,
    Complaint,
    ContactEnquiry,
    FAQ,
    Interest,
    MemberMembership,
    MembershipPlan,
    Notification,
    PaymentTransaction,
    ProfileReport,
    ProfileVerificationAssignment,
    ProfileVerificationHistory,
    ProfileVerificationRequest,
    SupportCategory,
    SupportTicket,
    SupportTicketAttachment,
    SupportTicketReply,
    TicketAuditLog,
    TicketFeedback,
    TicketInternalNote,
    TicketStatusHistory,
)


MAX_PRIVATE_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_ATTACHMENT_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
}
ALLOWED_ATTACHMENT_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt'}


def member_summary(member, *, include_contact=False):
    if member is None:
        return None
    result = {
        'id': str(member.pk),
        'full_name': member.get_full_name(),
        'first_name': member.first_name,
        'last_name': member.last_name,
    }
    if include_contact:
        result.update(email=member.email, mobile_number=getattr(member, 'mobile_number', ''))
        result['gender'] = getattr(member, 'gender', '')
        result['is_premium'] = getattr(member, 'is_premium', False)
        result['profile_status'] = getattr(member, 'profile_status', 'not_started')
        result['photo_status'] = getattr(member, 'photo_status', 'not_started')
        result['document_status'] = getattr(member, 'document_status', 'not_started')
        try:
            from apps.core.services.membership_service import MembershipService
            plan = MembershipService.get_effective_plan(member)
            result['active_plan'] = plan.name if plan else 'Free'
        except Exception:
            result['active_plan'] = 'Free'
    return result


def administrative_summary(account):
    if account is None:
        return None
    return {
        'id': str(account.pk),
        'full_name': account.get_full_name(),
        'email': account.email,
        'mobile_number': getattr(account, 'mobile_number', '') or '',
        'admin_id': getattr(account, 'admin_id', '') or '',
        'bio': getattr(account, 'bio', '') or '',
        'photo': getattr(account, 'photo', '') or '',
        'account_type': str(account.account_type),
        'role': account.admin_role_code,
    }


def validate_private_attachment(upload):
    if upload is None:
        return None
    if upload.size > MAX_PRIVATE_UPLOAD_SIZE:
        raise serializers.ValidationError('Attachments must be 10 MB or smaller.')
    extension = Path(upload.name).suffix.lower()
    if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise serializers.ValidationError('Unsupported attachment file type.')
    mime_type = (getattr(upload, 'content_type', '') or '').lower()
    if mime_type and mime_type not in ALLOWED_ATTACHMENT_MIME_TYPES and mime_type != 'application/octet-stream':
        raise serializers.ValidationError('Unsupported attachment MIME type.')
    return upload


class MembershipPlanSerializer(serializers.ModelSerializer):
    """Keep the admin-managed plan switches and runtime entitlements aligned."""

    def _synchronise_entitlements(self, validated_data):
        # The Super Admin editor stores feature choices in model columns while
        # runtime gates read the JSON entitlement map. Merge rather than
        # replace so custom keys are retained, but always update every gate
        # represented in the editor. This prevents stale JSON from silently
        # disabling a feature that the plan page promises.
        existing = getattr(self.instance, 'entitlements', None) or {}
        supplied = validated_data.get('entitlements') or {}
        entitlements = {**existing, **supplied}

        def value(field, default=None):
            if field in validated_data:
                return validated_data[field]
            return getattr(self.instance, field, default)

        # 1. Profile view limit synchronization (None or <0 = Unlimited)
        if 'profile_view_limit_daily' in validated_data:
            pv_limit = validated_data['profile_view_limit_daily']
            if pv_limit is not None and pv_limit < 0:
                pv_limit = None
            validated_data['profile_view_limit_daily'] = pv_limit
            validated_data['daily_profile_unlock_limit'] = pv_limit
        elif 'daily_profile_unlock_limit' in validated_data:
            pv_limit = validated_data['daily_profile_unlock_limit']
            if pv_limit is not None and pv_limit < 0:
                pv_limit = None
            validated_data['daily_profile_unlock_limit'] = pv_limit
            validated_data['profile_view_limit_daily'] = pv_limit
        else:
            pv_limit = getattr(self.instance, 'profile_view_limit_daily', getattr(self.instance, 'daily_profile_unlock_limit', 10))

        # 2. Interest limit synchronization (None or <0 = Unlimited)
        if 'interest_limit_daily' in validated_data:
            int_limit = validated_data['interest_limit_daily']
            if int_limit is not None and int_limit < 0:
                int_limit = None
            validated_data['interest_limit_daily'] = int_limit
            validated_data['interest_limit'] = int_limit
        elif 'interest_limit' in validated_data:
            int_limit = validated_data['interest_limit']
            if int_limit is not None and int_limit < 0:
                int_limit = None
            validated_data['interest_limit'] = int_limit
            validated_data['interest_limit_daily'] = int_limit
        else:
            int_limit = getattr(self.instance, 'interest_limit_daily', getattr(self.instance, 'interest_limit', 3))

        # 3. Message limit synchronization (None or <0 = Unlimited)
        msg_limit = value('message_limit_daily')
        if msg_limit is not None and msg_limit < 0:
            msg_limit = None
        if 'message_limit_daily' in validated_data:
            validated_data['message_limit_daily'] = msg_limit

        # 4. Messaging switches and mode synchronization
        can_msg = bool(value('can_message', False))
        if msg_limit is None or (isinstance(msg_limit, int) and msg_limit > 0):
            can_msg = True
            validated_data['can_message'] = True
            validated_data['messaging_mode'] = 'ENABLED'
            msg_mode = 'ENABLED'
        elif 'messaging_mode' in validated_data:
            msg_mode = validated_data['messaging_mode']
            if msg_mode != 'DISABLED':
                can_msg = True
                validated_data['can_message'] = True
        else:
            msg_mode = 'ENABLED' if can_msg else 'DISABLED'
            validated_data['messaging_mode'] = msg_mode

        # 5. Contact and photo modes
        contact_mode = value('contact_access_mode', 'NONE')
        can_contact = bool(value('can_view_contact', False) or contact_mode != 'NONE')
        validated_data['can_view_contact'] = can_contact
        validated_data['contact_access_mode'] = contact_mode

        photo_mode = value('photo_access_mode', 'PRIMARY_ONLY')
        if value('can_view_private_photos', False):
            photo_mode = 'ALL_APPROVED'
        validated_data['photo_access_mode'] = photo_mode

        # 6. Profile visitors limit (None or <0 = Unlimited)
        visitors_limit = value('profile_visitors_limit', 4)
        if visitors_limit is not None and visitors_limit < 0:
            visitors_limit = None
        if 'profile_visitors_limit' in validated_data:
            validated_data['profile_visitors_limit'] = visitors_limit
        if visitors_limit is None or (isinstance(visitors_limit, int) and visitors_limit > 0):
            validated_data['can_view_profile_visitors'] = True

        entitlements.update({
            'daily_profile_view_limit': pv_limit,
            'can_send_interest': bool(value('can_send_interest', True)),
            'daily_interest_limit': int_limit,
            'daily_message_limit': msg_limit,
            'can_chat': can_msg,
            'can_view_contact_details': can_contact,
            'profile_visibility_boost': bool(value('can_use_profile_boost', False) or value('profile_boost_level', 'NONE') != 'NONE'),
            'can_see_who_viewed_profile': bool(value('can_view_profile_visitors', False)),
            'profile_visitors_limit': visitors_limit,
            'can_view_received_interests': bool(value('can_view_received_interests', False)),
            'priority_support': value('support_priority', 'STANDARD') == 'HIGH',
            'max_photos': max(1, int((supplied.get('max_photos') if 'max_photos' in supplied else existing.get('max_photos', 6)) or 6)),
            'contact_access_mode': contact_mode,
            'photo_access_mode': photo_mode,
            'can_use_advanced_search': bool(value('can_use_advanced_search', False)),
            'can_view_full_profile': bool(value('can_view_full_profile', True)),
        })
        validated_data['can_view_full_profile'] = bool(value('can_view_full_profile', True))
        validated_data['entitlements'] = entitlements
        return validated_data

    def validate(self, attrs):
        return self._synchronise_entitlements(attrs)

    class Meta:
        model = MembershipPlan
        fields = '__all__'


class MemberMembershipSerializer(serializers.ModelSerializer):
    plan = MembershipPlanSerializer(read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_slug = serializers.CharField(source='plan.slug', read_only=True)

    class Meta:
        model = MemberMembership
        fields = (
            'id', 'member', 'plan', 'plan_name', 'plan_slug', 'start_date', 'end_date',
            'started_at', 'expires_at', 'is_active', 'status', 'created_at'
        )
        read_only_fields = ('id', 'member')



class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = '__all__'


class ContactEnquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactEnquiry
        fields = ('id', 'name', 'email', 'phone', 'subject', 'message', 'created_at')
        read_only_fields = ('id', 'created_at')


class MemberPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    is_demo = serializers.BooleanField(source='is_seed_data', read_only=True)
    age = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    photo_visibility = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
    height = serializers.SerializerMethodField()
    religion = serializers.SerializerMethodField()
    mother_tongue = serializers.SerializerMethodField()
    caste = serializers.SerializerMethodField()
    highest_education = serializers.SerializerMethodField()
    occupation = serializers.SerializerMethodField()
    annual_income = serializers.SerializerMethodField()
    work_location = serializers.SerializerMethodField()
    about = serializers.SerializerMethodField()
    family_type = serializers.SerializerMethodField()
    marital_status = serializers.SerializerMethodField()
    hobbies = serializers.SerializerMethodField()
    compatibility = serializers.SerializerMethodField()
    pref_about = serializers.SerializerMethodField()
    sub_caste = serializers.SerializerMethodField()
    gothra = serializers.SerializerMethodField()
    star_nakshatra = serializers.SerializerMethodField()
    manglik_status = serializers.SerializerMethodField()
    education_detail = serializers.SerializerMethodField()
    employed_in = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    father_status = serializers.SerializerMethodField()
    mother_status = serializers.SerializerMethodField()
    num_brothers = serializers.SerializerMethodField()
    num_sisters = serializers.SerializerMethodField()
    family_status = serializers.SerializerMethodField()
    family_location = serializers.SerializerMethodField()
    weight = serializers.SerializerMethodField()
    complexion = serializers.SerializerMethodField()
    blood_group = serializers.SerializerMethodField()
    profile_created_by = serializers.CharField(read_only=True)
    partner_preferences = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            'id', 'profile_slug', 'full_name', 'age', 'gender', 'is_demo', 'photo', 'photo_visibility', 'photos', 'is_verified', 'is_premium',
            'height', 'religion', 'mother_tongue', 'caste', 'highest_education',
            'occupation', 'annual_income', 'work_location', 'about', 'family_type',
            'marital_status', 'hobbies', 'compatibility', 'pref_about',
            'sub_caste', 'gothra', 'star_nakshatra', 'manglik_status', 'education_detail',
            'employed_in', 'company', 'father_status', 'mother_status', 'num_brothers',
            'num_sisters', 'family_status', 'family_location', 'weight', 'complexion',
            'blood_group', 'profile_created_by', 'partner_preferences',
            'chat_public_key',
        )

    def get_age(self, obj):
        if not obj.date_of_birth:
            return None
        today = timezone.localdate()
        born = obj.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    def _profile_value(self, obj, field, default=''):
        try:
            return getattr(obj.profile, field, default)
        except MemberProfile.DoesNotExist:
            return default

    def _get_viewer(self):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return request.user
        return None

    @staticmethod
    def _approved_photos(obj):
        """Use the existing byte-deferred prefetch for discovery results."""
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('profile_photos')
        if prefetched is not None:
            return sorted(
                (
                    photo
                    for photo in prefetched
                    if photo.status == ProfilePhoto.Status.APPROVED and not photo.is_deleted
                ),
                key=lambda photo: (photo.display_order, photo.created_at),
            )
        return list(
            ProfilePhoto.objects.active().without_binary()
            .filter(user=obj, status=ProfilePhoto.Status.APPROVED)
            .order_by('display_order', 'created_at')
        )

    def get_photo(self, obj):
        """Return a high-resolution photo endpoint, never image binary or a media URL."""
        approved = self._approved_photos(obj)
        photo = next((item for item in approved if item.is_primary), None)
        viewer = self._get_viewer()
        # Do not advertise a private endpoint that will reject the current
        # viewer. Discovery cards use the null value to show their neutral
        # placeholder instead of triggering noisy 403 thumbnail requests.
        if not photo or not can_view_profile_photo(viewer, photo):
            return None
        urls = photo_endpoint_urls(photo)
        return urls['image_url']

    def get_photo_visibility(self, obj):
        """Tell discovery clients why a profile card has no photo URL."""
        photos = getattr(obj, '_prefetched_objects_cache', {}).get('profile_photos')
        if photos is None:
            photos = ProfilePhoto.objects.active().without_binary().filter(user=obj)
        else:
            photos = [photo for photo in photos if not photo.is_deleted]
        if self.get_photo(obj):
            return 'visible'
        if any(photo.status == ProfilePhoto.Status.PENDING for photo in photos):
            return 'pending_approval'
        return 'unavailable'

    def get_photos(self, obj):
        """Return all approved photos visible to the authenticated member."""
        viewer = self._get_viewer()
        approved_photos = [
            photo for photo in self._approved_photos(obj)
            if can_view_profile_photo(viewer, photo)
        ]
        if viewer is None:
            return []  # Not authenticated — no photos in list context

        return [
            {
                'id': str(p.pk),
                'image_url': photo_endpoint_urls(p)['image_url'],
                'thumbnail_url': photo_endpoint_urls(p)['thumbnail_url'],
                'url': photo_endpoint_urls(p)['image_url'],  # legacy compat
                'is_primary': p.is_primary,
                'display_order': p.display_order,
            }
            for p in approved_photos
        ]

    def get_height(self, obj): return self._profile_value(obj, 'height')
    def get_religion(self, obj): return self._profile_value(obj, 'religion')
    def get_mother_tongue(self, obj): return self._profile_value(obj, 'mother_tongue')
    def get_caste(self, obj): return self._profile_value(obj, 'caste')
    def get_highest_education(self, obj): return self._profile_value(obj, 'highest_education')
    def get_occupation(self, obj): return self._profile_value(obj, 'occupation')
    def get_annual_income(self, obj): return self._profile_value(obj, 'annual_income')
    def get_work_location(self, obj): return self._profile_value(obj, 'work_location')
    def get_about(self, obj): return self._profile_value(obj, 'about')
    def get_family_type(self, obj): return self._profile_value(obj, 'family_type')
    def get_marital_status(self, obj): return self._profile_value(obj, 'marital_status')
    def get_hobbies(self, obj): return self._profile_value(obj, 'hobbies', [])
    def get_compatibility(self, obj): return self._profile_value(obj, 'compatibility', 0)

    def get_pref_about(self, obj):
        try:
            return obj.preferences.additional_expectations
        except MemberPreference.DoesNotExist:
            return ''

    def get_sub_caste(self, obj): return self._profile_value(obj, 'sub_caste')
    def get_gothra(self, obj): return self._profile_value(obj, 'gothra')
    def get_star_nakshatra(self, obj): return self._profile_value(obj, 'star_nakshatra')
    def get_manglik_status(self, obj): return self._profile_value(obj, 'manglik_status')
    def get_education_detail(self, obj): return self._profile_value(obj, 'education_detail')
    def get_employed_in(self, obj): return self._profile_value(obj, 'employed_in')
    def get_company(self, obj): return self._profile_value(obj, 'company')
    def get_father_status(self, obj): return self._profile_value(obj, 'father_status')
    def get_mother_status(self, obj): return self._profile_value(obj, 'mother_status')
    def get_num_brothers(self, obj): return self._profile_value(obj, 'num_brothers', 0)
    def get_num_sisters(self, obj): return self._profile_value(obj, 'num_sisters', 0)
    def get_family_status(self, obj): return self._profile_value(obj, 'family_status')
    def get_family_location(self, obj): return self._profile_value(obj, 'family_location')
    def get_weight(self, obj): return self._profile_value(obj, 'weight')
    def get_complexion(self, obj): return self._profile_value(obj, 'complexion')
    def get_blood_group(self, obj): return self._profile_value(obj, 'blood_group')

    def get_partner_preferences(self, obj):
        try:
            p = getattr(obj, 'preferences', None)
            if not p:
                return None
            return {
                'preferred_age_min': p.preferred_age_min,
                'preferred_age_max': p.preferred_age_max,
                'preferred_height_min': p.preferred_height_min,
                'preferred_height_max': p.preferred_height_max,
                'preferred_religion': p.preferred_religion,
                'preferred_caste': p.preferred_caste,
                'preferred_location': p.preferred_location,
                'preferred_education': p.preferred_education,
                'preferred_occupation': p.preferred_occupation,
                'preferred_marital_status': p.preferred_marital_status,
                'additional_expectations': p.additional_expectations,
            }
        except Exception:
            return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        viewer = self._get_viewer()
        if viewer is None:
            return data

        from apps.core.models import ProfileUnlock
        from apps.core.entitlement_service import MembershipEntitlementService
        from apps.core.entitlements import get_active_entitlements
        import zoneinfo
        kolkata_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        today = timezone.now().astimezone(kolkata_tz).date()

        data['is_unlocked'] = ProfileUnlock.objects.filter(
            viewer=viewer,
            profile=instance,
            usage_date=today
        ).exists()

        entitlements = get_active_entitlements(viewer)
        can_view_full = getattr(entitlements, 'can_view_full_profile', True)
        is_self = str(viewer.pk) == str(instance.pk)

        data['can_view_full_profile'] = can_view_full or is_self

        if not can_view_full and not is_self:
            # Plan has full bio disabled: mask in-depth background/preference details
            data['full_bio_locked'] = True
            data['sub_caste'] = None
            data['gothra'] = None
            data['star_nakshatra'] = None
            data['manglik_status'] = None
            data['education_detail'] = None
            data['company'] = None
            data['father_status'] = None
            data['mother_status'] = None
            data['num_brothers'] = None
            data['num_sisters'] = None
            data['family_status'] = None
            data['family_location'] = None
            data['partner_preferences'] = None
        else:
            data['full_bio_locked'] = False

        allowed, contact_mode = MembershipEntitlementService.can_view_contact(viewer, instance)
        if allowed:
            data['email'] = instance.email
            data['mobile_number'] = instance.mobile_number
        else:
            # Surface a plan-locked indicator instead of null to help the frontend
            if contact_mode == 'MUTUAL_ONLY':
                data['contact_locked'] = 'Accept each other\'s interest to unlock contact details.'
            else:
                data['contact_locked'] = 'Upgrade to Platinum or Elite to view contact details.'
        return data


class InterestMemberSerializer(serializers.ModelSerializer):
    """Fast, lightweight member serializer for interest feeds that avoids heavy N+1 checks."""
    id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(source='pk', read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    is_demo = serializers.BooleanField(source='is_seed_data', read_only=True)
    age = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    photo_visibility = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    primary_photo = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    is_premium = serializers.SerializerMethodField()
    height = serializers.SerializerMethodField()
    religion = serializers.SerializerMethodField()
    mother_tongue = serializers.SerializerMethodField()
    caste = serializers.SerializerMethodField()
    highest_education = serializers.SerializerMethodField()
    occupation = serializers.SerializerMethodField()
    annual_income = serializers.SerializerMethodField()
    work_location = serializers.SerializerMethodField()
    about = serializers.SerializerMethodField()
    family_type = serializers.SerializerMethodField()
    marital_status = serializers.SerializerMethodField()
    hobbies = serializers.SerializerMethodField()
    compatibility = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            'id', 'user_id', 'profile_slug', 'full_name', 'first_name', 'last_name',
            'age', 'gender', 'is_demo', 'photo', 'photo_visibility', 'photos',
            'primary_photo', 'is_verified', 'is_premium', 'height', 'religion',
            'mother_tongue', 'caste', 'highest_education', 'occupation',
            'annual_income', 'work_location', 'about', 'family_type',
            'marital_status', 'hobbies', 'compatibility',
        )

    def _profile_value(self, obj, field, default=''):
        try:
            return getattr(obj.profile, field, default)
        except Exception:
            return default

    def get_age(self, obj):
        if not obj.date_of_birth:
            return None
        today = timezone.localdate()
        born = obj.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    @staticmethod
    def _approved_photos(obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('profile_photos')
        if prefetched is not None:
            return sorted(
                (p for p in prefetched if p.status == ProfilePhoto.Status.APPROVED and not p.is_deleted),
                key=lambda p: (p.display_order, p.created_at),
            )
        return list(
            ProfilePhoto.objects.active().without_binary()
            .filter(user=obj, status=ProfilePhoto.Status.APPROVED)
            .order_by('display_order', 'created_at')
        )

    def get_photo(self, obj):
        photos = self._approved_photos(obj)
        p = next((x for x in photos if x.is_primary), None) or (photos[0] if photos else None)
        return photo_endpoint_urls(p)['image_url'] if p else None

    def get_primary_photo(self, obj):
        photos = self._approved_photos(obj)
        p = next((x for x in photos if x.is_primary), None) or (photos[0] if photos else None)
        if not p:
            return None
        urls = photo_endpoint_urls(p)
        return {'id': str(p.pk), 'image_url': urls['image_url'], 'thumbnail_url': urls['thumbnail_url']}

    def get_photos(self, obj):
        photos = self._approved_photos(obj)
        return [
            {
                'id': str(p.pk),
                'image_url': photo_endpoint_urls(p)['image_url'],
                'thumbnail_url': photo_endpoint_urls(p)['thumbnail_url'],
                'url': photo_endpoint_urls(p)['image_url'],
                'is_primary': p.is_primary,
                'display_order': p.display_order,
            }
            for p in photos
        ]

    def get_photo_visibility(self, obj):
        photos = self._approved_photos(obj)
        return 'visible' if photos else 'unavailable'

    def get_is_verified(self, obj):
        return bool(getattr(obj, 'is_verified', False) or getattr(obj, 'is_mobile_verified', False))

    def get_is_premium(self, obj):
        return bool(getattr(obj, 'is_premium', False))

    def get_height(self, obj): return self._profile_value(obj, 'height')
    def get_religion(self, obj): return self._profile_value(obj, 'religion')
    def get_mother_tongue(self, obj): return self._profile_value(obj, 'mother_tongue')
    def get_caste(self, obj): return self._profile_value(obj, 'caste')
    def get_highest_education(self, obj): return self._profile_value(obj, 'highest_education')
    def get_occupation(self, obj): return self._profile_value(obj, 'occupation')
    def get_annual_income(self, obj): return self._profile_value(obj, 'annual_income')
    def get_work_location(self, obj): return self._profile_value(obj, 'work_location')
    def get_about(self, obj): return self._profile_value(obj, 'about')
    def get_family_type(self, obj): return self._profile_value(obj, 'family_type')
    def get_marital_status(self, obj): return self._profile_value(obj, 'marital_status')
    def get_hobbies(self, obj): return self._profile_value(obj, 'hobbies', [])
    def get_compatibility(self, obj): return self._profile_value(obj, 'compatibility', 0)


class InterestSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    receiver = serializers.SerializerMethodField()

    class Meta:
        model = Interest
        fields = ('id', 'sender', 'receiver', 'status', 'created_at', 'updated_at')

    def get_sender(self, obj):
        return InterestMemberSerializer(obj.sender, context=self.context).data

    def get_receiver(self, obj):
        return InterestMemberSerializer(obj.receiver, context=self.context).data


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.UUIDField(read_only=True)
    receiver_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ('id', 'sender_id', 'receiver_id', 'text', 'is_read', 'created_at')


class SupportCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportCategory
        fields = ('id', 'code', 'name', 'description')


class SupportAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketAttachment
        fields = ('id', 'original_filename', 'mime_type', 'file_size', 'download_url', 'created_at')

    def get_download_url(self, obj):
        # Return a frontend-proxy path so the browser fetches it via Next.js,
        # which injects the Bearer token automatically — avoids 401 on direct requests.
        return f'/api/proxy/support/attachments/{obj.pk}/download/'


class SupportTicketReplySerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    sender = serializers.SerializerMethodField()
    is_internal_note = serializers.SerializerMethodField()
    attachments = SupportAttachmentSerializer(many=True, read_only=True)
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketReply
        fields = ('id', 'author', 'sender', 'message', 'is_public', 'is_internal_note', 'attachments', 'attachment', 'created_at', 'updated_at')

    def get_attachment(self, obj):
        first = obj.attachments.first()
        if not first:
            return None
        return f'/api/proxy/support/attachments/{first.pk}/download/'

    def get_author(self, obj):
        if obj.member_sender_id:
            return member_summary(obj.member_sender)
        if obj.admin_sender_id or obj.super_admin_sender_id:
            admin_obj = obj.admin_sender or obj.super_admin_sender
            is_for_member = self.context.get('for_member', False)
            if not is_for_member:
                request = self.context.get('request')
                if request and hasattr(request.user, 'account_type'):
                    is_for_member = str(request.user.account_type) == 'MEMBER'
            if is_for_member:
                return {
                    'id': str(admin_obj.pk) if admin_obj else '',
                    'full_name': 'Support Team',
                    'email': '',
                    'account_type': 'ADMIN',
                }
            return administrative_summary(admin_obj)
        return None

    def get_sender(self, obj):
        return self.get_author(obj)

    def get_is_internal_note(self, _obj):
        return False


class TicketInternalNoteSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = TicketInternalNote
        fields = ('id', 'author', 'note', 'created_at', 'updated_at')

    def get_author(self, obj):
        return administrative_summary(obj.admin or obj.super_admin)


class TicketStatusHistorySerializer(serializers.ModelSerializer):
    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = TicketStatusHistory
        fields = ('id', 'old_status', 'new_status', 'changed_by', 'reason', 'created_at')

    def get_changed_by(self, obj):
        if obj.changed_by_member_id:
            return member_summary(obj.changed_by_member)
        return administrative_summary(
            obj.changed_by_admin or obj.changed_by_super_admin
        )


class TicketListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for paginated ticket lists - NO full replies."""
    user = serializers.SerializerMethodField()
    category = serializers.CharField(source='category.code', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    assigned_to = serializers.SerializerMethodField()
    message = serializers.CharField(source='description', read_only=True)
    reply_count = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    has_attachments = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    claimed_by = serializers.SerializerMethodField()
    resolved_by = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = (
            'id', 'ticket_number', 'user', 'category', 'category_name',
            'subject', 'message', 'priority', 'status', 'source',
            'assigned_to', 'related_payment_id',
            'first_response_at', 'resolved_at', 'closed_at',
            'last_reply_at', 'reply_count', 'last_message_preview',
            'has_attachments', 'is_overdue',
            'sla_deadline', 'reopened_count', 'claimed_by', 'resolved_by',
            'created_at', 'updated_at',
        )

    def get_user(self, obj):
        return member_summary(obj.member, include_contact=False)

    def get_assigned_to(self, obj):
        return administrative_summary(obj.claimed_by_admin or obj.claimed_by_super_admin)

    def get_reply_count(self, obj):
        return getattr(obj, 'reply_count_cache', obj.replies.count())

    def get_last_message_preview(self, obj):
        last = getattr(obj, '_last_reply', None)
        if last:
            return last[:200]
        return ''

    def get_has_attachments(self, obj):
        return getattr(obj, '_attachment_count', 0) > 0

    def get_is_overdue(self, obj):
        if obj.sla_deadline and obj.status in (
            SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
            SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED,
        ):
            return obj.sla_deadline < timezone.now()
        return False

    def get_claimed_by(self, obj):
        if getattr(obj, 'claimed_by_super_admin', None):
            return administrative_summary(obj.claimed_by_super_admin)
        if getattr(obj, 'claimed_by_admin', None):
            return administrative_summary(obj.claimed_by_admin)
        if getattr(obj, 'claimed_by_support', None):
            return administrative_summary(obj.claimed_by_support)
        return None

    def get_resolved_by(self, obj):
        if getattr(obj, 'resolved_by_super_admin', None):
            return administrative_summary(obj.resolved_by_super_admin)
        if getattr(obj, 'resolved_by_admin', None):
            return administrative_summary(obj.resolved_by_admin)
        if getattr(obj, 'resolved_by_support', None):
            return administrative_summary(obj.resolved_by_support)
        return None


class SupportTicketSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    member = serializers.SerializerMethodField()
    category = serializers.CharField(source='category.code', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    assigned_to = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    message = serializers.CharField(source='description', read_only=True)
    reply_count = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    internal_notes = serializers.SerializerMethodField()
    status_history = TicketStatusHistorySerializer(many=True, read_only=True)
    attachments = SupportAttachmentSerializer(many=True, read_only=True)
    attachment = serializers.SerializerMethodField()
    claimed_by = serializers.SerializerMethodField()
    resolved_by = serializers.SerializerMethodField()
    closed_by = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    audit_logs = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = (
            'id', 'ticket_number', 'user', 'member', 'category', 'category_name',
            'subject', 'description', 'message', 'priority', 'status', 'source',
            'assigned_to', 'created_by', 'related_payment_id',
            'related_profile_id', 'first_response_at', 'resolved_at', 'closed_at',
            'last_reply_at', 'sla_deadline', 'reopened_count', 'resolution_summary',
            'version', 'claimed_by', 'resolved_by', 'closed_by', 'is_overdue',
            'reply_count', 'replies', 'internal_notes', 'status_history',
            'attachments', 'attachment', 'audit_logs', 'created_at', 'updated_at',
        )

    def get_attachment(self, obj):
        first = obj.attachments.filter(reply__isnull=True).first()
        if not first:
            return None
        return f'/api/proxy/support/attachments/{first.pk}/download/'

    def get_user(self, obj):
        return member_summary(obj.member, include_contact=self.context.get('include_contact', False))

    def get_member(self, obj):
        return self.get_user(obj)

    def get_assigned_to(self, obj):
        return administrative_summary(obj.claimed_by_admin or obj.claimed_by_super_admin)

    def get_created_by(self, obj):
        if obj.created_by_member_id:
            return member_summary(obj.created_by_member)
        return None

    def get_reply_count(self, obj):
        return obj.replies.filter(is_public=True).count()

    def get_replies(self, obj):
        if not self.context.get('include_replies'):
            return []
        replies = obj.replies.filter(is_public=True).select_related(
            'member_sender', 'admin_sender', 'super_admin_sender'
        )
        return SupportTicketReplySerializer(replies, many=True, context=self.context).data

    def get_internal_notes(self, obj):
        if not self.context.get('include_notes'):
            return []
        notes = obj.internal_notes.all().select_related('admin', 'super_admin')
        return TicketInternalNoteSerializer(notes, many=True).data

    def get_claimed_by(self, obj):
        if obj.claimed_by_super_admin:
            return administrative_summary(obj.claimed_by_super_admin)
        if obj.claimed_by_admin:
            return administrative_summary(obj.claimed_by_admin)
        return None

    def get_resolved_by(self, obj):
        if obj.resolved_by_super_admin:
            data = administrative_summary(obj.resolved_by_super_admin)
        elif obj.resolved_by_admin:
            data = administrative_summary(obj.resolved_by_admin)
        elif obj.resolver_name:
            data = {
                'id': str(obj.resolver_id) if obj.resolver_id else '',
                'full_name': obj.resolver_name,
                'email': obj.resolver_email,
                'mobile_number': obj.resolver_phone,
                'admin_id': obj.resolver_custom_id,
            }
        else:
            return None

        if obj.resolver_email and not data.get('email'):
            data['email'] = obj.resolver_email
        if obj.resolver_phone and not data.get('mobile_number'):
            data['mobile_number'] = obj.resolver_phone
        if obj.resolver_custom_id and not data.get('admin_id'):
            data['admin_id'] = obj.resolver_custom_id
        return data

    def get_closed_by(self, obj):
        if obj.closed_by_super_admin:
            return administrative_summary(obj.closed_by_super_admin)
        if obj.closed_by_admin:
            return administrative_summary(obj.closed_by_admin)
        return None

    def get_is_overdue(self, obj):
        if obj.sla_deadline and obj.status in (
            SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
            SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED,
        ):
            return obj.sla_deadline < timezone.now()
        return False

    def get_audit_logs(self, obj):
        if not self.context.get('include_audit'):
            return []
        logs = obj.audit_logs.all()[:50]
        return TicketAuditLogSerializer(logs, many=True).data


class TicketAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketAuditLog
        fields = (
            'id', 'action', 'actor_id', 'actor_name', 'actor_role',
            'old_value', 'new_value', 'reason', 'ip_address', 'created_at',
        )


class AdminTicketReadStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminTicketReadState
        fields = ('admin_id', 'admin_type', 'ticket_id', 'last_read_message_id', 'last_read_at', 'unread_count')


class TicketActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[
        'resolve', 'reopen', 'close',
    ])
    summary = serializers.CharField(required=False, allow_blank=True, default='')
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class MemberTicketCreateSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=50, default='GENERAL')
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    priority = serializers.CharField(required=False, default='NORMAL')
    attachment = serializers.FileField(required=False, allow_null=True, validators=[validate_private_attachment])

    def validate_attachment(self, value):
        if not value or isinstance(value, str):
            return None
        return value

    def validate_priority(self, value):
        val = str(value or 'NORMAL').upper()
        if val not in dict(SupportTicket.Priority.choices):
            return SupportTicket.Priority.NORMAL
        return val

    def validate_category(self, value):
        return str(value or 'GENERAL').upper()

    def validate(self, attrs):
        subject = str(attrs.get('subject') or self.initial_data.get('subject') or '').strip()
        description = str(attrs.get('description') or self.initial_data.get('description') or '').strip()
        if not subject:
            raise serializers.ValidationError({'subject': 'Subject is required.'})
        if not description:
            raise serializers.ValidationError({'description': 'Description is required.'})
        attrs['subject'] = subject
        attrs['description'] = description
        return attrs


class TicketReplyInputSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, default='')
    attachment = serializers.FileField(required=False, allow_null=True, validators=[validate_private_attachment])

    def validate_attachment(self, value):
        if not value or isinstance(value, str):
            return None
        return value

    def validate(self, attrs):
        msg = attrs.get('message') or self.initial_data.get('text') or self.initial_data.get('reply') or ''
        clean_msg = str(msg).strip()
        has_file = bool(attrs.get('attachment') or self.initial_data.get('attachment') or self.initial_data.get('file'))
        if not clean_msg and not has_file:
            raise serializers.ValidationError({'message': 'Message text or attachment file is required.'})
        attrs['message'] = clean_msg
        return attrs


class TicketFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketFeedback
        fields = ('id', 'rating', 'feedback_text', 'created_at')
        read_only_fields = ('id', 'created_at')


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id', 'notification_type', 'title', 'message', 'link_url', 'related_object_type',
            'related_object_id', 'priority', 'is_read', 'read_at', 'created_at',
        )


class WebPushSubscriptionInputSerializer(serializers.Serializer):
    """Validate browser Push API data without exposing stored device keys."""

    endpoint = serializers.URLField(max_length=2048)
    p256dh = serializers.CharField(max_length=255, write_only=True)
    auth = serializers.CharField(max_length=255, write_only=True)

    def validate_endpoint(self, value):
        if not value.startswith('https://'):
            raise serializers.ValidationError('Push subscriptions must use an HTTPS endpoint.')
        return value


class PaymentSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='payment_order.membership_plan.name', read_only=True)
    client_reference = serializers.CharField(source='payment_order.internal_order_number', read_only=True)
    gateway_reference = serializers.CharField(source='razorpay_payment_id', read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = (
            'id', 'plan_name', 'client_reference', 'amount', 'currency',
            'status', 'gateway_reference', 'created_at', 'updated_at',
        )


class VerificationAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_staff = serializers.SerializerMethodField()

    class Meta:
        model = ProfileVerificationAssignment
        fields = ('id', 'assigned_to_staff', 'assigned_at', 'completed_at', 'is_current')

    def get_assigned_to_staff(self, obj):
        return administrative_summary(obj.assigned_to_staff)


class VerificationHistorySerializer(serializers.ModelSerializer):
    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = ProfileVerificationHistory
        fields = ('id', 'old_status', 'new_status', 'changed_by', 'reason', 'created_at')

    def get_changed_by(self, obj):
        return administrative_summary(
            obj.changed_by_staff or obj.changed_by_admin or obj.changed_by_super_admin
        )


class ProfileVerificationSerializer(serializers.ModelSerializer):
    member = serializers.SerializerMethodField()
    current_assignment = serializers.SerializerMethodField()
    profile_photos = serializers.SerializerMethodField()
    verification_documents = serializers.SerializerMethodField()
    history = VerificationHistorySerializer(many=True, read_only=True)
    photo_status = serializers.SerializerMethodField()
    document_status = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    has_document = serializers.SerializerMethodField()
    has_bio = serializers.SerializerMethodField()
    is_ready = serializers.SerializerMethodField()
    pending_document = serializers.SerializerMethodField()
    pending_photo = serializers.SerializerMethodField()

    class Meta:
        model = ProfileVerificationRequest
        fields = (
            'id', 'member', 'verification_type', 'status', 'priority',
            'submitted_at', 'reviewed_at', 'approved_at', 'rejected_at',
            'rejection_reason', 'escalation_reason', 'current_assignment',
            'profile_photos', 'verification_documents', 'history', 'created_at', 'updated_at',
            'photo_status', 'document_status', 'has_photo', 'has_document', 'has_bio',
            'is_ready', 'pending_document', 'pending_photo',
        )

    def get_member(self, obj):
        return member_summary(obj.member, include_contact=True)

    def get_current_assignment(self, obj):
        assignment = obj.assignments.filter(is_current=True).select_related('assigned_to_staff').first()
        return VerificationAssignmentSerializer(assignment).data if assignment else None

    def get_photo_status(self, obj):
        return getattr(obj.member, 'photo_status', 'not_started') if obj.member else 'not_started'

    def get_document_status(self, obj):
        return getattr(obj.member, 'document_status', 'not_started') if obj.member else 'not_started'

    def get_has_photo(self, obj):
        if not obj.member:
            return False
        return (
            getattr(obj.member, 'photo_status', '') == 'approved'
            or ProfilePhoto.objects.active().filter(user_id=obj.member_id, status=ProfilePhoto.Status.APPROVED).exists()
        )

    def get_has_document(self, obj):
        if not obj.member:
            return False
        return (
            getattr(obj.member, 'document_status', '') == 'approved'
            or MemberDocument.objects.filter(member_id=obj.member_id, status=MemberDocument.Status.APPROVED).exists()
        )

    def get_has_bio(self, obj):
        if not obj.member:
            return False
        profile = getattr(obj.member, 'profile', None)
        bio = str(getattr(profile, 'about', '') or getattr(obj.member, 'about_me', '') or '').strip()
        return len(bio) >= 5

    def get_is_ready(self, obj):
        return self.get_has_photo(obj) and self.get_has_document(obj) and self.get_has_bio(obj)

    def get_pending_document(self, obj):
        if not obj.member:
            return None
        doc = MemberDocument.objects.filter(member_id=obj.member_id, status=MemberDocument.Status.PENDING).order_by('-uploaded_at').first()
        if doc:
            return {
                'id': str(doc.id),
                'document_type': doc.document_type,
                'status': doc.status,
            }
        return None

    def get_pending_photo(self, obj):
        if not obj.member:
            return None
        photo = ProfilePhoto.objects.active().filter(user_id=obj.member_id, status=ProfilePhoto.Status.PENDING).order_by('-created_at').first()
        if photo:
            return {
                'id': str(photo.id),
                'status': photo.status,
            }
        return None

    def get_profile_photos(self, obj):
        """Expose binary-free, actionable photos on photo-verification work only."""
        if obj.verification_type != ProfileVerificationRequest.VerificationType.PROFILE_PHOTO:
            return []
        base = ProfilePhoto.objects.active().without_binary().filter(user_id=obj.member_id)
        if obj.status in {
            ProfileVerificationRequest.Status.PENDING_REVIEW,
            ProfileVerificationRequest.Status.IN_REVIEW,
            ProfileVerificationRequest.Status.CHANGES_REQUESTED,
        }:
            photos = base.filter(status=ProfilePhoto.Status.PENDING).order_by('-is_primary', 'display_order', 'created_at')
            if not photos.exists():
                photos = base.order_by('-is_primary', 'display_order', 'created_at')
        elif obj.status == ProfileVerificationRequest.Status.APPROVED:
            photos = base.filter(status=ProfilePhoto.Status.APPROVED).order_by('-is_primary', 'display_order', 'created_at')
            if not photos.exists():
                photos = base.order_by('-is_primary', 'display_order', 'created_at')
        elif obj.status == ProfileVerificationRequest.Status.REJECTED:
            photos = base.filter(status=ProfilePhoto.Status.REJECTED).order_by('-is_primary', 'display_order', 'created_at')
            if not photos.exists():
                photos = base.order_by('-is_primary', 'display_order', 'created_at')
        else:
            photos = base.order_by('-is_primary', 'display_order', 'created_at')
        return ProfilePhotoSerializer(photos, many=True, context=self.context).data

    def get_verification_documents(self, obj):
        """Return only documents explicitly attached to this document review."""
        if obj.verification_type != ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT:
            return []
        from apps.accounts.serializers import MemberDocumentSerializer

        documents = [link.member_document for link in obj.verification_documents.select_related('member_document')]
        return MemberDocumentSerializer(documents, many=True, context=self.context).data


class MemberComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('id', 'subject', 'description', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'status', 'created_at', 'updated_at')


class MemberProfileReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileReport
        fields = ('id', 'reported_member', 'reason', 'details', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'status', 'created_at', 'updated_at')
