'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import {
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  FileText,
  Download,
  Check,
  X,
  Maximize2,
  LayoutGrid,
  List,
  Clock,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  formatAdminDate,
} from '../../components/admin/AdminUI';
import AdminDocumentLightbox, { LightboxDocument } from '../../components/admin/AdminDocumentLightbox';
import AdminDocumentThumbnail from '../../components/admin/AdminDocumentThumbnail';
import '../../pages/AdminPage.css';

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
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toUpperCase();
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        styles[normalized] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {normalized}
    </span>
  );
}

const PRESET_REJECTION_REASONS = [
  'Blurry or unreadable document image',
  'Name does not match member profile',
  'Date of birth does not match profile',
  'Document is expired or invalid',
  'Corners / edges of document are cut off',
  'Incorrect document type uploaded',
  'Photocopy / black and white not accepted',
  'Document appears altered or suspicious',
];

export default function AdminDocumentVerificationPage() {
  const { hasAdminPermission, user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN' || user?.account_type === 'SUPER_ADMIN' || (user as any)?.is_super_admin;
  const basePath = isSuper ? '/super-admin' : '/admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState(searchParams.get('status') || 'PENDING');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [docType, setDocType] = useState(searchParams.get('document_type') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  // Zoom lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Reject modal state
  const [rejectModalDoc, setRejectModalDoc] = useState<DocumentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isSuperAdmin = user?.account_type === 'SUPER_ADMIN';
  const canApprove = isSuperAdmin || hasAdminPermission('documents.approve');
  const canReject = isSuperAdmin || hasAdminPermission('documents.reject');

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '24',
      };
      if (status) params.status = status;
      if (search) params.search = search;
      if (docType) params.document_type = docType;

      const data = await fetchApi<{ items: DocumentItem[]; pagination?: { total_items?: number } }>(
        '/admin/documents/',
        { params },
      );
      setDocuments(data.items || []);
      setCount(data.pagination?.total_items || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Documents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, status, search, docType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, search, docType]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (search) next.set('search', search);
    if (docType) next.set('document_type', docType);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }, [status, search, docType, page, setSearchParams]);

  // Client-side quick filter for instantaneous responsiveness
  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.member_name?.toLowerCase().includes(q) ||
        d.member_email?.toLowerCase().includes(q) ||
        d.display_name?.toLowerCase().includes(q) ||
        d.original_file_name?.toLowerCase().includes(q) ||
        d.document_type?.toLowerCase().includes(q),
    );
  }, [documents, search]);

  const handleApprove = async (docId: string) => {
    setBusyDocId(docId);
    setActionError('');
    try {
      await fetchApi(`/admin/documents/${docId}/approve/`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const approvedDoc = documents.find((d) => d.id === docId);
      const name = approvedDoc?.member_name || 'Member';
      setSuccessToast(`Document for ${name} has been approved.`);
      setTimeout(() => setSuccessToast(''), 4000);

      // Optimistically update document in list
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: 'APPROVED', reviewer_name: user?.first_name || 'Admin' } : d,
        ),
      );

      // Auto-advance lightbox to next pending document if currently open
      if (lightboxIndex !== null) {
        const remainingPending = documents.filter((d) => d.id !== docId && d.status === 'PENDING');
        if (remainingPending.length > 0) {
          const nextIdx = documents.findIndex((d) => d.id === remainingPending[0].id);
          if (nextIdx !== -1) setLightboxIndex(nextIdx);
        }
      }

      await load(true);
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

      const rejectedDoc = documents.find((d) => d.id === docId);
      const name = rejectedDoc?.member_name || 'Member';
      setSuccessToast(`Document for ${name} has been rejected.`);
      setTimeout(() => setSuccessToast(''), 4000);

      // Optimistically update document in list
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: 'REJECTED',
                rejection_reason: rejectReason,
                reviewer_name: user?.first_name || 'Admin',
              }
            : d,
        ),
      );

      setRejectModalDoc(null);
      setRejectReason('');

      // Auto-advance lightbox to next pending document if currently open
      if (lightboxIndex !== null) {
        const remainingPending = documents.filter((d) => d.id !== docId && d.status === 'PENDING');
        if (remainingPending.length > 0) {
          const nextIdx = documents.findIndex((d) => d.id === remainingPending[0].id);
          if (nextIdx !== -1) setLightboxIndex(nextIdx);
        }
      }

      await load(true);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Rejection failed.');
    } finally {
      setBusyDocId(null);
    }
  };

  const openZoomForDoc = (docId: string) => {
    const idx = documents.findIndex((d) => d.id === docId);
    if (idx !== -1) {
      setLightboxIndex(idx);
    }
  };

  // Convert DocumentItem to LightboxDocument
  const lightboxDocs: LightboxDocument[] = useMemo(() => {
    return documents.map((d) => ({
      id: d.id,
      member_id: d.member_id,
      member_name: d.member_name,
      member_email: d.member_email,
      document_type: d.document_type,
      custom_document_name: d.custom_document_name,
      display_name: d.display_name,
      original_file_name: d.original_file_name,
      mime_type: d.mime_type,
      file_size: d.file_size,
      status: d.status,
      rejection_reason: d.rejection_reason,
      uploaded_at: d.uploaded_at,
      reviewer_name: d.reviewer_name,
    }));
  }, [documents]);

  if (loading && !documents.length) return <AdminLoading label="Loading verification documents…" />;
  if (error && !documents.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Document Verification"
        description="Review and approve member verification documents with high-clarity zoom."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn-secondary flex items-center gap-2 shadow-sm"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <AdminPanel className="admin-table-panel space-y-5">
        {/* Toolbar: Filters, Search, View Mode Toggle */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status & Document Type Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <FileCheck2 className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Type:</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">All Document Types</option>
                <option value="AADHAAR">Aadhaar Card</option>
                <option value="PAN">PAN Card</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENCE">Driving Licence</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="text-xs font-medium text-slate-500 px-2">
              <strong className="text-slate-900 font-bold">{count}</strong> documents
            </div>
          </div>

          {/* Search bar & View mode toggle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member, email, file..."
                className="w-56 sm:w-64 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
              />
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid Gallery View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
        {actionError && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{actionError}</span>
          </div>
        )}

        {successToast && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-700 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successToast}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 py-1">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Updating documents…</span>
          </div>
        )}

        {/* --- Card Grid Gallery View --- */}
        {filteredDocuments.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
            {filteredDocuments.map((doc) => {
              const memberName = doc.member_name || 'Unnamed Member';
              const memberEmail = doc.member_email || 'No email';
              const isPending = doc.status === 'PENDING';

              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group/card"
                >
                  {/* Document Preview Thumbnail */}
                  <div className="aspect-[16/11] bg-slate-100 relative overflow-hidden">
                    <AdminDocumentThumbnail
                      documentId={doc.id}
                      mimeType={doc.mime_type}
                      originalFileName={doc.original_file_name}
                      displayName={doc.display_name}
                      className="h-full w-full"
                      onClick={() => openZoomForDoc(doc.id)}
                    />

                    {/* Document Type Badge (top-left) */}
                    <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                      <span className="rounded-lg bg-indigo-600/90 text-white font-extrabold text-[10px] px-2.5 py-0.5 shadow-md uppercase tracking-wider backdrop-blur-sm">
                        {doc.document_type || 'DOCUMENT'}
                      </span>
                    </div>

                    {/* Status Badge (top-right) */}
                    <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider ${
                          doc.status === 'APPROVED'
                            ? 'bg-emerald-500 text-white'
                            : doc.status === 'REJECTED'
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    {/* File Size Badge (bottom-right) */}
                    <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
                      <span className="rounded-md bg-black/60 text-white font-medium text-[10px] px-2 py-0.5 backdrop-blur-sm">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Document Name */}
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 text-sm truncate" title={doc.display_name}>
                          {doc.display_name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => openZoomForDoc(doc.id)}
                          className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded-lg transition"
                          title="Zoom preview"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Filename */}
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={doc.original_file_name}>
                        {doc.original_file_name}
                      </p>

                      {/* Member Info */}
                      <a
                        href={`${basePath}/members/${doc.member_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-2.5 bg-slate-50/80 hover:bg-indigo-50/70 p-2 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group/member cursor-pointer"
                        title={`View ${memberName}'s account`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 group-hover/member:bg-indigo-600 group-hover/member:text-white font-bold text-indigo-700 text-xs shrink-0 transition-colors">
                          {(memberName || 'M')[0].toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 group-hover/member:text-indigo-600 truncate flex items-center gap-1 transition-colors" title={memberName}>
                            {memberName}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover/member:opacity-100 transition-opacity text-indigo-500 shrink-0" />
                          </p>
                          <p className="text-[11px] text-slate-400 truncate" title={memberEmail}>
                            {memberEmail}
                          </p>
                        </div>
                      </a>

                      {/* Rejection reason snippet if rejected */}
                      {doc.status === 'REJECTED' && doc.rejection_reason && (
                        <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700">
                          <strong>Reason:</strong> {doc.rejection_reason}
                        </div>
                      )}

                      {/* Metadata row */}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatAdminDate(doc.uploaded_at)}
                        </span>
                        <a
                          href={`/api/proxy/admin/documents/${doc.id}/download/`}
                          download={doc.original_file_name}
                          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-medium transition"
                          title="Download original document"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      {isPending ? (
                        <>
                          {canApprove && (
                            <button
                              type="button"
                              disabled={busyDocId === doc.id}
                              onClick={() => handleApprove(doc.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                              title="Approve this document"
                            >
                              {busyDocId === doc.id ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                          )}

                          {canReject && (
                            <button
                              type="button"
                              disabled={busyDocId === doc.id}
                              onClick={() => {
                                setRejectModalDoc(doc);
                                setRejectReason('');
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                              title="Reject this document with reason"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openZoomForDoc(doc.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          View in Zoom Lightbox
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Table View --- */}
        {filteredDocuments.length > 0 && viewMode === 'table' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-20">Preview</th>
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
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    {/* Thumbnail preview column */}
                    <td data-label="Preview" className="w-20 py-2">
                      <div className="h-12 w-16 overflow-hidden rounded-lg shadow-sm border border-slate-200 bg-slate-100">
                        <AdminDocumentThumbnail
                          documentId={doc.id}
                          mimeType={doc.mime_type}
                          originalFileName={doc.original_file_name}
                          displayName={doc.display_name}
                          className="h-full w-full"
                          onClick={() => openZoomForDoc(doc.id)}
                        />
                      </div>
                    </td>

                    {/* Member */}
                    <td data-label="Member">
                      <a
                        href={`${basePath}/members/${doc.member_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-member-cell group/member hover:opacity-90 cursor-pointer"
                        title={`View ${doc.member_name || 'Member'}'s account`}
                      >
                        <span className="admin-list-avatar group-hover/member:bg-indigo-600 group-hover/member:text-white transition-colors">
                          {(doc.member_name || doc.member_email || 'M')[0].toUpperCase()}
                        </span>
                        <p>
                          <strong className="group-hover/member:text-indigo-600 flex items-center gap-1 transition-colors">
                            {doc.member_name || 'Unnamed'}
                            <ExternalLink size={11} className="opacity-0 group-hover/member:opacity-100 text-indigo-500 transition-opacity" />
                          </strong>
                          <small>{doc.member_email}</small>
                        </p>
                      </a>
                    </td>

                    {/* Document */}
                    <td data-label="Document">
                      <strong>{doc.display_name}</strong>
                      <small style={{ display: 'block', color: '#9ca3af' }}>{doc.original_file_name}</small>
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => openZoomForDoc(doc.id)}
                          className="admin-btn-link text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                        >
                          <Maximize2 size={12} /> Zoom Preview
                        </button>
                        <a
                          href={`/api/proxy/admin/documents/${doc.id}/download/`}
                          download={doc.original_file_name}
                          className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
                          title="Download original file"
                        >
                          <Download size={12} /> Download
                        </a>
                      </div>
                    </td>

                    {/* Type */}
                    <td data-label="Type">
                      <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {doc.document_type}
                      </span>
                    </td>

                    {/* Size */}
                    <td data-label="Size">{formatFileSize(doc.file_size)}</td>

                    {/* Uploaded */}
                    <td data-label="Uploaded">{formatAdminDate(doc.uploaded_at)}</td>

                    {/* Status */}
                    <td data-label="Status">
                      <StatusBadge status={doc.status} />
                      {doc.status === 'REJECTED' && doc.rejection_reason && (
                        <small
                          style={{
                            display: 'block',
                            color: '#dc2626',
                            marginTop: '2px',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={doc.rejection_reason}
                        >
                          {doc.rejection_reason}
                        </small>
                      )}
                    </td>

                    {/* Reviewer */}
                    <td data-label="Reviewer">{doc.reviewer_name || '—'}</td>

                    {/* Actions */}
                    {(canApprove || canReject) && (
                      <td className="admin-row-actions" data-label="Actions">
                        {doc.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canApprove && (
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busyDocId === doc.id}
                                onClick={() => handleApprove(doc.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                {busyDocId === doc.id ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                                Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                disabled={busyDocId === doc.id}
                                onClick={() => {
                                  setRejectModalDoc(doc);
                                  setRejectReason('');
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <X size={14} /> Reject
                              </button>
                            )}
                          </div>
                        ) : (
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
        )}

        {/* Empty State */}
        {!loading && filteredDocuments.length === 0 && (
          <AdminEmptyState
            title="No verification documents found"
            description={
              search
                ? `No documents match "${search}". Try clearing your search.`
                : status
                ? `No documents with status "${status}".`
                : 'No documents have been uploaded yet.'
            }
          />
        )}

        <AdminPagination page={page} count={count} pageSize={24} onPageChange={setPage} />
      </AdminPanel>

      {/* --- Interactive Document Zoom Lightbox --- */}
      {lightboxIndex !== null && (
        <AdminDocumentLightbox
          isOpen={true}
          documents={lightboxDocs}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(idx) => setLightboxIndex(idx)}
          onApprove={handleApprove}
          onReject={(docId) => {
            const found = documents.find((d) => d.id === docId);
            if (found) {
              setRejectModalDoc(found);
              setRejectReason('');
            }
          }}
          isActionBusy={busyDocId !== null}
        />
      )}

      {/* --- Reject Modal with Quick Preset Chips --- */}
      {rejectModalDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-in fade-in">
          <div
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Verification Document</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Member: <strong>{rejectModalDoc.member_name}</strong> ({rejectModalDoc.display_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Reason Chips */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Quick Rejection Reasons (click to apply):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition ${
                      rejectReason === reason
                        ? 'bg-rose-100 text-rose-800 border-rose-300 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reason / Message to Member:
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The document image is blurred and numbers cannot be read. Please upload a clear color photo."
              rows={4}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
            />

            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                onClick={() => setRejectModalDoc(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReject(rejectModalDoc.id)}
                disabled={!rejectReason.trim() || busyDocId === rejectModalDoc.id}
                className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
              >
                {busyDocId === rejectModalDoc.id ? 'Rejecting…' : 'Reject Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
