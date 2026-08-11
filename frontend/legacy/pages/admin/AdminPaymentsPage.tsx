'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { BadgeCheck, Banknote, CreditCard, Filter, RefreshCw, Search, WalletCards } from 'lucide-react';
import { getAdminTransactionsPage, type AdminTransaction } from '../../services/adminService';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader, AdminPagination,
  AdminPanel, AdminStatusBadge, formatAdminDate, formatAdminMoney,
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function AdminPaymentsPage() {
  const location = useLocation();
  const membershipMode = location.pathname.endsWith('/memberships');
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminTransactionsPage({ page, page_size: 20, search, status: status || undefined });
      setTransactions(result.results);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${membershipMode ? 'Memberships' : 'Payments'} could not be loaded.`);
    } finally {
      setLoading(false);
    }
  }, [membershipMode, page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  useRealtimeRefresh({
    eventTypes: [
      'payment.created',
      'payment.success',
      'payment.failed',
      'payment.refunded',
      'membership.purchased',
      'membership.activated',
      'membership.cancelled',
    ],
    refresh: load,
    debounceMs: 300,
  });

  const summary = useMemo(() => ({
    value: transactions.reduce((total, item) => total + Number(item.amount || 0), 0),
    active: transactions.filter((item) => ['ACTIVE', 'PAID', 'SUCCESS', 'SUCCESSFUL'].includes(item.status.toUpperCase())).length,
    pending: transactions.filter((item) => item.status.toUpperCase().includes('PENDING')).length,
  }), [transactions]);

  if (loading && !transactions.length) return <AdminLoading label={`Loading ${membershipMode ? 'membership records' : 'payment history'}â€¦`} />;
  if (error && !transactions.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Revenue operations"
        title={membershipMode ? 'Memberships' : 'Payments'}
        description={membershipMode ? 'Monitor active and expired subscriptions and the plans members use.' : 'Review payment status, value, gateway references and transaction history.'}
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />
      <div className="admin-mini-stat-grid">
        <article><span className="green"><Banknote /></span><p><small>Visible value</small><strong>{formatAdminMoney(summary.value)}</strong></p></article>
        <article><span className="blue">{membershipMode ? <BadgeCheck /> : <CreditCard />}</span><p><small>{membershipMode ? 'Active memberships' : 'Successful payments'}</small><strong>{summary.active}</strong></p></article>
        <article><span className="amber"><WalletCards /></span><p><small>Pending records</small><strong>{summary.pending}</strong></p></article>
        <article><span className="wine"><CreditCard /></span><p><small>Total records</small><strong>{count.toLocaleString('en-IN')}</strong></p></article>
      </div>
      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, plan or reference" /></div>
          <div className="admin-filter-row"><label><Filter /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="paid">Paid</option><option value="captured">Captured</option><option value="created">Created</option><option value="authorized">Authorized</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label></div>
        </div>
        {error && <div className="admin-inline-error">{error}</div>}
        {transactions.length ? (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Plan</th><th>Amount</th><th>Status</th><th>Gateway / reference</th><th>Started</th></tr></thead><tbody>{transactions.map((item) => (
            <tr key={item.id}>
              <td data-label="Member"><p className="admin-cell-stack"><strong>{item.user || 'Unknown member'}</strong><small>{item.email}</small></p></td>
              <td data-label="Plan"><strong>{item.plan}</strong></td>
              <td data-label="Amount"><strong className="admin-money-cell">{formatAdminMoney(item.amount)}</strong></td>
              <td data-label="Status"><AdminStatusBadge status={item.status} /></td>
              <td data-label="Gateway / reference"><p className="admin-cell-stack"><strong>{item.gateway || 'N/A'}</strong><small>{item.reference || 'No reference'}</small></p></td>
              <td data-label="Started"><span className="admin-muted-cell">{formatAdminDate(item.date)}</span></td>
            </tr>
          ))}</tbody></table></div>
        ) : <AdminEmptyState title={`No ${membershipMode ? 'memberships' : 'payments'} found`} description="No records match the current filters." />}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>
    </>
  );
}

