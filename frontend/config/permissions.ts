export type PermissionGroup = {
  module: string;
  label: string;
  permissions: { code: string; label: string; description: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: 'members',
    label: 'Members',
    permissions: [
      { code: 'members.view', label: 'View', description: 'View member profiles and details' },
      { code: 'members.view_sensitive', label: 'View sensitive data', description: 'View contact and sensitive member information' },
      { code: 'members.edit', label: 'Edit', description: 'Edit member profiles' },
      { code: 'members.suspend', label: 'Suspend', description: 'Suspend or ban member accounts' },
      { code: 'members.delete', label: 'Delete', description: 'Delete member accounts' },
      { code: 'members.verify', label: 'Verify', description: 'Verify member profiles' },
    ],
  },
  {
    module: 'verification',
    label: 'Verification',
    permissions: [
      { code: 'verification.view_all', label: 'View all', description: 'View all verification submissions' },
      { code: 'verification.approve', label: 'Approve', description: 'Approve verification requests' },
      { code: 'verification.reject', label: 'Reject', description: 'Reject verification requests' },
      { code: 'verification.request_changes', label: 'Request changes', description: 'Request changes to submissions' },
    ],
  },
  {
    module: 'documents',
    label: 'Documents',
    permissions: [
      { code: 'documents.view', label: 'View', description: 'View uploaded documents' },
      { code: 'documents.request', label: 'Request', description: 'Request documents from members' },
      { code: 'documents.approve', label: 'Approve', description: 'Approve documents' },
      { code: 'documents.reject', label: 'Reject', description: 'Reject documents' },
    ],
  },
  {
    module: 'payments',
    label: 'Payments',
    permissions: [
      { code: 'payments.view', label: 'View', description: 'View payment records' },
      { code: 'payments.refund', label: 'Refund', description: 'Process refunds' },
    ],
  },
  {
    module: 'tickets',
    label: 'Support Tickets',
    permissions: [
      { code: 'tickets.view_all', label: 'View all', description: 'View all support tickets' },
      { code: 'tickets.assign', label: 'Assign', description: 'Assign tickets to agents' },
      { code: 'tickets.close', label: 'Close', description: 'Close tickets' },
    ],
  },

  {
    module: 'reports',
    label: 'Reports',
    permissions: [
      { code: 'reports.view', label: 'View', description: 'View platform reports' },
      { code: 'reports.export', label: 'Export', description: 'Export report data' },
    ],
  },
  {
    module: 'profile_reports',
    label: 'Profile Reports',
    permissions: [
      { code: 'profile_reports.manage', label: 'Manage', description: 'Manage reported profiles' },
    ],
  },
  {
    module: 'complaints',
    label: 'Complaints',
    permissions: [
      { code: 'complaints.view_all', label: 'View all', description: 'View all complaints' },
      { code: 'complaints.resolve', label: 'Resolve', description: 'Resolve complaints' },
    ],
  },
  {
    module: 'admins',
    label: 'Admin Management',
    permissions: [
      { code: 'admins.manage', label: 'Manage admins', description: 'Create and manage admin accounts' },
      { code: 'staff.manage', label: 'Manage staff', description: 'Create and manage staff accounts' },
      { code: 'support_agents.manage', label: 'Manage support agents', description: 'Create and manage support agents' },
    ],
  },
  {
    module: 'roles',
    label: 'Roles & Permissions',
    permissions: [
      { code: 'roles.manage', label: 'Manage roles', description: 'Manage roles and permission groups' },
      { code: 'roles.assign', label: 'Assign roles', description: 'Assign roles to users' },
    ],
  },
  {
    module: 'staff',
    label: 'Staff',
    permissions: [
      { code: 'staff.activity', label: 'View activity', description: 'View staff activity logs' },
    ],
  },
  {
    module: 'activity',
    label: 'Audit Logs',
    permissions: [
      { code: 'activity.view_all', label: 'View all', description: 'View full audit log' },
    ],
  },
  {
    module: 'settings',
    label: 'Platform Settings',
    permissions: [
      { code: 'settings.manage', label: 'Manage', description: 'Manage platform settings' },
    ],
  },
  {
    module: 'backups',
    label: 'Backups',
    permissions: [
      { code: 'backups.manage', label: 'Manage', description: 'Manage database backups' },
    ],
  },
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { code: 'dashboard.view', label: 'View', description: 'View dashboard' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.code));
