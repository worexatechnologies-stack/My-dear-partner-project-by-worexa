'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Filter, LoaderCircle, RefreshCw, Search, TrendingUp, Users, CreditCard, TicketCheck, Calendar, Activity, UserPlus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi, getAccessToken } from '../../services/apiClient';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader, AdminPanel,
  formatAdminDate, formatAdminMoney,
} from '../../components/admin/AdminUI';

interface ReportStats {
  total_users: number;
  active_users: number;
  new_this_month: number;
  premium_users: number;
  total_revenue: string;
  revenue_this_month: string;
  successful_payments: number;
  pending_tickets: number;
  resolved_tickets: number;
  open_complaints: number;
}

const reportTypes = [
  { value: 'new_users', label: 'New Users', icon: UserPlus },
  { value: 'activities', label: 'Activities', icon: Activity },
  { value: 'expiring_memberships', label: 'Expiring Memberships', icon: Clock },
  { value: 'users', label: 'User registrations', icon: Users },
  { value: 'tickets', label: 'Support tickets', icon: TicketCheck },
  { value: 'payments', label: 'Payment transactions', icon: CreditCard },
];

const dateRanges = [
  { value: 'custom', label: 'Custom Range' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

function todayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function AdminReportsPage() {
  const { hasAdminPermission } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [startDate, setStartDate] = useState(daysAgoStr(30));
  const [endDate, setEndDate] = useState(todayStr());
  const [reportType, setReportType] = useState('new_users');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi<{ stats: ReportStats }>(`/admin/dashboard/?range=${range}`);
      setStats(data.stats as unknown as ReportStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reports could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    if (!hasAdminPermission('reports.export')) {
      setExportMessage('You do not have permission to export reports.');
      return;
    }
    setExporting(true);
    setExportMessage('');
    try {
      const sd = range === 'custom' ? startDate : daysAgoStr(range === '7d' ? 7 : range === '30d' ? 30 : range === 'year' ? 365 : 30);
      const ed = range === 'custom' ? endDate : todayStr();
      const url = `/api/v1/admin/reports/export/?report=${reportType}&start_date=${sd}&end_date=${ed}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${getAccessToken() || ''}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const urlBlob = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = `${reportType}-report-${sd}-to-${ed}.xlsx`;
      a.click();
      URL.revokeObjectURL(urlBlob);
      const label = reportTypes.find((r) => r.value === reportType)?.label || reportType;
      setExportMessage(`${label} report exported successfully.`);
    } catch (err) {
      setExportMessage('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <AdminLoading label="Loading report data..." />;
  if (error) return <AdminErrorState message={error} onRetry={load} />;

  const ReportIcon = reportTypes.find((r) => r.value === reportType)?.icon || Users;

  return (
    <>
      <AdminPageHeader
        eyebrow="Management"
        title="Reports"
        description="View platform-wide analytics and export detailed reports for operational oversight."
        actions={(
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select value={range} onChange={(e) => { setRange(e.target.value); setShowDatePicker(e.target.value === 'custom'); }} aria-label="Date range">
              {dateRanges.map((dr) => <option key={dr.value} value={dr.value}>{dr.label}</option>)}
            </select>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>
          </div>
        )}
      />

      {showDatePicker && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1.5rem', background: 'var(--admin-bg-subtle)', borderRadius: '0.75rem', marginBottom: '1rem' }}>
          <Calendar className="w-4 h-4" style={{ color: 'var(--admin-muted)' }} />
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text)' }}>From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--admin-border)', fontSize: '0.875rem' }} />
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text)' }}>To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--admin-border)', fontSize: '0.875rem' }} />
        </div>
      )}

      {stats && (
        <div className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="admin-stat-icon wine"><Users /></span>
            <div><strong>{(stats.total_users || 0).toLocaleString('en-IN')}</strong><p>Total users</p></div>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-icon green"><TrendingUp /></span>
            <div><strong>{(stats.new_this_month || 0).toLocaleString('en-IN')}</strong><p>New this month</p></div>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-icon gold"><CreditCard /></span>
            <div><strong>{formatAdminMoney(stats.total_revenue)}</strong><p>Total revenue</p></div>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-icon amber"><TicketCheck /></span>
            <div><strong>{(stats.pending_tickets || 0).toLocaleString('en-IN')}</strong><p>Pending tickets</p></div>
          </article>
        </div>
      )}

      <AdminPanel
        title="Export reports"
        subtitle="Download detailed records as Excel (.xlsx) for analysis"
        action={(
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
              style={{ minWidth: '200px' }}>
              {reportTypes.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
            </select>
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? <LoaderCircle className="admin-spinner" /> : <Download />} Export Excel
            </button>
          </div>
        )}
      >
        {exportMessage && (
          <div className={`admin-inline-${exportMessage.includes('success') ? 'success' : 'error'}`}
            style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
              background: exportMessage.includes('success') ? 'var(--admin-success-bg)' : 'var(--admin-danger-bg)',
              color: exportMessage.includes('success') ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
            {exportMessage}
          </div>
        )}
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--admin-bg-subtle)', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <ReportIcon className="w-6 h-6" style={{ color: 'var(--admin-primary)' }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--admin-text)' }}>
                {reportTypes.find((r) => r.value === reportType)?.label || 'Report'}
              </p>
              <p style={{ color: 'var(--admin-muted)', fontSize: '0.8rem' }}>
                Select date range and click Export to download
              </p>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--admin-muted)', fontSize: '0.875rem', lineHeight: 2 }}>
            <li><strong>New Users</strong>: ID, name, email, mobile, gender, profile status, join date</li>
            <li><strong>Activities</strong>: Date, actor, role, action, module, target, description, IP — for all admin types and members</li>
            <li><strong>Expiring Memberships</strong>: Member ID, name, email, mobile, plan, expiry date, days remaining, contact status — includes phone numbers for calling</li>
            <li><strong>User registrations</strong>: ID, name, email, gender, verification status, join date</li>
            <li><strong>Support tickets</strong>: ticket number, subject, user, priority, status, assignment</li>
            <li><strong>Payment transactions</strong>: ID, user, amount, currency, status, gateway reference</li>
          </ul>
        </div>
      </AdminPanel>
    </>
  );
}
