'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowUpCircle, CheckCircle2, Filter,
  LoaderCircle, RefreshCw, Search, UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import type { AdminListParams, AdminIdentity } from '../../services/adminService';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge,
  AdminToast, formatAdminDate,
} from '../../components/admin/AdminUI';

interface Complaint {
  id: string;
  user: AdminIdentity | null;
  subject: string;
  description: string;
  status: string;
  assigned_to: AdminIdentity | null;
  escalated_by: AdminIdentity | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedComplaints {
  count: number; page: number; page_size: number; num_pages: number; results: Complaint[];
}

const getComplaints = (params: AdminListParams = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null) as [string, string][])
  ).toString();
  return fetchApi<PaginatedComplaints>(`/admin/complaints/${qs ? `?${qs}` : ''}`);
};

const updateComplaint = (id: string, data: Record<string, unknown>) =>
  fetchApi<Complaint>(`/admin/complaints/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });

export default function AdminComplaintsPage() {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ item: Complaint; action: string; label: string; description: string; dangerous: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getComplaints({ page, page_size: 20, search: search || undefined, status: statusFilter || undefined });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Complaints could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const runAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (confirm.action === 'escalate') { payload.action = 'escalate'; payload.status = 'ESCALATED'; }
      else if (confirm.action === 'resolve') payload.status = 'RESOLVED';
      else if (confirm.action === 'close') payload.status = 'CLOSED';
      const updated = await updateComplaint(confirm.item.id, payload);
      setItems((rows) => rows.map((r) => r.id === updated.id ? updated : r));
      setToast({ message: `Complaint updated successfully.`, tone: 'success' });
      setConfirm(null);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Action failed.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const isStaff = currentUser?.admin_role === 'ADMIN';
  const canManage = hasAdminPermission('complaints.manage') || hasAdminPermission('complaints.escalate');

  if (loading && !items.length) return <AdminLoading label="Loading complaintsâ€¦" />;
  if (error && !items.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Support Operations"
        title="Complaints"
        description="Review user complaints and escalations. Manage resolution and assignment across your support team."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search complaintsâ€¦" /></div>
          <div className="admin-filter-row">
            <label><Filter />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="ESCALATED">Escalated</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          </div>
        </div>

        {error && <div className="admin-inline-error">{error}</div>}
        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updatingâ€¦</div>}

        {items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr>
                <th>User</th><th>Subject</th><th>Status</th>
                <th>Assigned to</th><th>Created</th>
                {canManage && <th className="admin-table-actions-heading">Actions</th>}
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="User">
                      <p className="admin-cell-stack">
                        <strong>{item.user?.full_name || 'Deleted user'}</strong>
                        <small>{item.user?.email || 'N/A'}</small>
                      </p>
                    </td>
                    <td data-label="Subject"><span style={{ fontWeight: 500 }}>{item.subject}</span></td>
                    <td data-label="Status"><AdminStatusBadge status={item.status} /></td>
                    <td data-label="Assigned to"><span className="admin-muted-cell">{item.assigned_to?.full_name || 'Unassigned'}</span></td>
                    <td data-label="Created"><span className="admin-muted-cell">{formatAdminDate(item.created_at)}</span></td>
                    {canManage && (
                      <td className="admin-row-actions" data-label="Actions">
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {isStaff && item.status !== 'ESCALATED' && item.status !== 'RESOLVED' && (
                            <button type="button" className="admin-btn admin-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => setConfirm({ item, action: 'escalate', label: 'Escalate complaint?', description: `This will escalate the complaint from ${item.user?.full_name || 'this user'} to an administrator for review.`, dangerous: false })}>
                              <ArrowUpCircle /> Escalate
                            </button>
                          )}
                          {!isStaff && item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                            <button type="button" className="admin-btn admin-btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => setConfirm({ item, action: 'resolve', label: 'Mark as resolved?', description: `This will mark the complaint from ${item.user?.full_name || 'this user'} as resolved.`, dangerous: false })}>
                              <CheckCircle2 /> Resolve
                            </button>
                          )}
                          {!isStaff && item.status !== 'CLOSED' && (
                            <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => setConfirm({ item, action: 'close', label: 'Close complaint?', description: `This will close the complaint from ${item.user?.full_name || 'this user'}. No further action will be taken.`, dangerous: true })}>
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No complaints found" description="No complaints match your current filter." />
        )}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      <AdminConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.label || 'Confirm'}
        description={confirm?.description || ''}
        confirmLabel={confirm?.action === 'escalate' ? 'Escalate' : confirm?.action === 'resolve' ? 'Mark resolved' : 'Close complaint'}
        dangerous={confirm?.dangerous ?? false}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runAction}
      />
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
