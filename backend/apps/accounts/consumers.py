"""
WebSocket consumers for real-time verification updates
"""

import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Member, AccountType

logger = logging.getLogger(__name__)


class VerificationConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for verification status updates
    
    Channel groups:
    - member_verification_{member_id} - For member-specific updates
    - admin_verifications - For admin verification queue updates
    - staff_verifications - For staff verification queue updates
    """
    
    async def connect(self):
        """Handle WebSocket connection"""
        # Get user from scope (set by auth middleware)
        user = self.scope.get('user')
        
        if isinstance(user, AnonymousUser):
            await self.close(code=4001)
            return
        
        # Store user info
        self.user = user
        self.user_type = await self.get_user_type()
        
        if not self.user_type:
            await self.close(code=4003)
            return
        
        # Join appropriate groups based on user type
        if self.user_type == AccountType.MEMBER:
            self.member_group = f'member_verification_{user.id}'
            await self.channel_layer.group_add(self.member_group, self.channel_name)
            
        elif self.user_type in [AccountType.ADMIN, AccountType.SUPER_ADMIN]:
            self.admin_group = 'admin_verifications'
            await self.channel_layer.group_add(self.admin_group, self.channel_name)
        
        await self.accept()
        logger.info(f"WebSocket connected: {self.user_type} {user.id}")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Leave groups
        if hasattr(self, 'member_group'):
            await self.channel_layer.group_discard(self.member_group, self.channel_name)
        if hasattr(self, 'admin_group'):
            await self.channel_layer.group_discard(self.admin_group, self.channel_name)
            
        logger.info(f"WebSocket disconnected: {close_code}")
    
    async def receive_json(self, content):
        """Handle incoming WebSocket messages"""
        message_type = content.get('type')
        
        if message_type == 'ping':
            await self.send_json({'type': 'pong'})
        elif message_type == 'subscribe_verification':
            # Client requesting to subscribe to verification updates
            await self.send_json({
                'type': 'subscribed', 
                'message': 'Subscribed to verification updates'
            })
        else:
            logger.warning(f"Unknown message type: {message_type}")
    # Event handlers for group messages
    async def verification_submitted(self, event):
        """Handle verification submitted event"""
        await self.send_json({
            'type': 'verification.submitted',
            'data': event['data']
        })
    
    async def verification_approved(self, event):
        """Handle verification approved event"""
        await self.send_json({
            'type': 'verification.approved',
            'data': event['data']
        })
    
    async def verification_rejected(self, event):
        """Handle verification rejected event"""
        await self.send_json({
            'type': 'verification.rejected',
            'data': event['data']
        })
    
    async def verification_changes_requested(self, event):
        """Handle verification changes requested event"""
        await self.send_json({
            'type': 'verification.changes_requested',
            'data': event['data']
        })
    
    async def contact_verified(self, event):
        """Handle email/mobile verification event"""
        await self.send_json({
            'type': 'verification.contact_verified',
            'data': event['data']
        })
    
    @database_sync_to_async
    def get_user_type(self):
        """Get user account type"""
        try:
            if hasattr(self.user, 'member'):
                return AccountType.MEMBER
            elif hasattr(self.user, 'admin'):
                return AccountType.ADMIN
            elif hasattr(self.user, 'super_admin'):
                return AccountType.SUPER_ADMIN
            else:
                # Fallback - check account_type property
                return getattr(self.user, 'account_type', None)
        except Exception as e:
            logger.error(f"Error getting user type: {e}")
            return None