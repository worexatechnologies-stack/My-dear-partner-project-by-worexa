'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import { Filter, LoaderCircle, RefreshCw, Search, FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader,
  AdminPagination, AdminPanel, formatAdminDate
} from '../../components/admin/AdminUI';
import ProtectedDocumentViewer from '@/components/documents/ProtectedDocumentViewer';

interface DocumentItem {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  document_type: string;
  custom_document_name: string;
  display_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  status: string;
  rejection_reason: string;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  reviewer_name: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function AdminStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export default function AdminDocumentVerificationPage() {
  const { hasAdminPermission, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [docType, setDocType] = useState(searchParams.get('document_type') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: string; type: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);

  const isSuperAdmin = user?.account_type === 'SUPER_ADMIN';
  const canApprove = isSuperAdmin || hasAdminPermission('documents.approve');
  const canReject = isSuperAdmin || hasAdminPermission('documents.reject');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '20',
      };
      if (status) params.status = status;
      if (search) params.search = search;
      if (docType) params.document_type = docType;

      const data = await fetchApi<{ items: any[]; pagination?: { total_items?: number } }>('/admin/documents/', { params });
      setDocuments(data.items || []);
      setCount(data.pagination?.total_items || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Documents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, status, search, docType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [status, search, docType]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (search) next.set('search', search);
    if (docType) next.set('document_type', docType);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [status, search, docType, page]);

  const handleApprove = async (docId: string) => {
    setBusyDocId(docId);
    setActionError('');
    try {
      await fetchApi(`/admin/documents/${docId}/approve/`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Approval failed.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleReject = async (docId: string) => {
    if (!rejectReason.trim()) return;
    setBusyDocId(docId);
    setActionError('');
    try {
      await fetchApi(`/admin/documents/${docId}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setShowReject(null);
      setRejectReason('');
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Rejection failed.');
    } finally {
      setBusyDocId(null);
    }
  };

  if (loading && !documents.length) return <AdminLoading label="Loading documents\u2026" />;
  if (error && !documents.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Document Verification"
        description="Review and approve member verification documents."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-filter-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} /> Status:
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginLeft: '4px' }}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Document Type:
              <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ marginLeft: '4px' }}>
                <option value="">All</option>
                <option value="AADHAAR">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENCE">Driving Licence</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>
          </div>
        </div>

        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updating\u2026</div>}
        {actionError && <div className="admin-inline-error" role="alert">{actionError}</div>}

        {documents.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  {(canApprove || canReject) && <th className="admin-table-actions-heading">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td data-label="Member">
                      <div className="admin-member-cell">
                        <span className="admin-list-avatar">
                          {(doc.member_name || doc.member_email || 'M')[0].toUpperCase()}
                        </span>
                        <p>
                          <strong>{doc.member_name || 'Unnamed'}</strong>
                          <small>{doc.member_email}</small>
                        </p>
                      </div>
                    </td>
                    <td data-label="Document">
                      <strong>{doc.display_name}</strong>
                      <small style={{ display: 'block', color: '#9ca3af' }}>{doc.original_file_name}</small>
                      <button
                        type="button"
                        onClick={() => setViewDoc({ id: doc.id, type: doc.document_type })}
                        className="admin-btn-link"
                        style={{ fontSize: '0.8rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                      >
                        <FileText size={12} /> View / Download
                      </button>
                    </td>
                    <td data-label="Type">{doc.document_type}</td>
                    <td data-label="Size">{formatFileSize(doc.file_size)}</td>
                    <td data-label="Uploaded">{formatAdminDate(doc.uploaded_at)}</td>
                    <td data-label="Status">
                      <AdminStatusBadge status={doc.status} />
                      {doc.status === 'REJECTED' && doc.rejection_reason && (
                        <small style={{ display: 'block', color: '#dc2626', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.rejection_reason}
                        </small>
                      )}
                    </td>
                    <td data-label="Reviewer">{doc.reviewer_name || '\u2014'}</td>
                    {(canApprove || canReject) && (
                      <td className="admin-row-actions" data-label="Actions">
                        {doc.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canApprove && (
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busyDocId === doc.id}
                                onClick={() => handleApprove(doc.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <CheckCircle size={14} /> Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                disabled={busyDocId === doc.id}
                                onClick={() => { setShowReject(doc.id); setRejectReason(''); }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            )}
                          </div>
                        )}
                        {doc.status !== 'PENDING' && (
                          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                            {doc.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No documents found"
            description={status ? `No documents with status "${status}".` : 'No documents have been uploaded yet.'}
          />
        )}

        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      {/* View Document Modal */}
      {viewDoc && (
        <ProtectedDocumentViewer
          documentId={viewDoc.id}
          documentType={viewDoc.type}
          namespace="admin"
          onClose={() => setViewDoc(null)}
        />
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Document</h3>
            <p className="text-sm text-gray-600 mb-4">Enter the reason for rejection. The member will be notified immediately.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The uploaded image is blurred. Please upload a clear copy."
              rows={4}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowReject(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showReject)}
                disabled={!rejectReason.trim() || busyDocId === showReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {busyDocId === showReject ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
