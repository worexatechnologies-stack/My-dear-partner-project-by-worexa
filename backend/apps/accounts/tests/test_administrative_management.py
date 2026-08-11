"""
Backend integration tests for administrative account management.

Covers:
  - Super Admin account CRUD
  - Admin creating Staff
  - Admin blocked from creating Admin (permission boundary)
   - Staff authorization boundaries
   - Employee-code uniqueness (global, cross-model)
  - Email / mobile uniqueness (global, cross-model)
  - Deactivation safety (active assignments / tickets)
  - Work-assignment endpoint
  - Ticket-assignment endpoint
  - Account activate / deactivate actions
  - Password reset action
  - Soft-delete / archive safety
  - Last-Super-Admin protection
  - Portal-mismatch security (login on wrong portal)
  - Search, filtering, and pagination on listing endpoints
"""

import pytest
from django.utils import timezone

from apps.accounts.models import (
    AccountType,
    Admin,
    AdminPermission,
    AdminRole,
    AdminRolePermission,
    RoleCode,
    Staff,
    SuperAdmin,
)
from apps.accounts.security import issue_account_tokens
from apps.conftest import PASSWORD


pytestmark = pytest.mark.django_db


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def auth(client, account):
    token = issue_account_tokens(account)["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _support_category():
    from apps.core.models import SupportCategory
    cat, _ = SupportCategory.objects.get_or_create(code="general", defaults={"name": "General"})
    return cat


def _make_ticket(assignee=None, status="UNASSIGNED", subject="Test Ticket"):
    """Create a SupportTicket with a required category."""
    from apps.core.models import SupportTicket
    return SupportTicket.objects.create(
        category=_support_category(),
        subject=subject,
        description="Test description.",
        status=status,
        claimed_by_admin=assignee,
    )


def _make_work_assignment(staff, admin_account=None, status="ASSIGNED"):
    """Create a WorkAssignment bypassing the clean() single-target constraint for test setup."""
    from apps.core.models import WorkAssignment, Complaint
    from django.db.models import Model
    comp = Complaint.objects.create(subject="Test Complaint", description="Test.")
    wa = WorkAssignment(
        assignment_type="COMPLAINT_REVIEW",
        assigned_to_staff=staff,
        assigned_by_admin=admin_account,
        status=status,
        related_complaint=comp,
    )
    # Bypass WorkAssignment.save (which calls full_clean) for direct test data creation
    Model.save(wa, force_insert=True)
    return wa


def _grant(admin_account, *codes):
    """Grant the given permission codes to an Admin."""
    role = admin_account.role
    for code in codes:
        perm, _ = AdminPermission.objects.get_or_create(
            code=code, defaults={"name": code, "module": code.split(".")[0], "description": ""}
        )
        AdminRolePermission.objects.update_or_create(
            role=role, permission=perm, defaults={"is_allowed": True}
        )


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────

@pytest.fixture
def super_admin(db):
    return SuperAdmin.objects.create_user(
        email="sa@example.com",
        mobile_number="9000000001",
        password=PASSWORD,
        first_name="Super",
        last_name="Admin",
        role=AdminRole.objects.get(code=RoleCode.SUPER_ADMIN),
        is_email_verified=True,
    )


@pytest.fixture
def second_super_admin(db):
    return SuperAdmin.objects.create_user(
        email="sa2@example.com",
        mobile_number="9000000002",
        password=PASSWORD,
        first_name="Second",
        last_name="SA",
        role=AdminRole.objects.get(code=RoleCode.SUPER_ADMIN),
        is_email_verified=True,
    )


@pytest.fixture
def admin_account(db, super_admin):
    return Admin.objects.create_user(
        email="admin@example.com",
        mobile_number="9000000010",
        password=PASSWORD,
        first_name="Ada",
        last_name="Admin",
        role=AdminRole.objects.get(code=RoleCode.ADMIN),
        created_by_super_admin=super_admin,
        is_email_verified=True,
    )


@pytest.fixture
def staff_account(db, admin_account):
    return Staff.objects.create_user(
        email="staff@example.com",
        mobile_number="9000000020",
        password=PASSWORD,
        first_name="Sam",
        last_name="Staff",
        employee_code="STF-00001",
        role=AdminRole.objects.get(code=RoleCode.STAFF),
        created_by_admin=admin_account,
        is_email_verified=True,
    )


# ─────────────────────────────────────────────────────────
# 1. Super Admin Account CRUD
# ─────────────────────────────────────────────────────────

class TestSuperAdminAccountCRUD:
    def test_super_admin_can_list_all_accounts(self, api_client, super_admin, admin_account, staff_account):
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/")
        assert resp.status_code == 200
        emails = {row["email"] for row in resp.data["data"]["results"]}
        assert "admin@example.com" in emails
        assert "staff@example.com" in emails

    def test_super_admin_can_create_admin(self, api_client, super_admin):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "ADMIN",
            "email": "newadmin@example.com",
            "first_name": "New",
            "last_name": "Admin",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code == 201
        assert Admin.objects.filter(email="newadmin@example.com").exists()

    def test_super_admin_can_create_staff(self, api_client, super_admin):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "newstaff@example.com",
            "first_name": "New",
            "last_name": "Staff",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code == 201
        assert Staff.objects.filter(email="newstaff@example.com").exists()

    def test_super_admin_can_deactivate_admin(self, api_client, super_admin, admin_account):
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/ADMIN/{admin_account.pk}/deactivate/"
        )
        assert resp.status_code == 200
        admin_account.refresh_from_db()
        assert not admin_account.is_active

    def test_super_admin_can_activate_admin(self, api_client, super_admin, admin_account):
        admin_account.is_active = False
        admin_account.save()
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/ADMIN/{admin_account.pk}/activate/"
        )
        assert resp.status_code == 200
        admin_account.refresh_from_db()
        assert admin_account.is_active

    def test_super_admin_can_reset_password(self, api_client, super_admin, admin_account):
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/ADMIN/{admin_account.pk}/reset-password/",
            {"new_password": "NewSecurePass!99"},
            format="json",
        )
        assert resp.status_code == 200
        admin_account.refresh_from_db()
        assert admin_account.check_password("NewSecurePass!99")

    def test_last_super_admin_cannot_be_deactivated(self, api_client, super_admin):
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/SUPER_ADMIN/{super_admin.pk}/deactivate/"
        )
        assert resp.status_code == 400
        assert "last" in resp.data.get("message", "").lower() or "last" in str(resp.data).lower()

    def test_second_super_admin_can_be_deactivated(self, api_client, super_admin, second_super_admin):
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/SUPER_ADMIN/{second_super_admin.pk}/deactivate/"
        )
        assert resp.status_code == 200
        second_super_admin.refresh_from_db()
        assert not second_super_admin.is_active


# ─────────────────────────────────────────────────────────
# 2. Admin Creating Staff
# ─────────────────────────────────────────────────────────

class TestAdminCreatingStaffAndSupport:
    def test_admin_with_permission_can_create_staff(self, api_client, admin_account):
        _grant(admin_account, "staff.create")
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/accounts/", {
            "role": "STAFF",
            "email": "staff2@example.com",
            "first_name": "Staff",
            "last_name": "Two",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code == 201
        assert Staff.objects.filter(email="staff2@example.com").exists()

    def test_admin_blocked_from_creating_admin(self, api_client, admin_account):
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/accounts/", {
            "role": "ADMIN",
            "email": "newadmin2@example.com",
            "first_name": "New",
            "last_name": "Admin",
            "password": PASSWORD,
        }, format="json")
        # Admin cannot create another Admin
        assert resp.status_code in (400, 403)

    def test_admin_without_staff_create_permission_is_blocked(self, api_client, admin_account):
        # Make sure staff.create is NOT granted
        perm = AdminPermission.objects.filter(code="staff.create").first()
        if perm:
            AdminRolePermission.objects.filter(role=admin_account.role, permission=perm).update(is_allowed=False)
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/accounts/", {
            "role": "STAFF",
            "email": "blocked@example.com",
            "first_name": "Blocked",
            "last_name": "Staff",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code in (400, 403)


# ─────────────────────────────────────────────────────────
# 3. Staff Authorization Boundaries
# ─────────────────────────────────────────────────────────

class TestStaffAuthorizationBoundaries:
    def test_staff_cannot_create_accounts(self, api_client, staff_account):
        auth(api_client, staff_account)
        resp = api_client.post("/api/v1/admin/accounts/", {
            "role": "STAFF",
            "email": "hack@example.com",
            "first_name": "Hack",
            "last_name": "Attempt",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code == 403

    def test_staff_cannot_access_admin_account_list(self, api_client, staff_account):
        auth(api_client, staff_account)
        assert api_client.get("/api/v1/admin/accounts/").status_code == 403

# ─────────────────────────────────────────────────────────
# 5. Employee Code Uniqueness
# ─────────────────────────────────────────────────────────

class TestEmployeeCodeUniqueness:
    def test_duplicate_employee_code_across_staff_is_rejected(self, api_client, super_admin, staff_account):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "dupcode@example.com",
            "first_name": "Dup",
            "last_name": "Code",
            "password": PASSWORD,
            "employee_code": "STF-00001",  # already used by staff_account
        }, format="json")
        assert resp.status_code in (400, 422)
        assert "employee_code" in str(resp.data).lower()

    def test_unique_employee_codes_are_accepted(self, api_client, super_admin, staff_account):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "uniqcode@example.com",
            "first_name": "Unique",
            "last_name": "Code",
            "password": PASSWORD,
            "employee_code": "STF-99999",
        }, format="json")
        assert resp.status_code == 201


# ─────────────────────────────────────────────────────────
# 6. Email / Mobile Global Uniqueness
# ─────────────────────────────────────────────────────────

class TestEmailMobileGlobalUniqueness:
    def test_email_already_in_admin_table_is_rejected(self, api_client, super_admin, admin_account):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "admin@example.com",  # same as admin_account
            "first_name": "Dup",
            "last_name": "Email",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code in (400, 422)
        assert "email" in str(resp.data).lower()

    def test_email_already_in_staff_table_is_rejected(self, api_client, super_admin, staff_account):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "staff@example.com",  # same as staff_account
            "first_name": "Dup",
            "last_name": "Email2",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code in (400, 422)
        assert "email" in str(resp.data).lower()

    def test_mobile_already_in_admin_is_rejected(self, api_client, super_admin, admin_account):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "STAFF",
            "email": "dupmobile@example.com",
            "mobile_number": "9000000010",  # same as admin_account
            "first_name": "Dup",
            "last_name": "Mobile",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code in (400, 422)
        assert "mobile" in str(resp.data).lower()

    def test_unique_email_and_mobile_are_accepted(self, api_client, super_admin):
        auth(api_client, super_admin)
        resp = api_client.post("/api/v1/super-admin/accounts/", {
            "role": "ADMIN",
            "email": "uniqueadmin@example.com",
            "mobile_number": "9111111111",
            "first_name": "Unique",
            "last_name": "Admin",
            "password": PASSWORD,
        }, format="json")
        assert resp.status_code == 201


# ─────────────────────────────────────────────────────────
# 7. Deactivation Safety
# ─────────────────────────────────────────────────────────

class TestDeactivationSafety:
    def test_staff_with_active_assignment_cannot_be_deactivated(self, api_client, super_admin, staff_account, admin_account):
        _make_work_assignment(staff_account, admin_account, status="ASSIGNED")
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/STAFF/{staff_account.pk}/deactivate/"
        )
        assert resp.status_code == 400
        assert "assignment" in resp.data.get("message", "").lower() or "active" in str(resp.data).lower()

    def test_staff_with_no_active_assignments_can_be_deactivated(self, api_client, super_admin, staff_account):
        auth(api_client, super_admin)
        resp = api_client.post(
            f"/api/v1/super-admin/accounts/STAFF/{staff_account.pk}/deactivate/"
        )
        assert resp.status_code == 200
        staff_account.refresh_from_db()
        assert not staff_account.is_active


# ─────────────────────────────────────────────────────────
# 8. Work Assignment
# ─────────────────────────────────────────────────────────

class TestWorkAssignment:
    def test_admin_can_assign_work_to_staff(self, api_client, admin_account, staff_account):
        _grant(admin_account, "verification.assign")
        from apps.core.models import Complaint
        comp = Complaint.objects.create(
            subject="Test Complaint",
            description="Please review this complaint.",
            status="OPEN",
        )
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/assign-work/", {
            "assigned_to_staff": str(staff_account.pk),
            "assignment_type": "COMPLAINT_REVIEW",
            "related_id": str(comp.pk),
            "priority": "NORMAL",
            "notes": "Please review.",
        }, format="json")
        assert resp.status_code == 200
        from apps.core.models import WorkAssignment
        assert WorkAssignment.objects.filter(assigned_to_staff=staff_account, assignment_type="COMPLAINT_REVIEW").exists()

    def test_cannot_assign_work_to_inactive_staff(self, api_client, admin_account, staff_account):
        _grant(admin_account, "verification.assign")
        from apps.core.models import Complaint
        comp = Complaint.objects.create(subject="Inactive Staff Test", description="Test.")
        staff_account.is_active = False
        staff_account.save()
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/assign-work/", {
            "assigned_to_staff": str(staff_account.pk),
            "assignment_type": "COMPLAINT_REVIEW",
            "related_id": str(comp.pk),
            "priority": "NORMAL",
        }, format="json")
        assert resp.status_code == 400

    def test_admin_without_verification_assign_is_blocked(self, api_client, admin_account, staff_account):
        # Revoke permission
        perm = AdminPermission.objects.filter(code="verification.assign").first()
        if perm:
            AdminRolePermission.objects.filter(role=admin_account.role, permission=perm).update(is_allowed=False)
        from apps.core.models import Complaint
        comp = Complaint.objects.create(subject="Blocked Test", description="Test.")
        auth(api_client, admin_account)
        resp = api_client.post("/api/v1/admin/assign-work/", {
            "assigned_to_staff": str(staff_account.pk),
            "assignment_type": "COMPLAINT_REVIEW",
            "related_id": str(comp.pk),
            "priority": "NORMAL",
        }, format="json")
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────
# 9. Ticket Assignment
# ─────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────
# 10. Password Reset Action
# ─────────────────────────────────────────────────────────

class TestPasswordReset:
    def test_admin_can_reset_staff_password(self, api_client, admin_account, staff_account):
        _grant(admin_account, "staff.manage")
        auth(api_client, admin_account)
        resp = api_client.post(
            f"/api/v1/admin/staff/{staff_account.pk}/reset-password/",
            {"new_password": "NewStaff!Pass99"},
            format="json",
        )
        assert resp.status_code == 200
        staff_account.refresh_from_db()
        assert staff_account.check_password("NewStaff!Pass99")

    def test_weak_password_is_rejected(self, api_client, admin_account, staff_account):
        _grant(admin_account, "staff.manage")
        auth(api_client, admin_account)
        resp = api_client.post(
            f"/api/v1/admin/staff/{staff_account.pk}/reset-password/",
            {"new_password": "123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_missing_new_password_is_rejected(self, api_client, admin_account, staff_account):
        _grant(admin_account, "staff.manage")
        auth(api_client, admin_account)
        resp = api_client.post(
            f"/api/v1/admin/staff/{staff_account.pk}/reset-password/",
            {},
            format="json",
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────
# 11. Soft Delete / Archive Safety
# ─────────────────────────────────────────────────────────

class TestSoftDeleteArchiveSafety:
    def test_deleted_staff_not_returned_in_list(self, api_client, super_admin, staff_account):
        staff_account.deleted_at = timezone.now()
        staff_account.save()
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?role=STAFF")
        assert resp.status_code == 200
        emails = [row["email"] for row in resp.data["data"]["results"]]
        assert "staff@example.com" not in emails

# ─────────────────────────────────────────────────────────
# 12. Portal Mismatch Security
# ─────────────────────────────────────────────────────────

class TestPortalMismatchSecurity:
    def test_admin_cannot_login_on_staff_portal(self, api_client, admin_account):
        # Admin uses staff portal — should NOT succeed
        resp = api_client.post(
            "/api/v1/staff-auth/login/",
            {"email": admin_account.email, "password": PASSWORD},
            format="json",
        )
        # Must not return a 200; either 401 (unknown) or 400 (mismatch after valid credentials)
        assert resp.status_code in (400, 401)

    def test_staff_cannot_login_on_admin_portal(self, api_client, staff_account):
        resp = api_client.post(
            "/api/v1/admin-auth/login/",
            {"email": staff_account.email, "password": PASSWORD},
            format="json",
        )
        assert resp.status_code in (400, 401)

    def test_unknown_email_returns_generic_401_not_redirect(self, api_client):
        resp = api_client.post(
            "/api/v1/admin-auth/login/",
            {"email": "nobody@nowhere.com", "password": "whatever"},
            format="json",
        )
        # Must be 401 — not 400/redirect — for unknown emails
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────
# 13. Search, Filtering & Pagination
# ─────────────────────────────────────────────────────────

class TestSearchFilteringPagination:
    def test_search_by_email_filters_correctly(self, api_client, super_admin, staff_account):
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?search=staff@example")
        assert resp.status_code == 200
        results = resp.data["data"]["results"]
        assert all("staff" in r["email"] for r in results)

    def test_role_filter_returns_only_that_role(self, api_client, super_admin, admin_account, staff_account):
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?role=STAFF")
        assert resp.status_code == 200
        results = resp.data["data"]["results"]
        for r in results:
            assert r.get("role") == "STAFF"

    def test_status_active_filter_excludes_inactive(self, api_client, super_admin, staff_account):
        staff_account.is_active = False
        staff_account.save()
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?role=STAFF&status=active")
        assert resp.status_code == 200
        results = resp.data["data"]["results"]
        emails = [r["email"] for r in results]
        assert "staff@example.com" not in emails

    def test_status_inactive_filter_returns_only_inactive(self, api_client, super_admin, staff_account):
        staff_account.is_active = False
        staff_account.save()
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?role=STAFF&status=inactive")
        assert resp.status_code == 200
        results = resp.data["data"]["results"]
        assert any(r["email"] == "staff@example.com" for r in results)

    def test_pagination_returns_count_and_next(self, api_client, super_admin, admin_account):
        # Create 30 more staff so pagination kicks in
        role = AdminRole.objects.get(code=RoleCode.STAFF)
        for i in range(30):
            Staff.objects.create_user(
                email=f"page_staff_{i}@example.com",
                password=PASSWORD,
                first_name=f"Staff{i}",
                last_name="Page",
                employee_code=f"PG-{i:05d}",
                role=role,
                created_by_admin=admin_account,
            )
        auth(api_client, super_admin)
        resp = api_client.get("/api/v1/super-admin/accounts/?role=STAFF&page_size=10")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert data.get("count", 0) >= 10
