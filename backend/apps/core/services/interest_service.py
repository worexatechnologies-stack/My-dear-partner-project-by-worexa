"""
Interest Service

Handles all interest-related business logic:
- Sending interests with limit checks
- Accepting/declining interests
- Withdrawing interests
- Daily limit tracking
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.models import Interest
from apps.accounts.models import Member
from apps.core.eligibility import get_eligible_profiles_for
from .membership_service import MembershipService
from .profile_unlock_service import ProfileUnlockService


class InterestService:
    """
    Centralized service for interest operations.
    
    Rules:
    - No self-interest
    - No duplicate active interest
    - No interest to blocked users
    - No interest to unapproved/inactive users
    - Enforce daily plan limits
    - Failed requests do not consume usage
    - Mutual acceptance creates/unlocks conversation
    """
    
    @staticmethod
    @transaction.atomic
    def send_interest(sender, receiver_id):
        """
        Send an interest to another member.
        
        Args:
            sender: Member sending the interest
            receiver_id: UUID of the receiver
            
        Returns:
            tuple: (success: bool, message: str, interest: Interest or None)
        """
        # Check daily limit
        allowed, reason = InterestService.can_send_interest(sender)
        if not allowed:
            return False, reason, None
        
        # Get receiver from eligible profiles
        eligible_profiles = get_eligible_profiles_for(sender)
        try:
            receiver = eligible_profiles.get(pk=receiver_id)
        except Member.DoesNotExist:
            return False, 'This member is not eligible or available.', None
        
        # Check for self-interest
        if sender.pk == receiver.pk:
            return False, 'You cannot send an interest to yourself.', None
        
        # Check for existing interest
        existing_interest = Interest.objects.filter(
            sender=sender,
            receiver=receiver
        ).first()
        
        if existing_interest:
            if existing_interest.status == Interest.Status.DECLINED:
                # Allow resending after decline
                existing_interest.status = Interest.Status.PENDING
                existing_interest.created_at = timezone.now()
                existing_interest.save(update_fields=['status', 'created_at', 'updated_at'])
                return True, 'Interest sent successfully.', existing_interest
            else:
                return False, 'An interest already exists for this member.', None
        
        # Create new interest
        interest = Interest.objects.create(
            sender=sender,
            receiver=receiver,
            status=Interest.Status.PENDING
        )
        
        # Send notification (if notification system exists)
        try:
            from apps.core.api_utils import notify
            notify(
                receiver,
                notification_type='INTEREST_RECEIVED',
                title='New interest received',
                message=f'{sender.get_full_name()} sent you an interest.',
                link_url=f'/profile/{sender.pk}',
                related_object=interest,
            )
        except ImportError:
            pass
        
        return True, 'Interest sent successfully.', interest
    
    @staticmethod
    @transaction.atomic
    def accept_interest(interest, user):
        """
        Accept an interest.
        
        Args:
            interest: Interest instance
            user: User accepting (must be receiver)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        if interest.receiver_id != user.pk:
            return False, 'You are not authorized to accept this interest.'
        
        if interest.status != Interest.Status.PENDING:
            return False, f'Interest is already {interest.status.lower()}.'
        
        interest.status = Interest.Status.ACCEPTED
        interest.updated_at = timezone.now()
        interest.save(update_fields=['status', 'updated_at'])
        
        # Send notification to sender
        try:
            from apps.core.api_utils import notify
            notify(
                interest.sender,
                notification_type='INTEREST_ACCEPTED',
                title='Interest accepted',
                message=f'{user.get_full_name()} accepted your interest.',
                link_url=f'/profile/{user.pk}',
                related_object=interest,
            )
        except ImportError:
            pass
        
        # Create or unlock conversation (if chat system exists)
        # This is handled by messaging service when user tries to message
        
        return True, 'Interest accepted successfully.'
    
    @staticmethod
    @transaction.atomic
    def decline_interest(interest, user):
        """
        Decline an interest.
        
        Args:
            interest: Interest instance
            user: User declining (must be receiver)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        if interest.receiver_id != user.pk:
            return False, 'You are not authorized to decline this interest.'
        
        if interest.status != Interest.Status.PENDING:
            return False, f'Interest is already {interest.status.lower()}.'
        
        interest.status = Interest.Status.DECLINED
        interest.updated_at = timezone.now()
        interest.save(update_fields=['status', 'updated_at'])
        
        # Optionally notify sender
        try:
            from apps.core.api_utils import notify
            notify(
                interest.sender,
                notification_type='INTEREST_DECLINED',
                title='Interest declined',
                message=f'{user.get_full_name()} declined your interest.',
                link_url=f'/profile/{user.pk}',
                related_object=interest,
            )
        except ImportError:
            pass
        
        return True, 'Interest declined.'
    
    @staticmethod
    @transaction.atomic
    def withdraw_interest(interest, user):
        """
        Withdraw a sent interest.
        
        Args:
            interest: Interest instance
            user: User withdrawing (must be sender)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        if interest.sender_id != user.pk:
            return False, 'You are not authorized to withdraw this interest.'
        
        if interest.status == Interest.Status.ACCEPTED:
            return False, 'Cannot withdraw an accepted interest.'
        
        # Delete the interest
        interest.delete()
        
        return True, 'Interest withdrawn successfully.'
    
    @staticmethod
    def can_send_interest(sender):
        """
        Check if sender can send a new interest (daily limit check & paid plan check).
        
        Args:
            sender: Member sending interest
            
        Returns:
            tuple: (allowed: bool, reason: str)
        """
        plan = MembershipService.get_effective_plan(sender)
        
        # Require a paid plan to send interests/likes
        if not plan or not getattr(sender, 'is_premium', False) or getattr(plan, 'slug', '') == 'free':
            return False, 'A paid membership plan is required to send likes and interests. Please upgrade your plan to connect with members.'

        daily_limit = plan.interest_limit
        
        # Get today's date
        today = ProfileUnlockService.get_today_date()
        
        # Count interests sent today (excluding declined)
        interests_sent_today = Interest.objects.filter(
            sender=sender,
            created_at__date=today
        ).exclude(status=Interest.Status.DECLINED).count()
        
        # Check limit (None means unlimited)
        if daily_limit is not None and interests_sent_today >= daily_limit:
            return False, f'You have reached your daily interest limit of {daily_limit}. Upgrade your plan to send more interests.'
        
        return True, 'Allowed'
    
    @staticmethod
    def get_daily_usage(sender):
        """
        Get today's interest usage for a sender.
        
        Args:
            sender: Member instance
            
        Returns:
            dict: Usage statistics
        """
        plan = MembershipService.get_effective_plan(sender)
        daily_limit = plan.interest_limit if plan else 3
        
        today = ProfileUnlockService.get_today_date()
        resets_at = ProfileUnlockService.get_next_reset_time()
        
        interests_sent_today = Interest.objects.filter(
            sender=sender,
            created_at__date=today
        ).exclude(status=Interest.Status.DECLINED).count()
        
        remaining_today = max(0, daily_limit - interests_sent_today) if daily_limit is not None else None
        
        return {
            'daily_limit': daily_limit,
            'used_today': interests_sent_today,
            'remaining_today': remaining_today,
            'resets_at': resets_at.isoformat(),
            'is_unlimited': daily_limit is None,
        }
    
    @staticmethod
    def get_interests(user, direction='incoming', status=None):
        """
        Get interests for a user.
        
        Args:
            user: Member instance
            direction: 'incoming' or 'outgoing'
            status: Filter by status (PENDING, ACCEPTED, DECLINED) or None for all
            
        Returns:
            QuerySet: Interest queryset
        """
        queryset = Interest.objects.select_related(
            'sender', 'receiver',
            'sender__profile', 'receiver__profile'
        )
        
        if direction == 'incoming':
            queryset = queryset.filter(receiver=user)
        elif direction == 'outgoing':
            queryset = queryset.filter(sender=user)
        else:
            # Both
            queryset = queryset.filter(
                Q(sender=user) | Q(receiver=user)
            )
        
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset.order_by('-created_at')
    
    @staticmethod
    def has_mutual_interest(user1, user2):
        """
        Check if two users have mutual accepted interest.
        
        Args:
            user1: First member
            user2: Second member
            
        Returns:
            bool: True if mutual interest exists
        """
        return Interest.objects.filter(
            Q(sender=user1, receiver=user2, status=Interest.Status.ACCEPTED) |
            Q(sender=user2, receiver=user1, status=Interest.Status.ACCEPTED)
        ).exists()
