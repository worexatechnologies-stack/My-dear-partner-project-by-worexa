'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Activity, BadgeCheck, Banknote, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, FileCheck2, FileImage, Flag, Headphones, HeartHandshake,
  LoaderCircle, RefreshCw, ShieldAlert, TicketCheck, UserRoundCheck, Users,
} from 'lucide-react';
import { useAuth, type AdminRole } from '../../contexts/AuthContext';
import {
  getAdminDashboard, type AdminDashboard, type AdminDashboardStats,
  type DashboardChartPoint,
} from '../../services/adminService';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader, AdminPanel,
  AdminStatusBadge, formatAdminDate, formatAdminMoney, AdminSkeleton,
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

interface StatDefinition {
  key: keyof AdminDashboardStats;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  money?: boolean;
}

const stat = (key: keyof AdminDashboardStats, label: string, icon: StatDefinition['icon'], tone: string, money = false): StatDefinition => ({ key, label, icon, tone, money });

const roleStats: Record<AdminRole, StatDefinition[]> = {
  SUPER_ADMIN: [
    stat('total_users', 'Total users', Users, 'wine'),
    stat('active_users', 'Active users', UserRoundCheck, 'green'),
    stat('pending_profile_approvals', 'Profile approvals', ShieldAlert, 'amber'),
    stat('verified_users', 'Verified profiles', BadgeCheck, 'rose'),
    stat('suspended_users', 'Suspended users', ShieldAlert, 'red'),
    stat('new_today', 'New today', CalendarDays, 'purple'),
    stat('new_this_month', 'New this month', Users, 'rose'),
    stat('male_profiles', 'Male profiles', Users, 'slate'),
    stat('female_profiles', 'Female profiles', Users, 'wine'),
    stat('premium_users', 'Premium members', HeartHandshake, 'gold'),
    stat('expired_memberships', 'Expired memberships', Clock3, 'slate'),
    stat('total_revenue', 'Total revenue', Banknote, 'green', true),
    stat('revenue_this_month', 'Revenue this month', CircleDollarSign, 'green', true),
    stat('pending_payments', 'Pending payments', CreditCard, 'amber'),
    stat('successful_payments', 'Successful payments', CheckCircle2, 'green'),
    stat('failed_payments', 'Failed payments', CreditCard, 'red'),
    stat('pending_tickets', 'Pending tickets', TicketCheck, 'amber'),
    stat('open_complaints', 'Open complaints', Headphones, 'red'),
    stat('reported_profiles', 'Reported profiles', Flag, 'red'),
  ],
  ADMIN: [
    stat('total_users', 'Total users', Users, 'wine'),
    stat('pending_profile_approvals', 'Profile approvals', ShieldAlert, 'amber'),
    stat('pending_photo_approvals', 'Photo approvals', FileImage, 'amber'),
    stat('pending_document_verification', 'Document checks', FileCheck2, 'rose'),
    stat('suspended_users', 'Suspended users', ShieldAlert, 'red'),
    stat('new_this_month', 'New registrations', Users, 'purple'),
    stat('active_memberships', 'Active memberships', BadgeCheck, 'green'),
    stat('expired_memberships', 'Expired memberships', Clock3, 'slate'),
    stat('pending_tickets', 'Pending tickets', TicketCheck, 'amber'),
    stat('open_complaints', 'Complaints', Headphones, 'red'),
    stat('reported_profiles', 'Reported profiles', Flag, 'red'),
  ],
};

const roleCopy: Record<AdminRole, { eyebrow: string; title: string; description: string }> = {
  SUPER_ADMIN: {
    eyebrow: 'Executive control centre',
    title: 'Complete platform overview',
    description: 'Revenue, users, trust operations and administrative activity in one secure view.',
  },
  ADMIN: {
    eyebrow: 'Operations workspace',
    title: 'Keep daily operations moving',
    description: 'Prioritise approvals, memberships, reports and customer issues without exposing critical settings.',
  },
};

const dateRanges = [
  ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'],
  ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom range'],
] as const;

export default function AdminDashboardPage() {
  const { user, updateUser } = useAuth();
  const initialRole = (user?.admin_role || (user?.is_superuser ? 'SUPER_ADMIN' : 'ADMIN')) as AdminRole;
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [range, setRange] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const params = range === 'custom'
        ? { date_from: dateFrom || undefined, date_to: dateTo || undefined }
        : { range };
      const data = await getAdminDashboard(params);
      setDashboard(data);
      updateUser({
        admin_role: data.role,
        admin_role_name: data.role_display,
        admin_role_display: data.role_display,
        admin_permissions: data.permissions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, range, updateUser]);

  useEffect(() => { load(); }, [load]);

  // Live-reload when a WebSocket verification event fires
  useEffect(() => {
    const handler = () => load(true);
    window.addEventListener('admin-update', handler);
    return () => window.removeEventListener('admin-update', handler);
  }, [load]);

  // Realtime refresh via the centralised RealtimeProvider
  useRealtimeRefresh({
    eventTypes: [
      'verification.submitted',
      'verification.approved',
      'verification.rejected',
      'verification.changes_requested',
      'profile.submitted',
      'profile.approved',
      'profile.rejected',
      'photo.uploaded',
      'photo.approved',
      'photo.rejected',
      'document.uploaded',
      'document.approved',
      'document.rejected',
      'membership.purchased',
      'membership.activated',
      'membership.cancelled',
      'membership.expired',
      'payment.success',
      'payment.failed',
      'payment.refunded',
      'support.ticket_created',
      'support.ticket_assigned',
      'support.ticket_resolved',
      'complaint.created',
      'complaint.resolved',
      'report.created',
      'refund.requested',
      'refund.completed',
      'contact.created',
    ],
    refresh: useCallback(() => load(true), [load]),
    debounceMs: 400,
  });

  const role = dashboard?.role || initialRole;
  const copy = roleCopy[role];
  const visibleStats = roleStats[role];
  const charts = useMemo(() => dashboard?.charts || { registrations: [], revenue: [], memberships: [] }, [dashboard]);

  if (loading) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Loading workspace"
          title="Loading operational metrics..."
          description="Preparing secure data metrics for your role..."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="admin-skeleton-card" style={{ background: 'var(--admin-surface, #fff)', border: '1px solid var(--admin-line, rgba(0,0,0,0.08))', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="admin-skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e5e7eb', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="admin-skeleton-shimmer" style={{ width: '70%', height: '18px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '0.25rem' }} />
                <div className="admin-skeleton-shimmer" style={{ width: '40%', height: '12px', background: '#f3f4f6', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="admin-chart-grid" style={{ marginBottom: '2rem' }}>
          <AdminSkeleton type="chart" />
          <AdminSkeleton type="chart" />
        </div>
      </>
    );
  }
  if (error && !dashboard) return <AdminErrorState message={error} onRetry={() => load()} />;

  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},`;
  const adminName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Administrator';

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={`${greeting} ${adminName}`}
        description={`${copy.description} (Logged in as: ${user?.email || ''})`}
        actions={(
          <div className="admin-dashboard-filters">
            <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Dashboard date range">
              {dateRanges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" className="admin-icon-btn" onClick={() => load(true)} aria-label="Refresh dashboard" disabled={refreshing}>
              {refreshing ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />}
            </button>
          </div>
        )}
      />

      {range === 'custom' && (
        <div className="admin-custom-date-row">
          <label>From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>
      )}
      {error && <div className="admin-inline-error">{error}</div>}

      <div className="admin-stat-grid">
        {visibleStats.map(({ key, label, icon: Icon, tone, money }) => {
          const value = dashboard?.stats[key] ?? 0;
          return (
            <article className="admin-stat-card" key={key}>
              <span className={`admin-stat-icon ${tone}`}><Icon /></span>
              <div><strong>{money ? formatAdminMoney(value) : Number(value).toLocaleString('en-IN')}</strong><p>{label}</p></div>
            </article>
          );
        })}
      </div>

      <div className="admin-chart-grid">
        <AdminPanel title="User registrations" subtitle="Registration volume for the selected period">
          <AdminBarChart points={charts.registrations} empty="No registration history in this period." />
        </AdminPanel>
        {role === 'SUPER_ADMIN' && (
          <AdminPanel title="Revenue trend" subtitle="Recognised membership revenue">
            <AdminBarChart points={charts.revenue} money empty="No revenue history in this period." />
          </AdminPanel>
        )}
        <AdminPanel title="Membership mix" subtitle="Members by active plan">
          <AdminDistribution points={charts.memberships} />
        </AdminPanel>
      </div>

      <div className="admin-dashboard-recent-grid">
        <AdminPanel title="Recent registrations" subtitle="Latest members visible to your role">
          {dashboard?.recent_users.length ? (
            <div className="admin-compact-list">
              {dashboard.recent_users.slice(0, 6).map((member) => (
                <div key={member.id}>
                  <span className="admin-list-avatar">{(member.full_name || member.email).slice(0, 1).toUpperCase()}</span>
                  <p><strong>{member.full_name || 'Unnamed member'}</strong><small>{member.email}</small></p>
                  <AdminStatusBadge status={member.is_verified ? 'Verified' : 'Pending'} />
                </div>
              ))}
            </div>
          ) : <AdminEmptyState title="No recent users" description="Recent members will appear here." />}
        </AdminPanel>

        <AdminPanel title="Recent ticket activity" subtitle="Latest support work in your scope">
          {dashboard?.recent_tickets.length ? (
            <div className="admin-compact-list">
              {dashboard.recent_tickets.slice(0, 6).map((ticket) => (
                <div key={ticket.id}>
                  <span className="admin-list-avatar ticket"><TicketCheck /></span>
                  <p><strong>{ticket.subject}</strong><small>{ticket.ticket_number} Â· {ticket.user?.full_name || 'Unassigned user'}</small></p>
                  <AdminStatusBadge status={ticket.status} />
                </div>
              ))}
            </div>
          ) : <AdminEmptyState title="No recent tickets" description="New support activity will appear here." />}
        </AdminPanel>

        {role === 'SUPER_ADMIN' && (
          <AdminPanel title="Recent payments" subtitle="Latest membership transactions">
            {dashboard?.recent_payments.length ? (
              <div className="admin-compact-list">
                {dashboard.recent_payments.slice(0, 6).map((payment) => (
                  <div key={payment.id}>
                    <span className="admin-list-avatar money"><CreditCard /></span>
                    <p><strong>{payment.user || payment.email}</strong><small>{payment.plan} Â· {formatAdminDate(payment.date)}</small></p>
                    <b>{formatAdminMoney(payment.amount)}</b>
                  </div>
                ))}
              </div>
            ) : <AdminEmptyState title="No recent payments" description="New transactions will appear here." />}
          </AdminPanel>
        )}

        {role === 'SUPER_ADMIN' && (
          <AdminPanel title="Recent admin activity" subtitle="Latest privileged actions">
            {dashboard?.recent_activity.length ? (
              <div className="admin-activity-preview">
                {dashboard.recent_activity.slice(0, 6).map((item) => (
                  <div key={item.id}><span><Activity /></span><p><strong>{item.admin_name}</strong> {item.description || item.action}<small>{formatAdminDate(item.created_at, true)}</small></p></div>
                ))}
              </div>
            ) : <AdminEmptyState title="No recent activity" description="Administrative actions will appear here." />}
          </AdminPanel>
        )}
      </div>
    </>
  );
}

function AdminBarChart({ points, money = false, empty }: { points: DashboardChartPoint[]; money?: boolean; empty: string }) {
  if (!points.length) return <AdminEmptyState title="No chart data" description={empty} />;
  const max = Math.max(...points.map((point) => Number(point.value)), 1);
  return (
    <div className="admin-bar-chart">
      {points.map((point) => (
        <div className="admin-bar-column" key={point.label} title={`${point.label}: ${money ? formatAdminMoney(point.value) : point.value}`}>
          <span>{money ? formatAdminMoney(point.value) : point.value.toLocaleString('en-IN')}</span>
          <i style={{ height: `${Math.max((point.value / max) * 100, 4)}%` }} />
          <small>{point.label}</small>
        </div>
      ))}
    </div>
  );
}

function AdminDistribution({ points }: { points: DashboardChartPoint[] }) {
  if (!points.length) return <AdminEmptyState title="No membership data" description="Membership distribution will appear here." />;
  const total = Math.max(points.reduce((sum, point) => sum + Number(point.value), 0), 1);
  return (
    <div className="admin-distribution">
      {points.map((point, index) => (
        <div key={point.label}>
          <p><span><i className={`tone-${index % 4}`} />{point.label}</span><strong>{point.value.toLocaleString('en-IN')}</strong></p>
          <div><i className={`tone-${index % 4}`} style={{ width: `${(point.value / total) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
