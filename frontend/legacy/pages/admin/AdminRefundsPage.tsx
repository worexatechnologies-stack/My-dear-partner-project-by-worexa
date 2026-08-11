'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Filter, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminTransactionsPage, type AdminTransaction } from '../../services/adminService';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminModal, AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge,
  AdminToast, formatAdminDate, formatAdminMoney,
} from '../../components/admin/AdminUI';
import { fetchApi } from '../../services/apiClient';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

interface RefundForm { amount: string; reason: string; }
const emptyRefundForm: RefundForm = { amount: '', reason: '' };

export default function AdminRefundsPage() {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const [items, setItems] = useState<AdminTransaction[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refundTarget, setRefundTarget] = useState<AdminTransaction | null>(null);
  const [refundForm, setRefundForm] = useState<RefundForm>(emptyRefundForm);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminTransactionsPage({ page, page_size: 20, search: search || undefined, status: statusFilter || undefined });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transactions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  useRealtimeRefresh({
    eventTypes: [
      'refund.requested',
      'refund.approved',
      'refund.rejected',
      'refund.completed',
      'payment.refunded',
    ],
    refresh: load,
    debounceMs: 300,
  });

  const openRefund = (item: AdminTransaction) => {
    setRefundTarget(item);
    setRefundForm({ amount: item.amount, reason: '' });
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    setBusy(true);
    try {
      await fetchApi(`/admin/payments/${refundTarget.id}/refund/`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(refundForm.amount), reason: refundForm.reason }),
      });
      setToast({ message: `Refund of ${formatAdminMoney(refundForm.amount)} initiated for ${refundTarget.user}.`, tone: 'success' });
      setConfirmRefund(false);
      setRefundTarget(null);
      setRefundForm(emptyRefundForm);
      load();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Refund could not be initiated.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const isSuperAdmin = currentUser?.admin_role === 'SUPER_ADMIN';
  const canRefund = isSuperAdmin || hasAdminPermission('payments.refund');

  const isRefundable = (status?: string) => {
    const s = (status || '').toUpperCase();
    return ['SUCCESS', 'PAID', 'CAPTURED', 'PARTIALLY_REFUNDED'].includes(s);
  };

  if (loading && !items.length) return <AdminLoading label="Loading payment recordsâ€¦" />;
  if (error && !items.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Finance"
        title="Refunds"
        description="Review eligible payments and initiate refunds. Only Super Admins can process refunds. All refund actions are audited."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or emailâ€¦" /></div>
          <div className="admin-filter-row">
            <label><Filter />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All payments</option>
                <option value="paid">Paid</option>
                <option value="captured">Captured</option>
                <option value="refunded">Refunded</option>
                <option value="partially_refunded">Partially refunded</option>
                <option value="failed">Failed</option>
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
                <th>Member</th><th>Plan</th><th>Amount</th>
                <th>Status</th><th>Gateway</th><th>Date</th>
                {canRefund && <th className="admin-table-actions-heading">Actions</th>}
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Member">
                      <p className="admin-cell-stack">
                        <strong>{item.user}</strong>
                        <small>{item.email}</small>
                      </p>
                    </td>
                    <td data-label="Plan"><span style={{ fontWeight: 500 }}>{item.plan}</span></td>
                    <td data-label="Amount"><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatAdminMoney(item.amount)}</span></td>
                    <td data-label="Status"><AdminStatusBadge status={item.status} /></td>
                    <td data-label="Gateway"><span className="admin-muted-cell">{item.gateway || 'N/A'}</span></td>
                    <td data-label="Date"><span className="admin-muted-cell">{formatAdminDate(item.date)}</span></td>
                    {canRefund && (
                      <td className="admin-row-actions" data-label="Actions">
                        {isRefundable(item.status) ? (
                          <button type="button" className="admin-btn admin-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => openRefund(item)}>
                            <Download /> Refund
                          </button>
                        ) : (
                          <span className="admin-muted-cell">N/A</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No payments found" description="No payments match the selected filter." />
        )}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      <AdminModal
        open={Boolean(refundTarget) && !confirmRefund}
        title="Initiate refund"
        description={`Processing a refund for ${refundTarget?.user} - ${refundTarget?.plan}`}
        onClose={() => { setRefundTarget(null); setRefundForm(emptyRefundForm); }}
      >
        <div className="admin-form-body">
          <label className="admin-form-field">
            <span>Refund amount (INR)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={refundTarget?.amount}
              value={refundForm.amount}
              onChange={(e) => setRefundForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Enter refund amount"
            />
          </label>
          <label className="admin-form-field">
            <span>Reason for refund</span>
            <textarea
              value={refundForm.reason}
              onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Document the reason for this refundâ€¦"
              rows={3}
            />
          </label>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => { setRefundTarget(null); setRefundForm(emptyRefundForm); }}>Cancel</button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={() => setConfirmRefund(true)} disabled={!refundForm.amount || !refundForm.reason.trim()}>
              Review refund
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminConfirmDialog
        open={confirmRefund}
        title="Confirm refund?"
        description={`This will initiate a refund of ${formatAdminMoney(refundForm.amount)} for ${refundTarget?.user}. This action is irreversible and will be recorded in the audit log.`}
        confirmLabel="Process refund"
        dangerous
        busy={busy}
        onCancel={() => setConfirmRefund(false)}
        onConfirm={submitRefund}
      />
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
