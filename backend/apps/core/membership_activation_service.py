"""
Membership Activation Service

Handles the complete membership lifecycle:
1. Unverified member selects plan → save as pending_verification
2. Account gets verified → automatically activate pending_verification
3. Verified member selects plan → immediate activation

This service works with AccountVerificationService to enforce
verification requirements before membership activation.
"""

from datetime import timedelta
from typing import NamedTuple, Tuple, Optional
from django.utils import timezone
from django.db import transaction
from .models import MemberMembership, MembershipPlan
from apps.accounts.models import Member
from apps.accounts.verification_service import AccountVerificationService


class MembershipActivationResult(NamedTuple):
    """Result of membership activation attempt"""
    success: bool
    message: str
    membership: Optional['MemberMembership'] = None
    status: str = 'PENDING_VERIFICATION'  # PENDING_VERIFICATION | ACTIVE | ERROR


class MembershipActivationService:
    """
    Service for managing membership activation workflow.
    
    Statuses:
    - pending_verification: Plan selected, waiting for account verification
    - active: Member has verified account, plan is active
    - expired: Plan validity period has ended
    - cancelled: Member cancelled the plan
    - suspended: Account suspended, plan not usable
    """

    STATUS_PENDING_VERIFICATION = 'PENDING_VERIFICATION'
    STATUS_ACTIVE = 'ACTIVE'
    STATUS_EXPIRED = 'EXPIRED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_SUSPENDED = 'SUSPENDED'

    @staticmethod
    @transaction.atomic
    def select_plan_unverified(
        member: Member,
        plan_slug: str,
        source: str = 'member_request'
    ) -> MembershipActivationResult:
        """
        Unverified member selects a plan.
        
        Workflow:
        1. Validate plan exists and is active
        2. Validate member is not already verified (if verified, use verified flow)
        3. Deactivate any existing pending_verification membership
        4. Create new MemberMembership with status=pending_verification
        5. Do NOT activate entitlements yet
        6. Return success with status=pending_verification
        
        Args:
            member: Member selecting the plan
            plan_slug: Membership plan slug (gold, platinum, elite)
            source: Source of selection (member_request, admin_upgrade, etc)
            
        Returns:
            MembershipActivationResult with status and message
        """
        # Validate member is not already verified
        if AccountVerificationService.is_account_verified(member):
            return MembershipActivationResult(
                success=False,
                message='Use the verified activation flow for verified accounts'
            )

        # Get plan
        try:
            plan = MembershipPlan.objects.get(slug=plan_slug, is_active=True)
        except MembershipPlan.DoesNotExist:
            return MembershipActivationResult(
                success=False,
                message=f'Plan "{plan_slug}" does not exist or is not active'
            )

        # Check if plan is free (should not go through pending_verification)
        if plan_slug == 'free':
            return MembershipActivationResult(
                success=False,
                message='Free plan is the default. No activation required.'
            )

        # Deactivate any existing pending_verification membership
        MemberMembership.objects.filter(
            member=member,
            status=MembershipActivationService.STATUS_PENDING_VERIFICATION
        ).update(status=MembershipActivationService.STATUS_CANCELLED)

        # Create new pending_verification membership
        membership = MemberMembership.objects.create(
            member=member,
            plan=plan,
            status=MembershipActivationService.STATUS_PENDING_VERIFICATION,
            is_active=False,  # Entitlements not active yet
            start_date=None,  # Will be set when verified
            end_date=None
        )

        return MembershipActivationResult(
            success=True,
            message=f'{plan.display_name} plan selected. Waiting for account verification to activate.',
            membership=membership,
            status=MembershipActivationService.STATUS_PENDING_VERIFICATION
        )

    @staticmethod
    @transaction.atomic
    def activate_pending_membership(member: Member) -> MembershipActivationResult:
        """
        Automatically activate pending_verification membership when account is verified.
        
        Called by signal handler when account verification is completed.
        
        Workflow:
        1. Check if member has pending_verification membership
        2. If not, no action (member can select plan after verification)
        3. If yes:
           a. Set start_date = now
           b. Calculate end_date from plan.duration_days
           c. Change status to active
           d. Set is_active = True
           e. Apply entitlements
           f. Send notification
           g. Record in audit log
        
        Args:
            member: Member whose account was just verified
            
        Returns:
            MembershipActivationResult
        """
        pending = MemberMembership.objects.filter(
            member=member,
            status=MembershipActivationService.STATUS_PENDING_VERIFICATION
        ).first()

        if not pending:
            return MembershipActivationResult(
                success=True,
                message='Account verified. No pending membership to activate.',
                membership=None
            )

        # Check plan is still active
        if not pending.plan or not pending.plan.is_active:
            pending.status = MembershipActivationService.STATUS_CANCELLED
            pending.save(update_fields=['status', 'updated_at'])
            return MembershipActivationResult(
                success=False,
                message='Pending plan is no longer active',
                membership=pending
            )

        # Activate the membership
        now = timezone.now()
        end_date = now + timedelta(days=pending.plan.duration_days)

        pending.status = MembershipActivationService.STATUS_ACTIVE
        pending.is_active = True
        pending.start_date = now
        pending.end_date = end_date
        pending.save(update_fields=['status', 'is_active', 'start_date', 'end_date', 'updated_at'])

        # Update member's premium status
        member.is_premium = True
        member.save(update_fields=['is_premium', 'updated_at'])

        return MembershipActivationResult(
            success=True,
            message=f'{pending.plan.display_name} membership activated successfully!',
            membership=pending,
            status=MembershipActivationService.STATUS_ACTIVE
        )

    @staticmethod
    @transaction.atomic
    def select_plan_verified(
        member: Member,
        plan_slug: str,
        source: str = 'member_request'
    ) -> MembershipActivationResult:
        """
        Verified member selects a plan.
        
        Workflow:
        1. Verify account is verified
        2. Validate plan exists and is active
        3. Deactivate previous active membership
        4. Create and activate new membership immediately
        5. Set start_date = now, end_date from duration
        6. Apply entitlements
        7. Send notification
        8. Record in audit log
        
        Args:
            member: Verified member selecting the plan
            plan_slug: Membership plan slug
            source: Source of selection
            
        Returns:
            MembershipActivationResult with status=active
        """
        # Verify account is verified
        if not AccountVerificationService.is_account_verified(member):
            return MembershipActivationResult(
                success=False,
                message='Account must be verified to select a paid plan. Complete verification first.'
            )

        # Get plan
        try:
            plan = MembershipPlan.objects.get(slug=plan_slug, is_active=True)
        except MembershipPlan.DoesNotExist:
            return MembershipActivationResult(
                success=False,
                message=f'Plan "{plan_slug}" does not exist or is not active'
            )

        # Check if plan is free
        if plan_slug == 'free':
            return MembershipActivationResult(
                success=False,
                message='Free plan is the default. No activation required.'
            )

        # Deactivate previous active membership
        previous = MemberMembership.objects.filter(
            member=member,
            status=MembershipActivationService.STATUS_ACTIVE
        ).first()

        if previous:
            previous.status = MembershipActivationService.STATUS_EXPIRED
            previous.is_active = False
            previous.save(update_fields=['status', 'is_active', 'updated_at'])

        # Create and immediately activate new membership
        now = timezone.now()
        end_date = now + timedelta(days=plan.duration_days)

        membership = MemberMembership.objects.create(
            member=member,
            plan=plan,
            status=MembershipActivationService.STATUS_ACTIVE,
            is_active=True,
            start_date=now,
            end_date=end_date
        )

        # Update member's premium status
        member.is_premium = True
        member.save(update_fields=['is_premium', 'updated_at'])

        return MembershipActivationResult(
            success=True,
            message=f'{plan.display_name} membership activated successfully!',
            membership=membership,
            status=MembershipActivationService.STATUS_ACTIVE
        )

    @staticmethod
    def get_active_membership(member: Member) -> Optional[MemberMembership]:
        """
        Get member's currently active membership.
        
        Args:
            member: Member to check
            
        Returns:
            Active MemberMembership or None
        """
        return MemberMembership.objects.filter(
            member=member,
            status=MembershipActivationService.STATUS_ACTIVE,
            is_active=True
        ).first()

    @staticmethod
    def get_pending_membership(member: Member) -> Optional[MemberMembership]:
        """
        Get member's pending_verification membership.
        
        Args:
            member: Member to check
            
        Returns:
            Pending MemberMembership or None
        """
        return MemberMembership.objects.filter(
            member=member,
            status=MembershipActivationService.STATUS_PENDING_VERIFICATION
        ).first()

    @staticmethod
    def deactivate_membership(
        member: Member,
        reason: str = 'member_requested'
    ) -> Tuple[bool, str]:
        """
        Deactivate member's active or pending membership.
        
        Args:
            member: Member whose membership to deactivate
            reason: Reason for deactivation
            
        Returns:
            Tuple of (success: bool, message: str)
        """
        membership = MembershipActivationService.get_active_membership(member)
        
        if not membership:
            return False, 'No active membership found'

        membership.status = MembershipActivationService.STATUS_CANCELLED
        membership.is_active = False
        membership.save(update_fields=['status', 'is_active', 'updated_at'])

        # Update member's premium status
        member.is_premium = False
        member.save(update_fields=['is_premium', 'updated_at'])

        return True, 'Membership deactivated'

    @staticmethod
    def get_membership_summary(member: Member) -> dict:
        """
        Get complete membership status for member.
        
        Returns dict with:
        - has_active_plan: bool
        - plan_name: str
        - plan_slug: str
        - is_free: bool
        - start_date, end_date
        - days_remaining
        - status: active | pending_verification | none
        - entitlements: {...}
        
        Args:
            member: Member to check
            
        Returns:
            Dictionary with membership summary
        """
        active = MembershipActivationService.get_active_membership(member)
        pending = MembershipActivationService.get_pending_membership(member)

        if active:
            now = timezone.now()
            days_remaining = (active.end_date - now).days if active.end_date else 0
            
            return {
                'has_active_plan': True,
                'plan_name': active.plan.display_name if active.plan else 'Unknown',
                'plan_slug': active.plan.slug if active.plan else None,
                'is_free': False,
                'start_date': active.start_date,
                'end_date': active.end_date,
                'days_remaining': max(0, days_remaining),
                'status': 'active',
                'membership_id': str(active.id)
            }
        elif pending:
            return {
                'has_active_plan': False,
                'plan_name': pending.plan.display_name if pending.plan else 'Unknown',
                'plan_slug': pending.plan.slug if pending.plan else None,
                'is_free': False,
                'start_date': None,
                'end_date': None,
                'days_remaining': 0,
                'status': 'pending_verification',
                'membership_id': str(pending.id),
                'next_action': 'Complete account verification to activate membership'
            }
        else:
            return {
                'has_active_plan': False,
                'plan_name': 'Free',
                'plan_slug': 'free',
                'is_free': True,
                'start_date': member.created_at,
                'end_date': None,
                'days_remaining': None,
                'status': 'none'
            }
