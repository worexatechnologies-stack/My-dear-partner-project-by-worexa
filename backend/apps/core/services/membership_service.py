"""
Membership Service

Handles all membership-related business logic:
- Instant plan activation
- Plan deactivation
- Membership status management
- Audit trail creation
"""

from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404

from apps.core.models import MembershipPlan, MemberMembership, MembershipRequest, MembershipPurchase, PaymentTransaction
from apps.accounts.models import Member


class MembershipService:
    """
    Centralized service for membership operations.
    
    Supports three activation modes via MEMBERSHIP_ACTIVATION_MODE setting:
    - 'instant': Immediate activation without payment (current)
    - 'payment_verified': Activate after successful payment (future)
    - 'manual_approval': Requires admin approval (legacy)
    """
    
    ACTIVATION_MODE_INSTANT = 'instant'
    ACTIVATION_MODE_PAYMENT = 'payment_verified'
    ACTIVATION_MODE_MANUAL = 'manual_approval'
    
    @staticmethod
    def get_activation_mode():
        """Get current membership activation mode from settings."""
        return getattr(settings, 'MEMBERSHIP_ACTIVATION_MODE', MembershipService.ACTIVATION_MODE_INSTANT)
    
    @staticmethod
    def get_payment_mode():
        """Get current payment mode from settings."""
        return getattr(settings, 'PAYMENT_MODE', 'disabled')
    
    @staticmethod
    @transaction.atomic
    def activate_plan(member, plan_slug, actor=None, source='member_request'):
        """
        Activate a membership plan for a member.
        
        Args:
            member: Member instance
            plan_slug: Plan slug to activate (e.g., 'gold', 'platinum', 'elite')
            actor: User performing the activation (for audit)
            source: Source of activation ('member_request', 'admin_direct', 'payment_verified')
            
        Returns:
            tuple: (success: bool, message: str, membership: MemberMembership or None)
        """
        # Validate plan exists and is active
        plan = get_object_or_404(MembershipPlan, slug=plan_slug, is_active=True)
        
        # Lock the member record
        member = Member.objects.select_for_update().get(pk=member.pk)
        
        # Deactivate any existing active membership in MemberMembership
        MemberMembership.objects.filter(
            member=member,
            is_active=True
        ).update(is_active=False, status=MemberMembership.MembershipStatus.EXPIRED)

        # Deactivate any existing active membership in MembershipPurchase
        MembershipPurchase.objects.filter(
            user=member,
            status='active'
        ).update(status='expired', expires_at=timezone.now())
        
        # Calculate start and end dates
        start_date = timezone.now()
        duration_days = plan.duration_days or 30
        end_date = start_date + timedelta(days=duration_days) if duration_days else None
        
        # Create or update membership
        membership = MemberMembership.objects.create(
            member=member,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            started_at=start_date,
            expires_at=end_date,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
        )

        # Create MembershipPurchase record
        MembershipPurchase.objects.create(
            user=member,
            membership_plan=plan,
            price_snapshot=plan.price,
            currency=plan.currency,
            duration_days_snapshot=duration_days,
            starts_at=start_date,
            expires_at=end_date,
            status='active',
            activated_at=start_date,
        )
        
        # Update member's premium status
        member.is_premium = True
        member.save(update_fields=['is_premium', 'updated_at'])
        
        # Create approved membership request for audit trail
        MembershipRequest.objects.create(
            user=member,
            selected_plan=plan,
            status=MembershipRequest.Status.APPROVED,
            requested_at=start_date,
            approved_at=start_date,
            approved_by_id=actor.pk if actor else None,
            start_date=start_date,
            expiry_date=end_date,
            is_active=True,
        )
        
        # Log audit event
        from apps.core.api_utils import audit
        audit(
            request=None,
            actor=actor or member,
            action='MEMBERSHIP_ACTIVATED',
            module='memberships',
            target_type='MEMBER',
            target_id=member.pk,
            new_data={
                'plan_slug': plan.slug,
                'plan_name': plan.name,
                'duration_days': duration_days,
                'source': source,
                'activation_mode': MembershipService.get_activation_mode(),
            }
        )
        
        return (
            True,
            f'{plan.name} plan activated successfully. Valid until {end_date.strftime("%B %d, %Y") if end_date else "indefinite"}.',
            membership
        )

    @staticmethod
    @transaction.atomic
    def grant_custom_membership(member, plan_slug, duration_months=12, actor=None, reason='Admin Direct Grant'):
        """
        Admin action to grant a specific plan (Gold, Elite, Premium, Silver, etc.) for a custom duration
        (1 month, 6 months, 1 year, 2 years, 3 years, etc.) without requiring payment.
        """
        plan = MembershipPlan.objects.filter(slug__iexact=str(plan_slug or '').strip(), is_active=True).first()
        if not plan:
            return False, 'The selected membership plan is unavailable. Refresh the page and choose an active plan.', None
        member = Member.objects.select_for_update().get(pk=member.pk)
        
        # Deactivate existing active memberships
        MemberMembership.objects.filter(member=member, is_active=True).update(
            is_active=False, status=MemberMembership.MembershipStatus.EXPIRED
        )
        MembershipPurchase.objects.filter(user=member, status='active').update(
            status='expired', expires_at=timezone.now()
        )

        start_date = timezone.now()
        try:
            months = int(duration_months) if duration_months else 12
        except (TypeError, ValueError):
            return False, 'Choose a valid membership duration.', None
        if months not in (1, 3, 6, 12, 24, 36):
            return False, 'Choose a membership duration between 1 and 36 months.', None
        duration_days = months * 30
        end_date = start_date + timedelta(days=duration_days)

        membership = MemberMembership.objects.create(
            member=member,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            started_at=start_date,
            expires_at=end_date,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
        )

        MembershipPurchase.objects.create(
            user=member,
            membership_plan=plan,
            price_snapshot=0,
            currency=plan.currency,
            duration_days_snapshot=duration_days,
            starts_at=start_date,
            expires_at=end_date,
            status='active',
            activated_at=start_date,
        )

        member.is_premium = True
        member.save(update_fields=['is_premium', 'updated_at'])

        return (
            True,
            f'{plan.name} granted for {months} month(s) until {end_date.strftime("%B %d, %Y")}.',
            membership
        )
    
    @staticmethod
    @transaction.atomic
    def deactivate_membership(member, reason='manual_deactivation', actor=None):
        """
        Deactivate a member's current membership.
        
        Args:
            member: Member instance
            reason: Reason for deactivation
            actor: User performing the deactivation
            
        Returns:
            tuple: (success: bool, message: str)
        """
        member = Member.objects.select_for_update().get(pk=member.pk)
        
        active_memberships = MemberMembership.objects.filter(
            member=member,
            is_active=True
        )
        
        active_purchases = MembershipPurchase.objects.filter(
            user=member,
            status='active'
        )
        
        if not active_memberships.exists() and not active_purchases.exists():
            return False, 'No active membership to deactivate.'
        
        count = active_memberships.update(is_active=False, status=MemberMembership.MembershipStatus.EXPIRED)
        active_purchases.update(status='cancelled', cancelled_at=timezone.now(), cancellation_reason=reason)
        
        # Update member's premium status
        member.is_premium = False
        member.save(update_fields=['is_premium', 'updated_at'])
        
        # Log audit event
        from apps.core.api_utils import audit
        audit(
            request=None,
            actor=actor or member,
            action='MEMBERSHIP_DEACTIVATED',
            module='memberships',
            target_type='MEMBER',
            target_id=member.pk,
            new_data={
                'reason': reason,
                'deactivated_count': count,
            }
        )
        
        return True, f'{count} membership(s) deactivated successfully.'
    
    @staticmethod
    def get_active_membership(member):
        """
        Get the member's active membership (primary MembershipPurchase, fallback MemberMembership).
        
        Args:
            member: Member instance
            
        Returns:
            MembershipPurchase/MemberMembership or None
        """
        purchase = MembershipPurchase.objects.select_related('membership_plan').filter(
            user=member,
            status='active',
        ).order_by('-starts_at', '-created_at').first()
        if purchase:
            return purchase
            
        return MemberMembership.objects.select_related('plan').filter(
            member=member,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
        ).order_by('-started_at', '-created_at').first()
    
    @staticmethod
    def get_effective_plan(member):
        """
        Get the effective plan for a member (returns plan or None for Free).
        
        Args:
            member: Member instance
            
        Returns:
            MembershipPlan or None
        """
        membership = MembershipService.get_active_membership(member)
        
        if not membership:
            return None
            
        plan = None
        if isinstance(membership, MembershipPurchase):
            plan = membership.membership_plan
        else:
            plan = membership.plan
        
        if not plan:
            return None
        
        # Check if membership has expired
        expiry = membership.expires_at if hasattr(membership, 'expires_at') else (membership.end_date if hasattr(membership, 'end_date') else None)
        if expiry and expiry <= timezone.now():
            return None
        
        # Check member account status
        if member.account_status != Member.AccountStatus.ACTIVE or not member.is_active:
            return None
        
        return plan
    
    @staticmethod
    def check_membership_expiry(member):
        """
        Check if membership has expired and update status if needed.
        
        Args:
            member: Member instance
            
        Returns:
            bool: True if expired and updated, False otherwise
        """
        # Expire MembershipPurchase records
        purchase = MembershipPurchase.objects.filter(
            user=member,
            status='active'
        ).order_by('-starts_at', '-created_at').first()
        
        purchase_expired = False
        if purchase and purchase.expires_at and purchase.expires_at <= timezone.now():
            purchase.status = 'expired'
            purchase.save(update_fields=['status', 'updated_at'])
            purchase_expired = True
            
        # Expire MemberMembership records
        membership = MemberMembership.objects.filter(
            member=member,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
        ).order_by('-started_at', '-created_at').first()
        
        mem_expired = False
        if membership and (membership.expires_at or membership.end_date):
            expiry = membership.expires_at or membership.end_date
            if expiry <= timezone.now():
                membership.is_active = False
                membership.status = MemberMembership.MembershipStatus.EXPIRED
                membership.end_date = expiry
                membership.expires_at = expiry
                membership.save(update_fields=['is_active', 'status', 'end_date', 'expires_at', 'updated_at'])
                mem_expired = True

        if purchase_expired or mem_expired:
            member.is_premium = False
            member.save(update_fields=['is_premium', 'updated_at'])
            return True
            
        return False
    
    @staticmethod
    def get_membership_summary(member):
        """
        Get comprehensive membership summary for a member.
        
        Args:
            member: Member instance
            
        Returns:
            dict: Membership summary with plan details and limits
        """
        plan = MembershipService.get_effective_plan(member)
        membership = MembershipService.get_active_membership(member)
        
        if not plan:
            # Free / Trial plan: feature flags mirror get_active_entitlements
            from apps.core.entitlements import get_active_entitlements
            entitlements = get_active_entitlements(member)
            messaging_mode = 'ENABLED' if entitlements.can_chat else 'DISABLED'
            return {
                'has_active_plan': entitlements.is_trial,
                'plan_name': entitlements.plan_name,
                'plan_slug': entitlements.plan_slug,
                'is_free': True,
                'is_trial': entitlements.is_trial,
                'trial_expires_at': entitlements.trial_expires_at,
                'trial_days_remaining': entitlements.trial_days_remaining,
                'start_date': getattr(member, 'created_at', None) or getattr(member, 'date_joined', None),
                'end_date': entitlements.trial_expires_at,
                'days_remaining': entitlements.trial_days_remaining if entitlements.is_trial else 0,
                'daily_profile_unlock_limit': entitlements.daily_profile_view_limit,
                'daily_interest_limit': entitlements.daily_interest_limit,
                'can_message': entitlements.can_chat,
                'can_use_advanced_search': entitlements.can_use_advanced_search,
                'contact_access_mode': entitlements.contact_access_mode,
                'photo_access_mode': entitlements.photo_access_mode,
                'messaging_mode': messaging_mode,
            }
        
        # Calculate days remaining
        days_remaining = None
        if membership and (membership.expires_at or membership.end_date):
            delta = (membership.expires_at or membership.end_date) - timezone.now()
            days_remaining = max(0, delta.days)
        
        return {
            'has_active_plan': True,
            'plan_name': plan.name,
            'plan_slug': plan.slug,
            'is_free': False,
            'start_date': (membership.started_at or membership.start_date) if membership else None,
            'end_date': (membership.expires_at or membership.end_date) if membership else None,
            'days_remaining': days_remaining,
            'daily_profile_unlock_limit': plan.daily_profile_unlock_limit,
            'daily_interest_limit': plan.interest_limit,
            'can_message': bool(plan.can_message),
            'can_use_advanced_search': plan.can_use_advanced_search,
            'contact_access_mode': plan.contact_access_mode,
            'photo_access_mode': plan.photo_access_mode,
            'messaging_mode': plan.messaging_mode,
        }
