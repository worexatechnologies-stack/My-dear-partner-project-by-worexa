"""
Verification Events Service

Publishes verification events to WebSocket consumers for real-time updates.
Events are published ONLY after database transactions are committed.
"""

import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction
from .models import Member
from .verification_service import AccountVerificationService

logger = logging.getLogger(__name__)


class VerificationEvents:
    """Service for publishing verification events"""
    
    @staticmethod
    def publish_verification_submitted(member: Member, verification_type: str):
        """Publish event when verification is submitted"""
        def _publish():
            channel_layer = get_channel_layer()
            if not channel_layer:
                return
                
            # Get fresh verification status
            verification_summary = AccountVerificationService.get_verification_summary(member)
            
            # Event data
            event_data = {
                'member_id': str(member.id),
                'member_name': member.get_full_name(),
                'verification_type': verification_type,
                'status': 'pending_review',
                'overall_status': verification_summary.overall_status,
                'completed_steps': verification_summary.completed_steps,
                'total_steps': verification_summary.total_steps,
                'timestamp': member.updated_at.isoformat() if member.updated_at else None
            }
            
            # Send to member
            async_to_sync(channel_layer.group_send)(
                f'member_verification_{member.id}',
                {
                    'type': 'verification.submitted',
                    'data': event_data
                }
            )
            
            # Send to admin queue
            async_to_sync(channel_layer.group_send)(
                'admin_verifications',
                {
                    'type': 'verification.submitted',
                    'data': event_data
                }
            )
            
            # Send to staff queue
            async_to_sync(channel_layer.group_send)(
                'staff_verifications',
                {
                    'type': 'verification.submitted',
                    'data': event_data
                }
            )
            
            logger.info(f"Published verification_submitted event for member {member.id}")
        
        # Execute after current transaction commits
        transaction.on_commit(_publish)
    @staticmethod
    def publish_verification_approved(member: Member, verification_type: str, reviewed_by):
        """Publish event when verification is approved"""
        def _publish():
            channel_layer = get_channel_layer()
            if not channel_layer:
                return
                
            # Get fresh verification status
            verification_summary = AccountVerificationService.get_verification_summary(member)
            
            # Event data
            event_data = {
                'member_id': str(member.id),
                'member_name': member.get_full_name(),
                'verification_type': verification_type,
                'status': 'approved',
                'overall_status': verification_summary.overall_status,
                'is_verified': verification_summary.is_verified,
                'completed_steps': verification_summary.completed_steps,
                'total_steps': verification_summary.total_steps,
                'reviewed_by': reviewed_by.get_full_name() if hasattr(reviewed_by, 'get_full_name') else str(reviewed_by),
                'timestamp': member.updated_at.isoformat() if member.updated_at else None
            }
            
            # Send to member
            async_to_sync(channel_layer.group_send)(
                f'member_verification_{member.id}',
                {
                    'type': 'verification.approved',
                    'data': event_data
                }
            )
            
            # Send to admin queue
            async_to_sync(channel_layer.group_send)(
                'admin_verifications',
                {
                    'type': 'verification.approved',
                    'data': event_data
                }
            )
            
            logger.info(f"Published verification_approved event for member {member.id}")
        
        transaction.on_commit(_publish)

    @staticmethod
    def publish_verification_rejected(member: Member, verification_type: str, reason: str, reviewed_by):
        """Publish event when verification is rejected"""
        def _publish():
            channel_layer = get_channel_layer()
            if not channel_layer:
                return
                
            # Get fresh verification status
            verification_summary = AccountVerificationService.get_verification_summary(member)
            
            # Event data
            event_data = {
                'member_id': str(member.id),
                'member_name': member.get_full_name(),
                'verification_type': verification_type,
                'status': 'rejected',
                'reason': reason,
                'overall_status': verification_summary.overall_status,
                'completed_steps': verification_summary.completed_steps,
                'total_steps': verification_summary.total_steps,
                'reviewed_by': reviewed_by.get_full_name() if hasattr(reviewed_by, 'get_full_name') else str(reviewed_by),
                'timestamp': member.updated_at.isoformat() if member.updated_at else None
            }
            
            # Send to member
            async_to_sync(channel_layer.group_send)(
                f'member_verification_{member.id}',
                {
                    'type': 'verification.rejected',
                    'data': event_data
                }
            )
            
            # Send to admin queue
            async_to_sync(channel_layer.group_send)(
                'admin_verifications',
                {
                    'type': 'verification.rejected',
                    'data': event_data
                }
            )
            
            logger.info(f"Published verification_rejected event for member {member.id}")
        
        transaction.on_commit(_publish)
    @staticmethod
    def publish_contact_verified(member: Member, contact_type: str):
        """Publish event when email/mobile is verified"""
        def _publish():
            channel_layer = get_channel_layer()
            if not channel_layer:
                return
                
            # Get fresh verification status
            verification_summary = AccountVerificationService.get_verification_summary(member)
            
            # Event data
            event_data = {
                'member_id': str(member.id),
                'contact_type': contact_type,  # 'email' or 'mobile'
                'overall_status': verification_summary.overall_status,
                'email_verified': verification_summary.email_verified,
                'mobile_verified': verification_summary.mobile_verified,
                'completed_steps': verification_summary.completed_steps,
                'total_steps': verification_summary.total_steps,
                'timestamp': member.updated_at.isoformat() if member.updated_at else None
            }
            
            # Send to member only (contact verification is not admin business)
            async_to_sync(channel_layer.group_send)(
                f'member_verification_{member.id}',
                {
                    'type': 'contact.verified',
                    'data': event_data
                }
            )
            
            logger.info(f"Published contact_verified event for member {member.id} ({contact_type})")
        
        transaction.on_commit(_publish)

    @staticmethod
    def publish_verification_changes_requested(member: Member, verification_type: str, reason: str, reviewed_by):
        """Publish event when admin requests changes"""
        def _publish():
            channel_layer = get_channel_layer()
            if not channel_layer:
                return
                
            # Get fresh verification status
            verification_summary = AccountVerificationService.get_verification_summary(member)
            
            # Event data
            event_data = {
                'member_id': str(member.id),
                'member_name': member.get_full_name(),
                'verification_type': verification_type,
                'status': 'changes_requested',
                'reason': reason,
                'overall_status': verification_summary.overall_status,
                'completed_steps': verification_summary.completed_steps,
                'total_steps': verification_summary.total_steps,
                'reviewed_by': reviewed_by.get_full_name() if hasattr(reviewed_by, 'get_full_name') else str(reviewed_by),
                'timestamp': member.updated_at.isoformat() if member.updated_at else None
            }
            
            # Send to member
            async_to_sync(channel_layer.group_send)(
                f'member_verification_{member.id}',
                {
                    'type': 'verification.changes_requested',
                    'data': event_data
                }
            )
            
            # Send to admin queue
            async_to_sync(channel_layer.group_send)(
                'admin_verifications',
                {
                    'type': 'verification.changes_requested',
                    'data': event_data
                }
            )
            
            logger.info(f"Published verification_changes_requested event for member {member.id}")
        
        transaction.on_commit(_publish)