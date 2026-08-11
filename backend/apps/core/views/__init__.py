"""
Views module for core app.

Exports views from submodules. Legacy views are in legacy_views.py
to avoid circular imports.
"""

from .membership_views import (
    MembershipSummaryView,
    MembershipDeactivateView,
)

from .plan_views import (
    PublicMembershipPlanListView,
    AdminMembershipPlanDetailView,
    AdminMembershipPlanToggleView,
    AdminMembershipPlanListCreateView,
)

from .legacy_views import (
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
    MemberSupportTicketDetailView,
    MemberSupportTicketListView,
    MembershipPlanListView,
    MessageHistoryView,
    PaymentHistoryView,
    ProfileDetailView,
    ProfileListView,
    ProfileVisitorListView,
    MemberComplaintListCreateView,
    MemberProfileReportCreateView,
    SupportAttachmentDownloadView,
    SupportCategoryListView,
    MemberMembershipRequestView,
    MemberMembershipRequestHistoryView,
    ProfileUnlockDailyUsageView,
    ProfileUnlockHistoryView,
)

# Import admin content views
from ..role_views import (
    AdminFAQDetailView,
    AdminFAQListCreateView,
)

__all__ = [
    # New views
    'MembershipSummaryView',
    'MembershipDeactivateView',
    'PublicMembershipPlanListView',
    'AdminMembershipPlanDetailView',
    'AdminMembershipPlanToggleView',
    'AdminMembershipPlanListCreateView',
    # Legacy views
    'CompatibilityCheckView',
    'ContactEnquiryCreateView',
    'ConversationListView',
    'DatabaseHealthCheckView',
    'FAQListView',
    'HealthCheckView',
    'InterestDetailView',
    'InterestListCreateView',
    'MemberNotificationListView',
    'MemberNotificationReadView',
    'MemberNotificationUnreadCountView',
    'MemberSupportTicketDetailView',
    'MemberSupportTicketListView',
    'MembershipPlanListView',
    'MessageHistoryView',
    'PaymentHistoryView',
    'ProfileDetailView',
    'ProfileListView',
    'ProfileVisitorListView',
    'MemberComplaintListCreateView',
    'MemberProfileReportCreateView',
    'SupportAttachmentDownloadView',
    'SupportCategoryListView',
    'MemberMembershipRequestView',
    'MemberMembershipRequestHistoryView',
    'ProfileUnlockDailyUsageView',
    'ProfileUnlockHistoryView',
    # Admin content views
    'AdminFAQDetailView',
    'AdminFAQListCreateView',
]



