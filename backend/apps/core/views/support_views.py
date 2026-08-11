import gzip
import json
from urllib.parse import unquote

from django.db import transaction, IntegrityError
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, OuterRef, Prefetch, Q, Subquery
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import Admin, SuperAdmin
from apps.core.api_utils import (
    audit,
    create_notification,
    create_ticket_attachment,
    client_ip,
    paginated_response,
    bad_request,
)
from apps.core.models import (
    AdminTicketReadState,
    SupportCategory,
    SupportSlaRule,
    SupportTicket,
    SupportTicketAttachment,
    SupportTicketReply,
    TicketAssignment,
    TicketAuditLog,
    TicketInternalNote,
    TicketStatusHistory,
    TicketFeedback,
)
from apps.core.responses import ApiResponse
from apps.core.serializers import (
    AdminTicketReadStateSerializer,
    SupportAttachmentSerializer,
    SupportCategorySerializer,
    SupportTicketSerializer,
    TicketListSerializer,
    TicketAuditLogSerializer,
    TicketActionSerializer,
    TicketReplyInputSerializer,
    TicketInternalNoteSerializer,
    TicketFeedbackSerializer,
)
from apps.core.support_services import (
    reply_to_ticket,
    resolve_ticket,
    reopen_ticket,
    close_ticket,
    update_read_state,
    get_queue_counts,
    calculate_sla,
    _notify_assignees,
)


def _get_admin_from_request(request):
    """Extract admin/agent/super_admin from request user."""
    user = request.user
    if hasattr(user, 'account_type'):
        atype = str(user.account_type)
        if atype == 'SUPER_ADMIN':
            return user, atype
        elif atype == 'ADMIN':
            return user, atype
    return None, None


def _check_permission(user, permission_code):
    if hasattr(user, 'account_type') and str(user.account_type) in ('SUPER_ADMIN', 'ADMIN'):
        return True
    if hasattr(user, 'has_admin_permission'):
        return user.has_admin_permission(permission_code)
    return True


# ─── Admin Ticket Views ─────────────────────────────────────────────────


class AdminTicketListPaginatedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, atype = _get_admin_from_request(request)
        if not user or atype not in ('SUPER_ADMIN', 'ADMIN'):
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        can_view_all = True
        assigned_only = False

        qs = SupportTicket.objects.select_related(
            'member', 'category',
            'claimed_by_super_admin', 'claimed_by_admin',
        ).annotate(
            _attachment_count=Count('attachments', distinct=True),
            reply_count_cache=Count('replies', distinct=True),
            _last_reply=Subquery(
                SupportTicketReply.objects.filter(ticket=OuterRef('pk')).order_by('-created_at').values('message')[:1]
            ),
        ).defer(
            'description', 'resolution_summary',
        )

        # Filter by queue
        queue = request.query_params.get('queue', 'all')
        if queue == 'unassigned':
            qs = qs.filter(claimed_by_admin__isnull=True, claimed_by_super_admin__isnull=True, status__in=[
                SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED, SupportTicket.Status.REOPENED,
            ])
        elif queue == 'open':
            qs = qs.filter(status__in=[
                SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                SupportTicket.Status.REOPENED, SupportTicket.Status.IN_PROGRESS,
            ])
        elif queue == 'in_progress':
            qs = qs.filter(status=SupportTicket.Status.IN_PROGRESS)
        elif queue == 'waiting_for_member':
            qs = qs.filter(status=SupportTicket.Status.WAITING_FOR_MEMBER)
        elif queue == 'waiting_for_internal':
            qs = qs.filter(status=SupportTicket.Status.WAITING_FOR_INTERNAL)
        elif queue == 'resolved':
            qs = qs.filter(status=SupportTicket.Status.RESOLVED)
        elif queue == 'closed':
            qs = qs.filter(status=SupportTicket.Status.CLOSED)
        elif queue == 'reopened':
            qs = qs.filter(status=SupportTicket.Status.REOPENED)
        elif queue == 'urgent':
            qs = qs.filter(priority=SupportTicket.Priority.URGENT)
        elif queue == 'overdue':
            qs = qs.filter(
                sla_deadline__isnull=False,
                sla_deadline__lt=timezone.now(),
                status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                            SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED],
            )
        elif queue == 'assigned_to_me':
            qs = qs.filter(Q(claimed_by_admin=user) | Q(claimed_by_super_admin=user))
        elif queue == 'my_team':
            qs = qs.exclude(claimed_by_admin__isnull=True, claimed_by_super_admin__isnull=True)

        # Search
        search = request.query_params.get('search', '').strip()
        if search:
            q_search = Q()
            # By ticket number
            try:
                q_search |= Q(ticket_number__icontains=search)
            except Exception:
                pass
            # By member name/email/phone
            q_search |= Q(member__first_name__icontains=search)
            q_search |= Q(member__last_name__icontains=search)
            q_search |= Q(member__email__icontains=search)
            q_search |= Q(member__mobile_number__icontains=search)
            # By subject/message
            q_search |= Q(subject__icontains=search)
            q_search |= Q(description__icontains=search)
            # By admin name
            q_search |= Q(claimed_by_admin__first_name__icontains=search)
            q_search |= Q(claimed_by_admin__last_name__icontains=search)
            q_search |= Q(claimed_by_super_admin__first_name__icontains=search)
            q_search |= Q(claimed_by_super_admin__last_name__icontains=search)
            qs = qs.filter(q_search)

        # Status filter
        status_filter = request.query_params.get('status', '')
        if status_filter and status_filter.upper() in dict(SupportTicket.Status.choices):
            qs = qs.filter(status=status_filter.upper())

        # Priority filter
        priority_filter = request.query_params.get('priority', '')
        if priority_filter and priority_filter.upper() in dict(SupportTicket.Priority.choices):
            qs = qs.filter(priority=priority_filter.upper())

        # Category filter
        category_filter = request.query_params.get('category', '')
        if category_filter:
            qs = qs.filter(category__code=category_filter)

        # Assigned to filter
        assigned_filter = request.query_params.get('assigned_to', '')
        if assigned_filter:
            qs = qs.filter(Q(claimed_by_admin_id=assigned_filter) | Q(claimed_by_super_admin_id=assigned_filter))

        # Date range
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        # Sorting
        sort = request.query_params.get('sort', '-created_at')
        allowed_sorts = {
            'created_at', '-created_at', 'updated_at', '-updated_at',
            'last_reply_at', '-last_reply_at', 'priority', '-priority',
            'sla_deadline', '-sla_deadline', 'status', '-status',
        }
        if sort not in allowed_sorts:
            sort = '-created_at'
        qs = qs.order_by(sort)

        # Assigned-only restriction
        if assigned_only:
            qs = qs.filter(Q(claimed_by_admin=user) | Q(claimed_by_super_admin=user))

        return paginated_response(
            request, qs, TicketListSerializer,
            context={'include_contact': atype == 'SUPER_ADMIN'},
            message='Tickets retrieved successfully.',
        )


class AdminTicketDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        try:
            ticket = SupportTicket.objects.select_related(
                'member', 'category',
                'claimed_by_super_admin', 'claimed_by_admin',
                'resolved_by_super_admin', 'resolved_by_admin',
                'closed_by_super_admin', 'closed_by_admin',
            ).prefetch_related(
                Prefetch('replies', queryset=SupportTicketReply.objects.select_related(
                    'member_sender', 'admin_sender', 'super_admin_sender',
                ).order_by('created_at')),
                Prefetch('internal_notes', queryset=TicketInternalNote.objects.select_related(
                    'admin', 'super_admin',
                ).order_by('created_at')),
                Prefetch('status_history', queryset=TicketStatusHistory.objects.order_by('created_at')),
                Prefetch('attachments', queryset=SupportTicketAttachment.objects.all()),
                Prefetch('audit_logs', queryset=TicketAuditLog.objects.order_by('-created_at')),
            ).get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        update_read_state(user.pk, atype, ticket)
        serializer = SupportTicketSerializer(
            ticket, context={
                'include_replies': True,
                'include_notes': True,
                'include_audit': atype == 'SUPER_ADMIN',
                'include_contact': atype == 'SUPER_ADMIN',
            }
        )
        return ApiResponse(data=serializer.data, message='Ticket retrieved.')


class AdminTicketActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        serializer = TicketActionSerializer(data=request.data)
        if not serializer.is_valid():
            return ApiResponse(success=False, message='Invalid action.', errors=serializer.errors,
                               status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        try:
            ticket = SupportTicket.objects.get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        try:
            if action == 'resolve':
                check = _check_permission(user, 'tickets.resolve') or atype == 'SUPER_ADMIN'
                if not check:
                    return ApiResponse(success=False, message='Permission denied.', status=status.HTTP_403_FORBIDDEN)
                summary = serializer.validated_data.get('summary', '')
                ticket = resolve_ticket(ticket, summary, user, request)
                return ApiResponse(data={'id': str(ticket.pk), 'status': ticket.status}, message='Ticket resolved.')

            elif action == 'reopen':
                check = _check_permission(user, 'tickets.reopen') or atype == 'SUPER_ADMIN'
                if not check:
                    return ApiResponse(success=False, message='Permission denied.', status=status.HTTP_403_FORBIDDEN)
                reason = serializer.validated_data.get('reason', '')
                ticket = reopen_ticket(ticket, reason, user, request)
                return ApiResponse(data={'id': str(ticket.pk), 'status': ticket.status}, message='Ticket reopened.')

            elif action == 'close':
                check = _check_permission(user, 'tickets.close') or atype == 'SUPER_ADMIN'
                if not check:
                    return ApiResponse(success=False, message='Permission denied.', status=status.HTTP_403_FORBIDDEN)
                reason = serializer.validated_data.get('reason', '')
                ticket = close_ticket(ticket, reason, user, request)
                return ApiResponse(data={'id': str(ticket.pk), 'status': ticket.status}, message='Ticket closed.')

            return ApiResponse(success=False, message=f'Unknown action: {action}', status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return ApiResponse(success=False, message=str(e), status=status.HTTP_400_BAD_REQUEST)


class AdminTicketReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        can_reply = _check_permission(user, 'tickets.reply') or atype == 'SUPER_ADMIN'
        if not can_reply:
            return ApiResponse(success=False, message='Permission denied.', status=status.HTTP_403_FORBIDDEN)

        try:
            ticket = SupportTicket.objects.get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        serializer = TicketReplyInputSerializer(data=request.data)
        if not serializer.is_valid():
            return ApiResponse(success=False, message='Invalid input.', errors=serializer.errors,
                               status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        attachment = serializer.validated_data.get('attachment') or request.FILES.get('attachment') or request.FILES.get('file') or request.FILES.get('document') or (next(iter(request.FILES.values()), None) if request.FILES else None)
        is_note_val = request.data.get('is_note')
        if isinstance(is_note_val, bool):
            is_note = is_note_val
        else:
            is_note = str(is_note_val or '').lower() in ('true', '1', 'yes')

        try:
            reply = reply_to_ticket(ticket, message, user, attachment, request, is_public=not is_note)
            return ApiResponse(
                data={
                    'id': str(reply.pk),
                    'message': reply.message,
                    'is_public': reply.is_public,
                    'created_at': reply.created_at.isoformat(),
                },
                message='Reply sent.',
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return ApiResponse(success=False, message=str(e), status=status.HTTP_400_BAD_REQUEST)


class AdminTicketMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id, *args, **kwargs):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        try:
            ticket = SupportTicket.objects.get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        # Mix replies, notes, status changes into a timeline
        replies = SupportTicketReply.objects.filter(ticket=ticket).select_related(
            'member_sender', 'admin_sender', 'super_admin_sender',
        ).prefetch_related('attachments').order_by('created_at')

        notes = TicketInternalNote.objects.filter(ticket=ticket).select_related(
            'admin', 'super_admin',
        ).order_by('created_at')

        status_changes = TicketStatusHistory.objects.filter(ticket=ticket).order_by('created_at')

        timeline = []

        for r in replies:
            sender = None
            if r.member_sender_id:
                sender = {
                    'id': str(r.member_sender.pk),
                    'name': r.member_sender.get_full_name() or r.member_sender.email or 'Member',
                    'type': 'member',
                }
            elif r.admin_sender_id:
                sender = {'id': str(r.admin_sender.pk), 'name': r.admin_sender.get_full_name() or 'Admin', 'type': 'admin'}
            elif r.super_admin_sender_id:
                sender = {'id': str(r.super_admin_sender.pk), 'name': r.super_admin_sender.get_full_name() or 'Super Admin', 'type': 'super_admin'}

            atts = [
                {
                    'id': str(att.pk),
                    'original_filename': att.original_filename,
                    'mime_type': att.mime_type,
                    'file_size': att.file_size,
                    'download_url': f'/api/proxy/support/attachments/{att.pk}/download/',
                }
                for att in r.attachments.all()
            ]
            timeline.append({
                'type': 'reply' if r.is_public else 'note',
                'id': str(r.pk),
                'message': r.message,
                'sender': sender,
                'attachments': atts,
                'created_at': r.created_at.isoformat(),
                'is_public': r.is_public,
            })

        for n in notes:
            author = None
            if n.admin_id:
                author = {'id': str(n.admin.pk), 'name': n.admin.get_full_name() or 'Admin', 'type': 'admin'}
            elif n.super_admin_id:
                author = {'id': str(n.super_admin.pk), 'name': n.super_admin.get_full_name() or 'Super Admin', 'type': 'super_admin'}
            timeline.append({
                'type': 'internal_note',
                'id': str(n.pk),
                'message': n.note,
                'sender': author,
                'created_at': n.created_at.isoformat(),
                'is_public': False,
            })

        for s in status_changes:
            timeline.append({
                'type': 'status_change',
                'id': str(s.pk),
                'old_status': s.old_status,
                'new_status': s.new_status,
                'reason': s.reason,
                'created_at': s.created_at.isoformat(),
            })

        timeline.sort(key=lambda x: x['created_at'])

        return ApiResponse(data=timeline, message='Timeline retrieved.')


class AdminTicketReadStateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        message_id = request.data.get('message_id')
        try:
            ticket = SupportTicket.objects.get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        state = update_read_state(user.pk, atype, ticket, message_id)
        return ApiResponse(data=AdminTicketReadStateSerializer(state).data, message='Read state updated.')


class AdminQueueCountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        counts = get_queue_counts()
        return ApiResponse(data=counts, message='Queue counts retrieved.')


class AdminUnreadCountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        total_unread = AdminTicketReadState.objects.filter(
            admin_id=user.pk, admin_type=atype
        ).aggregate(total=Count('unread_count'))['total'] or 0

        unread_tickets = AdminTicketReadState.objects.filter(
            admin_id=user.pk, admin_type=atype,
            unread_count__gt=0,
        ).count()

        return ApiResponse(data={
            'total_unread_messages': total_unread,
            'unread_tickets': unread_tickets,
        }, message='Unread counts retrieved.')


class AdminAuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, atype = _get_admin_from_request(request)
        if not user or atype != 'SUPER_ADMIN':
            return ApiResponse(success=False, message='Only Super Admin can view audit logs.',
                               status=status.HTTP_403_FORBIDDEN)

        qs = TicketAuditLog.objects.select_related('ticket').order_by('-created_at')

        # Filters
        action_filter = request.query_params.get('action', '')
        if action_filter:
            qs = qs.filter(action=action_filter)

        actor_filter = request.query_params.get('actor_id', '')
        if actor_filter:
            qs = qs.filter(actor_id=actor_filter)

        ticket_filter = request.query_params.get('ticket_id', '')
        if ticket_filter:
            qs = qs.filter(ticket_id=ticket_filter)

        date_from = request.query_params.get('date_from', '')
        if date_from:
            qs = qs.filter(created_at__gte=date_from)

        date_to = request.query_params.get('date_to', '')
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        return paginated_response(
            request, qs, TicketAuditLogSerializer,
            message='Audit logs retrieved.',
        )


class AdminAttachmentUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        try:
            ticket = SupportTicket.objects.get(pk=ticket_id)
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return ApiResponse(success=False, message='No file provided.', status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_data = file_obj.read()
            compressed_data = gzip.compress(raw_data)
            att = SupportTicketAttachment.objects.create(
                ticket=ticket,
                uploaded_by_super_admin=user if atype == 'SUPER_ADMIN' else None,
                uploaded_by_admin=user if atype == 'ADMIN' else None,
                file_bytes=compressed_data,
                compression='gzip',
                original_filename=file_obj.name[:255],
                mime_type=(getattr(file_obj, 'content_type', '') or 'application/octet-stream')[:100],
                file_size=file_obj.size,
            )
            return ApiResponse(
                data=SupportAttachmentSerializer(att, context={'request': request}).data,
                message='Attachment uploaded.',
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return ApiResponse(success=False, message=str(e), status=status.HTTP_400_BAD_REQUEST)


class AdminAttachmentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        user, atype = _get_admin_from_request(request)
        if not user:
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        try:
            att = SupportTicketAttachment.objects.get(pk=attachment_id)
        except SupportTicketAttachment.DoesNotExist:
            return ApiResponse(success=False, message='Attachment not found.', status=status.HTTP_404_NOT_FOUND)

        try:
            raw = gzip.decompress(att.file_bytes) if att.compression == 'gzip' else att.file_bytes
        except Exception:
            raw = att.file_bytes or b''

        response = HttpResponse(raw, content_type=att.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{att.original_filename}"'
        response['Content-Length'] = len(raw)
        return response


class AdminSupportDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, atype = _get_admin_from_request(request)
        if not user or atype not in ('SUPER_ADMIN', 'ADMIN'):
            return ApiResponse(success=False, message='Unauthorized', status=status.HTTP_403_FORBIDDEN)

        base = SupportTicket.objects.all()

        # Average first-response time (hours)
        frt = base.exclude(first_response_at__isnull=True).aggregate(
            avg_first_response=Avg(
                ExpressionWrapper(
                    F('first_response_at') - F('created_at'),
                    output_field=DurationField()
                )
            )
        )['avg_first_response']

        # Average resolution time
        rt = base.exclude(resolved_at__isnull=True).aggregate(
            avg_resolution=Avg(
                ExpressionWrapper(
                    F('resolved_at') - F('created_at'),
                    output_field=DurationField()
                )
            )
        )['avg_resolution']

        frt_hours = round(frt.total_seconds() / 3600, 2) if frt else 0
        rt_hours = round(rt.total_seconds() / 3600, 2) if rt else 0

        # Per-admin metrics
        admin_metrics = []
        resolved_counts = SupportTicket.objects.exclude(
            resolved_by_admin__isnull=True, resolved_by_super_admin__isnull=True,
        ).values('resolved_by_admin', 'resolved_by_super_admin').annotate(
            count=Count('id')
        )

        counts = get_queue_counts()

        result = {
            **counts,
            'avg_first_response_hours': frt_hours,
            'avg_resolution_hours': rt_hours,
            'sla_breach_count': base.filter(
                sla_deadline__isnull=False, sla_deadline__lt=timezone.now(),
                status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                            SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED],
            ).count(),
        }

        return ApiResponse(data=result, message='Dashboard data retrieved.')


# ─── Member-facing Ticket Views ────────────────────────────────────────


class MemberSupportTicketListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List member's own tickets with pagination."""
        qs = SupportTicket.objects.filter(
            Q(member=request.user) | Q(created_by_member=request.user)
        ).select_related('category').order_by('-created_at')

        return paginated_response(request, qs, TicketListSerializer, message='Your tickets.')

    def post(self, request):
        """Create a new ticket as a member."""
        from apps.core.serializers import MemberTicketCreateSerializer
        serializer = MemberTicketCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return ApiResponse(success=False, message='Invalid input.', errors=serializer.errors,
                               status=status.HTTP_400_BAD_REQUEST)

        try:
            category = SupportCategory.objects.get(code=serializer.validated_data['category'])
        except SupportCategory.DoesNotExist:
            category = SupportCategory.objects.filter(is_active=True).first()
            if not category:
                return ApiResponse(success=False, message='No support category available.',
                                   status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ticket = SupportTicket.objects.create(
                member=request.user,
                category=category,
                subject=serializer.validated_data['subject'],
                description=serializer.validated_data['description'],
                priority=serializer.validated_data.get('priority', SupportTicket.Priority.NORMAL),
                status=SupportTicket.Status.UNASSIGNED,
                source=SupportTicket.Source.WEB,
                created_by_member=request.user,
                sla_deadline=calculate_sla(category, serializer.validated_data.get('priority', SupportTicket.Priority.NORMAL)),
            )

            attachment = serializer.validated_data.get('attachment')
            if attachment:
                create_ticket_attachment(
                    ticket=ticket, upload=attachment, member=request.user,
                )

        _notify_assignees(ticket, 'TICKET_CREATED', f'New ticket: {ticket.ticket_number}',
                          ticket.subject)

        result = TicketListSerializer(ticket, context={'request': request}).data
        return ApiResponse(data=result, message='Ticket created.', status=status.HTTP_201_CREATED)


class MemberSupportTicketDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _resolve_id(self, **kwargs):
        return kwargs.get('ticket_id') or kwargs.get('pk')

    def get(self, request, **kwargs):
        ticket_id = self._resolve_id(**kwargs)
        try:
            ticket = SupportTicket.objects.select_related(
                'member', 'category',
            ).prefetch_related(
                Prefetch('replies', queryset=SupportTicketReply.objects.filter(
                    is_public=True
                ).select_related(
                    'member_sender', 'admin_sender', 'super_admin_sender',
                ).order_by('created_at')),
                Prefetch('attachments', queryset=SupportTicketAttachment.objects.all()),
            ).get(
                Q(pk=ticket_id),
                Q(member=request.user) | Q(created_by_member=request.user),
            )
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        serializer = SupportTicketSerializer(
            ticket, context={
                'include_replies': True,
                'include_notes': False,
                'include_audit': False,
                'include_contact': True,
            }
        )
        return ApiResponse(data=serializer.data, message='Ticket retrieved.')

    def post(self, request, **kwargs):
        """Member replies to a ticket."""
        ticket_id = self._resolve_id(**kwargs)
        try:
            ticket = SupportTicket.objects.select_related('member').get(
                Q(pk=ticket_id),
                Q(member=request.user) | Q(created_by_member=request.user),
            )
        except SupportTicket.DoesNotExist:
            return ApiResponse(success=False, message='Ticket not found.', status=status.HTTP_404_NOT_FOUND)

        serializer = TicketReplyInputSerializer(data=request.data)
        if not serializer.is_valid():
            return ApiResponse(success=False, message='Invalid input.', errors=serializer.errors,
                               status=status.HTTP_400_BAD_REQUEST)

        try:
            reply = reply_to_ticket(
                ticket, serializer.validated_data['message'], request.user,
                serializer.validated_data.get('attachment'), request,
                is_public=True,
            )
            return ApiResponse(
                data={
                    'id': str(reply.pk),
                    'message': reply.message,
                    'created_at': reply.created_at.isoformat(),
                },
                message='Reply sent.',
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return ApiResponse(success=False, message=str(e), status=status.HTTP_400_BAD_REQUEST)


class SupportCategoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SupportCategory.objects.filter(is_active=True)
        return ApiResponse(
            data=SupportCategorySerializer(qs, many=True).data,
            message='Categories retrieved.',
        )


class SupportAttachmentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        try:
            att = SupportTicketAttachment.objects.get(pk=attachment_id)
        except SupportTicketAttachment.DoesNotExist:
            return ApiResponse(success=False, message='Attachment not found.', status=status.HTTP_404_NOT_FOUND)

        ticket = att.ticket
        user = request.user

        # Check access: owner of ticket or admin
        has_access = False
        if hasattr(user, 'account_type') and str(user.account_type) in ('SUPER_ADMIN', 'ADMIN'):
            has_access = True
        elif ticket.member_id == user.pk or ticket.created_by_member_id == user.pk:
            has_access = True

        if not has_access:
            return ApiResponse(success=False, message='Access denied.', status=status.HTTP_403_FORBIDDEN)
        try:
            raw = gzip.decompress(att.file_bytes) if att.compression == 'gzip' else att.file_bytes
        except Exception:
            raw = att.file_bytes or b''

        response = HttpResponse(raw, content_type=att.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'inline; filename="{att.original_filename}"'
        response['Content-Length'] = len(raw)
        return response
