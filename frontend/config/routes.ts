import type { AccountType } from '@/lib/auth';

export interface RouteConfig {
  path: string;
  label: string;
  requiresAuth?: boolean;
  guestOnly?: boolean;
  allowedRoles?: AccountType[];
  requiredPermissions?: string[];
  requiresVerifiedEmail?: boolean;
  requiresVerifiedProfile?: boolean;
  requiresActiveMembership?: boolean;
  redirectTo?: string;
  hideFromNav?: boolean;
}

export type RouteGroup = {
  label: string;
  routes: RouteConfig[];
};

export const publicRoutes: RouteConfig[] = [
  { path: '/', label: 'Home', guestOnly: true },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
  { path: '/faq', label: 'FAQ' },
  { path: '/help', label: 'Help Centre' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms of Service' },
  { path: '/membership', label: 'Membership Plans' },
];

export const authRoutes: RouteConfig[] = [
  { path: '/login', label: 'Login', guestOnly: true },
  { path: '/register', label: 'Register', guestOnly: true },
  { path: '/forgot-password', label: 'Forgot Password', guestOnly: true },
  { path: '/reset-password', label: 'Reset Password', guestOnly: true },
  { path: '/verify-otp', label: 'Verify OTP', guestOnly: true },
  { path: '/403', label: 'Access Denied' },
];

export const memberRoutes: RouteConfig[] = [
  { path: '/dashboard', label: 'Dashboard', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/search', label: 'Search', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/matches', label: 'Matches', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/shortlist', label: 'Shortlist', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/interests', label: 'Interests', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/interests/sent', label: 'Sent Interests', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/interests/received', label: 'Received Interests', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/interests/accepted', label: 'Accepted Interests', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/messages', label: 'Messages', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/messages/[conversationId]', label: 'Conversation', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/notifications', label: 'Notifications', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/support', label: 'Support', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/support/[id]', label: 'Support Detail', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/verification', label: 'Verification', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/compare', label: 'Compare', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/profile', label: 'Profile', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/profile/me', label: 'My Profile', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/profile/[id]', label: 'Profile Detail', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/profile/edit', label: 'Edit Profile', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/profile/photos', label: 'Photos', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/profile/documents', label: 'Documents', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/settings', label: 'Settings', requiresAuth: true, allowedRoles: ['MEMBER'] },
  { path: '/settings/profile', label: 'Profile Settings', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/settings/security', label: 'Security Settings', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/settings/notifications', label: 'Notification Settings', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/settings/membership', label: 'Membership Settings', requiresAuth: true, allowedRoles: ['MEMBER'], hideFromNav: true },
  { path: '/membership', label: 'Membership', requiresAuth: true, allowedRoles: ['MEMBER'] },
];

export const adminRoutes: RouteConfig[] = [
  { path: '/admin/dashboard', label: 'Dashboard', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['dashboard.view'] },
  { path: '/admin/members', label: 'Members', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['members.view'] },
  { path: '/admin/profiles', label: 'Profile Approvals', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { path: '/admin/photos', label: 'Photo Approvals', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { path: '/admin/documents', label: 'Document Verification', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { path: '/admin/memberships', label: 'Memberships', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['members.view'] },
  { path: '/admin/memberships/payments', label: 'Payments', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['payments.view'] },
  { path: '/admin/memberships/refunds', label: 'Refunds', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['payments.refund'] },
  { path: '/admin/tickets', label: 'Support Tickets', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['tickets.view_all'] },
  { path: '/admin/contact-enquiries', label: 'Contact Enquiries', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['tickets.view_all'] },
  { path: '/admin/complaints', label: 'Complaints', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['complaints.view_all'] },
  { path: '/admin/reported-profiles', label: 'Reported Profiles', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['profile_reports.manage'] },
  { path: '/admin/admin-accounts', label: 'Admin Accounts', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/admin/staff-activity', label: 'Staff Activity', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['staff.activity'] },
  { path: '/admin/reports', label: 'Reports', requiresAuth: true, allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['reports.view'] },
  { path: '/admin/audit-logs', label: 'Audit Logs', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['activity.view_all'] },
  { path: '/admin/settings', label: 'Settings', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['settings.manage'] },
  { path: '/admin/backups', label: 'Backups', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['backups.manage'] },
];

export const superAdminRoutes: RouteConfig[] = [
  { path: '/super-admin/dashboard', label: 'Dashboard', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/members', label: 'Members', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/profiles', label: 'Profile Approvals', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/photos', label: 'Photo Approvals', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/documents', label: 'Document Verification', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/memberships', label: 'Memberships', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/memberships/payments', label: 'Payments', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/memberships/refunds', label: 'Refunds', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/tickets', label: 'Support Tickets', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/contact-enquiries', label: 'Contact Enquiries', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/complaints', label: 'Complaints', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/reported-profiles', label: 'Reported Profiles', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },

  { path: '/super-admin/admin-accounts', label: 'Admin Accounts', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/staff-activity', label: 'Staff Activity', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/reports', label: 'Reports', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/audit-logs', label: 'Audit Logs', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/settings', label: 'Settings', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
  { path: '/super-admin/backups', label: 'Backups', requiresAuth: true, allowedRoles: ['SUPER_ADMIN'] },
];

export const staffRoutes: RouteConfig[] = [
];

export const allRoutes = [
  ...publicRoutes,
  ...authRoutes,
  ...memberRoutes,
  ...adminRoutes,
  ...superAdminRoutes,
  ...staffRoutes,
];

export function findRouteConfig(path: string): RouteConfig | undefined {
  const exact = allRoutes.find((r) => r.path === path);
  if (exact) return exact;
  return allRoutes.find((r) => {
    const pattern = r.path.replace(/\[.*?\]/g, '[^/]+');
    return new RegExp(`^${pattern}$`).test(path);
  });
}

export function getRedirectForRole(accountType: AccountType | null): string {
  switch (accountType) {
    case 'MEMBER': return '/dashboard';
    case 'SUPER_ADMIN': return '/super-admin/dashboard';
    case 'ADMIN': return '/admin/dashboard';
    default: return '/login';
  }
}
