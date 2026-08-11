import pytest
from rest_framework.test import APIClient

from apps.accounts.models import (
    Admin,
    AdminRole,
    Member,
    RoleCode,
    Staff,
    SuperAdmin,
)
from apps.accounts.security import issue_account_tokens


PASSWORD = 'TestPassword!742'


@pytest.fixture
def member(db):
    return Member.objects.create_user(
        email='member@example.com',
        mobile_number='9876543210',
        password=PASSWORD,
        first_name='Maya',
        last_name='Member',
    )


@pytest.fixture
def other_member(db):
    return Member.objects.create_user(
        email='other@example.com',
        mobile_number='9876543211',
        password=PASSWORD,
        first_name='Other',
        last_name='Member',
    )


@pytest.fixture
def super_admin(db):
    return SuperAdmin.objects.create_user(
        email='owner@example.com',
        mobile_number='9876543220',
        password=PASSWORD,
        first_name='Platform',
        last_name='Owner',
        role=AdminRole.objects.get(code=RoleCode.SUPER_ADMIN),
        is_email_verified=True,
    )


@pytest.fixture
def admin_account(db, super_admin):
    return Admin.objects.create_user(
        email='admin@example.com',
        mobile_number='9876543221',
        password=PASSWORD,
        first_name='Ada',
        last_name='Admin',
        role=AdminRole.objects.get(code=RoleCode.ADMIN),
        created_by_super_admin=super_admin,
        is_email_verified=True,
    )


@pytest.fixture
def staff_account(db, admin_account):
    return Staff.objects.create_user(
        email='staff@example.com',
        mobile_number='9876543222',
        password=PASSWORD,
        first_name='Sam',
        last_name='Staff',
        employee_code='STF-00001',
        role=AdminRole.objects.get(code=RoleCode.STAFF),
        created_by_admin=admin_account,
        is_email_verified=True,
    )



@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client():
    def build(account):
        client = APIClient()
        token = issue_account_tokens(account)['access']
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client
    return build
