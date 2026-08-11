"""
Legacy views re-exported for backward compatibility.

This module imports all views from apps.core.old_views
(the original views.py file before refactoring) and re-exports
them for use in urls.py and other modules.
"""

# Import all views from the original views.py (now old_views.py module)
from ..old_views import (
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

__all__ = [
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
]
