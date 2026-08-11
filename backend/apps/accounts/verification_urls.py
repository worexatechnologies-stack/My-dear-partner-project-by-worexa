"""
Clean Verification URL Configuration

Standardized verification API endpoints.
"""

from django.urls import path
from .verification_views import (
    # Member endpoints
    MemberVerificationStatusView,
    MemberEmailOtpSendView,
    MemberEmailOtpVerifyView,
    MemberMobileOtpSendView,
    MemberMobileOtpVerifyView,
    MemberProfileSubmitView,
    MemberPhotoSubmitView,
    MemberDocumentSubmitView,
    
    # Admin endpoints
    AdminVerificationListView,
    AdminVerificationDetailView,
    AdminVerificationApproveView,
    AdminVerificationRejectView,
    AdminVerificationRequestChangesView,
)

# Note: This file is kept for reference but not used directly.
# All patterns are included directly in urls.py to avoid namespace collision.

urlpatterns = [
    # Member verification endpoints
    path('status/', MemberVerificationStatusView.as_view(), name='member_status'),
    path('email/send-otp/', MemberEmailOtpSendView.as_view(), name='member_email_send_otp'),
    path('email/verify-otp/', MemberEmailOtpVerifyView.as_view(), name='member_email_verify_otp'),
    path('mobile/send-otp/', MemberMobileOtpSendView.as_view(), name='member_mobile_send_otp'),
    path('mobile/verify-otp/', MemberMobileOtpVerifyView.as_view(), name='member_mobile_verify_otp'),
    path('profile/', MemberProfileSubmitView.as_view(), name='member_profile_submit'),
    path('photo/', MemberPhotoSubmitView.as_view(), name='member_photo_submit'),
    path('government-id/', MemberDocumentSubmitView.as_view(), name='member_document_submit'),
    
    # Admin verification endpoints
    path('admin/', AdminVerificationListView.as_view(), name='admin_list'),
    path('admin/<uuid:verification_id>/', AdminVerificationDetailView.as_view(), name='admin_detail'),
    path('admin/<uuid:verification_id>/approve/', AdminVerificationApproveView.as_view(), name='admin_approve'),
    path('admin/<uuid:verification_id>/reject/', AdminVerificationRejectView.as_view(), name='admin_reject'),
    path('admin/<uuid:verification_id>/request-changes/', AdminVerificationRequestChangesView.as_view(), name='admin_request_changes'),
]