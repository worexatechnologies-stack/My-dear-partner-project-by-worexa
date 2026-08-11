import type { LucideIcon } from 'lucide-react';
import {
  Activity, BadgeCheck, BriefcaseBusiness, Building2,
  CircleHelp, ClipboardCheck, Clock3, CreditCard, FileCheck2, FileImage, FileText,
  Flag, Headphones, Image, LayoutDashboard, LifeBuoy, ListTodo,
  LockKeyhole, MapPinned, Megaphone, MessageSquareMore,
  ReceiptText, RefreshCcw, SearchCheck, Settings, ShieldEllipsis, TicketCheck,
  UserCog, UserRoundCheck, Users,
} from 'lucide-react';
import type { AdminRole } from '../contexts/AuthContext';

export type AdminNavSection = 'Workspace' | 'Operations' | 'Content' | 'Management' | 'Support';

export interface AdminNavItem {
  path: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  section: AdminNavSection;
  permissions?: string[];
  roles?: AdminRole[];
  implemented?: boolean;
}

const leadership: AdminRole[] = ['SUPER_ADMIN', 'ADMIN'];
const superAdmin: AdminRole[] = ['SUPER_ADMIN'];

export const adminNavigation: AdminNavItem[] = [
  { path: '/admin/dashboard', label: 'Dashboard', description: 'Your live operational overview.', icon: LayoutDashboard, section: 'Workspace', implemented: true },
  { path: '/admin/members', label: 'Members', description: 'Search, review, verify and manage members.', icon: Users, section: 'Operations', permissions: ['members.view'], implemented: true },
  // { path: '/admin/profile-verifications', label: 'Profile approvals', description: 'Review profiles waiting for approval.', icon: UserRoundCheck, section: 'Operations', permissions: ['verification.view_all'], roles: leadership },
  { path: '/admin/photo-verifications', label: 'Photo approvals', description: 'Approve or reject member photos.', icon: FileImage, section: 'Operations', permissions: ['verification.view_all'], roles: leadership },
  { path: '/admin/documents', label: 'Document Verification', shortLabel: 'Documents', description: 'Review and approve member verification documents.', icon: FileCheck2, section: 'Operations', permissions: ['verification.view_all'], roles: leadership, implemented: true },
  { path: '/admin/memberships', label: 'Memberships', description: 'Review subscriptions and membership health.', icon: BadgeCheck, section: 'Operations', permissions: ['members.view'], roles: leadership, implemented: true },
  { path: '/admin/membership-plans', label: 'Membership Plans', shortLabel: 'Plans', description: 'Configure plan tiers, pricing, and entitlements.', icon: CreditCard, section: 'Operations', permissions: ['memberships.view'], roles: superAdmin, implemented: true },
  { path: '/admin/memberships/payments', label: 'Payments', description: 'Track successful, pending and failed payments.', icon: CreditCard, section: 'Operations', permissions: ['payments.view'], roles: leadership, implemented: true },
  { path: '/admin/memberships/refunds', label: 'Refunds', description: 'Review and process eligible refund requests.', icon: RefreshCcw, section: 'Operations', permissions: ['payments.refund'], roles: superAdmin },
  { path: '/admin/support-tickets', label: 'Support tickets', description: 'Triage, assign and resolve support work.', icon: TicketCheck, section: 'Support', permissions: ['tickets.view_all'], roles: leadership, implemented: true },
  { path: '/admin/contact-enquiries', label: 'Contact enquiries', description: 'Track and resolve incoming enquiries.', icon: MessageSquareMore, section: 'Support', permissions: ['tickets.view_all'], implemented: true },
  { path: '/admin/complaints', label: 'Complaints', description: 'Review member complaints and escalations.', icon: Megaphone, section: 'Support', permissions: ['complaints.view_all'], roles: leadership },
  { path: '/admin/reported-profiles', label: 'Reported profiles', description: 'Investigate suspicious and reported profiles.', icon: Flag, section: 'Support', permissions: ['profile_reports.manage'], roles: leadership },

  { path: '/admin/admin-accounts', label: 'Admin Accounts', description: 'Create and manage administrative profiles.', icon: UserCog, section: 'Management', roles: superAdmin, implemented: true },
  { path: '/admin/staff-activity', label: 'Staff activity', description: 'Review recent Staff operational activity.', icon: BriefcaseBusiness, section: 'Management', permissions: ['staff.activity'], roles: leadership },
  { path: '/admin/reports', label: 'Reports', description: 'View and export permitted platform reports.', icon: ReceiptText, section: 'Management', permissions: ['reports.view'], roles: leadership },
  { path: '/admin/activity', label: 'Activity logs', description: 'Audit administrative actions and changes.', icon: Activity, section: 'Management', permissions: ['activity.view_all'], roles: superAdmin, implemented: true },
  { path: '/admin/settings', label: 'Settings', description: 'Manage application and integration settings.', icon: Settings, section: 'Management', permissions: ['settings.manage'], roles: superAdmin, implemented: true },
  { path: '/admin/backups', label: 'Backups', description: 'Review protected database backup operations.', icon: Building2, section: 'Management', permissions: ['backups.manage'], roles: superAdmin, implemented: true },
];

export const adminNavSections: AdminNavSection[] = ['Workspace', 'Operations', 'Support', 'Content', 'Management'];

export function canAccessAdminItem(
  item: AdminNavItem,
  role: AdminRole | null | undefined,
  permissions: string[] = [],
) {
  if (!role) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (!item.permissions?.length) return true;
  const permissionSet = new Set(permissions);
  return item.permissions.some((permission) => permissionSet.has(permission));
}

// Normalize portal-specific paths to their /admin/* equivalent for lookups.
export const normalizeAdminPath = (pathname: string) => {
  if (pathname.startsWith('/super-admin/')) return pathname.replace('/super-admin/', '/admin/');
  return pathname;
};

export const findAdminNavItem = (pathname: string) => {
  const normalized = normalizeAdminPath(pathname);
  return adminNavigation.find((item) => item.path === normalized || item.path === pathname);
};
