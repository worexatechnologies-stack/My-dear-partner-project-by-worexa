import pytest
from django.test import override_settings

from apps.accounts.models import Admin, AdminRole, RoleCode, SuperAdmin
from apps.accounts.super_admin_sync import sync_super_admin_from_environment


pytestmark = pytest.mark.django_db


def test_environment_sync_creates_one_hashed_super_admin_and_is_idempotent():
    with override_settings(
        SUPERADMIN_EMAIL='configured-owner@example.com',
        SUPERADMIN_PASSWORD='ConfiguredPassword!742',
        SUPERADMIN_MOBILE='9876543280',
        SUPERADMIN_FIRST_NAME='Configured',
        SUPERADMIN_LAST_NAME='Owner',
    ):
        first = sync_super_admin_from_environment()
        account = SuperAdmin.objects.get()
        original_hash = account.password
        second = sync_super_admin_from_environment()

    assert first.created is True
    assert second.updated is False
    assert SuperAdmin.objects.count() == 1
    assert account.email == 'configured-owner@example.com'
    assert account.role.code == RoleCode.SUPER_ADMIN
    assert account.password != 'ConfiguredPassword!742'
    assert account.check_password('ConfiguredPassword!742')
    account.refresh_from_db()
    assert account.password == original_hash
    assert account.two_factor_enabled is False


def test_environment_sync_updates_the_existing_super_admin_email_and_password(api_client):
    with override_settings(
        SUPERADMIN_EMAIL='old-owner@example.com',
        SUPERADMIN_PASSWORD='OldPassword!742',
    ):
        sync_super_admin_from_environment()
        account = SuperAdmin.objects.get()
        original_id = account.pk

    with override_settings(
        SUPERADMIN_EMAIL='new-owner@example.com',
        SUPERADMIN_PASSWORD='NewPassword!742',
    ):
        result = sync_super_admin_from_environment()

    account.refresh_from_db()
    assert result.updated is True
    assert SuperAdmin.objects.count() == 1
    assert account.pk == original_id
    assert account.email == 'new-owner@example.com'
    assert not account.check_password('OldPassword!742')
    assert account.check_password('NewPassword!742')

    old_login = api_client.post(
        '/api/v1/super-admin-auth/login/',
        {'email': 'new-owner@example.com', 'password': 'OldPassword!742'},
        format='json',
    )
    new_login = api_client.post(
        '/api/v1/super-admin-auth/login/',
        {'email': 'new-owner@example.com', 'password': 'NewPassword!742'},
        format='json',
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200
    assert 'NewPassword!742' not in str(new_login.data)


def test_environment_sync_does_not_modify_a_normal_admin():
    with override_settings(
        SUPERADMIN_EMAIL='configured-owner@example.com',
        SUPERADMIN_PASSWORD='ConfiguredPassword!742',
    ):
        sync_super_admin_from_environment()
    owner = SuperAdmin.objects.get()
    admin = Admin.objects.create_user(
        email='normal-admin@example.com',
        password='NormalAdminPassword!742',
        first_name='Normal',
        role=AdminRole.objects.get(code=RoleCode.ADMIN),
        created_by_super_admin=owner,
    )

    with override_settings(
        SUPERADMIN_EMAIL='updated-owner@example.com',
        SUPERADMIN_PASSWORD='UpdatedConfiguredPassword!742',
    ):
        sync_super_admin_from_environment()

    admin.refresh_from_db()
    assert admin.email == 'normal-admin@example.com'
    assert admin.check_password('NormalAdminPassword!742')
    assert admin.account_type == 'ADMIN'
