from datetime import timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework import permissions
from django.utils import timezone

from apps.core.responses import ApiResponse
from apps.core.services.membership_lifecycle_service import MembershipLifecycleService
from apps.core.models import NotificationDeliveryLog, SupportExpiringMembership, MemberMembership


class AdminExpiringMembersListView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        members = MembershipLifecycleService.get_expiring_members_for_support(days)
        return ApiResponse(data={
            'expiring_members': members,
            'total': len(members),
            'days_threshold': days,
        })


class AdminContactExpiringMemberView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    def post(self, request, membership_id):
        membership = MemberMembership.objects.filter(pk=membership_id).first()
        if not membership:
            return ApiResponse(success=False, message='Membership not found.', status=status.HTTP_404_NOT_FOUND)

        tracking, _ = SupportExpiringMembership.objects.get_or_create(membership=membership)
        tracking.contact_status = SupportExpiringMembership.ContactStatus.CONTACTED
        tracking.assigned_agent_id = request.user.pk
        tracking.assigned_agent_name = request.user.get_full_name() or request.user.email
        tracking.contacted_at = timezone.now()
        tracking.last_contacted_at = tracking.contacted_at
        if request.data.get('notes'):
            tracking.follow_up_notes = request.data.get('notes')
        tracking.save()

        return ApiResponse(success=True, message='Contact logged.', data={'contact_status': tracking.contact_status})


class AdminExpiringMembersDashboardView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        now = timezone.now()
        expiry_counts = {
            'expiring_30_days': MemberMembership.objects.filter(is_active=True, status__in=['ACTIVE', 'EXPIRING_SOON'], expires_at__lte=now + timedelta(days=30), expires_at__gt=now).count(),
            'expiring_14_days': MemberMembership.objects.filter(is_active=True, status__in=['ACTIVE', 'EXPIRING_SOON'], expires_at__lte=now + timedelta(days=14), expires_at__gt=now).count(),
            'expiring_7_days': MemberMembership.objects.filter(is_active=True, status__in=['ACTIVE', 'EXPIRING_SOON'], expires_at__lte=now + timedelta(days=7), expires_at__gt=now).count(),
            'expiring_3_days': MemberMembership.objects.filter(is_active=True, status__in=['ACTIVE', 'EXPIRING_SOON'], expires_at__lte=now + timedelta(days=3), expires_at__gt=now).count(),
            'expiring_today': MemberMembership.objects.filter(is_active=True, status__in=['ACTIVE', 'EXPIRING_SOON'], expires_at__lte=now).count(),
            'total_active': MemberMembership.objects.filter(is_active=True, status='ACTIVE').count(),
        }

        contacted_count = SupportExpiringMembership.objects.filter(contact_status='contacted').count()
        pending_count = SupportExpiringMembership.objects.filter(contact_status='pending').count()
        follow_up_count = SupportExpiringMembership.objects.filter(contact_status='follow_up').count()
        resolved_count = SupportExpiringMembership.objects.filter(contact_status='resolved').count()

        return ApiResponse(data={
            'expiry_counts': expiry_counts,
            'contact_stats': {
                'contacted': contacted_count,
                'pending': pending_count,
                'follow_up': follow_up_count,
                'resolved': resolved_count,
                'total': contacted_count + pending_count + follow_up_count + resolved_count,
            },
        })


class AdminNotificationDeliveryLogView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        notification_type = request.query_params.get('notification_type', '')
        logs = NotificationDeliveryLog.objects.all()
        if notification_type:
            logs = logs.filter(notification_type=notification_type)
        logs = logs.select_related('membership', 'user').order_by('-sent_at')[:100]
        return ApiResponse(data=[
            {
                'id': str(log.id),
                'notification_type': log.notification_type,
                'milestone': log.milestone,
                'channel': log.channel,
                'sent_at': log.sent_at.isoformat(),
                'delivery_status': log.delivery_status,
                'member_name': log.user.get_full_name() or log.user.email,
            }
            for log in logs
        ])
