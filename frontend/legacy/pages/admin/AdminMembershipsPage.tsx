'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock3, Filter, LoaderCircle, Search } from 'lucide-react';
import { fetchApi } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminModal, AdminPageHeader, AdminPanel, AdminPagination, AdminStatusBadge, AdminToast,
  formatAdminDate, formatAdminMoney,
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

interface AdminMembership {
  id: string;
  user: { id: string; full_name: string; email: string } | null;
  plan: { id: string; name: string; price: string } | null;
  current_plan: { name: string; is_active: boolean; expires_at: string | null } | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

interface PaginatedMemberships {
  count: number;
  page: number;
  page_size: number;
  num_pages: number;
  results: AdminMembership[];
}

const getMemberships = (params: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null) as [string, string][])
  ).toString();
  return fetchApi<PaginatedMemberships>(`/admin/memberships/${qs ? `?${qs}` : ''}`);
};

const messageFrom = (error: unknown) => (
  error instanceof Error ? error.message : 'The request could not be completed.'
);

export default function AdminMembershipsPage() {
  const { user, hasAdminPermission } = useAuth();

  const canView = user?.admin_role === 'SUPER_ADMIN' || hasAdminPermission('memberships.view');
  const canManage = user?.admin_role === 'SUPER_ADMIN' || hasAdminPermission('members.manage');

  // Subscriptions State
  const [items, setItems] = useState<AdminMembership[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [directActivationOpen, setDirectActivationOpen] = useState(false);
  const [directForm, setDirectForm] = useState({ action: 'activate', duration_days: '30' });
  const [selectedMember, setSelectedMember] = useState<{ id: string; full_name: string; email: string; is_premium: boolean; account_status: string } | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: string; full_name: string; email: string; is_premium: boolean; account_status: string }[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [planOptions, setPlanOptions] = useState<{ slug: string; name: string }[]>([]);
  const [planSlug, setPlanSlug] = useState('');

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMemberships({ page, page_size: 20, search: search || undefined, status: statusFilter || undefined });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const openDirectOverride = useCallback(async () => {
    setDirectActivationOpen(true);
    setDirectForm({ action: 'activate', duration_days: '30' });
    setSelectedMember(null);
    setMemberQuery('');
    setMemberResults([]);
    setPlanSlug('');
    try {
      const data = await fetchApi<any>(`/admin/membership-plans/?page_size=100`);
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      setPlanOptions(list.filter((p: any) => p?.slug).map((p: any) => ({ slug: p.slug, name: p.name })));
    } catch {
      setPlanOptions([]);
    }
  }, []);

  useEffect(() => {
    if (!memberQuery.trim()) {
      setMemberResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const data = await fetchApi<{ results: { id: string; full_name: string; email: string; is_premium: boolean; account_status: string }[] }>(`/admin/members/search/?q=${encodeURIComponent(memberQuery.trim())}`);
        setMemberResults(data.results || []);
      } catch {
        setMemberResults([]);
      } finally {
        setMemberSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [memberQuery]);

  const handleDirectMembership = async () => {
    if (!selectedMember) {
      setToast({ message: 'Please select a member.', tone: 'error' });
      return;
    }
    if (directForm.action === 'activate' && !planSlug) {
      setToast({ message: 'Please choose a plan to activate.', tone: 'error' });
      return;
    }
    if (directForm.action === 'extend' && !(parseInt(directForm.duration_days) > 0)) {
      setToast({ message: 'Please enter a valid number of days to extend.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await fetchApi(`/admin/memberships/direct/`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedMember.id,
          plan_slug: planSlug || undefined,
          action: directForm.action,
          duration_days: parseInt(directForm.duration_days) || 30,
        }),
      });
      setToast({ message: 'Direct membership override applied.', tone: 'success' });
      setDirectActivationOpen(false);
      void loadSubscriptions();
    } catch (err) {
      setToast({ message: messageFrom(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (canView) void loadSubscriptions();
  }, [canView, loadSubscriptions]);

  useRealtimeRefresh({
    eventTypes: [
      'membership.purchased',
      'membership.activated',
      'membership.expired',
      'membership.cancelled',
      'membership.upgraded',
      'membership.downgraded',
      'payment.success',
      'payment.failed',
      'payment.refunded',
    ],
    refresh: loadSubscriptions,
    debounceMs: 400,
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  if (!canView) return <AdminLoading label="Checking access…" />;
  if (loading && !items.length) return <AdminLoading label="Loading memberships…" />;
  if (error && !items.length) return <AdminErrorState message={error} onRetry={loadSubscriptions} />;

  const activeCount = items.filter((i) => i.is_active).length;
  const expiredCount = items.filter((i) => !i.is_active).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Revenue operations"
        title="Memberships"
        description="Review active and expired subscriptions and manage membership overrides."
        actions={(
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canManage && (
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => void openDirectOverride()}>
                Direct Membership Override
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => loadSubscriptions()}>
              <LoaderCircle /> Refresh
            </button>
          </div>
        )}
      />

      <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '1.5rem' }}>
        <article className="admin-stat-card">
          <span className="admin-stat-icon green"><BadgeCheck /></span>
          <div><strong>{activeCount}</strong><p>Active (this page)</p></div>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-icon slate"><Clock3 /></span>
          <div><strong>{expiredCount}</strong><p>Expired (this page)</p></div>
        </article>
      </div>

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" /></div>
          <div className="admin-filter-row">
            <label><Filter /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All memberships</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select></label>
          </div>
        </div>
        {error && <div className="admin-inline-error">{error}</div>}
        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updating…</div>}
        {items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Member</th><th>Record Plan</th><th>Current Plan</th><th>Price</th><th>Status</th><th>Start date</th><th>End date</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Member"><p className="admin-cell-stack"><strong>{item.user?.full_name || 'Deleted user'}</strong><small>{item.user?.email || 'N/A'}</small></p></td>
                    <td data-label="Record Plan"><span style={{ fontWeight: 600, color: '#555' }}>{item.plan?.name || 'No plan'}</span></td>
                    <td data-label="Current Plan">
                      <span style={{ fontWeight: 700, padding: '2px 10px', borderRadius: '99px', fontSize: '0.78rem', background: item.current_plan?.is_active ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f3f4f6', color: item.current_plan?.is_active ? 'white' : '#6b7280' }}>
                        {(item.current_plan as any)?.name || 'Free'}
                      </span>
                    </td>
                    <td data-label="Price"><span style={{ fontFamily: 'monospace' }}>{item.plan?.price ? formatAdminMoney(item.plan.price) : 'N/A'}</span></td>
                    <td data-label="Status"><AdminStatusBadge status={item.is_active ? 'Active' : 'Expired'} /></td>
                    <td data-label="Start date"><span className="admin-muted-cell">{formatAdminDate(item.start_date)}</span></td>
                    <td data-label="End date"><span className="admin-muted-cell">{item.end_date ? formatAdminDate(item.end_date) : 'Lifetime'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (<AdminEmptyState title="No memberships found" description="No memberships match the current filter." />)}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      {/* Direct Override Modal */}
      <AdminModal open={directActivationOpen} title="Direct Membership Override" onClose={() => setDirectActivationOpen(false)}>
        <div style={{ padding: '1rem' }}>
          {/* Member picker */}
          <label className="admin-form-field"><span>Member</span>
            {selectedMember ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid var(--admin-line)', borderRadius: '8px', background: 'var(--admin-panel-soft)' }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                  {(selectedMember.full_name || selectedMember.email).charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedMember.full_name}</p>
                  <small style={{ color: 'var(--admin-muted)' }}>{selectedMember.email}{selectedMember.is_premium ? ' · Premium' : ''} · {selectedMember.account_status}</small>
                </div>
                <button type="button" className="admin-btn admin-btn-secondary text-[11px] px-2 py-1" onClick={() => { setSelectedMember(null); setMemberQuery(''); setMemberResults([]); }}>Change</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div className="admin-search-field"><Search /><input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search by name or email…" /></div>
                {memberSearching && <div className="admin-inline-hint" style={{ marginTop: '0.35rem' }}>Searching…</div>}
                {memberResults.length > 0 && (
                  <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0, border: '1px solid var(--admin-line)', borderRadius: '8px', maxHeight: 220, overflowY: 'auto', background: 'var(--admin-bg)' }}>
                    {memberResults.map((m) => (
                      <li key={m.id}>
                        <button type="button" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.55rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => { setSelectedMember(m); setMemberQuery(''); setMemberResults([]); }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: '0.75rem' }}>
                            {(m.full_name || m.email).charAt(0).toUpperCase()}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '0.9rem' }}>{m.full_name}</strong>
                            <small style={{ color: 'var(--admin-muted)' }}>{m.email}{m.is_premium ? ' · Premium' : ''}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </label>

          <label className="admin-form-field" style={{ marginTop: '1rem' }}><span>Action</span>
            <select value={directForm.action} onChange={(e) => setDirectForm((f) => ({ ...f, action: e.target.value }))}>
              <option value="activate">Activate / Replace Plan</option>
              <option value="extend">Extend Expiry Date</option>
              <option value="cancel">Cancel Active Membership</option>
            </select>
          </label>

          {directForm.action === 'activate' && (
            <label className="admin-form-field" style={{ marginTop: '1rem' }}><span>Plan</span>
              <select value={planSlug} onChange={(e) => setPlanSlug(e.target.value)}>
                <option value="">Select a plan…</option>
                {planOptions.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </label>
          )}

          {directForm.action !== 'cancel' && (
            <label className="admin-form-field" style={{ marginTop: '1rem' }}><span>{directForm.action === 'extend' ? 'Extend by (days)' : 'Duration (days)'}</span>
              <input type="number" value={directForm.duration_days} onChange={(e) => setDirectForm((f) => ({ ...f, duration_days: e.target.value }))} placeholder="30" min={1} />
            </label>
          )}

          <div className="admin-form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setDirectActivationOpen(false)}>Cancel</button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => void handleDirectMembership()} disabled={busy || !selectedMember}>Apply Override</button>
          </div>
        </div>
      </AdminModal>

      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
