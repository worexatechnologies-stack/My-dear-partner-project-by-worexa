"""
Messaging Views

Member-facing views for chat/messaging functionality.
Messages are stored permanently in PostgreSQL.
Redis is used only for WebSocket real-time delivery.
"""

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.pagination import CursorPagination

from apps.accounts.permissions import IsMember
from apps.core.responses import ApiResponse, ApiErrorResponse
from apps.core.models import ChatMessage
from apps.accounts.models import Member
from apps.profiles.models import ProfilePhoto
from apps.profiles.photo_permissions import can_view_profile_photo
from apps.profiles.serializers import photo_endpoint_urls


class MessageCursorPagination(CursorPagination):
    """Cursor pagination for messages (efficient for large datasets)"""
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class ConversationListView(APIView):
    """
    GET /api/v1/member-auth/conversations/
    
    Get list of conversations with last message and unread count.
    
    Response:
        {
            "success": true,
            "data": [
                {
                    "other_member": {
                        "id": "uuid",
                        "full_name": "John Doe",
                        "photo": "url",
                        "gender": "Male"
                    },
                    "last_message": {
                        "id": "uuid",
                        "text": "Hello",
                        "sender_id": "uuid",
                        "created_at": "2026-07-17T10:30:00Z",
                        "is_read": false
                    },
                    "unread_count": 3
                }
            ]
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def get(self, request):
        member = request.user
        
        # Get all members user has exchanged messages with
        # Using subquery to get last message per conversation
        conversations = []
        
        # Get unique conversation partners
        sent_to = ChatMessage.objects.filter(sender=member).values_list('receiver_id', flat=True).distinct()
        received_from = ChatMessage.objects.filter(receiver=member).values_list('sender_id', flat=True).distinct()
        partner_ids = set(sent_to) | set(received_from)
        
        for partner_id in partner_ids:
            # Get last message in this conversation
            last_message = ChatMessage.objects.filter(
                Q(sender=member, receiver_id=partner_id) |
                Q(sender_id=partner_id, receiver=member)
            ).order_by('-created_at').first()
            
            if not last_message:
                continue
            
            # Count unread messages from partner
            unread_count = ChatMessage.objects.filter(
                sender_id=partner_id,
                receiver=member,
                is_read=False
            ).count()
            
            # Get partner details
            try:
                partner = Member.objects.select_related('profile').get(pk=partner_id)
                primary_photo = (
                    ProfilePhoto.objects.without_binary()
                    .select_related('user')
                    .filter(
                        user=partner,
                        is_primary=True,
                        status=ProfilePhoto.Status.APPROVED,
                    )
                    .first()
                )
                
                conversations.append({
                    'other_member': {
                        'id': str(partner.id),
                        'full_name': partner.get_full_name(),
                        'photo': (
                            photo_endpoint_urls(primary_photo)['thumbnail_url']
                            if primary_photo and can_view_profile_photo(request.user, primary_photo)
                            else None
                        ),
                        'gender': partner.gender,
                        'chat_public_key': getattr(partner, 'chat_public_key', None) or '',
                    },
                    'last_message': {
                        'id': str(last_message.id),
                        'text': last_message.text,
                        'sender_id': str(last_message.sender_id),
                        'created_at': last_message.created_at.isoformat(),
                        'is_read': last_message.is_read,
                    },
                    'unread_count': unread_count,
                })
            except Member.DoesNotExist:
                continue
        
        # Sort by last message time
        conversations.sort(key=lambda x: x['last_message']['created_at'], reverse=True)
        
        return ApiResponse(
            success=True,
            data=conversations,
            status=status.HTTP_200_OK
        )


class MessageHistoryView(APIView):
    """
    GET /api/v1/member-auth/conversations/<uuid:member_id>/messages/
    
    Get message history with pagination.
    
    Query Params:
        - cursor: Pagination cursor
        - limit: Messages per page (default 50, max 100)
    
    Response:
        {
            "success": true,
            "data": {
                "messages": [...],
                "next": "cursor_string",
                "previous": "cursor_string"
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    pagination_class = MessageCursorPagination
    
    def get(self, request, member_id):
        member = request.user
        
        # Verify other member exists
        try:
            other_member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Member not found',
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get messages between these two members
        messages = ChatMessage.objects.filter(
            Q(sender=member, receiver=other_member) |
            Q(sender=other_member, receiver=member)
        ).select_related('sender', 'receiver').order_by('-created_at')
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(messages, request, view=self)
        
        message_data = [
            {
                'id': str(msg.id),
                'sender_id': str(msg.sender_id),
                'receiver_id': str(msg.receiver_id),
                'text': msg.text,
                'is_read': msg.is_read,
                'created_at': msg.created_at.isoformat(),
            }
            for msg in page
        ]
        
        return paginator.get_paginated_response({
            'success': True,
            'data': {
                'messages': message_data,
            }
        })


class SendMessageView(APIView):
    """
    POST /api/v1/member-auth/conversations/<uuid:member_id>/messages/
    
    Send a message.
    
    Request Body:
        {
            "text": "Hello"
        }
    
    Response:
        {
            "success": true,
            "data": {
                "id": "uuid",
                "sender_id": "uuid",
                "receiver_id": "uuid",
                "text": "Hello",
                "is_read": false,
                "created_at": "2026-07-17T10:30:00Z"
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    @transaction.atomic
    def post(self, request, member_id):
        member = request.user
        text = request.data.get('text', '').strip()
        
        if not text:
            return ApiResponse(
                success=False,
                message='Message text is required',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Max message length
        if len(text) > 5000:
            return ApiResponse(
                success=False,
                message='Message is too long (max 5000 characters)',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # A chat target must remain active and visible.  The reviewed-member
        # policy is feature-configurable for the legacy rollout; profile-photo
        # endpoints stay strict regardless of this messaging setting.
        receiver_filters = {
            'pk': member_id,
            'is_active': True,
            'deleted_at__isnull': True,
            'account_status': Member.AccountStatus.ACTIVE,
            'is_hidden': False,
        }
        if getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
            receiver_filters['profile_status'] = Member.ProfileStatus.APPROVED
        receiver = Member.objects.filter(**receiver_filters).first()
        if receiver is None:
            return ApiResponse(
                success=False,
                message='Recipient is not available',
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Cannot message yourself
        if receiver.id == member.id:
            return ApiResponse(
                success=False,
                message='Cannot send message to yourself',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.core.entitlement_service import MembershipEntitlementService
        allowed, reason = MembershipEntitlementService.can_message(member, receiver)
        if not allowed:
            return ApiErrorResponse(
                message='Messaging is not available for this member.',
                code=reason,
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Create message
        message = ChatMessage.objects.create(
            sender=member,
            receiver=receiver,
            text=text,
            is_read=False
        )

        # Persist and broadcast a notification for the HTTP fallback path.
        # Socket messages already publish this from the consumer, but users
        # temporarily using HTTP sync must receive the same live alert.
        from apps.core.api_utils import notify_chat_message
        notify_chat_message(receiver, member, text, message)
        
        return ApiResponse(
            success=True,
            message='Message sent',
            data={
                'id': str(message.id),
                'sender_id': str(message.sender_id),
                'receiver_id': str(message.receiver_id),
                'text': message.text,
                'is_read': message.is_read,
                'created_at': message.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED
        )


class MarkMessagesReadView(APIView):
    """
    POST /api/v1/member-auth/conversations/<uuid:member_id>/mark-read/
    
    Mark all messages from a member as read.
    
    Response:
        {
            "success": true,
            "message": "Messages marked as read",
            "data": {
                "marked_count": 5
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    @transaction.atomic
    def post(self, request, member_id):
        member = request.user
        
        # Mark all unread messages from this sender as read
        marked_count = ChatMessage.objects.filter(
            sender_id=member_id,
            receiver=member,
            is_read=False
        ).update(is_read=True)
        # Reading the chat also clears its aggregated CHAT_MESSAGE bell alerts.
        from apps.core.models import Notification
        from django.utils import timezone
        Notification.objects.filter(
            member_recipient=member,
            notification_type='CHAT_MESSAGE',
            link_url=f'/messages?user={member_id}',
            is_read=False,
        ).update(is_read=True, read_at=timezone.now())
        
        return ApiResponse(
            success=True,
            message='Messages marked as read',
            data={'marked_count': marked_count},
            status=status.HTTP_200_OK
        )


class UnreadCountView(APIView):
    """
    GET /api/v1/member-auth/conversations/unread-count/
    
    Get total unread message count.
    
    Response:
        {
            "success": true,
            "data": {
                "total_unread": 12
            }
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsMember)
    
    def get(self, request):
        member = request.user
        
        total_unread = ChatMessage.objects.filter(
            receiver=member,
            is_read=False
        ).count()
        
        return ApiResponse(
            success=True,
            data={'total_unread': total_unread},
            status=status.HTTP_200_OK
        )
