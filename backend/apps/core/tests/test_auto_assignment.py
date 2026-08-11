import pytest
from apps.accounts.models import Staff, AdminRole, RoleCode
from apps.core.models import (
    SupportTicket,
    ProfileVerificationRequest,
    SupportCategory,
    AssignmentStrategy,
    AssignmentRule,
    Specialization,
    Queue,
    EmployeeAvailability,
    Workload,
    AssignmentAudit,
)
from apps.core.assignment_engine import auto_assign_ticket, auto_assign_verification

PASSWORD = 'TestPassword!742'

@pytest.fixture
def test_setup(db, admin_account):
    # Setup strategies
    least_workload_strat, _ = AssignmentStrategy.objects.get_or_create(
        code='LEAST_WORKLOAD',
        defaults={'name': 'Least Workload'}
    )
    round_robin_strat, _ = AssignmentStrategy.objects.get_or_create(
        code='ROUND_ROBIN',
        defaults={'name': 'Round Robin'}
    )

    # Setup categories
    category_general, _ = SupportCategory.objects.get_or_create(
        code='GENERAL',
        defaults={'name': 'General Inquiry', 'is_active': True}
    )
    category_billing, _ = SupportCategory.objects.get_or_create(
        code='BILLING',
        defaults={'name': 'Billing Inquiry', 'is_active': True}
    )

    # Setup queue
    unassigned_queue, _ = Queue.objects.get_or_create(
        code='UNASSIGNED',
        defaults={'name': 'Unassigned Queue'}
    )

    # Setup specialization
    spec_general, _ = Specialization.objects.get_or_create(
        code='GENERAL',
        defaults={'name': 'General Support'}
    )
    spec_billing, _ = Specialization.objects.get_or_create(
        code='BILLING',
        defaults={'name': 'Billing Support'}
    )
    spec_verification, _ = Specialization.objects.get_or_create(
        code='VERIFICATION',
        defaults={'name': 'Profile Verification'}
    )

    return {
        'least_workload_strat': least_workload_strat,
        'round_robin_strat': round_robin_strat,
        'category_general': category_general,
        'category_billing': category_billing,
        'unassigned_queue': unassigned_queue,
        'spec_general': spec_general,
        'spec_billing': spec_billing,
        'spec_verification': spec_verification,
    }


def test_workload_and_availability_creation(db, admin_account):
    # Create Staff
    staff = Staff.objects.create_user(
        email='new_staff@example.com',
        mobile_number='1234567890',
        password=PASSWORD,
        first_name='John',
        last_name='Staff',
        employee_code='STF-9999',
        role=AdminRole.objects.get(code=RoleCode.STAFF),
        created_by_admin=admin_account,
        is_email_verified=True,
    )
    assert hasattr(staff, 'availability')
    assert hasattr(staff, 'workload')
    assert staff.availability.is_online is True
    assert staff.workload.capacity == 10

def test_auto_assign_fallback_unassigned(db, test_setup, member):
    # Create ticket with no rules setup
    ticket = SupportTicket.objects.create(
        member=member,
        category=test_setup['category_general'],
        subject='No Rule Test',
        description='Test details',
    )
    assigned = auto_assign_ticket(ticket)
    assert assigned is False
    ticket.refresh_from_db()
    assert ticket.status == SupportTicket.Status.UNASSIGNED
    assert AssignmentAudit.objects.filter(related_object_id=ticket.id, success=False).exists()
