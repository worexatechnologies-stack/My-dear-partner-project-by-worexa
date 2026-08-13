"""
Centralized Account Verification Service

Single source of truth for all account verification logic.
NO AUTO-APPROVAL. All verification items requiring admin approval must go through admin queue.
"""

from typing import NamedTuple, Optional
from django.db import transaction
from django.utils import timezone
from .models import Member


class VerificationItemStatus(NamedTuple):
    """Status of a single verification item"""
    status: str
    name: str
    submitted_at: Optional[str]
    reviewed_at: Optional[str]
    reason: Optional[str]


class VerificationSummary(NamedTuple):
    """Complete verification status structure"""
    overall_status: str
    is_verified: bool
    completed_steps: int
    total_steps: int
    mobile_verified: bool
    profile_information_status: str
    profile_photo_status: str
    government_id_status: str
    profile: VerificationItemStatus
    photo: VerificationItemStatus
    document: VerificationItemStatus
    next_action: str
    membership_pending: bool


class AccountVerificationService:
    """Centralized service for all account verification logic"""
    
    # Standardized status values
    STATUS_NOT_STARTED = 'not_started'
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_REVIEW = 'pending_review'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHANGES_REQUESTED = 'changes_requested'
    
    # Overall account status
    OVERALL_INCOMPLETE = 'incomplete'
    OVERALL_PENDING = 'pending'
    OVERALL_VERIFIED = 'verified'
    OVERALL_REJECTED = 'rejected'
    OVERALL_CHANGES_REQUESTED = 'changes_requested'
    @staticmethod
    def get_profile_info_status(member: Member) -> VerificationItemStatus:
        """Get profile information verification status"""
        status = member.profile_status or AccountVerificationService.STATUS_NOT_STARTED
        
        return VerificationItemStatus(
            status=status,
            name='Profile Information',
            submitted_at=member.profile_submitted_at.isoformat() if member.profile_submitted_at else None,
            reviewed_at=member.profile_reviewed_at.isoformat() if member.profile_reviewed_at else None,
            reason=member.profile_rejection_reason if status in [
                AccountVerificationService.STATUS_REJECTED,
                AccountVerificationService.STATUS_CHANGES_REQUESTED
            ] else None
        )

    @staticmethod
    def get_photo_status(member: Member) -> VerificationItemStatus:
        """Get profile photo verification status"""
        from apps.profiles.models import ProfilePhoto

        primary_photo = (
            ProfilePhoto.objects.without_binary()
            .filter(user=member, is_primary=True)
            .first()
        )
        
        if not primary_photo:
            return VerificationItemStatus(
                status=AccountVerificationService.STATUS_NOT_STARTED,
                name='Profile Photo',
                submitted_at=None,
                reviewed_at=None,
                reason=None
            )
        
        # Map ProfilePhoto status to standardized status
        photo_status_map = {
            ProfilePhoto.Status.PENDING: AccountVerificationService.STATUS_PENDING_REVIEW,
            ProfilePhoto.Status.APPROVED: AccountVerificationService.STATUS_APPROVED,
            ProfilePhoto.Status.REJECTED: AccountVerificationService.STATUS_REJECTED,
        }
        
        status = photo_status_map.get(
            primary_photo.status, 
            AccountVerificationService.STATUS_NOT_STARTED
        )
        
        return VerificationItemStatus(
            status=status,
            name='Profile Photo',
            submitted_at=primary_photo.created_at.isoformat() if primary_photo.created_at else None,
            reviewed_at=primary_photo.verified_at.isoformat() if primary_photo.verified_at else None,
            reason=getattr(primary_photo, 'rejection_reason', None) if status == AccountVerificationService.STATUS_REJECTED else None
        )
    @staticmethod
    def get_document_status(member: Member) -> VerificationItemStatus:
        """Get government ID verification status"""
        status = member.document_status or AccountVerificationService.STATUS_NOT_STARTED
        
        return VerificationItemStatus(
            status=status,
            name='Government ID',
            submitted_at=member.document_submitted_at.isoformat() if member.document_submitted_at else None,
            reviewed_at=member.document_reviewed_at.isoformat() if member.document_reviewed_at else None,
            reason=member.document_rejection_reason if status in [
                AccountVerificationService.STATUS_REJECTED,
                AccountVerificationService.STATUS_CHANGES_REQUESTED
            ] else None
        )

    @staticmethod
    def get_verification_summary(member: Member, check_membership_pending: bool = True) -> VerificationSummary:
        """Get complete verification status summary - SINGLE SOURCE OF TRUTH"""
        # Get individual item statuses
        profile_status = AccountVerificationService.get_profile_info_status(member)
        photo_status = AccountVerificationService.get_photo_status(member)
        document_status = AccountVerificationService.get_document_status(member)

        # Mobile verification is the only contact verification requirement.
        mobile_verified = member.is_mobile_verified

        # Count completed steps
        completed_steps = 0
        if mobile_verified:
            completed_steps += 1
        if profile_status.status == AccountVerificationService.STATUS_APPROVED:
            completed_steps += 1
        if photo_status.status == AccountVerificationService.STATUS_APPROVED:
            completed_steps += 1
        if document_status.status == AccountVerificationService.STATUS_APPROVED:
            completed_steps += 1
        
        total_steps = 4
        # Determine overall status
        is_verified = AccountVerificationService.is_account_verified(member)
        
        # Check if any item is rejected
        any_rejected = any([
            profile_status.status == AccountVerificationService.STATUS_REJECTED,
            photo_status.status == AccountVerificationService.STATUS_REJECTED,
            document_status.status == AccountVerificationService.STATUS_REJECTED,
        ])
        
        # Check if any item has changes requested
        any_changes_requested = any([
            profile_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED,
            photo_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED,
            document_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED,
        ])
        
        # Check if all manual items are pending review
        all_pending = all([
            profile_status.status == AccountVerificationService.STATUS_PENDING_REVIEW,
            photo_status.status == AccountVerificationService.STATUS_PENDING_REVIEW,
            document_status.status == AccountVerificationService.STATUS_PENDING_REVIEW,
        ]) and mobile_verified
        
        # Determine overall status
        if is_verified:
            overall_status = AccountVerificationService.OVERALL_VERIFIED
        elif any_rejected:
            overall_status = AccountVerificationService.OVERALL_REJECTED
        elif any_changes_requested:
            overall_status = AccountVerificationService.OVERALL_CHANGES_REQUESTED
        elif all_pending:
            overall_status = AccountVerificationService.OVERALL_PENDING
        else:
            overall_status = AccountVerificationService.OVERALL_INCOMPLETE
        # Determine next action
        next_action = AccountVerificationService._get_next_action(
            mobile_verified, profile_status, photo_status, document_status, overall_status
        )

        # Check for pending membership
        membership_pending = False
        if check_membership_pending:
            from apps.core.models import MemberMembership
            membership_pending = MemberMembership.objects.filter(
                member=member,
                status='PENDING_VERIFICATION'
            ).exists()

        return VerificationSummary(
            overall_status=overall_status,
            is_verified=is_verified,
            completed_steps=completed_steps,
            total_steps=total_steps,
            mobile_verified=mobile_verified,
            profile_information_status=profile_status.status,
            profile_photo_status=photo_status.status,
            government_id_status=document_status.status,
            profile=profile_status,
            photo=photo_status,
            document=document_status,
            next_action=next_action,
            membership_pending=membership_pending
        )
    @staticmethod
    def _get_next_action(mobile_verified, profile_status, photo_status, document_status, overall_status):
        """Determine the next action message for the user"""
        if overall_status == AccountVerificationService.OVERALL_VERIFIED:
            return 'Your account is fully verified! You can access all features.'
        
        if not mobile_verified:
            return 'Verify your mobile number to continue.'
        
        # Check for rejected items
        if profile_status.status == AccountVerificationService.STATUS_REJECTED:
            return f'Your profile was rejected. Reason: {profile_status.reason}. Please update and resubmit.'
        if photo_status.status == AccountVerificationService.STATUS_REJECTED:
            return f'Your photo was rejected. Reason: {photo_status.reason}. Please upload a new photo.'
        if document_status.status == AccountVerificationService.STATUS_REJECTED:
            return f'Your document was rejected. Reason: {document_status.reason}. Please upload a valid government ID.'
        
        # Check for changes requested
        if profile_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED:
            return f'Changes requested for your profile. {profile_status.reason}'
        if photo_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED:
            return f'Changes requested for your photo. {photo_status.reason}'
        if document_status.status == AccountVerificationService.STATUS_CHANGES_REQUESTED:
            return f'Changes requested for your document. {document_status.reason}'
        
        # Check what needs to be submitted
        if profile_status.status in [AccountVerificationService.STATUS_NOT_STARTED, AccountVerificationService.STATUS_DRAFT]:
            return 'Complete and submit your profile information for review.'
        if photo_status.status == AccountVerificationService.STATUS_NOT_STARTED:
            return 'Upload your profile photo for verification.'
        if document_status.status == AccountVerificationService.STATUS_NOT_STARTED:
            return 'Upload your government ID for verification.'
        
        # All submitted, waiting for review
        return 'Your documents are under review. We will notify you once the review is complete.'
    @staticmethod
    def is_account_verified(member: Member) -> bool:
        """Check the lightweight "verified" requirement: both identity
        the mobile contact is confirmed. This drives `is_verified`, `overall_status`, and
        membership-unlock gating. The stricter all-steps state is
        `are_verification_checks_passed` / `is_fully_verified`."""
        if member.account_status != Member.AccountStatus.ACTIVE or member.deleted_at is not None:
            return False
        return bool(member.is_mobile_verified)
    @staticmethod
    @transaction.atomic
    def submit_profile_for_review(member: Member) -> bool:
        """Submit profile information for admin review - NO AUTO-APPROVAL"""
        if member.profile_status == AccountVerificationService.STATUS_APPROVED:
            return True
        
        member.profile_status = AccountVerificationService.STATUS_PENDING_REVIEW
        member.profile_submitted_at = timezone.now()
        member.profile_rejection_reason = ''
        member.save(update_fields=['profile_status', 'profile_submitted_at', 'profile_rejection_reason', 'updated_at'])
        
        # Create verification request for admin queue
        from apps.core.models import ProfileVerificationRequest
        ProfileVerificationRequest.objects.get_or_create(
            member=member,
            verification_type=ProfileVerificationRequest.VerificationType.FULL_PROFILE,
            status=ProfileVerificationRequest.Status.PENDING_REVIEW,
            defaults={'submitted_at': timezone.now()}
        )
        
        return True

    @staticmethod
    @transaction.atomic
    def approve_profile(member: Member, reviewed_by, reason: str = '', force: bool = False) -> tuple[bool, str]:
        """Admin approves profile information. If force=True, bypasses photo/doc requirement for Super Admins."""
        if not force:
            profile = getattr(member, 'profile', None)
            bio_text = str(getattr(profile, 'about', '') or getattr(member, 'about_me', '') or '').strip()
            has_bio = len(bio_text) > 5

            has_photo = (
                str(member.photo_status or '').lower() == 'approved'
                or member.profile_photos.filter(status__iexact='APPROVED').exists()
            )

            has_doc = (
                str(member.document_status or '').lower() == 'approved'
                or member.documents.filter(status__iexact='APPROVED').exists()
            )

            missing = []
            if not has_bio:
                missing.append("Updated Bio")
            if not has_photo:
                missing.append("Approved Photo")
            if not has_doc:
                missing.append("Approved Document")

            if missing:
                return False, f"Missing requirements: {', '.join(missing)}."

        member.profile_status = AccountVerificationService.STATUS_APPROVED
        member.profile_reviewed_at = timezone.now()
        member.profile_rejection_reason = ''
        member.save(update_fields=['profile_status', 'profile_reviewed_at', 'profile_rejection_reason', 'updated_at'])
        
        # Update verification request
        from apps.core.models import ProfileVerificationRequest, ProfileVerificationHistory
        vr = ProfileVerificationRequest.objects.filter(
            member=member,
            verification_type=ProfileVerificationRequest.VerificationType.FULL_PROFILE
        ).first()
        
        if vr:
            old_status = vr.status
            vr.status = ProfileVerificationRequest.Status.APPROVED
            vr.approved_at = timezone.now()
            vr.reviewed_at = timezone.now()
            AccountVerificationService._set_reviewer(vr, reviewed_by)
            vr.save()
            
            # Create history entry
            ProfileVerificationHistory.objects.create(
                verification_request=vr,
                old_status=old_status,
                new_status=vr.status,
                changed_by_admin=getattr(vr, 'reviewed_by_admin', None),
                changed_by_super_admin=getattr(vr, 'reviewed_by_super_admin', None),
                reason=reason or ('Force approved by admin' if force else 'Profile approved')
            )
        
        return True, "Profile approved successfully."

    @staticmethod
    @transaction.atomic
    def reject_profile(member: Member, reviewed_by, reason: str = '') -> bool:
        """Admin rejects profile information"""
        reason_text = (reason or '').strip() or 'Profile rejected by admin.'
        
        member.profile_status = AccountVerificationService.STATUS_REJECTED
        member.profile_reviewed_at = timezone.now()
        member.profile_rejection_reason = reason_text
        member.save(update_fields=['profile_status', 'profile_reviewed_at', 'profile_rejection_reason', 'updated_at'])
        
        # Update verification request
        from apps.core.models import ProfileVerificationRequest, ProfileVerificationHistory
        vr = ProfileVerificationRequest.objects.filter(
            member=member,
            verification_type=ProfileVerificationRequest.VerificationType.FULL_PROFILE
        ).first()
        
        if vr:
            old_status = vr.status
            vr.status = ProfileVerificationRequest.Status.REJECTED
            vr.rejected_at = timezone.now()
            vr.reviewed_at = timezone.now()
            vr.rejection_reason = reason_text
            AccountVerificationService._set_reviewer(vr, reviewed_by)
            vr.save()
            
            # Create history entry
            ProfileVerificationHistory.objects.create(
                verification_request=vr,
                old_status=old_status,
                new_status=vr.status,
                changed_by_admin=getattr(vr, 'reviewed_by_admin', None),
                changed_by_super_admin=getattr(vr, 'reviewed_by_super_admin', None),
                reason=reason_text
            )
        
        return True

    @staticmethod
    def _set_reviewer(vr, reviewed_by):
        """Set the appropriate reviewer field based on reviewer account_type"""
        if not reviewed_by:
            return
        account_type = str(getattr(reviewed_by, 'account_type', '')).upper()
        if account_type == 'SUPER_ADMIN':
            try:
                from apps.accounts.models import SuperAdmin
                if isinstance(reviewed_by, SuperAdmin):
                    vr.reviewed_by_super_admin = reviewed_by
                else:
                    vr.reviewed_by_super_admin_id = getattr(reviewed_by, 'pk', None) or getattr(reviewed_by, 'id', None)
            except Exception:
                pass
        else:
            try:
                from apps.accounts.models import Admin
                if isinstance(reviewed_by, Admin):
                    vr.reviewed_by_admin = reviewed_by
                else:
                    vr.reviewed_by_admin_id = getattr(reviewed_by, 'pk', None) or getattr(reviewed_by, 'id', None)
            except Exception:
                pass
