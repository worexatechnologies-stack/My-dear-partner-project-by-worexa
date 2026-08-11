'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Filter, LoaderCircle, RefreshCw, Search, ShieldAlert,
  Eye, FileText, X, User, ExternalLink, Image as ImageIcon, Download, Calendar
} from 'lucide-react';
import { fetchApi } from '../../services/apiClient';
import type { AdminListParams, AdminIdentity } from '../../services/adminService';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge,
  AdminToast, formatAdminDate,
} from '../../components/admin/AdminUI';

interface ProfileReportUser {
  id: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  mobile_number?: string;
  gender?: string;
  [key: string]: any;
}

interface ProfileReport {
  id: string;
  reported_user: ProfileReportUser | null;
  reported_by: ProfileReportUser | null;
  reason: string;
  details: string;
  evidence_file?: string | null;
  status: string;
  reviewed_by: any;
  created_at: string;
  updated_at: string;
}

interface PaginatedReports {
  count: number; page: number; page_size: number; num_pages: number; results: ProfileReport[];
}

const getReports = (params: AdminListParams = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null) as [string, string][])
  ).toString();
  return fetchApi<PaginatedReports>(`/admin/reported-profiles/${qs ? `?${qs}` : ''}`);
};

const updateReport = (id: string, data: Record<string, unknown>) =>
  fetchApi<ProfileReport>(`/admin/reported-profiles/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });

export default function AdminReportedProfilesPage() {
  const [items, setItems] = useState<ProfileReport[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ item: ProfileReport; action: string } | null>(null);

  // Modal Dialog for viewing complete report details, reason, & files
  const [detailModalItem, setDetailModalItem] = useState<ProfileReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getReports({ page, page_size: 20, search: search || undefined, status: statusFilter || undefined });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reported profiles could not be loaded.');
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
      const status = confirm.action === 'action' ? 'ACTIONED' : 'DISMISSED';
      const updated = await updateReport(confirm.item.id, { status });
      setItems((rows) => rows.map((r) => r.id === updated.id ? updated : r));
      if (detailModalItem && detailModalItem.id === updated.id) {
        setDetailModalItem(updated);
      }
      setToast({ message: `Report ${confirm.action === 'action' ? 'actioned' : 'dismissed'} successfully.`, tone: 'success' });
      setConfirm(null);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Action failed.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !items.length) return <AdminLoading label="Loading reported profiles..." />;
  if (error && !items.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Reported profiles"
        description="Investigate suspicious or policy-violating member profiles. Review reasons, attached evidence files, reporter explanations, and take appropriate action."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reason, details, or reported user..." /></div>
          <div className="admin-filter-row">
            <label><Filter />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="ACTIONED">Actioned</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="">All Statuses</option>
              </select>
            </label>
          </div>
        </div>

        {error && <div className="admin-inline-error">{error}</div>}
        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updating...</div>}

        {items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reported User</th>
                  <th>Reason & Details</th>
                  <th>Reported By</th>
                  <th>Attached File</th>
                  <th>Status</th>
                  <th>Submitted Date</th>
                  <th className="admin-table-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const reportedName = item.reported_user?.full_name || 'Deleted User';
                  const reportedEmail = item.reported_user?.email || 'N/A';
                  const reporterName = item.reported_by?.full_name || 'Anonymous';
                  const hasEvidence = Boolean(item.evidence_file);

                  return (
                    <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setDetailModalItem(item)}>
                      {/* Reported User Cell */}
                      <td data-label="Reported User">
                        <div className="admin-member-cell">
                          <span className="admin-list-avatar" style={{ background: '#fee2e2', color: '#991b1b' }}>
                            {reportedName[0]?.toUpperCase() || 'U'}
                          </span>
                          <p className="admin-cell-stack">
                            <strong>{reportedName}</strong>
                            <small>{reportedEmail}</small>
                          </p>
                        </div>
                      </td>

                      {/* Reason & Details Snippet */}
                      <td data-label="Reason & Details">
                        <div>
                          <strong style={{ color: '#991b1b', display: 'block', fontSize: '0.85rem' }}>
                            {item.reason}
                          </strong>
                          {item.details && (
                            <small style={{ color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '240px' }}>
                              {item.details}
                            </small>
                          )}
                        </div>
                      </td>

                      {/* Reported By */}
                      <td data-label="Reported By">
                        <span className="admin-muted-cell" style={{ fontWeight: 500 }}>
                          {reporterName}
                        </span>
                      </td>

                      {/* Attached File Indicator */}
                      <td data-label="Attached File">
                        {hasEvidence ? (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ImageIcon size={12} /> File Attached
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>No file</span>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        <AdminStatusBadge status={item.status} />
                      </td>

                      {/* Date */}
                      <td data-label="Date">
                        <span className="admin-muted-cell">{formatAdminDate(item.created_at)}</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="admin-row-actions" data-label="Actions" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => setDetailModalItem(item)}
                          >
                            <Eye size={14} /> Full Details
                          </button>

                          {(item.status === 'OPEN' || item.status === 'UNDER_REVIEW') && (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn-danger"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', cursor: 'pointer' }}
                                onClick={() => setConfirm({ item, action: 'action' })}
                              >
                                <ShieldAlert size={14} /> Action Taken
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', cursor: 'pointer' }}
                                onClick={() => setConfirm({ item, action: 'dismiss' })}
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No reported profiles"
            description="All reported profile tickets have been reviewed and resolved."
            action={<span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-success)' }}><CheckCircle2 /> All clear</span>}
          />
        )}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      {/* COMPLETE REPORTED PROFILE DETAILS POPUP CARD MODAL */}
      {detailModalItem && (() => {
        const reportedUser = detailModalItem.reported_user;
        const reportedName = reportedUser?.full_name || 'Deleted User';
        const reportedEmail = reportedUser?.email || 'N/A';
        const reportedMobile = reportedUser?.mobile || reportedUser?.mobile_number || 'N/A';

        const reportedBy = detailModalItem.reported_by;
        const reporterName = reportedBy?.full_name || 'Anonymous Reporter';
        const reporterEmail = reportedBy?.email || 'N/A';

        const evidenceUrl = detailModalItem.evidence_file;

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3000,
            }}
            onClick={() => setDetailModalItem(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                maxWidth: '680px',
                width: '92%',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Gradient Header */}
              <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: '#ffffff', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={24} style={{ color: '#ffffff' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 700 }}>
                      Reported Profile Details
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#fca5a5' }}>
                      Report ID: {detailModalItem.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {/* Status & Date Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Report Status:</span>
                    <AdminStatusBadge status={detailModalItem.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    <Calendar size={14} /> Reported: {formatAdminDate(detailModalItem.created_at)}
                  </div>
                </div>

                {/* Reason & Detailed Description Box */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} style={{ color: '#dc2626' }} /> Reason for Report
                  </h4>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem' }}>
                    <span style={{ background: '#991b1b', color: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block', marginBottom: '0.5rem' }}>
                      {detailModalItem.reason}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#7f1d1d', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {detailModalItem.details || 'No additional details provided by reporter.'}
                    </p>
                  </div>
                </div>

                {/* Evidence / Screenshot Files Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={16} style={{ color: '#2563eb' }} /> Evidence & Proof File Attachment
                  </h4>

                  {evidenceUrl ? (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={15} /> Uploaded Proof Screenshot / File
                        </span>
                        <a
                          href={evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Open Original <ExternalLink size={13} />
                        </a>
                      </div>

                      {/* Image Preview Box if image */}
                      {(evidenceUrl.includes('http') || evidenceUrl.includes('data:image') || evidenceUrl.endsWith('.png') || evidenceUrl.endsWith('.jpg') || evidenceUrl.endsWith('.jpeg') || evidenceUrl.endsWith('.webp')) ? (
                        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0f2fe', background: '#000', textAlign: 'center', maxHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={evidenceUrl}
                            alt="Report Evidence Screenshot"
                            style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }}
                          />
                        </div>
                      ) : (
                        <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.85rem', color: '#334155', wordBreak: 'break-all' }}>{evidenceUrl}</span>
                          <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                            <Download size={13} /> Download
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} style={{ color: '#9ca3af' }} />
                      <span>No proof file or screenshot was attached with this report.</span>
                    </div>
                  )}
                </div>

                {/* Parties Involved (Reported User & Reporter) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Reported User Card */}
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>
                      Reported User
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {reportedName[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: '#1f2937' }}>{reportedName}</strong>
                        <small style={{ color: '#6b7280', fontSize: '0.78rem', display: 'block' }}>{reportedEmail}</small>
                        <small style={{ color: '#6b7280', fontSize: '0.78rem', display: 'block' }}>{reportedMobile}</small>
                      </div>
                    </div>
                  </div>

                  {/* Reported By Card */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem' }}>
                      Reported By
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {reporterName[0]?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: '#1f2937' }}>{reporterName}</strong>
                        <small style={{ color: '#6b7280', fontSize: '0.78rem', display: 'block' }}>{reporterEmail}</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setDetailModalItem(null)}>
                  Close
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(detailModalItem.status === 'OPEN' || detailModalItem.status === 'UNDER_REVIEW') && (
                    <>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => {
                          const itemToDismiss = detailModalItem;
                          setDetailModalItem(null);
                          setConfirm({ item: itemToDismiss, action: 'dismiss' });
                        }}
                      >
                        Dismiss Report
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() => {
                          const itemToAction = detailModalItem;
                          setDetailModalItem(null);
                          setConfirm({ item: itemToAction, action: 'action' });
                        }}
                      >
                        <ShieldAlert size={15} /> Action Taken
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <AdminConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'action' ? 'Mark action taken?' : 'Dismiss this report?'}
        description={confirm?.action === 'action'
          ? `This will mark the report against ${confirm?.item.reported_user?.full_name || 'this user'} as actioned and record the decision.`
          : `This will dismiss the report as a false positive. No action will be taken against the reported user.`}
        confirmLabel={confirm?.action === 'action' ? 'Mark actioned' : 'Dismiss report'}
        dangerous={confirm?.action === 'action'}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runAction}
      />
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
