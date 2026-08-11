import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status

from apps.accounts.models import (
    AccountType,
    Admin,
    AdminPermission,
    AdminRole,
    RoleCode,
    Staff,
    SuperAdmin,
    UserPermission,
    PermissionAuditLog,
)
from apps.accounts.security import issue_account_tokens
from apps.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def auth(api_client, account):
    token = issue_account_tokens(account)["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api_client


@pytest.fixture
def permissions_setup():
    # Make sure basic permissions exist in DB
    p_view, _ = AdminPermission.objects.get_or_create(code="users.view", defaults={"name": "View users", "module": "users"})
    p_edit, _ = AdminPermission.objects.get_or_create(code="users.edit", defaults={"name": "Edit users", "module": "users"})
    p_delete, _ = AdminPermission.objects.get_or_create(code="users.delete", defaults={"name": "Delete users", "module": "users"})
    p_manage_perms, _ = AdminPermission.objects.get_or_create(code="admins.manage_permissions", defaults={"name": "Manage admins", "module": "admins"})
    return p_view, p_edit, p_delete, p_manage_perms


@pytest.fixture
def super_admin():
    return SuperAdmin.objects.create_user(
        email="super@example.com",
        first_name="Super",
        last_name="Admin",
        password=PASSWORD,
        is_active=True,
    )


@pytest.fixture
def admin_user():
    role = AdminRole.objects.filter(code=RoleCode.ADMIN).first()
    return Admin.objects.create_user(
        email="admin@example.com",
        first_name="Admin",
        last_name="User",
        password=PASSWORD,
        is_active=True,
        role=role,
    )


@pytest.fixture
def staff_user():
    role = AdminRole.objects.filter(code=RoleCode.STAFF).first()
    return Staff.objects.create_user(
        email="staff@example.com",
        first_name="Staff",
        last_name="User",
        password=PASSWORD,
        is_active=True,
        role=role,
    )


def test_super_admin_unrestricted_and_immutable(api_client, super_admin, admin_user, permissions_setup):
    """Super Admin always gets all permissions, and cannot be managed/edited by other admins."""
    # 1. Super Admin effective permissions is everything
    all_permissions = set(AdminPermission.objects.values_list("code", flat=True))
    assert super_admin.get_effective_admin_permissions() == all_permissions
    assert super_admin.has_admin_permission("users.delete")

    # 2. Other admin cannot edit/modify Super Admin
    auth(api_client, admin_user)
    
    # Try to patch Super Admin -> should be HTTP 403 Forbidden
    url = reverse("super_admin_account_detail", kwargs={"account_type": "super_admin", "account_id": str(super_admin.id)})
    response = api_client.patch(url, {"first_name": "HackedName"})
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_permission_inheritance_and_override(api_client, admin_user, staff_user, permissions_setup):
    """Verify that users inherit role defaults and overrides work as explicit grants or denials."""
    p_view, p_edit, p_delete, p_manage_perms = permissions_setup
    
    # 1. Staff defaults: has 'users.view' (inherited), does not have 'users.delete'
    assert staff_user.has_admin_permission("users.view") is True
    assert staff_user.has_admin_permission("users.delete") is False

    # 2. Add explicit grant override for 'users.delete'
    staff_ct = ContentType.objects.get_for_model(Staff)
    UserPermission.objects.create(
        user_content_type=staff_ct,
        user_object_id=staff_user.id,
        permission=p_delete,
        is_allowed=True,
    )
    # Clear cached permissions if any (Django cached_properties are not used here, but let's check)
    assert staff_user.has_admin_permission("users.delete") is True

    # 3. Add explicit denial override for inherited 'users.view'
    UserPermission.objects.create(
        user_content_type=staff_ct,
        user_object_id=staff_user.id,
        permission=p_view,
        is_allowed=False,
    )
    assert staff_user.has_admin_permission("users.view") is False


def test_privilege_escalation_guard(api_client, super_admin, admin_user, staff_user, permissions_setup):
    """Verify that admins cannot grant permissions they do not have, nor modify admins.manage_permissions."""
    p_view, p_edit, p_delete, p_manage_perms = permissions_setup
    
    # Authenticate as admin_user (who lacks admins.manage_permissions and users.delete by default)
    # Let's ensure admin does not have admins.manage_permissions
    assert admin_user.has_admin_permission("admins.manage_permissions") is False
    
    auth(api_client, admin_user)
    url = reverse("admin_user_permissions", kwargs={"user_id": str(staff_user.id)})
    
    # 1. Admin tries to grant 'admins.manage_permissions' -> should be bad request (escalation guard)
    response = api_client.post(url, {
        "permissions": [
            {"code": "admins.manage_permissions", "is_allowed": True}
        ]
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "escalation" in str(response.data).lower() or "only the super admin" in str(response.data).lower()

    # 2. Grant admin_user 'admins.manage_permissions' from Super Admin first
    admin_ct = ContentType.objects.get_for_model(Admin)
    UserPermission.objects.create(
        user_content_type=admin_ct,
        user_object_id=admin_user.id,
        permission=p_manage_perms,
        is_allowed=True,
    )
    assert admin_user.has_admin_permission("admins.manage_permissions") is True

    # But admin still lacks 'settings.manage'. Let's verify they cannot grant it.
    assert admin_user.has_admin_permission("settings.manage") is False
    response = api_client.post(url, {
        "permissions": [
            {"code": "settings.manage", "is_allowed": True}
        ]
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "escalation" in str(response.data).lower()


def test_only_super_admin_grants_admins_manage_permissions(api_client, super_admin, admin_user, staff_user, permissions_setup):
    """Verify that only the Super Admin can grant or modify admins.manage_permissions."""
    p_view, p_edit, p_delete, p_manage_perms = permissions_setup
    
    # Admin A is granted admins.manage_permissions so they can modify others' permissions
    admin_ct = ContentType.objects.get_for_model(Admin)
    UserPermission.objects.create(
        user_content_type=admin_ct,
        user_object_id=admin_user.id,
        permission=p_manage_perms,
        is_allowed=True,
    )
    
    # Create another Admin account
    role = AdminRole.objects.filter(code=RoleCode.ADMIN).first()
    admin_b = Admin.objects.create_user(
        email="adminb@example.com",
        first_name="Admin",
        last_name="B",
        password=PASSWORD,
        is_active=True,
        role=role,
    )
    
    # Admin A tries to grant Admin B 'admins.manage_permissions' -> should fail
    auth(api_client, admin_user)
    url = reverse("admin_user_permissions", kwargs={"user_id": str(admin_b.id)})
    response = api_client.post(url, {
        "permissions": [
            {"code": "admins.manage_permissions", "is_allowed": True}
        ]
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "only the super admin" in str(response.data).lower()

    # Super Admin tries to grant Admin B 'admins.manage_permissions' -> should succeed
    auth(api_client, super_admin)
    response = api_client.post(url, {
        "permissions": [
            {"code": "admins.manage_permissions", "is_allowed": True}
        ]
    }, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert admin_b.has_admin_permission("admins.manage_permissions") is True


def test_audit_logging_and_session_invalidation(api_client, super_admin, staff_user, permissions_setup):
    """Verify that permission overrides changes trigger audit log creation and invalidate target sessions."""
    p_view, p_edit, p_delete, p_manage_perms = permissions_setup
    
    auth(api_client, super_admin)
    url = reverse("admin_user_permissions", kwargs={"user_id": str(staff_user.id)})
    
    # Check initial token version
    initial_version = staff_user.token_version
    
    # Change permissions
    response = api_client.post(url, {
        "permissions": [
            {"code": "users.view", "is_allowed": False}
        ]
    }, format="json")
    assert response.status_code == status.HTTP_200_OK
    
    # 1. Audit log created
    assert PermissionAuditLog.objects.filter(user_object_id=staff_user.id).exists() is True
    log = PermissionAuditLog.objects.filter(user_object_id=staff_user.id).first()
    assert log.previous_permissions == {}
    assert log.new_permissions == {"users.view": False}
    
    # 2. Token version bumped (session invalidation)
    staff_user.refresh_from_db()
    assert staff_user.token_version == initial_version + 1

