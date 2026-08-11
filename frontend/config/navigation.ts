import {
  Bell, CreditCard, Heart, LayoutDashboard, MessageSquareMore,
  Search, Settings, Star, TicketCheck, User, UserRound, Users,
  HeartHandshake, ShieldCheck, BriefcaseBusiness, Building2,
  ClipboardCheck, FileCheck2, FileImage, FileText,
  Headphones, ListTodo, LockKeyhole, Megaphone,
  ReceiptText, RefreshCcw, Activity, UserCog,
  ShieldEllipsis, Flag, CircleHelp, MapPinned, FolderOpen, type LucideIcon,
} from 'lucide-react';
import type { AccountType } from '@/lib/auth';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  allowedRoles?: AccountType[];
  requiredPermissions?: string[];
  badge?: string;
  children?: NavItem[];
}

export const memberNavigation: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', allowedRoles: ['MEMBER'] },
  { label: 'Search', icon: Search, href: '/search', allowedRoles: ['MEMBER'] },
  {
    label: 'Matches', icon: Heart, href: '/compare', allowedRoles: ['MEMBER'],
    children: [
      { label: 'Recommended', icon: Star, href: '/compare', allowedRoles: ['MEMBER'] },
      { label: 'Sent Interests', icon: HeartHandshake, href: '/interests/sent', allowedRoles: ['MEMBER'] },
      { label: 'Received Interests', icon: Users, href: '/interests/received', allowedRoles: ['MEMBER'] },
    ],
  },
  { label: 'Shortlist', icon: Star, href: '/shortlist', allowedRoles: ['MEMBER'] },
  { label: 'Messages', icon: MessageSquareMore, href: '/messages', allowedRoles: ['MEMBER'] },
  { label: 'Notifications', icon: Bell, href: '/notifications', allowedRoles: ['MEMBER'] },
  { label: 'My Documents', icon: FolderOpen, href: '/profile/documents', allowedRoles: ['MEMBER'] },
  { label: 'Verification', icon: ShieldCheck, href: '/verification', allowedRoles: ['MEMBER'] },
  { label: 'Membership', icon: CreditCard, href: '/membership', allowedRoles: ['MEMBER'] },
  {
    label: 'Settings', icon: Settings, href: '/settings', allowedRoles: ['MEMBER'],
    children: [
      { label: 'Profile', icon: User, href: '/settings/profile', allowedRoles: ['MEMBER'] },
      { label: 'Security', icon: LockKeyhole, href: '/settings/security', allowedRoles: ['MEMBER'] },
      { label: 'Membership', icon: CreditCard, href: '/settings/membership', allowedRoles: ['MEMBER'] },
    ],
  },
  { label: 'Support', icon: CircleHelp, href: '/support', allowedRoles: ['MEMBER'] },
];

export const adminNavSections = [
  { label: 'Workspace', items: ['/admin/dashboard'] as const },
  { label: 'Operations', items: ['/admin/members', '/admin/profiles', '/admin/photos', '/admin/documents', '/admin/memberships', '/admin/memberships/payments', '/admin/memberships/refunds'] as const },
  { label: 'Support', items: ['/admin/tickets', '/admin/contact-enquiries', '/admin/complaints', '/admin/reported-profiles'] as const },
  { label: 'Management', items: ['/admin/staff-activity', '/admin/reports', '/admin/audit-logs', '/admin/settings', '/admin/backups'] as const },
] as const;

export const adminNavigation: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['dashboard.view'] },
  { label: 'Members', icon: Users, href: '/admin/members', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['members.view'] },
  { label: 'Profile Approvals', icon: UserRound, href: '/admin/profiles', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { label: 'Photo Approvals', icon: FileImage, href: '/admin/photos', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { label: 'Documents', icon: FileCheck2, href: '/admin/documents', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['verification.view_all'] },
  { label: 'Memberships', icon: ShieldCheck, href: '/admin/memberships', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['members.view'] },
  { label: 'Payments', icon: CreditCard, href: '/admin/memberships/payments', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['payments.view'] },
  { label: 'Refunds', icon: RefreshCcw, href: '/admin/memberships/refunds', allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['payments.refund'] },
  { label: 'Support Tickets', icon: TicketCheck, href: '/admin/tickets', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['tickets.view_all'] },
  { label: 'Contact Enquiries', icon: MessageSquareMore, href: '/admin/contact-enquiries', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['tickets.view_all'] },
  { label: 'Complaints', icon: Megaphone, href: '/admin/complaints', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['complaints.view_all'] },
  { label: 'Reported Profiles', icon: Flag, href: '/admin/reported-profiles', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['profile_reports.manage'] },
  { label: 'Staff Activity', icon: BriefcaseBusiness, href: '/admin/staff-activity', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['staff.activity'] },
  { label: 'Reports', icon: ReceiptText, href: '/admin/reports', allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiredPermissions: ['reports.view'] },
  { label: 'Audit Logs', icon: Activity, href: '/admin/audit-logs', allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['activity.view_all'] },
  { label: 'Settings', icon: Settings, href: '/admin/settings', allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['settings.manage'] },
  { label: 'Backups', icon: Building2, href: '/admin/backups', allowedRoles: ['SUPER_ADMIN'], requiredPermissions: ['backups.manage'] },
];

export const superAdminNavigation: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/super-admin/dashboard', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Members', icon: Users, href: '/super-admin/members', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Profile Approvals', icon: UserRound, href: '/super-admin/profiles', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Photo Approvals', icon: FileImage, href: '/super-admin/photos', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Documents', icon: FileCheck2, href: '/super-admin/documents', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Memberships', icon: ShieldCheck, href: '/super-admin/memberships', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Payments', icon: CreditCard, href: '/super-admin/memberships/payments', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Refunds', icon: RefreshCcw, href: '/super-admin/memberships/refunds', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Support Tickets', icon: TicketCheck, href: '/super-admin/tickets', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Contact Enquiries', icon: MessageSquareMore, href: '/super-admin/contact-enquiries', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Complaints', icon: Megaphone, href: '/super-admin/complaints', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Reported Profiles', icon: Flag, href: '/super-admin/reported-profiles', allowedRoles: ['SUPER_ADMIN'] },

  { label: 'Admin Accounts', icon: UserCog, href: '/super-admin/admin-accounts', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Staff Activity', icon: BriefcaseBusiness, href: '/super-admin/staff-activity', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Reports', icon: ReceiptText, href: '/super-admin/reports', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Audit Logs', icon: Activity, href: '/super-admin/audit-logs', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Settings', icon: Settings, href: '/super-admin/settings', allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Backups', icon: FileText, href: '/super-admin/backups', allowedRoles: ['SUPER_ADMIN'] },
];

export const staffNavigation: NavItem[] = [];

export function filterNavByRole(items: NavItem[], user: { account_type: AccountType; admin_permissions: string[] } | null): NavItem[] {
  if (!user) return [];
  return items.filter((item) => {
    if (item.allowedRoles && !item.allowedRoles.includes(user.account_type)) return false;
    if (item.requiredPermissions?.length) {
      if (user.account_type === 'SUPER_ADMIN') return true;
      return item.requiredPermissions.some((p) => user.admin_permissions.includes(p));
    }
    return true;
  });
}
