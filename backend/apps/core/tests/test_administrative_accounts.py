import pytest

from apps.accounts.models import Admin, Member, SuperAdminActivityLog
from apps.core.models import Notification


pytestmark = pytest.mark.django_db


def test_super_admin_can_create_admin_and_operation_is_audited(
    authenticated_client, super_admin
):
    response = authenticated_client(super_admin).post(
        '/api/v1/super-admin/admins/',
        {
            'email': 'created-admin@example.com',
            'mobile_number': '9876543290',
            'first_name': 'Created',
            'last_name': 'Admin',
            'password': 'CreatedAdmin!834',
        },
        format='json',
    )
    assert response.status_code == 201, response.data
    created = Admin.objects.get(email='created-admin@example.com')
    assert created.created_by_super_admin == super_admin
    assert created.check_password('CreatedAdmin!834')
    assert SuperAdminActivityLog.objects.filter(
        actor_id=super_admin.pk,
        action='ADMIN_CREATED',
        target_id=str(created.pk),
    ).exists()


def test_admin_cannot_create_another_admin(authenticated_client, admin_account):
    response = authenticated_client(admin_account).post(
        '/api/v1/admin/accounts/',
        {
            'role': 'ADMIN',
            'email': 'forbidden-admin@example.com',
            'mobile_number': '9876543291',
            'first_name': 'Forbidden',
            'password': 'ForbiddenAdmin!834',
        },
        format='json',
    )
    assert response.status_code == 403
    assert not Admin.objects.filter(email='forbidden-admin@example.com').exists()


def test_suspending_member_notifies_other_active_members(
    authenticated_client, super_admin, member, other_member
):
    response = authenticated_client(super_admin).patch(
        f'/api/v1/admin/users/{member.pk}/',
        {'action': 'suspend'},
        format='json',
    )

    assert response.status_code == 200, response.data
    member.refresh_from_db()
    assert member.is_active is False
    assert member.account_status == Member.AccountStatus.SUSPENDED
    notification = Notification.objects.get(member_recipient=other_member)
    assert notification.notification_type == 'MEMBER_ACCOUNT_UNAVAILABLE'
    assert 'suspended' in notification.message
