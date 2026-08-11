"""Canonical administrative permission catalogue and role matrix."""

from .models import AdminPermission, AdminRole, AdminRolePermission, RoleCode


PERMISSIONS = {
    'dashboard.view': ('View dashboard', 'dashboard'),
    'members.view': ('View members', 'members'),
    'members.manage': ('Manage members', 'members'),
    'members.suspend': ('Suspend members', 'members'),
    'members.delete': ('Delete members', 'members'),
    'members.sensitive': ('View sensitive member data', 'members'),
    'admins.view': ('View admins', 'accounts'),
    'admins.create': ('Create admins', 'accounts'),
    'admins.manage': ('Manage admins', 'accounts'),
    'staff.view': ('View staff', 'accounts'),
    'staff.create': ('Create staff', 'accounts'),
    'staff.manage': ('Manage staff', 'accounts'),
    'staff.activity': ('View staff activity', 'activity'),
    'roles.view': ('View roles and permissions', 'roles'),
    'roles.manage': ('Change role permissions', 'roles'),
    'tickets.view_all': ('View all support tickets', 'tickets'),
    'tickets.view_assigned': ('View assigned support tickets', 'tickets'),
    'tickets.claim': ('Claim unassigned support tickets', 'tickets'),
    'tickets.assign': ('Assign support tickets', 'tickets'),
    'tickets.reply': ('Reply to support tickets', 'tickets'),
    'tickets.note': ('Add internal ticket notes', 'tickets'),
    'tickets.status': ('Change ticket status', 'tickets'),
    'tickets.escalate': ('Escalate tickets', 'tickets'),
    'tickets.member_details': ('View ticket-related member details', 'tickets'),
    'tickets.payment_details': ('View ticket-related payment details', 'tickets'),
    'verification.view_all': ('View all verification requests', 'verification'),
    'verification.view_assigned': ('View assigned verification requests', 'verification'),
    'verification.assign': ('Assign profile verification', 'verification'),
    'verification.review': ('Review profile verification', 'verification'),
    'verification.approve': ('Approve profile verification', 'verification'),
    'verification.reject': ('Reject profile verification', 'verification'),
    'verification.escalate': ('Escalate profile verification', 'verification'),
    'complaints.view_all': ('View all complaints', 'complaints'),
    'complaints.view_assigned': ('View assigned complaints', 'complaints'),
    'complaints.manage': ('Manage complaints', 'complaints'),
    'complaints.escalate': ('Escalate complaints', 'complaints'),
    'profile_reports.manage': ('Manage reported profiles', 'safety'),
    'payments.view': ('View payments', 'payments'),
    'payments.refund': ('Approve refunds', 'payments'),
    'settings.manage': ('Manage platform settings', 'settings'),
    'backups.manage': ('Manage backups', 'backups'),
    'activity.view_all': ('View all administrative activity', 'activity'),
    
    # New membership permissions requested
    'memberships.view': ('View membership plans', 'memberships'),
    'memberships.create': ('Create membership plans', 'memberships'),
    'memberships.edit': ('Edit membership plans', 'memberships'),
    'memberships.activate': ('Activate membership plans', 'memberships'),
    'memberships.deactivate': ('Deactivate membership plans', 'memberships'),
    'memberships.view_subscribers': ('View membership plan subscribers', 'memberships'),
    'memberships.manage_entitlements': ('Manage plan entitlements', 'memberships'),

    # New granular permissions requested
    'users.view': ('View users', 'users'),
    'users.edit': ('Edit users', 'users'),
    'users.approve': ('Approve users', 'users'),
    'users.delete': ('Delete users', 'users'),
    'documents.view': ('View documents', 'documents'),
    'documents.approve': ('Approve documents', 'documents'),
    'documents.reject': ('Reject documents', 'documents'),
    'documents.delete': ('Delete documents', 'documents'),
    'memberships.manage': ('Manage memberships', 'memberships'),
    'tickets.resolve': ('Resolve tickets', 'tickets'),
    'staff.manage_permissions': ('Manage staff permissions', 'staff'),
    'admins.manage_permissions': ('Manage admin permissions', 'admins'),
    'audit_logs.view': ('View audit logs', 'audit_logs'),
}


ROLE_PERMISSIONS = {
    RoleCode.SUPER_ADMIN: set(PERMISSIONS),
    RoleCode.ADMIN: {
        'dashboard.view',
        'members.view', 'members.manage', 'members.suspend', 'members.delete', 'members.sensitive',
        'staff.view', 'staff.create', 'staff.manage', 'staff.activity',
        'tickets.view_all', 'tickets.assign', 'tickets.note',
        'tickets.status', 'tickets.escalate', 'tickets.member_details',
        'verification.view_all', 'verification.assign', 'verification.review',
        'verification.approve', 'verification.reject', 'verification.escalate',
        'complaints.view_all', 'complaints.manage', 'profile_reports.manage',
        'payments.view',
        'memberships.view',
        'users.view', 'users.edit', 'users.approve', 'users.delete',
        'documents.view', 'documents.approve', 'documents.reject', 'documents.delete',
        'memberships.manage', 'tickets.resolve', 'staff.manage_permissions',
        'audit_logs.view',
    },
}


ROLE_NAMES = {
    RoleCode.SUPER_ADMIN: 'Super Admin',
    RoleCode.ADMIN: 'Admin',
}


def seed_rbac():
    """Idempotently create the immutable permission catalogue and defaults."""

    permission_rows = {}
    for code, (name, module) in PERMISSIONS.items():
        permission_rows[code], _ = AdminPermission.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'module': module,
                'description': '',
            },
        )

    role_rows = {}
    for code, name in ROLE_NAMES.items():
        role_rows[str(code)], _ = AdminRole.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'description': f'System role for {name}.',
                'is_system_role': True,
            },
        )

    for role_code, role in role_rows.items():
        allowed = ROLE_PERMISSIONS[role_code]
        for permission_code, permission in permission_rows.items():
            AdminRolePermission.objects.update_or_create(
                role=role,
                permission=permission,
                defaults={'is_allowed': permission_code in allowed},
            )

    return role_rows
