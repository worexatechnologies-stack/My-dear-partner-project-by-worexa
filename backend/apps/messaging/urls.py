"""Messaging URLs"""

from django.urls import path

from .views import (
    ConversationListView,
    MessageHistoryView,
    SendMessageView,
    MarkMessagesReadView,
    UnreadCountView,
)

app_name = 'messaging'

urlpatterns = [
    # Conversation list
    path('conversations/', ConversationListView.as_view(), name='conversation_list'),
    
    # Unread count
    path('conversations/unread-count/', UnreadCountView.as_view(), name='unread_count'),
    
    # Message history with specific member
    path('conversations/<uuid:member_id>/messages/', MessageHistoryView.as_view(), name='message_history'),
    
    # Send message
    path('conversations/<uuid:member_id>/messages/', SendMessageView.as_view(), name='send_message'),
    
    # Mark messages as read
    path('conversations/<uuid:member_id>/mark-read/', MarkMessagesReadView.as_view(), name='mark_read'),
]
