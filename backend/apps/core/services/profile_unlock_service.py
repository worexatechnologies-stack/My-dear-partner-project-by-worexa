"""
Profile Unlock Service

Handles profile unlock logic with transaction safety:
- Daily unlock limit tracking
- Duplicate unlock prevention
- Transaction-level locking to prevent race conditions
"""

import datetime
import zoneinfo
from django.db import transaction
from django.utils import timezone

from apps.core.models import ProfileUnlock, MemberMembership
from apps.accounts.models import Member
from apps.core.entitlements import get_active_entitlements


class ProfileUnlockService:
    """
    Centralized service for profile unlock operations.
    
    Rules:
    - Opening the same profile multiple times on the same day = 1 unlock
    - Refreshing the profile page does not consume another unlock
    - Failed or unauthorized requests do not consume an unlock
    - Daily reset uses Asia/Kolkata timezone
    - Transaction locking prevents concurrent requests exceeding limits
    """
    
    KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
    
    @staticmethod
    def get_today_date():
        """Get current date in Asia/Kolkata timezone."""
        return timezone.now().astimezone(ProfileUnlockService.KOLKATA_TZ).date()
    
    @staticmethod
    def get_next_reset_time():
        """Get the next midnight reset time in Asia/Kolkata."""
        local_now = timezone.now().astimezone(ProfileUnlockService.KOLKATA_TZ)
        tomorrow = local_now.date() + datetime.timedelta(days=1)
        return datetime.datetime.combine(tomorrow, datetime.time.min, tzinfo=ProfileUnlockService.KOLKATA_TZ)
    
    @staticmethod
    @transaction.atomic
    def unlock_profile(viewer, target_profile, source='search'):
        """
        Unlock a profile for viewing.
        
        Args:
            viewer: Member viewing the profile
            target_profile: Member profile being viewed
            source: Source page ('search', 'matches', 'dashboard', etc.)
            
        Returns:
            tuple: (allowed: bool, reason: str, access_data: dict)
        """
        # Lock the viewer record to prevent race conditions
        viewer = Member.objects.select_for_update().get(pk=viewer.pk)
        
        # Get today's date
        today = ProfileUnlockService.get_today_date()
        resets_at = ProfileUnlockService.get_next_reset_time()
        
        # Check if already unlocked today
        already_unlocked = ProfileUnlock.objects.filter(
            viewer=viewer,
            profile=target_profile,
            usage_date=today
        ).exists()
        
        # Typed resolver is the sole source of the member's current limit.
        daily_limit = get_active_entitlements(viewer).daily_profile_view_limit
        
        # Count unlocks used today
        used_today = ProfileUnlock.objects.filter(
            viewer=viewer,
            usage_date=today
        ).count()
        
        # Calculate remaining
        remaining_today = max(0, daily_limit - used_today) if daily_limit is not None else None
        
        # If already unlocked, allow without consuming
        if already_unlocked:
            return (
                True,
                'Already unlocked today',
                {
                    'profile_unlocked': True,
                    'unlock_consumed': False,
                    'daily_limit': daily_limit,
                    'used_today': used_today,
                    'remaining_today': remaining_today,
                    'resets_at': resets_at.isoformat(),
                }
            )
        
        # Check if limit is reached (None means unlimited)
        if daily_limit is not None and used_today >= daily_limit:
            return (
                False,
                f'You have used all {daily_limit} profile unlocks available today.',
                {
                    'profile_unlocked': False,
                    'unlock_consumed': False,
                    'daily_limit': daily_limit,
                    'used_today': used_today,
                    'remaining_today': 0,
                    'resets_at': resets_at.isoformat(),
                }
            )
        
        # Create unlock record
        active_membership = MemberMembership.objects.filter(
            member=viewer,
            is_active=True
        ).first()
        
        ProfileUnlock.objects.create(
            viewer=viewer,
            profile=target_profile,
            membership=active_membership,
            usage_date=today,
            consumed_limit=True,
            source=source
        )
        
        # Update counts
        used_today += 1
        remaining_today = max(0, daily_limit - used_today) if daily_limit is not None else None
        
        return (
            True,
            'Profile unlocked successfully',
            {
                'profile_unlocked': True,
                'unlock_consumed': True,
                'daily_limit': daily_limit,
                'used_today': used_today,
                'remaining_today': remaining_today,
                'resets_at': resets_at.isoformat(),
            }
        )
    
    @staticmethod
    def get_daily_usage(viewer):
        """
        Get today's unlock usage for a viewer.
        
        Args:
            viewer: Member instance
            
        Returns:
            dict: Usage statistics
        """
        today = ProfileUnlockService.get_today_date()
        resets_at = ProfileUnlockService.get_next_reset_time()
        
        daily_limit = get_active_entitlements(viewer).daily_profile_view_limit
        
        used_today = ProfileUnlock.objects.filter(
            viewer=viewer,
            usage_date=today
        ).count()
        
        remaining_today = max(0, daily_limit - used_today) if daily_limit is not None else None
        
        return {
            'daily_limit': daily_limit,
            'used_today': used_today,
            'remaining_today': remaining_today,
            'resets_at': resets_at.isoformat(),
            'is_unlimited': daily_limit is None,
        }
    
    @staticmethod
    def has_unlocked_profile(viewer, target_profile):
        """
        Check if viewer has unlocked the target profile (ever).
        
        Args:
            viewer: Member viewing
            target_profile: Member profile being checked
            
        Returns:
            bool: True if unlocked before, False otherwise
        """
        return ProfileUnlock.objects.filter(
            viewer=viewer,
            profile=target_profile
        ).exists()
