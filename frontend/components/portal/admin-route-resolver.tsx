'use client';

import dynamic from 'next/dynamic';
import { notFound, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ComponentType } from 'react';
import { useAuth } from '@/legacy/contexts/AuthContext';

const load = (loader: () => Promise<{ default: ComponentType<any> }>) => dynamic(loader, { loading: () => <div className="portal-loading">Loading module…</div> });
const Dashboard = load(() => import('@/legacy/pages/admin/AdminDashboardPage'));
const Members = load(() => import('@/legacy/pages/admin/AdminUsersPage'));
const Tickets = load(() => import('@/legacy/pages/admin/AdminTicketsPage'));
const Enquiries = load(() => import('@/legacy/pages/admin/AdminEnquiriesPage'));
const Activity = load(() => import('@/legacy/pages/admin/AdminActivityPage'));
const Payments = load(() => import('@/legacy/pages/admin/AdminPaymentsPage'));
const Profiles = load(() => import('@/legacy/pages/admin/AdminProfileApprovalsPage'));
const Photos = load(() => import('@/legacy/pages/admin/AdminPhotoApprovalsPage'));
const Documents = load(() => import('@/legacy/pages/admin/AdminDocumentVerificationPage'));
const Memberships = load(() => import('@/legacy/pages/admin/AdminMembershipsPage'));
const MembershipPlans = load(() => import('@/legacy/pages/admin/AdminMembershipPlansPage'));
const Complaints = load(() => import('@/legacy/pages/admin/AdminComplaintsPage'));
const ReportedProfiles = load(() => import('@/legacy/pages/admin/AdminReportedProfilesPage'));
const Reports = load(() => import('@/legacy/pages/admin/AdminReportsPage'));
const Refunds = load(() => import('@/legacy/pages/admin/AdminRefundsPage'));
const StaffActivity = load(() => import('@/legacy/pages/admin/AdminStaffActivityPage'));
const AdminAccounts = load(() => import('@/legacy/pages/admin/AdminAccountsManagementPage'));
const System = load(() => import('@/legacy/pages/admin/AdminSystemPage'));
const MemberDetail = load(() => import('@/legacy/pages/admin/AdminMemberDetailPage'));

type RouteEntry = { component: ComponentType<any>; permission?: string; props?: Record<string, unknown> };

const routes: Record<string, RouteEntry> = {
  dashboard: { component: Dashboard, permission: 'dashboard.view' },
  members: { component: Members, permission: 'members.view' },
  profiles: { component: Profiles, permission: 'verification.view_all' },
  'profile-verifications': { component: Profiles, permission: 'verification.view_all' },
  photos: { component: Photos, permission: 'verification.view_all' },
  'photo-verifications': { component: Photos, permission: 'verification.view_all' },
  documents: { component: Documents, permission: 'verification.view_all' },
  'document-verifications': { component: Documents, permission: 'verification.view_all' },
  memberships: { component: Memberships, permission: 'memberships.view' },
  'membership-plans': { component: MembershipPlans, permission: 'memberships.view' },
  tickets: { component: Tickets, permission: 'tickets.view_all' },
  'support-tickets': { component: Tickets, permission: 'tickets.view_all' },
  'contact-enquiries': { component: Enquiries, permission: 'tickets.view_all' },
  reports: { component: Reports, permission: 'reports.view' },
  'audit-logs': { component: Activity, permission: 'activity.view_all' },
  activity: { component: Activity, permission: 'activity.view_all' },
  settings: { component: System, permission: 'settings.manage', props: { mode: 'settings' } },
  backups: { component: System, permission: 'backups.manage', props: { mode: 'backups' } },
  complaints: { component: Complaints, permission: 'complaints.view_all' },
  'reported-profiles': { component: ReportedProfiles, permission: 'profile_reports.manage' },
  'staff-activity': { component: StaffActivity, permission: 'staff.activity' },
  'admin-accounts': { component: AdminAccounts },
  'admin_accounts': { component: AdminAccounts },
  'accounts': { component: AdminAccounts },
  'memberships/payments': { component: Payments, permission: 'payments.view' },
  'memberships/refunds': { component: Refunds, permission: 'payments.refund' },
  'memberships/subscriptions': { component: Memberships, permission: 'memberships.view' },
};

function routeKey(pathname: string, portal: 'admin' | 'super-admin') {
  const path = pathname.replace(new RegExp(`^/${portal}/?`), '').replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return 'dashboard';
  const two = segments.slice(0, 2).join('/');
  if (routes[two]) return two;
  return segments[0];
}

function AdminPermissionGuard({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const router = useRouter();
  const { user, hasAdminPermission, loading } = useAuth();
  const isSuperAdmin = user?.account_type === 'SUPER_ADMIN' || user?.is_superuser;
  const isAllowed = !permission || isSuperAdmin || hasAdminPermission(permission);

  useEffect(() => {
    if (!loading && user && !isAllowed) {
      router.replace('/403');
    }
  }, [isAllowed, loading, user, router]);

  if (loading) return <div className="portal-loading">Loading module…</div>;
  if (!isAllowed) return <div className="portal-loading">Checking permissions…</div>;
  return <>{children}</>;
}

export function AdminRouteResolver({ portal }: { portal: 'admin' | 'super-admin' }) {
  const pathname = usePathname();
  const segments = pathname.replace(new RegExp(`^/${portal}/?`), '').split('/').filter(Boolean);
  const memberId = segments[0] === 'members' ? segments[1] : undefined;
  const entry = memberId ? { component: MemberDetail, permission: 'members.manage', props: { memberId } } : routes[routeKey(pathname, portal)];
  if (!entry) notFound();
  const Component = entry.component;
  return (
    <AdminPermissionGuard permission={entry.permission}>
      <Component {...entry.props} />
    </AdminPermissionGuard>
  );
}
