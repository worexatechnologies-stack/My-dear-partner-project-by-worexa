import gzip
import pytest

from apps.accounts.models import AdminActivityLog, Member, MemberDocument, StaffActivityLog
from apps.core.models import (
    Notification,
    ProfileVerificationAssignment,
    ProfileVerificationHistory,
    ProfileVerificationRequest,
)


pytestmark = pytest.mark.django_db


def new_verification(member, verification_type='FULL_PROFILE'):
    return ProfileVerificationRequest.objects.create(
        member=member,
        verification_type=verification_type,
    )


def assign_verification(client, verification, staff):
    response = client.post(
        f'/api/v1/admin/verifications/{verification.pk}/',
        {'action': 'assign', 'staff_id': str(staff.pk)},
        format='json',
    )
    assert response.status_code == 200, response.data
    verification.refresh_from_db()


def test_admin_assigns_profile_review_to_staff_only(
    authenticated_client, member, admin_account, staff_account
):
    verification = new_verification(member)
    assign_verification(authenticated_client(admin_account), verification, staff_account)
    assignment = ProfileVerificationAssignment.objects.get(
        verification_request=verification,
        is_current=True,
    )
    assert assignment.assigned_to_staff == staff_account
    assert assignment.assigned_by_admin == admin_account
    assert verification.status == ProfileVerificationRequest.Status.PENDING_REVIEW
    assert Notification.objects.filter(
        staff_recipient=staff_account,
        notification_type='PROFILE_ASSIGNED',
    ).exists()
    assert AdminActivityLog.objects.filter(
        actor_id=admin_account.pk,
        action='PROFILE_VERIFICATION_ASSIGNED',
    ).exists()


def test_super_admin_can_directly_approve_a_pending_document_verification(
    authenticated_client, member, super_admin
):
    document = MemberDocument.objects.create(
        member=member,
        document_type='AADHAAR',
        original_file_name='test-id.pdf',
        file_data=gzip.compress(b'%PDF-1.4 test document'),
        mime_type='application/pdf',
        file_size=18,
        compressed_size=len(gzip.compress(b'%PDF-1.4 test document')),
        status=MemberDocument.Status.PENDING,
    )
    verification = new_verification(member, ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT)
    verification.verification_documents.create(member_document=document)

    response = authenticated_client(super_admin).post(
        f'/api/v1/admin/verifications/{verification.pk}/',
        {'action': 'approve'},
        format='json',
    )

    assert response.status_code == 200, response.data
    verification.refresh_from_db()
    document.refresh_from_db()
    assert verification.status == ProfileVerificationRequest.Status.APPROVED
    assert document.status == MemberDocument.Status.APPROVED


def test_staff_approval_updates_member_and_writes_separate_activity(
    authenticated_client, member, admin_account, staff_account
):
    verification = new_verification(member)
    assign_verification(authenticated_client(admin_account), verification, staff_account)
    response = authenticated_client(staff_account).post(
        f'/api/v1/staff/verifications/{verification.pk}/',
        {'action': 'approve'},
        format='json',
    )
    assert response.status_code == 200, response.data
    verification.refresh_from_db()
    member.refresh_from_db()
    assert verification.status == ProfileVerificationRequest.Status.APPROVED
    assert member.profile_status == Member.ProfileStatus.APPROVED
    assert ProfileVerificationHistory.objects.filter(
        verification_request=verification,
        changed_by_staff=staff_account,
        new_status=ProfileVerificationRequest.Status.APPROVED,
    ).exists()
    assert StaffActivityLog.objects.filter(
        actor_id=staff_account.pk,
        action='PROFILE_APPROVED',
    ).exists()
    assert Notification.objects.filter(
        member_recipient=member,
        notification_type='PROFILE_APPROVED',
    ).count() == 1


@pytest.mark.parametrize(
    ('action', 'expected_status'),
    (
        ('reject', ProfileVerificationRequest.Status.REJECTED),
        ('escalate', ProfileVerificationRequest.Status.CHANGES_REQUESTED),
    ),
)
def test_staff_rejection_and_escalation_require_reasons(
    authenticated_client, member, admin_account, staff_account, action, expected_status
):
    verification = new_verification(member)
    assign_verification(authenticated_client(admin_account), verification, staff_account)
    no_reason = authenticated_client(staff_account).post(
        f'/api/v1/staff/verifications/{verification.pk}/',
        {'action': action},
        format='json',
    )
    assert no_reason.status_code == 400
    response = authenticated_client(staff_account).post(
        f'/api/v1/staff/verifications/{verification.pk}/',
        {'action': action, 'reason': 'The supplied evidence cannot be confirmed.'},
        format='json',
    )
    assert response.status_code == 200, response.data
    verification.refresh_from_db()
    assert verification.status == expected_status

