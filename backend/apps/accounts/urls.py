"""Member authentication endpoints.

The legacy ``/api/v1/auth/`` mount also points here during the frontend
transition, but it can authenticate members only.
"""

from django.urls import path, include

from .views import (
    MemberChangePasswordView,
    MemberDocumentDeleteView,
    MemberDocumentListCreateView,
    MemberDocumentReuploadView,
    MemberForgotPasswordView,
    MemberLoginView,
    MemberLogoutAllView,
    MemberLogoutView,
    MemberMeView,
    MemberOtpRequestView,
    MemberOtpVerifyView,
    MemberProfileSubmitView,
    MemberRefreshView,
    MemberRegisterView,
    MemberResetPasswordView,
    MemberVerificationStatusView,
    UserSessionsView,
)
from .verification_views import (
    MemberDocumentDownloadView,
    MemberDocumentPreviewView,
    MemberEmailOtpSendView,
    MemberEmailOtpVerifyView,
    MemberMobileOtpSendView,
    MemberMobileOtpVerifyView,
    MemberFirebaseMobileVerifyView,
    MemberPhotoSubmitView,
    MemberDocumentSubmitView,
    AdminVerificationListView,
    AdminVerificationDetailView,
    AdminVerificationApproveView,
    AdminVerificationRejectView,
    AdminVerificationRequestChangesView,
)
from apps.profiles.views import (
    ProfilePhotoDeleteView as MemberPhotoDeleteView,
    ProfilePhotoSetPrimaryView as MemberPhotoSetPrimaryView,
    ProfilePhotoUploadView as MemberPhotoUploadView,
)

# Import membership views from core app
from apps.core.views.membership_views import (
    MembershipSummaryView,
    MembershipDeactivateView,
)
from apps.core.views.lifecycle_views import (
    MembershipUpgradeView,
    AvailableUpgradesView,
    ActivateFreePlanView,
    CancelMembershipView,
    MembershipStatusDetailView,
)


app_name = 'member_auth'

urlpatterns = [
    path('register/', MemberRegisterView.as_view(), name='register'),
    path('login/', MemberLoginView.as_view(), name='login'),
    path('logout/', MemberLogoutView.as_view(), name='logout'),
    path('logout-all/', MemberLogoutAllView.as_view(), name='logout_all'),
    path('refresh/', MemberRefreshView.as_view(), name='refresh'),
    path('token/refresh/', MemberRefreshView.as_view(), name='token_refresh'),
    path('sessions/', UserSessionsView.as_view(), name='sessions'),
    path('sessions/<uuid:session_id>/', UserSessionsView.as_view(), name='session_detail'),
    path('me/', MemberMeView.as_view(), name='me'),
    path('me/submit/', MemberProfileSubmitView.as_view(), name='profile_submit'),
    path('me/documents/', MemberDocumentListCreateView.as_view(), name='member_documents'),
    path('me/documents/<uuid:document_id>/', MemberDocumentDeleteView.as_view(), name='member_document_delete'),
    path('me/documents/<uuid:document_id>/reupload/', MemberDocumentReuploadView.as_view(), name='member_document_reupload'),
    path('me/photos/', MemberPhotoUploadView.as_view(), name='member_photos_upload'),
    path('me/photos/<uuid:photo_id>/', MemberPhotoDeleteView.as_view(), name='member_photo_delete'),
    path('me/photos/<uuid:photo_id>/set-primary/', MemberPhotoSetPrimaryView.as_view(), name='member_photo_set_primary'),
    path('change-password/', MemberChangePasswordView.as_view(), name='change_password'),
    path('forgot-password/', MemberForgotPasswordView.as_view(), name='forgot_password'),
    path('reset-password/', MemberResetPasswordView.as_view(), name='reset_password'),
    path('otp/request/', MemberOtpRequestView.as_view(), name='otp_request'),
    path('otp/verify/', MemberOtpVerifyView.as_view(), name='otp_verify'),
    
    # Membership management endpoints
    path('membership/summary/', MembershipSummaryView.as_view(), name='membership_summary'),
    path('membership/deactivate/', MembershipDeactivateView.as_view(), name='membership_deactivate'),
    path('membership/upgrade/', MembershipUpgradeView.as_view(), name='membership_upgrade'),
    path('membership/available-upgrades/', AvailableUpgradesView.as_view(), name='membership_available_upgrades'),
    path('membership/activate-free/', ActivateFreePlanView.as_view(), name='membership_activate_free'),
    path('membership/cancel/', CancelMembershipView.as_view(), name='membership_cancel'),
    path('membership/status/', MembershipStatusDetailView.as_view(), name='membership_status_detail'),
    
    # Verification endpoints - Member
    path('verification/status/', MemberVerificationStatusView.as_view(), name='verification_status'),
    path('verification/email/send-otp/', MemberEmailOtpSendView.as_view(), name='verification_email_send_otp'),
    path('verification/email/verify-otp/', MemberEmailOtpVerifyView.as_view(), name='verification_email_verify_otp'),
    path('verification/mobile/send-otp/', MemberMobileOtpSendView.as_view(), name='verification_mobile_send_otp'),
    path('verification/mobile/verify-otp/', MemberMobileOtpVerifyView.as_view(), name='verification_mobile_verify_otp'),
    path('verification/mobile/verify-firebase/', MemberFirebaseMobileVerifyView.as_view(), name='verification_mobile_verify_firebase'),
    path('verification/profile/', MemberProfileSubmitView.as_view(), name='verification_profile_submit'),
    path('verification/photo/', MemberPhotoSubmitView.as_view(), name='verification_photo_submit'),
    path('verification/documents/<uuid:document_id>/download/', MemberDocumentDownloadView.as_view(), name='member_document_download'),
    path('verification/documents/<uuid:document_id>/preview/', MemberDocumentPreviewView.as_view(), name='member_document_preview'),
    path('verification/government-id/', MemberDocumentSubmitView.as_view(), name='verification_document_submit'),
    
    # Verification endpoints - Admin
    path('verification/admin/', AdminVerificationListView.as_view(), name='verification_admin_list'),
    path('verification/admin/<uuid:verification_id>/', AdminVerificationDetailView.as_view(), name='verification_admin_detail'),
    path('verification/admin/<uuid:verification_id>/approve/', AdminVerificationApproveView.as_view(), name='verification_admin_approve'),
    path('verification/admin/<uuid:verification_id>/reject/', AdminVerificationRejectView.as_view(), name='verification_admin_reject'),
    path('verification/admin/<uuid:verification_id>/request-changes/', AdminVerificationRequestChangesView.as_view(), name='verification_admin_request_changes'),
]
