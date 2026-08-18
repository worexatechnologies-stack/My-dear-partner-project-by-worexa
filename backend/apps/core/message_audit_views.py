"""Strictly privileged, reason-logged message audit endpoints."""

from datetime import datetime, time

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Member
from apps.accounts.permissions import IsSuperAdmin

from .message_service import decrypt_retained_message_text, serialize_message
from .models import AdminMessageAccessLog, ChatConversation, ChatMessage
from .responses import ApiResponse


MAX_PAGE_SIZE = 50


def _reason(request):
    value = request.query_params.get('reason') or request.data.get('reason')
    return str(value or '').strip()[:500]


def _require_reason(request):
    reason = _reason(request)
    if not reason:
        return None, Response(
            {'message': 'A reason is required to access retained message content.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return reason, None


def _log_access(request, *, action, reason, conversation=None, message=None):
    return AdminMessageAccessLog.objects.create(
        admin_user=request.user,
        conversation=conversation,
        message=message,
        conversation_id_snapshot=conversation.pk if conversation else None,
        message_id_snapshot=message.pk if message else None,
        action=action,
        reason=reason,
        ip_address=request.META.get('REMOTE_ADDR'),
        user_agent=str(request.META.get('HTTP_USER_AGENT', ''))[:10000],
    )


def _member_data(member, *, snapshot_id=None, snapshot_name=''):
    if member:
        return {
            'id': str(member.pk),
            'name': member.get_full_name() or member.email,
            'email': member.email,
            'phone': member.mobile_number,
        }
    return {
        'id': str(snapshot_id or ''),
        'name': snapshot_name or 'Deleted member',
        'email': None,
        'phone': None,
    }


def _conversation_data(conversation):
    last_message = conversation.messages.order_by('-created_at').first()
    deleted_count = conversation.messages.filter(deleted_for_everyone=True).count()
    return {
        'id': str(conversation.pk),
        'member_a': _member_data(
            conversation.member_one,
            snapshot_id=conversation.member_one_id_snapshot,
            snapshot_name=conversation.member_one_name_snapshot,
        ),
        'member_b': _member_data(
            conversation.member_two,
            snapshot_id=conversation.member_two_id_snapshot,
            snapshot_name=conversation.member_two_name_snapshot,
        ),
        'started_at': conversation.created_at,
        'last_activity': conversation.last_message_at or conversation.updated_at,
        'message_count': conversation.messages.count(),
        'deleted_count': deleted_count,
        'last_message': 'Message deleted' if last_message and last_message.deleted_for_everyone else (decrypt_retained_message_text(last_message) if last_message else ''),
    }


def _page(request, queryset):
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = min(MAX_PAGE_SIZE, max(1, int(request.query_params.get('page_size', 20))))
    except (TypeError, ValueError):
        page, page_size = 1, 20
    total = queryset.count()
    start = (page - 1) * page_size
    return queryset[start:start + page_size], {
        'page': page,
        'page_size': page_size,
        'total': total,
        'has_next': start + page_size < total,
    }


def _date_filter(queryset, field, raw_value, *, end=False):
    parsed = parse_date(str(raw_value or ''))
    if not parsed:
        return queryset
    value = datetime.combine(parsed, time.max if end else time.min)
    value = timezone.make_aware(value) if timezone.is_naive(value) else value
    return queryset.filter(**{f'{field}__lte' if end else f'{field}__gte': value})


class MessageAuditConversationListView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsSuperAdmin)

    def get(self, request):
        reason, error = _require_reason(request)
        if error:
            return error
        queryset = ChatConversation.objects.select_related('member_one', 'member_two').annotate(
            active_message_exists=Exists(ChatMessage.objects.filter(conversation=OuterRef('pk'), deleted_for_everyone=False)),
            deleted_message_exists=Exists(ChatMessage.objects.filter(conversation=OuterRef('pk'), deleted_for_everyone=True)),
        ).order_by('-last_message_at', '-updated_at')

        search = str(request.query_params.get('search') or '').strip()
        user_name = str(request.query_params.get('user_name') or '').strip()
        email = str(request.query_params.get('email') or '').strip()
        phone = str(request.query_params.get('phone') or '').strip()
        conversation_id = str(request.query_params.get('conversation_id') or '').strip()
        message_text = str(request.query_params.get('message_text') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(member_one__first_name__icontains=search)
                | Q(member_one__last_name__icontains=search)
                | Q(member_two__first_name__icontains=search)
                | Q(member_two__last_name__icontains=search)
                | Q(member_one__email__icontains=search)
                | Q(member_two__email__icontains=search)
                | Q(member_one__mobile_number__icontains=search)
                | Q(member_two__mobile_number__icontains=search)
                | Q(pk__icontains=search)
                | Q(messages__text__icontains=search)
            )
        if user_name:
            queryset = queryset.filter(
                Q(member_one__first_name__icontains=user_name) | Q(member_one__last_name__icontains=user_name)
                | Q(member_two__first_name__icontains=user_name) | Q(member_two__last_name__icontains=user_name)
            )
        if email:
            queryset = queryset.filter(Q(member_one__email__icontains=email) | Q(member_two__email__icontains=email))
        if phone:
            queryset = queryset.filter(Q(member_one__mobile_number__icontains=phone) | Q(member_two__mobile_number__icontains=phone))
        if conversation_id:
            queryset = queryset.filter(pk=conversation_id)
        if message_text:
            queryset = queryset.filter(messages__text__icontains=message_text)
        status_filter = str(request.query_params.get('status') or 'all').lower()
        if status_filter == 'active':
            queryset = queryset.filter(active_message_exists=True)
        elif status_filter == 'deleted':
            queryset = queryset.filter(deleted_message_exists=True)
        queryset = _date_filter(queryset, 'last_message_at', request.query_params.get('from'))
        queryset = _date_filter(queryset, 'last_message_at', request.query_params.get('to'), end=True)
        queryset = queryset.distinct()

        _log_access(request, action=AdminMessageAccessLog.Action.SEARCH_MESSAGES, reason=reason)
        rows, pagination = _page(request, queryset)
        return ApiResponse(data={'results': [_conversation_data(row) for row in rows], **pagination})


class MessageAuditConversationMessagesView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsSuperAdmin)

    def get(self, request, conversation_id):
        reason, error = _require_reason(request)
        if error:
            return error
        conversation = ChatConversation.objects.select_related('member_one', 'member_two').filter(pk=conversation_id).first()
        if conversation is None:
            return Response({'message': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
        _log_access(request, action=AdminMessageAccessLog.Action.VIEW_CONVERSATION, reason=reason, conversation=conversation)
        queryset = conversation.messages.all().order_by('-created_at')
        status_filter = str(request.query_params.get('status') or 'all').lower()
        if status_filter == 'active':
            queryset = queryset.filter(deleted_for_everyone=False)
        elif status_filter == 'deleted':
            queryset = queryset.filter(deleted_for_everyone=True)
        rows, pagination = _page(request, queryset)
        deleted_rows = [row for row in rows if row.deleted_for_everyone]
        for message in deleted_rows:
            _log_access(
                request,
                action=AdminMessageAccessLog.Action.VIEW_DELETED_MESSAGE,
                reason=reason,
                conversation=conversation,
                message=message,
            )
        return ApiResponse(data={
            'conversation': _conversation_data(conversation),
            'results': [serialize_message(message, privileged=True) for message in rows],
            **pagination,
        })


class MessageAuditMessageDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsSuperAdmin)

    def get(self, request, message_id):
        reason, error = _require_reason(request)
        if error:
            return error
        message = ChatMessage.objects.select_related('conversation').filter(pk=message_id).first()
        if message is None:
            return Response({'message': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)
        action = AdminMessageAccessLog.Action.VIEW_DELETED_MESSAGE if message.deleted_for_everyone else AdminMessageAccessLog.Action.VIEW_MESSAGE
        _log_access(request, action=action, reason=reason, conversation=message.conversation, message=message)
        return ApiResponse(data=serialize_message(message, privileged=True))
