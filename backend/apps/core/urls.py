from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .role_views import (
    AdminAccountApprovalsView,
    AdminAccountDetailView,
    AdminAccountListCreateView,
    AdminActivityListView,
    AdminStaffPerformanceAnalyticsView,
    AdminBackupListView,
    AdminAssigneeListView,
    AdminDashboardView,
    AdminComplaintDetailView,
    AdminComplaintListView,
    AdminEnquiryDetailView,
    AdminEnquiryListView,
    AdminFAQDetailView,
    AdminFAQListCreateView,
    AdminRolePermissionView,
    AdminUserPermissionsView,
    AdminPermissionAuditLogListView,
    AdminMembershipListView,
    AdminMemberSearchView,
    AdminMembershipRequestListView,
    AdminMembershipRequestDetailView,
    AdminDirectMembershipView,
    AdminPaymentListView,
    AdminPaymentDetailView,
    AdminPaymentRefundView,
    AdminRefundRequestApproveRejectView,
    AdminPaymentReconcileView,
    AdminProfileReportDetailView,
    AdminProfileReportListView,
    AdminReportExportView,
    AdminSettingsView,
    AdminSupportDashboardView,
    AdminSupportReportsView,
    AdminTicketDetailView,
    AdminTicketListView,
    AdminUserActionView,
    AdminUserListView,
    AdminGrantMembershipView,
    AdminVerificationDetailView,
    AdminVerificationListView,
    AdministrativeNotificationListView,
    StaffDashboardView,
    StaffVerificationDetailView,
    StaffVerificationListView,
    SuperAdminAdminListCreateView,
    
    # New administrative and workflow views
    SuperAdminAccountListCreateView,
    SuperAdminAccountDetailView,
    SuperAdminAccountActionView,
    SuperAdminAccountActivityView,
    AdminStaffListCreateView,
    AdminStaffDetailView,
    AdminStaffActionView,
    AdminStaffActivityView,
    AdminAssignWorkView,
    AdminAssignTicketView,
    AdminDuplicateFlagListView,
    StaffWorkListView,
    StaffWorkActionView,
    AdminEligibleStaffListView,
    AdminEligibleAgentsListView,
    AdminBulkReassignTicketView,
    AdminBulkReassignWorkView,
    AdminQueueListView,
    AdminAnalyticsDashboardView,
    SpecializationViewSet,
    QueueViewSet,
    AssignmentStrategyViewSet,
    EmployeeAvailabilityViewSet,
    WorkloadViewSet,
    AssignmentRuleViewSet,
    AssignmentAuditViewSet,
    SuperAdminMembershipPlanListCreateView,
    SuperAdminMembershipPlanDetailView,
    SuperAdminMembershipPlanActivateView,
    SuperAdminMembershipPlanDeactivateView,
)
from apps.accounts.presence_views import PresenceBulkView
from apps.accounts.document_admin_views import (
    AdminDocumentListView,
    AdminDocumentDetailView,
    AdminDocumentDownloadView,
    AdminDocumentPreviewView,
    AdminDocumentApproveView,
    AdminDocumentRejectView,
)

from .views import (
    CompatibilityCheckView,
    ContactEnquiryCreateView,
    ConversationListView,
    DatabaseHealthCheckView,
    FAQListView,
    HealthCheckView,
    InterestDetailView,
    InterestListCreateView,
    MemberNotificationListView,
    MemberNotificationReadView,
    MemberNotificationUnreadCountView,
    MembershipPlanListView,
    MessageHistoryView,
    PaymentHistoryView,
    ProfileDetailView,
    ProfileListView,
    ProfileVisitorListView,
    MemberComplaintListCreateView,
    MemberProfileReportCreateView,
    ProfileUnlockDailyUsageView,
    ProfileUnlockHistoryView,
    # New plan views
    PublicMembershipPlanListView,
    AdminMembershipPlanListCreateView,
    AdminMembershipPlanDetailView,
    AdminMembershipPlanToggleView,
)
from .views.support_views import (
    AdminTicketListPaginatedView,
    AdminTicketDetailView,
    AdminTicketActionView,
    AdminTicketReplyView,
    AdminTicketMessagesView,
    AdminTicketReadStateView,
    AdminQueueCountsView,
    AdminUnreadCountsView,
    AdminAuditLogListView,
    AdminAttachmentUploadView,
    AdminAttachmentDownloadView,
    AdminSupportDashboardView as NewAdminSupportDashboardView,
    MemberSupportTicketListCreateView,
    MemberSupportTicketDetailView,
    SupportCategoryListView,
    SupportAttachmentDownloadView,
)
from .views.membership_views import (
    PaymentOrderCreateView,
    PaymentVerifyView,
    PaymentOrderStatusView,
    PaymentHistoryView,
    PaymentReceiptView,
    PaymentRefundRequestView,
    PaymentRefundStatusView,
    RazorpayWebhookView,
    MembershipEntitlementsView,
)
from .views.admin_lifecycle_views import (
    AdminExpiringMembersListView,
    AdminContactExpiringMemberView,
    AdminExpiringMembersDashboardView,
    AdminNotificationDeliveryLogView,
)


urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('health/database/', DatabaseHealthCheckView.as_view(), name='database_health_check'),

    # Targeted presence lookup (no global broadcast).
    path('presence/bulk/', PresenceBulkView.as_view(), name='presence_bulk'),

    # Public membership plans endpoint
    path('membership-plans/', PublicMembershipPlanListView.as_view(), name='public_membership_plans'),
    
    # Keep legacy endpoint for backward compatibility
    # path('membership-plans/', MembershipPlanListView.as_view(), name='membership_plans'),
    # Verification endpoints are handled in apps.accounts.urls
    # Do not include verification_urls here to avoid namespace conflicts
    
    path('faqs/', FAQListView.as_view(), name='faqs'),
    path('support/categories/', SupportCategoryListView.as_view(), name='support_categories'),
    path('contact-enquiries/', ContactEnquiryCreateView.as_view(), name='contact_enquiry_create'),

    path('profiles/', ProfileListView.as_view(), name='profiles_list'),
    path('profiles/<uuid:pk>/', ProfileDetailView.as_view(), name='profile_detail'),
    path('profile-visitors/', ProfileVisitorListView.as_view(), name='profile_visitors'),
    path('interests/', InterestListCreateView.as_view(), name='interests_list'),
    path('interests/<uuid:pk>/', InterestDetailView.as_view(), name='interest_detail'),
    path('matchmaking/compatibility/', CompatibilityCheckView.as_view(), name='compatibility_check'),
    path('conversations/', ConversationListView.as_view(), name='conversations_list'),
    path('conversations/<uuid:user_id>/messages/', MessageHistoryView.as_view(), name='conversation_messages'),

    # Razorpay Payment Gateway integration endpoints
    path('payments/orders/', PaymentOrderCreateView.as_view(), name='payment_order_create'),
    path('payments/verify/', PaymentVerifyView.as_view(), name='payment_verify'),
    path('payments/orders/<uuid:id>/status/', PaymentOrderStatusView.as_view(), name='payment_order_status'),
    path('payments/history/', PaymentHistoryView.as_view(), name='payment_history'),
    path('payments/<uuid:id>/receipt/', PaymentReceiptView.as_view(), name='payment_receipt'),
    path('payments/<uuid:id>/refund-request/', PaymentRefundRequestView.as_view(), name='payment_refund_request'),
    path('payments/refunds/<uuid:id>/', PaymentRefundStatusView.as_view(), name='payment_refund_status'),
    path('payments/webhooks/razorpay/', RazorpayWebhookView.as_view(), name='razorpay_webhook'),
    path('member/entitlements/', MembershipEntitlementsView.as_view(), name='member_entitlements'),
    path('complaints/', MemberComplaintListCreateView.as_view(), name='member_complaints'),
    path('profile-reports/', MemberProfileReportCreateView.as_view(), name='member_profile_reports'),

    path('profile-unlocks/daily-usage/', ProfileUnlockDailyUsageView.as_view(), name='profile_unlock_daily_usage'),
    path('profile-unlocks/history/', ProfileUnlockHistoryView.as_view(), name='profile_unlock_history'),

    # ═══ Refactored Support API (v2) ═══
    path('support/categories/', SupportCategoryListView.as_view(), name='support_categories_v2'),
    path('support/tickets/', MemberSupportTicketListCreateView.as_view(), name='member_support_tickets_v2'),
    path('support/tickets/<uuid:ticket_id>/', MemberSupportTicketDetailView.as_view(), name='member_support_ticket_detail_v2'),
    path('support/attachments/<uuid:attachment_id>/download/', SupportAttachmentDownloadView.as_view(), name='support_attachment_download'),

    # Admin support API v2
    path('admin/support/tickets/', AdminTicketListPaginatedView.as_view(), name='admin_tickets_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/', AdminTicketDetailView.as_view(), name='admin_ticket_detail_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/action/', AdminTicketActionView.as_view(), name='admin_ticket_action_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/reply/', AdminTicketReplyView.as_view(), name='admin_ticket_reply_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/messages/', AdminTicketMessagesView.as_view(), name='admin_ticket_messages_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/read/', AdminTicketReadStateView.as_view(), name='admin_ticket_read_v2'),
    path('admin/support/tickets/<uuid:ticket_id>/attachments/', AdminAttachmentUploadView.as_view(), name='admin_ticket_attachment_v2'),
    path('admin/support/attachments/<uuid:attachment_id>/download/', AdminAttachmentDownloadView.as_view(), name='admin_attachment_download_v2'),
    path('admin/support/queue-counts/', AdminQueueCountsView.as_view(), name='admin_queue_counts_v2'),
    path('admin/support/unread-counts/', AdminUnreadCountsView.as_view(), name='admin_unread_counts_v2'),
    path('admin/support/audit-logs/', AdminAuditLogListView.as_view(), name='admin_audit_logs_v2'),
    path('admin/support/dashboard/', NewAdminSupportDashboardView.as_view(), name='admin_support_dashboard_v2'),

    # Legacy routes (also use new views for compatibility)
    path('support/categories/', SupportCategoryListView.as_view(), name='support_categories'),
    path('support/tickets/', MemberSupportTicketListCreateView.as_view(), name='member_support_tickets'),
    path('support/tickets/<uuid:ticket_id>/', MemberSupportTicketDetailView.as_view(), name='member_support_ticket_detail'),
    # Legacy alias using 'pk' for backward compat with old member page
    path('support/tickets/<uuid:pk>/', MemberSupportTicketDetailView.as_view(), name='member_support_ticket_detail_pk'),
    path('support/attachments/<uuid:attachment_id>/download/', SupportAttachmentDownloadView.as_view(), name='support_attachment_download'),
    path('notifications/', MemberNotificationListView.as_view(), name='member_notifications'),
    path('notifications/unread-count/', MemberNotificationUnreadCountView.as_view(), name='member_notifications_unread_count'),
    path('notifications/<uuid:pk>/read/', MemberNotificationReadView.as_view(), name='member_notification_read'),
    path('notifications/mark-all-read/', MemberNotificationReadView.as_view(), name='member_notifications_mark_all_read'),

    # Super Admin owns Admin accounts and critical permission policy.
    path('super-admin/dashboard/', AdminDashboardView.as_view(), name='super_admin_dashboard'),
    path('super-admin/admins/', SuperAdminAdminListCreateView.as_view(), name='super_admin_admins'),
    path('super-admin/admins/<uuid:account_id>/', AdminAccountDetailView.as_view(), name='super_admin_admin_detail'),
    path('super-admin/roles/', AdminRolePermissionView.as_view(), name='super_admin_roles'),
    path('super-admin/roles/<int:role_id>/', AdminRolePermissionView.as_view(), name='super_admin_role_detail'),
    path('super-admin/activity/', AdminActivityListView.as_view(), name='super_admin_activity'),
    path('super-admin/staff-performance/', AdminStaffPerformanceAnalyticsView.as_view(), name='super_admin_staff_performance'),
    
    # Canonical Super Admin membership-plans routes
    path('super-admin/membership-plans/', SuperAdminMembershipPlanListCreateView.as_view(), name='super_admin_membership_plans'),
    path('super-admin/membership-plans/<uuid:plan_id>/', SuperAdminMembershipPlanDetailView.as_view(), name='super_admin_membership_plan_detail'),
    path('super-admin/membership-plans/<uuid:plan_id>/activate/', SuperAdminMembershipPlanActivateView.as_view(), name='super_admin_membership_plan_activate'),
    path('super-admin/membership-plans/<uuid:plan_id>/deactivate/', SuperAdminMembershipPlanDeactivateView.as_view(), name='super_admin_membership_plan_deactivate'),
    
    
    # New Super Admin Accounts CRUD paths
    path('super-admin/accounts/', SuperAdminAccountListCreateView.as_view(), name='super_admin_accounts_list'),
    path('super-admin/accounts/<str:account_type>/<uuid:account_id>/', SuperAdminAccountDetailView.as_view(), name='super_admin_account_detail'),
    path('super-admin/accounts/<str:account_type>/<uuid:account_id>/<str:action>/', SuperAdminAccountActionView.as_view(), name='super_admin_account_action'),
    path('super-admin/accounts/<str:account_type>/<uuid:account_id>/activity/', SuperAdminAccountActivityView.as_view(), name='super_admin_account_activity'),

    # Admin document management APIs
    path('admin/documents/', AdminDocumentListView.as_view(), name='admin_documents'),
    path('admin/documents/<uuid:document_id>/', AdminDocumentDetailView.as_view(), name='admin_document_detail'),
    path('admin/documents/<uuid:document_id>/download/', AdminDocumentDownloadView.as_view(), name='admin_document_download'),
    path('admin/documents/<uuid:document_id>/preview/', AdminDocumentPreviewView.as_view(), name='admin_document_preview'),
    path('admin/documents/<uuid:document_id>/approve/', AdminDocumentApproveView.as_view(), name='admin_document_approve'),
    path('admin/documents/<uuid:document_id>/reject/', AdminDocumentRejectView.as_view(), name='admin_document_reject'),

    # Admin operational APIs. Super Admin may also enter these APIs explicitly.
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_users'),
    path('admin/users/<uuid:user_id>/', AdminUserActionView.as_view(), name='admin_user_action'),
    path('admin/users/<uuid:user_id>/grant-membership/', AdminGrantMembershipView.as_view(), name='admin_user_grant_membership'),
    path('admin/payments/', AdminPaymentListView.as_view(), name='admin_payments_list'),
    path('admin/payments/<uuid:id>/', AdminPaymentDetailView.as_view(), name='admin_payment_detail'),
    path('admin/payments/<uuid:id>/refund/', AdminPaymentRefundView.as_view(), name='admin_payment_refund'),
    path('admin/refund-requests/<uuid:id>/<str:action>/', AdminRefundRequestApproveRejectView.as_view(), name='admin_refund_request_action'),
    path('admin/payments/<uuid:id>/reconcile/', AdminPaymentReconcileView.as_view(), name='admin_payment_reconcile'),
    path('admin/members/search/', AdminMemberSearchView.as_view(), name='admin_member_search'),
    path('admin/memberships/', AdminMembershipListView.as_view(), name='admin_memberships'),
    path('admin/memberships/direct/', AdminDirectMembershipView.as_view(), name='admin_memberships_direct'),
    path('admin/memberships/direct', AdminDirectMembershipView.as_view(), name='admin_memberships_direct_noslash'),
    path('admin/membership-plans/', AdminMembershipPlanListCreateView.as_view(), name='admin_membership_plans'),
    path('admin/membership-plans/<uuid:plan_id>/', AdminMembershipPlanDetailView.as_view(), name='admin_membership_plan_detail'),
    path('admin/membership-plans/<uuid:plan_id>/toggle/', AdminMembershipPlanToggleView.as_view(), name='admin_membership_plan_toggle'),
    path('admin/accounts/', AdminAccountListCreateView.as_view(), name='admin_accounts'),
    path('admin/accounts/<uuid:account_id>/', AdminAccountDetailView.as_view(), name='admin_account_detail'),
    path('admin/accounts/<uuid:account_id>/approvals/', AdminAccountApprovalsView.as_view(), name='admin_account_approvals'),
    path('admin/roles/', AdminRolePermissionView.as_view(), name='admin_roles'),
    path('admin/roles/<int:role_id>/', AdminRolePermissionView.as_view(), name='admin_role_detail'),
    path('admin/activity/', AdminActivityListView.as_view(), name='admin_activity'),
    path('admin/staff-performance/', AdminStaffPerformanceAnalyticsView.as_view(), name='admin_staff_performance'),
    path('admin/user-permissions/<uuid:user_id>/', AdminUserPermissionsView.as_view(), name='admin_user_permissions'),
    path('admin/user-permissions/logs/', AdminPermissionAuditLogListView.as_view(), name='admin_user_permissions_logs'),
    path('admin/tickets/', AdminTicketListView.as_view(), name='admin_tickets'),
    path('admin/tickets/<uuid:ticket_id>/', AdminTicketDetailView.as_view(), name='admin_ticket_detail'),
    path('admin/assignees/', AdminAssigneeListView.as_view(), name='admin_assignees'),
    path('admin/enquiries/', AdminEnquiryListView.as_view(), name='admin_enquiries'),
    path('admin/enquiries/<uuid:enquiry_id>/', AdminEnquiryDetailView.as_view(), name='admin_enquiry_detail'),
    path('admin/complaints/', AdminComplaintListView.as_view(), name='admin_complaints'),
    path('admin/complaints/<uuid:complaint_id>/', AdminComplaintDetailView.as_view(), name='admin_complaint_detail'),
    path('admin/reported-profiles/', AdminProfileReportListView.as_view(), name='admin_reported_profiles'),
    path('admin/reported-profiles/<uuid:report_id>/', AdminProfileReportDetailView.as_view(), name='admin_reported_profile_detail'),
    path('admin/verifications/', AdminVerificationListView.as_view(), name='admin_verifications'),
    path('admin/verifications/<uuid:verification_id>/', AdminVerificationDetailView.as_view(), name='admin_verification_detail'),
    path('admin/faqs/', AdminFAQListCreateView.as_view(), name='admin_faqs'),
    path('admin/faqs/<uuid:item_id>/', AdminFAQDetailView.as_view(), name='admin_faq_detail'),
    path('admin/settings/', AdminSettingsView.as_view(), name='admin_settings'),
    path('admin/backups/', AdminBackupListView.as_view(), name='admin_backups'),
    
    # New Admin Specific Staff CRUD paths
    path('admin/staff/', AdminStaffListCreateView.as_view(), name='admin_staff_list'),
    path('admin/staff/<uuid:pk>/', AdminStaffDetailView.as_view(), name='admin_staff_detail'),
    path('admin/staff/<uuid:pk>/activity/', AdminStaffActivityView.as_view(), name='admin_staff_activity'),
    path('admin/staff/<uuid:pk>/<str:action>/', AdminStaffActionView.as_view(), name='admin_staff_action'),
    
    # New Work/Ticket Assignment paths
    path('admin/assign-work/', AdminAssignWorkView.as_view(), name='admin_assign_work'),
    path('admin/assign-ticket/', AdminAssignTicketView.as_view(), name='admin_assign_ticket'),
    path('admin/eligible-staff/', AdminEligibleStaffListView.as_view(), name='admin_eligible_staff'),
    path('admin/eligible-agents/', AdminEligibleAgentsListView.as_view(), name='admin_eligible_agents'),
    path('admin/assignments/bulk-reassign-tickets/', AdminBulkReassignTicketView.as_view(), name='admin_bulk_reassign_tickets'),
    path('admin/assignments/bulk-reassign-work/', AdminBulkReassignWorkView.as_view(), name='admin_bulk_reassign_work'),
    path('admin/queues/', AdminQueueListView.as_view(), name='admin_queues'),
    path('admin/analytics/dashboard/', AdminAnalyticsDashboardView.as_view(), name='admin_analytics_dashboard'),

    # Duplicate account detection flags
    path('admin/duplicate-flags/', AdminDuplicateFlagListView.as_view(), name='admin_duplicate_flags'),
    path('admin/duplicate-flags/<uuid:pk>/', AdminDuplicateFlagListView.as_view(), name='admin_duplicate_flag_detail'),

    # Staff and Customer Support have intentionally separate work queues.
    path('staff/dashboard/', StaffDashboardView.as_view(), name='staff_dashboard'),
    path('staff/verifications/', StaffVerificationListView.as_view(), name='staff_verifications'),
    path('staff/verifications/<uuid:verification_id>/', StaffVerificationDetailView.as_view(), name='staff_verification_detail'),
    path('staff/notifications/', AdministrativeNotificationListView.as_view(), name='staff_notifications'),
    
    # New Staff Work Assignment endpoints
    path('staff/my-work/', StaffWorkListView.as_view(), name='staff_my_work'),
    path('staff/work-action/', StaffWorkActionView.as_view(), name='staff_work_action'),


    # Compatibility aliases for the previous admin support screens.
    path('admin/support/dashboard/', AdminSupportDashboardView.as_view(), name='admin_support_dashboard'),
    path('admin/support/reports/', AdminSupportReportsView.as_view(), name='admin_support_reports'),
    path('admin/reports/export/', AdminReportExportView.as_view(), name='admin_reports_export'),
    path('admin/support/tickets/', AdminTicketListView.as_view(), name='admin_support_tickets'),
    path('admin/support/tickets/<uuid:ticket_id>/', AdminTicketDetailView.as_view(), name='admin_support_ticket_detail'),

    # Membership lifecycle admin endpoints
    path('admin/memberships/expiring/', AdminExpiringMembersListView.as_view(), name='admin_memberships_expiring'),
    path('admin/memberships/expiring/<uuid:membership_id>/contact/', AdminContactExpiringMemberView.as_view(), name='admin_memberships_expiring_contact'),
    path('admin/memberships/expiring/dashboard/', AdminExpiringMembersDashboardView.as_view(), name='admin_memberships_expiring_dashboard'),
    path('admin/memberships/notifications/', AdminNotificationDeliveryLogView.as_view(), name='admin_memberships_notifications'),
]

router = DefaultRouter()
router.register(r'specializations', SpecializationViewSet, basename='specializations')
router.register(r'queues', QueueViewSet, basename='queues')
router.register(r'assignment-strategies', AssignmentStrategyViewSet, basename='assignment-strategies')
router.register(r'employee-availabilities', EmployeeAvailabilityViewSet, basename='employee-availabilities')
router.register(r'workloads', WorkloadViewSet, basename='workloads')
router.register(r'assignment-rules', AssignmentRuleViewSet, basename='assignment-rules')
router.register(r'assignment-audits', AssignmentAuditViewSet, basename='assignment-audits')

urlpatterns += [
    path('admin/config/', include(router.urls)),
]
