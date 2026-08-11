'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import { Activity, Filter, Monitor, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getAdminActivity, type ActivityLog } from '../../services/adminService';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader, AdminPagination,
  AdminPanel, AdminStatusBadge, formatAdminDate,
} from '../../components/admin/AdminUI';

const VALID_MODULES = new Set([
  'accounts', 'backups', 'complaints', 'content', 'documents',
  'enquiries', 'members', 'memberships', 'notifications', 'payments',
  'roles', 'safety', 'settings', 'tickets', 'verification',
]);

export default function AdminActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const initModule = searchParams.get('module') || '';
  const [module, setModule] = useState(VALID_MODULES.has(initModule.toLowerCase()) ? initModule.toLowerCase() : '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const adminId = searchParams.get('admin') || undefined;

  useEffect(() => {
    const m = searchParams.get('module');
    if (m && !VALID_MODULES.has(m.toLowerCase())) {
      const next = new URLSearchParams(searchParams);
      next.delete('module');
      setSearchParamsRef.current(next, { replace: true });
    }
  }, []);

  const loadWithPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminActivity({ page: targetPage, page_size: 20, search, module: module || undefined, admin: adminId });
      setActivity(result.results);
      setCount(result.count);
      setPage(targetPage);
      const next = new URLSearchParams();
      if (adminId) next.set('admin', adminId);
      if (search) next.set('search', search);
      if (module) next.set('module', module);
      if (targetPage > 1) next.set('page', String(targetPage));
      setSearchParamsRef.current(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activity logs could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [adminId, module, search]);

  useEffect(() => {
    setPage(1);
    const timer = window.setTimeout(() => loadWithPage(1), 200);
    return () => window.clearTimeout(timer);
  }, [search, module]);

  if (loading && !activity.length) return <AdminLoading label="Loading protected activity log..." />;
  if (error && !activity.length) return <AdminErrorState message={error} onRetry={() => loadWithPage(page)} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Security & accountability"
        title="Activity logs"
        description="A traceable record of sensitive administrative actions, affected records, devices and outcomes."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={() => loadWithPage(page)}><RefreshCw /> Refresh</button>}
      />
      {adminId && <div className="admin-filter-notice"><ShieldCheck /> Showing activity for the selected administrative account.<button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('admin'); setSearchParamsRef.current(next); }}>Clear account filter</button></div>}
      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search administrator, action or record" /></div>
          <div className="admin-filter-row"><label><Filter /><select value={module} onChange={(event) => setModule(event.target.value)}><option value="">All modules</option><option value="accounts">Accounts</option><option value="backups">Backups</option><option value="complaints">Complaints</option><option value="content">Content</option><option value="documents">Documents</option><option value="enquiries">Enquiries</option><option value="members">Members</option><option value="memberships">Memberships</option><option value="notifications">Notifications</option><option value="payments">Payments</option><option value="roles">Roles</option><option value="safety">Safety</option><option value="settings">Settings</option><option value="tickets">Tickets</option><option value="verification">Verification</option></select></label></div>
        </div>
        {error && <div className="admin-inline-error">{error}</div>}
        {activity.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-activity-table">
              <thead><tr><th>Done by</th><th>Action</th><th>Module / record</th><th>Outcome</th><th>IP & device</th><th>Location</th><th>Date & time</th></tr></thead>
              <tbody>{activity.map((item) => (
                <tr key={item.id}>
                  <td data-label="Done by"><div className="admin-member-cell"><span className="admin-list-avatar activity"><Activity /></span><p><strong>{item.actor_name || item.admin_name || 'Unknown'}</strong><small>{item.actor_role || item.role?.replaceAll('_', ' ') || '—'}</small></p></div></td>
                  <td data-label="Action"><p className="admin-cell-stack"><strong>{item.action.replaceAll('_', ' ')}</strong><small>{item.description || 'Administrative action recorded'}</small></p></td>
                  <td data-label="Module / record"><p className="admin-cell-stack"><strong>{item.module.replaceAll('_', ' ')}</strong><small>{item.record_id ? `Record ${item.record_id}` : 'No record reference'}</small></p></td>
                  <td data-label="Outcome"><AdminStatusBadge status={item.was_successful ? 'Successful' : 'Failed'} /></td>
                  <td data-label="IP & device"><div className="admin-device-cell"><Monitor /><p><strong>{item.ip_address || 'Unknown IP'}</strong><small title={item.user_agent}>{summariseDevice(item.user_agent)}</small></p></div></td>
                  <td data-label="Location"><span className="admin-muted-cell">{item.city && item.country ? `${item.city}, ${item.country}` : item.city || item.country || (item.latitude ? `${item.latitude?.toFixed(2)}, ${item.longitude?.toFixed(2)}` : '—')}</span></td>
                  <td data-label="Date & time"><span className="admin-muted-cell">{formatAdminDate(item.created_at, true)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <AdminEmptyState title="No activity found" description="No audit events match the selected filters." />}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={loadWithPage} />
      </AdminPanel>
    </>
  );
}

function summariseDevice(userAgent?: string) {
  if (!userAgent) return 'Device unavailable';
  if (userAgent.includes('Mobile')) return 'Mobile browser';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  return userAgent.slice(0, 48);
}

