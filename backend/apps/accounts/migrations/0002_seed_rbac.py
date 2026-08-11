from django.db import migrations


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
    'support_agents.view': ('View support agents', 'accounts'),
    'support_agents.create': ('Create support agents', 'accounts'),
    'support_agents.manage': ('Manage support agents', 'accounts'),
    'support_agents.activity': ('View support activity', 'activity'),
    'roles.view': ('View roles', 'roles'),
    'roles.manage': ('Manage roles', 'roles'),
    'tickets.view_all': ('View all tickets', 'tickets'),
    'tickets.view_assigned': ('View assigned tickets', 'tickets'),
    'tickets.claim': ('Claim tickets', 'tickets'),
    'tickets.assign': ('Assign tickets', 'tickets'),
    'tickets.reply': ('Reply to tickets', 'tickets'),
    'tickets.note': ('Add internal notes', 'tickets'),
    'tickets.status': ('Change ticket status', 'tickets'),
    'tickets.escalate': ('Escalate tickets', 'tickets'),
    'tickets.member_details': ('View ticket member details', 'tickets'),
    'tickets.payment_details': ('View ticket payment details', 'tickets'),
    'verification.view_all': ('View all verification', 'verification'),
    'verification.view_assigned': ('View assigned verification', 'verification'),
    'verification.assign': ('Assign verification', 'verification'),
    'verification.review': ('Review verification', 'verification'),
    'verification.approve': ('Approve verification', 'verification'),
    'verification.reject': ('Reject verification', 'verification'),
    'verification.escalate': ('Escalate verification', 'verification'),
    'complaints.view_all': ('View all complaints', 'complaints'),
    'complaints.view_assigned': ('View assigned complaints', 'complaints'),
    'complaints.manage': ('Manage complaints', 'complaints'),
    'complaints.escalate': ('Escalate complaints', 'complaints'),
    'profile_reports.manage': ('Manage profile reports', 'safety'),
    'content.manage': ('Manage content', 'content'),
    'payments.view': ('View payments', 'payments'),
    'payments.refund': ('Approve refunds', 'payments'),
    'notifications.manage': ('Manage notifications', 'notifications'),
    'settings.manage': ('Manage settings', 'settings'),
    'backups.manage': ('Manage backups', 'backups'),
    'activity.view_all': ('View all activity', 'activity'),
}

ADMIN = {
    'dashboard.view', 'members.view', 'members.manage', 'members.suspend', 'members.sensitive',
    'staff.view', 'staff.create', 'staff.manage', 'staff.activity',
    'support_agents.view', 'support_agents.create', 'support_agents.manage', 'support_agents.activity',
    'tickets.view_all', 'tickets.assign', 'tickets.note', 'tickets.status',
    'tickets.escalate', 'tickets.member_details', 'verification.view_all', 'verification.assign',
    'verification.review', 'verification.approve', 'verification.reject', 'verification.escalate',
    'complaints.view_all', 'complaints.manage', 'profile_reports.manage', 'content.manage',
    'payments.view', 'notifications.manage',
}
STAFF = {
    'verification.view_assigned', 'verification.review', 'verification.approve',
    'verification.reject', 'verification.escalate', 'complaints.view_assigned',
    'complaints.escalate', 'members.view',
}
SUPPORT = {
    'tickets.view_assigned', 'tickets.claim', 'tickets.reply', 'tickets.note',
    'tickets.status', 'tickets.escalate', 'tickets.member_details',
}


def seed_rbac(apps, _schema_editor):
    Permission = apps.get_model('accounts', 'AdminPermission')
    Role = apps.get_model('accounts', 'AdminRole')
    RolePermission = apps.get_model('accounts', 'AdminRolePermission')
    permission_rows = {}
    for code, (name, module) in PERMISSIONS.items():
        permission_rows[code], _ = Permission.objects.update_or_create(
            code=code,
            defaults={'name': name, 'module': module, 'description': ''},
        )
    role_permissions = {
        'SUPER_ADMIN': set(PERMISSIONS),
        'ADMIN': ADMIN,
        'STAFF': STAFF,
        'CUSTOMER_SUPPORT': SUPPORT,
    }
    for code, allowed in role_permissions.items():
        role, _ = Role.objects.update_or_create(
            code=code,
            defaults={
                'name': code.replace('_', ' ').title(),
                'description': f'System role for {code.replace("_", " ").title()}.',
                'is_system_role': True,
            },
        )
        for permission_code, permission in permission_rows.items():
            RolePermission.objects.update_or_create(
                role=role,
                permission=permission,
                defaults={'is_allowed': permission_code in allowed},
            )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0001_initial')]
    operations = [migrations.RunPython(seed_rbac, migrations.RunPython.noop)]
