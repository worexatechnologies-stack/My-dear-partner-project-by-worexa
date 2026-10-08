import logging
from datetime import date, datetime
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.views import APIView

from apps.accounts.models import Member, MemberAccountSettings
from apps.accounts.permissions import IsMember
from apps.accounts.lifecycle import deletion_days_remaining, request_member_deletion
from apps.accounts.security import clear_auth_cookies
from apps.accounts.audit import record_security_audit_event
from apps.core.responses import ApiErrorResponse, ApiResponse

logger = logging.getLogger(__name__)


def _get_or_create_settings(member):
    settings_obj, _ = MemberAccountSettings.objects.get_or_create(member=member)
    return settings_obj


class UserSettingsView(APIView):
    """
    GET /api/v1/settings/
    PATCH /api/v1/settings/
    
    Persist incognito, push, and email preferences per account.
    """
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        settings_obj = _get_or_create_settings(request.user)
        return ApiResponse(
            data={
                'incognito': request.user.is_hidden,
                'is_hidden': request.user.is_hidden,
                'push_notifications': settings_obj.push_notifications,
                'email_notifications': settings_obj.email_notifications,
                'notification_preferences': settings_obj.notification_preferences or {
                    'chat': True,
                    'interests': True,
                    'matches': True,
                    'promotions': False,
                },
                'updated_at': settings_obj.updated_at.isoformat() if settings_obj.updated_at else None,
            }
        )

    def patch(self, request):
        member = request.user
        settings_obj = _get_or_create_settings(member)
        data = request.data

        # Incognito / is_hidden
        if 'incognito' in data:
            member.is_hidden = bool(data['incognito'])
            member.save(update_fields=('is_hidden', 'updated_at'))
        elif 'is_hidden' in data:
            member.is_hidden = bool(data['is_hidden'])
            member.save(update_fields=('is_hidden', 'updated_at'))

        # Push / Email
        settings_updated = False
        if 'push_notifications' in data:
            settings_obj.push_notifications = bool(data['push_notifications'])
            settings_updated = True
        if 'email_notifications' in data:
            settings_obj.email_notifications = bool(data['email_notifications'])
            settings_updated = True
        if 'notification_preferences' in data and isinstance(data['notification_preferences'], dict):
            current = dict(settings_obj.notification_preferences or {})
            current.update(data['notification_preferences'])
            settings_obj.notification_preferences = current
            settings_updated = True

        if settings_updated:
            settings_obj.save()

        return ApiResponse(
            data={
                'incognito': member.is_hidden,
                'is_hidden': member.is_hidden,
                'push_notifications': settings_obj.push_notifications,
                'email_notifications': settings_obj.email_notifications,
                'notification_preferences': settings_obj.notification_preferences,
                'updated_at': settings_obj.updated_at.isoformat() if settings_obj.updated_at else None,
            },
            message='Settings updated successfully.'
        )


class UserPrivacySettingsView(APIView):
    """
    GET /api/v1/member-auth/privacy-settings/
    PATCH /api/v1/member-auth/privacy-settings/

    Enforce online-status and contact visibility per account.
    """
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        settings_obj = _get_or_create_settings(request.user)
        return ApiResponse(
            data={
                'show_online_status': settings_obj.show_online_status,
                'contact_visibility': settings_obj.contact_visibility,
                'photo_visibility': settings_obj.photo_visibility,
                'is_hidden': request.user.is_hidden,
                'updated_at': settings_obj.updated_at.isoformat() if settings_obj.updated_at else None,
            }
        )

    def patch(self, request):
        member = request.user
        settings_obj = _get_or_create_settings(member)
        data = request.data
        settings_updated = False

        if 'show_online_status' in data:
            settings_obj.show_online_status = bool(data['show_online_status'])
            settings_updated = True

        if 'contact_visibility' in data:
            val = str(data['contact_visibility']).strip().upper()
            if val in ('ALL', 'CONNECTED_ONLY', 'HIDDEN'):
                settings_obj.contact_visibility = val
                settings_updated = True

        if 'photo_visibility' in data:
            val = str(data['photo_visibility']).strip().upper()
            if val in ('ALL', 'CONNECTED_ONLY', 'APPROVED_MEMBERS'):
                settings_obj.photo_visibility = val
                settings_updated = True

        if 'is_hidden' in data:
            member.is_hidden = bool(data['is_hidden'])
            member.save(update_fields=('is_hidden', 'updated_at'))

        if settings_updated:
            settings_obj.save()

        return ApiResponse(
            data={
                'show_online_status': settings_obj.show_online_status,
                'contact_visibility': settings_obj.contact_visibility,
                'photo_visibility': settings_obj.photo_visibility,
                'is_hidden': member.is_hidden,
                'updated_at': settings_obj.updated_at.isoformat() if settings_obj.updated_at else None,
            },
            message='Privacy settings updated successfully.'
        )


class SafetyEligibilityView(APIView):
    """
    GET /api/v1/safety/eligibility/
    POST /api/v1/safety/eligibility/

    Validate adult DOB (18+) and consent, record policy version,
    and enforce eligibility on protected APIs/WebSockets.
    """
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def _calculate_age(self, born):
        if not born:
            return None
        today = timezone.localdate()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    def get(self, request):
        member = request.user
        settings_obj = _get_or_create_settings(member)
        age = self._calculate_age(member.date_of_birth)
        is_adult = (age is not None and age >= 18)
        has_consent = bool(member.terms_accepted_at or settings_obj.eligibility_consent)
        is_eligible = bool(
            is_adult
            and has_consent
            and member.account_status == Member.AccountStatus.ACTIVE
            and not member.deleted_at
        )

        return ApiResponse(
            data={
                'is_eligible': is_eligible,
                'is_adult': is_adult,
                'age': age,
                'date_of_birth': member.date_of_birth.isoformat() if member.date_of_birth else None,
                'consent_recorded': has_consent,
                'policy_version': settings_obj.eligibility_policy_version,
                'consented_at': (settings_obj.eligibility_consented_at or member.terms_accepted_at).isoformat() if (settings_obj.eligibility_consented_at or member.terms_accepted_at) else None,
                'account_status': member.account_status,
            }
        )

    def post(self, request):
        member = request.user
        settings_obj = _get_or_create_settings(member)
        data = request.data

        # 1. Validate DOB if provided
        dob_raw = data.get('date_of_birth') or data.get('dob')
        parsed_dob = None
        if dob_raw:
            try:
                if isinstance(dob_raw, str):
                    parsed_dob = datetime.strptime(dob_raw.strip(), '%Y-%m-%d').date()
                elif isinstance(dob_raw, date):
                    parsed_dob = dob_raw
            except ValueError:
                return ApiErrorResponse(
                    code='INVALID_DATE_FORMAT',
                    message='date_of_birth must be formatted as YYYY-MM-DD.',
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Use new DOB or existing DOB
        effective_dob = parsed_dob or member.date_of_birth
        if not effective_dob:
            return ApiErrorResponse(
                code='DOB_REQUIRED',
                message='Date of birth is required to confirm eligibility.',
                status=status.HTTP_400_BAD_REQUEST,
            )

        age = self._calculate_age(effective_dob)
        if age is None or age < 18:
            return ApiErrorResponse(
                code='UNDERAGE_INELIGIBLE',
                message='You must be at least 18 years of age to register and use My Dear Partner.',
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Consent check
        consent = data.get('consent', True)
        if not consent:
            return ApiErrorResponse(
                code='CONSENT_REQUIRED',
                message='You must accept the safety policy and terms of service.',
                status=status.HTTP_400_BAD_REQUEST,
            )

        policy_version = str(data.get('policy_version', 'v1.0')).strip()
        now = timezone.now()

        # Update member
        fields_to_update = ['terms_accepted_at', 'updated_at']
        member.terms_accepted_at = now
        if parsed_dob and member.date_of_birth != parsed_dob:
            member.date_of_birth = parsed_dob
            fields_to_update.append('date_of_birth')
        member.save(update_fields=fields_to_update)

        # Update settings
        settings_obj.eligibility_consent = True
        settings_obj.eligibility_policy_version = policy_version
        settings_obj.eligibility_consented_at = now
        settings_obj.save()

        record_security_audit_event('SAFETY_ELIGIBILITY_CONFIRMED', request=request, account=member)

        return ApiResponse(
            data={
                'is_eligible': True,
                'is_adult': True,
                'age': age,
                'date_of_birth': member.date_of_birth.isoformat(),
                'consent_recorded': True,
                'policy_version': policy_version,
                'consented_at': now.isoformat(),
                'account_status': member.account_status,
            },
            message='Eligibility and safety policy consent successfully recorded.'
        )


class SafetyAccountDeletionAliasView(APIView):
    """
    DELETE /api/v1/safety/account-deletion/
    GET /api/v1/safety/account-deletion/

    Alias for mobile/legacy compatibility mapping to member deletion.
    """
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        member = request.user
        return ApiResponse(
            data={
                'account_status': member.account_status,
                'is_deleted_pending': member.account_status == Member.AccountStatus.DELETION_PENDING,
                'recovery_until': member.recovery_until.isoformat() if member.recovery_until else None,
                'days_remaining': deletion_days_remaining(member),
                'is_hidden': member.is_hidden,
            }
        )

    def delete(self, request):
        member = request.user
        try:
            member = request_member_deletion(member=member)
        except ValueError as exc:
            return ApiResponse(success=False, message=str(exc), status=status.HTTP_409_CONFLICT)
        record_security_audit_event('MEMBER_ACCOUNT_DELETION_REQUESTED', request=request, account=member)
        response = ApiResponse(
            data={
                'account_status': member.account_status,
                'deleted_at': member.deleted_at.isoformat() if member.deleted_at else None,
                'recovery_until': member.recovery_until.isoformat() if member.recovery_until else None,
                'days_remaining': deletion_days_remaining(member),
            },
            message='Your account is scheduled for deletion. You can recover it within 30 days.',
        )
        return clear_auth_cookies(response)
