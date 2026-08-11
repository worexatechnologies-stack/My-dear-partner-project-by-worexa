import logging
from django.utils import timezone
from django.db import transaction
from django.db.models import F
from apps.accounts.models import Staff
from apps.core.models import (
    ProfileVerificationRequest, ProfileVerificationAssignment, WorkAssignment,
    AssignmentRule, AssignmentAudit, Notification, Workload
)

logger = logging.getLogger(__name__)

def auto_assign_verification(verification: ProfileVerificationRequest) -> bool:
    """
    Automatically routes and assigns a ProfileVerificationRequest to the best available Staff member
    based on active AssignmentRules.
    """
    try:
        rules = AssignmentRule.objects.filter(
            verification_type=verification.verification_type,
            is_active=True
        ).order_by('-priority_order', 'created_at')

        rule = rules.first()
        if not rule:
            logger.info(f"No active assignment rule found for verification request {verification.id} (type: {verification.verification_type}).")
            
            AssignmentAudit.objects.create(
                related_object_id=verification.id,
                related_object_type='VERIFICATION',
                strategy_applied='NONE',
                success=False,
                failure_reason=f"No matching AssignmentRule for verification type: {verification.verification_type}"
            )
            return False

        staff_members = Staff.objects.filter(
            is_active=True,
            deleted_at__isnull=True,
            availability__is_suspended=False,
            availability__availability_status='AVAILABLE'
        )

        staff_members = staff_members.filter(workload__open_verifications_count__lt=F('workload__capacity'))

        if not staff_members.exists():
            AssignmentAudit.objects.create(
                related_object_id=verification.id,
                related_object_type='VERIFICATION',
                rule_applied=rule,
                strategy_applied=rule.strategy.code,
                success=False,
                failure_reason="No eligible staff members found within capacity"
            )
            return False

        strategy_code = rule.strategy.code
        selected_staff = None

        if strategy_code == 'ROUND_ROBIN':
            selected_staff = staff_members.order_by(F('workload__last_assigned_at').asc(nulls_first=True)).first()
        elif strategy_code == 'LEAST_WORKLOAD':
            selected_staff = staff_members.order_by('workload__open_verifications_count').first()
        else:
            selected_staff = staff_members.order_by(F('workload__last_assigned_at').asc(nulls_first=True)).first()

        if not selected_staff:
            return False

        with transaction.atomic():
            verification.status = ProfileVerificationRequest.Status.PENDING_REVIEW
            verification.save()

            ProfileVerificationAssignment.objects.filter(verification_request=verification, is_current=True).update(is_current=False)
            ProfileVerificationAssignment.objects.create(
                verification_request=verification,
                assigned_to_staff=selected_staff,
                is_current=True
            )

            assignment_type = 'PROFILE_VERIFICATION'
            if verification.verification_type == 'PROFILE_PHOTO':
                assignment_type = 'PHOTO_VERIFICATION'
            elif verification.verification_type == 'IDENTITY_DOCUMENT':
                assignment_type = 'DOCUMENT_VERIFICATION'

            WorkAssignment.objects.filter(related_profile_verification=verification).delete()
            WorkAssignment.objects.create(
                assignment_type=assignment_type,
                assigned_to_staff=selected_staff,
                related_profile_verification=verification,
                priority=verification.priority,
                status='ASSIGNED',
                due_at=timezone.now() + timezone.timedelta(days=1),
                notes=f"Auto-assigned using {strategy_code} strategy."
            )

            workload = selected_staff.workload
            workload.open_verifications_count += 1
            workload.last_assigned_at = timezone.now()
            workload.current_workload_score = workload.open_verifications_count + workload.open_tickets_count
            workload.save()

            AssignmentAudit.objects.create(
                related_object_id=verification.id,
                related_object_type='VERIFICATION',
                rule_applied=rule,
                strategy_applied=strategy_code,
                assigned_staff=selected_staff,
                success=True
            )

            Notification.objects.create(
                staff_recipient=selected_staff,
                notification_type='VERIFICATION_ASSIGNMENT',
                title='New Verification Task Assigned',
                message=f"Verification Request {verification.id} ({verification.get_verification_type_display()}) has been auto-assigned to you.",
                priority=Notification.Priority.NORMAL
            )

        logger.info(f"Successfully auto-assigned verification request {verification.id} to staff {selected_staff.email}.")
        return True
    except Exception as e:
        logger.exception(f"Error during auto-assignment of verification {verification.id}: {str(e)}")
        return False
