'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import {
  Filter, LoaderCircle, RefreshCw, CheckCircle, XCircle,
  FileText, Camera, FileCheck, Eye, ShieldCheck, AlertCircle, X, Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader,
  AdminPagination, AdminPanel, AdminStatusBadge, formatAdminDate
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function AdminProfileApprovalsPage() {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [verifications, setVerifications] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'pending_review');

  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchQuery.trim());
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'incomplete'>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [confirmForceApproveItem, setConfirmForceApproveItem] = useState<{ id: string; name: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const isSuperOrAdmin = useMemo(() => {
    if (!currentUser) return true;
    const type = currentUser.account_type;
    return type === 'SUPER_ADMIN' || type === 'ADMIN' || Boolean(currentUser.is_superuser);
  }, [currentUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [status, readinessFilter, debouncedSearch]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (page > 1) next.set('page', String(page));
    if (debouncedSearch) next.set('search', debouncedSearch);
    setSearchParams(next, { replace: true });
  }, [status, page, debouncedSearch, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '50',
        verification_type: 'FULL_PROFILE',
      };
      if (status) params.status = status;
      if (debouncedSearch) params.search = debouncedSearch;

      const data = await fetchApi<any>('/admin/verifications/', { params });
      setVerifications(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile verifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, status, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh({
    eventTypes: [
      'verification.submitted',
      'verification.approved',
      'verification.rejected',
      'verification.changes_requested',
      'profile.submitted',
      'profile.approved',
      'profile.rejected',
    ],
    refresh: load,
    debounceMs: 300,
  });

  const handleApprove = async (id: string, force: boolean = false) => {
    setBusyId(id);
    setActionError('');
    try {
      await fetchApi(`/admin/verifications/${id}/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', force }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (detailItem && detailItem.id === id) setDetailItem(null);
      if (confirmForceApproveItem && confirmForceApproveItem.id === id) setConfirmForceApproveItem(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve profile.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    setActionError('');
    try {
      await fetchApi(`/admin/verifications/${rejectTarget.id}/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (detailItem && detailItem.id === rejectTarget.id) setDetailItem(null);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject profile.');
    } finally {
      setBusyId(null);
    }
  };

  const filteredVerifications = useMemo(() => {
    let list = verifications;
    if (readinessFilter === 'ready') {
      list = list.filter(v => v.is_ready || v.member?.is_ready);
    } else if (readinessFilter === 'incomplete') {
      list = list.filter(v => !(v.is_ready || v.member?.is_ready));
    }
    return list;
  }, [verifications, readinessFilter]);

  const canApprove = isSuperOrAdmin || hasAdminPermission('verification.approve');
  const canReject = isSuperOrAdmin || hasAdminPermission('verification.reject');

  const isReviewable = (s: string) => {
    if (!s) return true;
    return String(s).toLowerCase() !== 'approved';
  };

  if (loading && !verifications.length) return <AdminLoading label="Loading profile verifications queue\u00e2\u20ac\u00a6" />;
  if (error && !verifications.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Profile approvals"
        description="Verify matrimony profiles submitted for approval."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-filter-row">
            <label><Filter /> Status:
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending_review">Pending</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="">All statuses</option>
              </select>
            </label>
            <label><Search size={14} /> Search:
              <input
                type="text"
                className="admin-input"
                style={{ width: '180px' }}
                placeholder="Name, email, ID\u2026"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <label className="admin-filter-readiness">
              <ShieldCheck size={14} /> Readiness:
              <select value={readinessFilter} onChange={(e) => setReadinessFilter(e.target.value as any)}>
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </label>
          </div>
        </div>

        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updating\u00e2\u20ac\u00a6</div>}
        {actionError && <div className="admin-inline-error" role="alert"><AlertCircle size={14} /> {actionError}</div>}

        {detailItem && (
          <div className="admin-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0 }}>{detailItem.member?.full_name || detailItem.member?.email}</h3>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDetailItem(null)}><X size={16} /></button>
            </div>
            <p style={{ margin: '0.5rem 0', color: 'var(--admin-text-muted)' }}>
              ID: {detailItem.member_id} &middot; Email: {detailItem.member?.email} &middot; Priority: {detailItem.priority}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {canApprove && (
                <button type="button" className="admin-btn admin-btn-success" onClick={() => handleApprove(detailItem.id)} disabled={busyId === detailItem.id}>
                  <CheckCircle size={14} /> Approve
                </button>
              )}
              {canReject && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => { setRejectTarget({ id: detailItem.id, name: detailItem.member?.full_name || detailItem.member?.email || 'this member' }); setRejectReason(''); }}>
                  <XCircle size={14} /> Reject
                </button>
              )}
            </div>
          </div>
        )}

        {filteredVerifications.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="admin-table-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Member">
                      <div className="admin-member-cell">
                        <span className="admin-list-avatar">
                          {(v.member?.full_name || v.member?.email || 'M')[0].toUpperCase()}
                        </span>
                        <p>
                          <strong>{v.member?.full_name || 'Unnamed member'}</strong>
                          <small>{v.member?.email}</small>
                        </p>
                      </div>
                    </td>
                    <td data-label="Priority">{v.priority}</td>
                    <td data-label="Status"><AdminStatusBadge status={v.status} /></td>
                    <td data-label="Submitted">{formatAdminDate(v.submitted_at)}</td>
                    <td className="admin-row-actions" data-label="Actions">
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => setDetailItem(detailItem?.id === v.id ? null : v)}
                        >
                          <Eye size={14} />
                        </button>
                        {isReviewable(v.status) && canApprove && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-success"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => handleApprove(v.id)}
                            disabled={busyId === v.id}
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                        )}
                        {isReviewable(v.status) && canReject && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setRejectTarget({ id: v.id, name: v.member?.full_name || v.member?.email || 'this member' });
                              setRejectReason('');
                            }}
                            disabled={busyId === v.id}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No profile reviews pending"
            description="The queue is clear. New submission files will appear here automatically."
          />
        )}

        <AdminPagination page={page} count={count} pageSize={50} onPageChange={setPage} />
      </AdminPanel>

      {rejectTarget && (
        <div className="admin-modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Reject verification for {rejectTarget.name}</h3>
            </div>
            <div className="admin-modal-body">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Reason for rejection <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
              </label>
              <textarea
                className="admin-input"
                style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this profile is being rejected..."
              />
              {busyId === rejectTarget?.id && (
                <div style={{ marginTop: '0.5rem', color: 'var(--admin-text-muted, #9ca3af)' }}>
                  <LoaderCircle className="admin-spinner" size={16} /> Rejecting...
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setRejectTarget(null)} disabled={Boolean(busyId)}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={handleRejectConfirm} disabled={!rejectReason.trim() || Boolean(busyId)}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmForceApproveItem && (
        <div className="admin-modal-overlay" onClick={() => setConfirmForceApproveItem(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header"><h3>Force approve {confirmForceApproveItem.name}?</h3></div>
            <div className="admin-modal-body">
              <p>This profile may have incomplete verification checks. Are you sure?</p>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setConfirmForceApproveItem(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn-success" onClick={() => handleApprove(confirmForceApproveItem.id, true)}>Force Approve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
