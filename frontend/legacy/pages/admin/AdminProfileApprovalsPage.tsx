'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from '@/lib/router-compat';
import {
  ArrowLeft,
  Filter,
  LoaderCircle,
  RefreshCw,
  Check,
  X,
  Eye,
  ShieldCheck,
  AlertCircle,
  Search,
  ExternalLink,
  LayoutGrid,
  List,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileText,
  Camera,
  AlertTriangle,
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
  AdminStatusBadge,
  formatAdminDate,
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import AdminMemberDetailPage from './AdminMemberDetailPage';

function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

const PRESET_REJECTION_REASONS = [
  'Incomplete bio or personal details',
  'Unverifiable identity information',
  'Inappropriate or offensive content',
  'Photos do not match member details',
  'Duplicate or suspicious profile',
  'Does not meet platform guidelines',
];

export default function AdminProfileApprovalsPage() {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const isSuper =
    currentUser?.account_type === 'SUPER_ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    Boolean((currentUser as any)?.is_super_admin) ||
    Boolean(currentUser?.is_superuser);
  const basePath = isSuper ? '/super-admin' : '/admin';

  const [searchParams, setSearchParams] = useSearchParams();

  const [verifications, setVerifications] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'pending_review');

  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchQuery.trim());
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'doc_pending' | 'photo_pending' | 'incomplete'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Full Profile Inspector modal state
  const [inspectMemberId, setInspectMemberId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Clean Requirements Pending popup modal state
  const [missingReqTarget, setMissingReqTarget] = useState<any | null>(null);

  // Force approve confirmation
  const [confirmForceApproveItem, setConfirmForceApproveItem] = useState<{ id: string; name: string } | null>(null);

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

  // Close inspector on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rejectTarget) setRejectTarget(null);
        else if (missingReqTarget) setMissingReqTarget(null);
        else if (inspectMemberId) setInspectMemberId(null);
        else if (confirmForceApproveItem) setConfirmForceApproveItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rejectTarget, missingReqTarget, inspectMemberId, confirmForceApproveItem]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '30',
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

  const handleApprove = async (id: string, force: boolean = false, fromItem?: any) => {
    const item = fromItem || verifications.find((v) => v.id === id);
    if (!force && item) {
      const docStatus = item.document_status || item.member?.document_status;
      const photoStatus = item.photo_status || item.member?.photo_status;
      const isDocPending = docStatus === 'pending_review' || Boolean(item.pending_document);
      const isPhotoPending = photoStatus === 'pending_review' || Boolean(item.pending_photo);
      const isReady = item.is_ready || (item.has_photo && item.has_document && item.has_bio);

      if (!isReady && (isDocPending || isPhotoPending || !item.has_document || !item.has_photo)) {
        setMissingReqTarget(item);
        return;
      }
    }

    setBusyId(id);
    setActionError('');
    try {
      await fetchApi(`/admin/verifications/${id}/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', force }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (confirmForceApproveItem && confirmForceApproveItem.id === id) setConfirmForceApproveItem(null);
      if (missingReqTarget && missingReqTarget.id === id) setMissingReqTarget(null);
      setSuccessToast('Profile verification approved successfully.');
      setTimeout(() => setSuccessToast(''), 4000);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve profile.';
      if (msg.toLowerCase().includes('missing requirement') && item) {
        setMissingReqTarget(item);
      } else {
        setActionError(msg);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickApproveDoc = async (docId: string, verificationId?: string, autoApproveProfile: boolean = false) => {
    setBusyId(verificationId || docId);
    setActionError('');
    try {
      await fetchApi(`/admin/documents/${docId}/approve/`, { method: 'POST' });
      setSuccessToast('Identity document approved.');
      setTimeout(() => setSuccessToast(''), 4000);
      if (autoApproveProfile && verificationId) {
        await handleApprove(verificationId, false);
      } else {
        await load();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve document.');
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickApprovePhoto = async (photoId: string, verificationId?: string, autoApproveProfile: boolean = false) => {
    setBusyId(verificationId || photoId);
    setActionError('');
    try {
      await fetchApi(`/admin/profile-photos/${photoId}/approve/`, { method: 'POST' });
      setSuccessToast('Profile photo approved.');
      setTimeout(() => setSuccessToast(''), 4000);
      if (autoApproveProfile && verificationId) {
        await handleApprove(verificationId, false);
      } else {
        await load();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve photo.');
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
      const name = rejectTarget.name;
      setRejectTarget(null);
      setRejectReason('');
      setSuccessToast(`Profile verification for ${name} has been rejected.`);
      setTimeout(() => setSuccessToast(''), 4000);
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
      list = list.filter((v) => v.is_ready || (v.has_photo && v.has_document && v.has_bio));
    } else if (readinessFilter === 'doc_pending') {
      list = list.filter(
        (v) => (v.document_status || v.member?.document_status) === 'pending_review' || Boolean(v.pending_document)
      );
    } else if (readinessFilter === 'photo_pending') {
      list = list.filter(
        (v) => (v.photo_status || v.member?.photo_status) === 'pending_review' || Boolean(v.pending_photo)
      );
    } else if (readinessFilter === 'incomplete') {
      list = list.filter((v) => !(v.is_ready || (v.has_photo && v.has_document && v.has_bio)));
    }
    return list;
  }, [verifications, readinessFilter]);

  const canApprove = isSuperOrAdmin || hasAdminPermission('verification.approve');
  const canReject = isSuperOrAdmin || hasAdminPermission('verification.reject');

  const isReviewable = (s: string) => {
    if (!s) return true;
    return String(s).toLowerCase() !== 'approved';
  };

  if (loading && !verifications.length) {
    return <AdminLoading label="Loading profile verifications queue..." />;
  }

  // Dedicated Full-Width Profile Inspection Workspace (eliminates nested modal cutoff and layout ratio issues)
  if (inspectMemberId) {
    const inspectedVerification = verifications.find(
      (v) => (v.member_id || v.member?.id) === inspectMemberId
    );
    const inspectedName =
      inspectedVerification?.member?.full_name ||
      inspectedVerification?.member?.email ||
      'Member';

    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* Inspection Top Navigation Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setInspectMemberId(null);
                load();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Profile Queue
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500">Reviewing Profile:</span>
              <span className="font-bold text-slate-900">{inspectedName}</span>
              {inspectedVerification?.status && (
                <AdminStatusBadge status={inspectedVerification.status} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`${basePath}/members/${inspectMemberId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition"
              title="Open full member account in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Account in New Tab
            </a>
          </div>
        </div>

        {/* Full Member Detail Page rendered with 100% natural screen width & height */}
        <AdminMemberDetailPage
          memberId={inspectMemberId}
          onBack={() => {
            setInspectMemberId(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Profile approvals"
        description="Verify matrimony profiles submitted for approval and review member completeness."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={load}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {/* Success Banner */}
      {successToast && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 shadow-sm animate-in fade-in" role="alert">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {error && !verifications.length && (
        <AdminErrorState message={error} onRetry={load} />
      )}

      <AdminPanel className="admin-table-panel overflow-hidden">
        {/* Modern Clean Toolbar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name, email, ID..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500 shrink-0" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="pending_review">Pending Review</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="">All Statuses</option>
              </select>
            </div>

            {/* Readiness Filter */}
            {/* Readiness Filter */}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0" />
              <select
                value={readinessFilter}
                onChange={(e) => setReadinessFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="all">All Readiness</option>
                <option value="ready">Ready for Review</option>
                <option value="doc_pending">Doc Approval Pending</option>
                <option value="photo_pending">Photo Approval Pending</option>
                <option value="incomplete">Incomplete Profile</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle & Counter */}
          <div className="flex items-center justify-between md:justify-end gap-3">
            <span className="text-xs font-bold text-slate-400">
              {filteredVerifications.length} of {count} reviews
            </span>
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shadow-inner border border-slate-300/60">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="admin-table-progress p-3 bg-indigo-50/50 border-b border-indigo-100 text-xs font-semibold text-indigo-700 flex items-center gap-2">
            <LoaderCircle className="admin-spinner h-4 w-4" /> Updating profile verifications...
          </div>
        )}

        {/* --- Card Grid View --- */}
        {filteredVerifications.length > 0 && viewMode === 'grid' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredVerifications.map((v) => {
              const memberName = v.member?.full_name || 'Unnamed Member';
              const memberEmail = v.member?.email || 'No email provided';
              const memberId = v.member_id || v.member?.id;
              const photoStatus = v.photo_status || v.member?.photo_status;
              const docStatus = v.document_status || v.member?.document_status;
              const isPhotoApproved = v.has_photo || photoStatus === 'approved';
              const isPhotoPending = photoStatus === 'pending_review' || Boolean(v.pending_photo);
              const isDocApproved = v.has_document || docStatus === 'approved';
              const isDocPending = docStatus === 'pending_review' || Boolean(v.pending_document);
              const isReady = v.is_ready || (isPhotoApproved && isDocApproved && v.has_bio);

              return (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group/card"
                >
                  <div className="p-5">
                    {/* Top Status & Priority Row */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <AdminStatusBadge status={v.status} />
                      <div className="flex items-center gap-1.5">
                        {v.priority && (
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              v.priority === 'URGENT' || v.priority === 'HIGH'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {v.priority}
                          </span>
                        )}
                        {isReady ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Ready
                          </span>
                        ) : isDocPending && isPhotoPending ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="Photo & Doc Pending">
                            <AlertCircle className="h-3 w-3 text-amber-600" /> Photo & Doc
                          </span>
                        ) : isDocPending ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="Document Pending Verification">
                            <FileText className="h-3 w-3 text-amber-600" /> Doc Pending
                          </span>
                        ) : isPhotoPending ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="Photo Pending Verification">
                            <Camera className="h-3 w-3 text-amber-600" /> Photo Pending
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertCircle className="h-3 w-3 text-amber-600" /> Incomplete
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member Info & Avatar */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-base shrink-0 shadow-2xs">
                        {(memberName || 'M')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={memberId ? `${basePath}/members/${memberId}` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-slate-900 group-hover/card:text-indigo-600 text-sm truncate flex items-center gap-1 transition-colors"
                          title={`View ${memberName}'s account`}
                          onClick={(e) => {
                            if (!memberId) e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <span className="truncate">{memberName}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/card:opacity-100 transition-opacity text-indigo-500 shrink-0" />
                        </a>
                        <p className="text-xs text-slate-500 truncate mt-0.5" title={memberEmail}>
                          {memberEmail}
                        </p>
                        {memberId && (
                          <span className="inline-block mt-1 font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            ID: {memberId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Verification Status Chips */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <Camera className="h-3 w-3 text-slate-400" />
                        <span>Photo:</span>
                        {isPhotoApproved ? (
                          <span className="text-emerald-700 font-bold">Approved</span>
                        ) : isPhotoPending ? (
                          <span className="text-amber-700 font-bold animate-pulse">Pending</span>
                        ) : (
                          <span className="text-slate-400 font-normal">None</span>
                        )}
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span>Doc:</span>
                        {isDocApproved ? (
                          <span className="text-emerald-700 font-bold">Approved</span>
                        ) : isDocPending ? (
                          <span className="text-amber-700 font-bold animate-pulse">Pending</span>
                        ) : (
                          <span className="text-slate-400 font-normal">None</span>
                        )}
                      </div>
                    </div>

                    {/* Submission Meta */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatAdminDate(v.submitted_at)}
                      </span>
                      {v.member?.gender && (
                        <span className="capitalize font-semibold text-slate-600">
                          {v.member.gender}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="p-4 bg-slate-50/60 border-t border-slate-100 space-y-2">
                    {/* View Profile Primary Button */}
                    <button
                      type="button"
                      onClick={() => setInspectMemberId(memberId)}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-indigo-50/80 text-slate-800 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-indigo-600" />
                      View Full Profile
                    </button>

                    {/* Approve & Reject row */}
                    {isReviewable(v.status) && (
                      <div className="flex items-center gap-2">
                        {canApprove && (
                          <button
                            type="button"
                            disabled={busyId === v.id}
                            onClick={() => handleApprove(v.id, false, v)}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            {busyId === v.id ? (
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
                            disabled={busyId === v.id}
                            onClick={() => {
                              setRejectTarget({ id: v.id, name: memberName });
                              setRejectReason('');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Modern Table View --- */}
        {filteredVerifications.length > 0 && viewMode === 'table' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Priority</th>
                  <th>Photo</th>
                  <th>Document</th>
                  <th>Readiness</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="admin-table-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.map((v) => {
                  const memberName = v.member?.full_name || 'Unnamed member';
                  const memberEmail = v.member?.email || '—';
                  const memberId = v.member_id || v.member?.id;
                  const photoStatus = v.photo_status || v.member?.photo_status;
                  const docStatus = v.document_status || v.member?.document_status;
                  const isPhotoApproved = v.has_photo || photoStatus === 'approved';
                  const isPhotoPending = photoStatus === 'pending_review' || Boolean(v.pending_photo);
                  const isDocApproved = v.has_document || docStatus === 'approved';
                  const isDocPending = docStatus === 'pending_review' || Boolean(v.pending_document);
                  const isReady = v.is_ready || (isPhotoApproved && isDocApproved && v.has_bio);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Member column */}
                      <td data-label="Member">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm shrink-0">
                            {(memberName || 'M')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <a
                              href={memberId ? `${basePath}/members/${memberId}` : '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="group/member block text-left"
                              title={`View ${memberName}'s account`}
                              onClick={(e) => {
                                if (!memberId) e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <strong className="font-bold text-slate-900 group-hover/member:text-indigo-600 flex items-center gap-1 transition-colors text-sm">
                                {memberName}
                                <ExternalLink size={12} className="opacity-0 group-hover/member:opacity-100 text-indigo-500 transition-opacity" />
                              </strong>
                              <p className="text-slate-500 text-xs truncate">{memberEmail}</p>
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td data-label="Priority">
                        <span
                          className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            v.priority === 'URGENT' || v.priority === 'HIGH'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {v.priority || 'NORMAL'}
                        </span>
                      </td>

                      {/* Photo Column */}
                      <td data-label="Photo">
                        {isPhotoApproved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approved
                          </span>
                        ) : isPhotoPending ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                              <Clock className="h-3 w-3 text-amber-600" /> Pending
                            </span>
                            {v.pending_photo?.id && canApprove && (
                              <button
                                type="button"
                                disabled={busyId === v.id}
                                onClick={() => handleQuickApprovePhoto(v.pending_photo.id, v.id)}
                                title="1-Click Approve Photo"
                                className="p-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer shrink-0"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : photoStatus === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <XCircle className="h-3 w-3 text-rose-600" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3 text-slate-400" /> None
                          </span>
                        )}
                      </td>

                      {/* Document Column */}
                      <td data-label="Document">
                        {isDocApproved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approved
                          </span>
                        ) : isDocPending ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse"
                              title={v.pending_document?.document_type ? `${v.pending_document.document_type} pending verification` : 'Document pending review'}
                            >
                              <FileText className="h-3 w-3 text-amber-600" /> Pending
                            </span>
                            {v.pending_document?.id && canApprove && (
                              <button
                                type="button"
                                disabled={busyId === v.id}
                                onClick={() => handleQuickApproveDoc(v.pending_document.id, v.id)}
                                title="1-Click Approve Document"
                                className="p-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer shrink-0"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : docStatus === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <XCircle className="h-3 w-3 text-rose-600" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3 text-slate-400" /> None
                          </span>
                        )}
                      </td>

                      {/* Readiness */}
                      <td data-label="Readiness">
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ready
                          </span>
                        ) : isDocPending && isPhotoPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200" title="Both photo & document approval are pending">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Doc & Photo Pending
                          </span>
                        ) : isDocPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200" title="Identity document is pending approval">
                            <FileText className="h-3.5 w-3.5 text-amber-600" /> Doc Pending
                          </span>
                        ) : isPhotoPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200" title="Profile photo is pending approval">
                            <Camera className="h-3.5 w-3.5 text-amber-600" /> Photo Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Incomplete
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        <AdminStatusBadge status={v.status} />
                      </td>

                      {/* Submitted */}
                      <td data-label="Submitted">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatAdminDate(v.submitted_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="admin-row-actions" data-label="Actions">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* View Profile Button */}
                          <button
                            type="button"
                            onClick={() => setInspectMemberId(memberId)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Inspect complete member profile"
                          >
                            <Eye className="h-3.5 w-3.5 text-indigo-600" />
                            View Profile
                          </button>

                          {/* Approve */}
                          {isReviewable(v.status) && canApprove && (
                            <button
                              type="button"
                              onClick={() => handleApprove(v.id, false, v)}
                              disabled={busyId === v.id}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {busyId === v.id ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                          )}

                          {/* Reject */}
                          {isReviewable(v.status) && canReject && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectTarget({ id: v.id, name: memberName });
                                setRejectReason('');
                              }}
                              disabled={busyId === v.id}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredVerifications.length === 0 && (
          <AdminEmptyState
            title="No profile reviews found"
            description={
              searchQuery
                ? 'No profile verification requests matched your search filters.'
                : 'The profile queue is clear. New submissions will automatically appear here.'
            }
          />
        )}

        <AdminPagination page={page} count={count} pageSize={30} onPageChange={setPage} />
      </AdminPanel>



      {/* ─────────────────────────── Modern Rejection Reason Modal ─────────────────────────── */}
      {rejectTarget && (
        <ClientPortal>
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setRejectTarget(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reject Profile Verification</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{rejectTarget.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Quick Reason Tags:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REJECTION_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                        rejectReason === preset
                          ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason Details <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain what details need to be corrected by the member..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent min-h-[90px] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectReason.trim() || Boolean(busyId)}
                  onClick={handleRejectConfirm}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {busyId ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Force Approve Confirmation */}
      {confirmForceApproveItem && (
        <ClientPortal>
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setConfirmForceApproveItem(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Force Approve Profile?</h3>
                  <p className="text-xs text-slate-500">{confirmForceApproveItem.name}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                This profile may have incomplete verification checks. Force approving will mark the member as fully verified.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmForceApproveItem(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(confirmForceApproveItem.id, true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Force Approve
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Clean Requirements Pending Popup Modal */}
      {missingReqTarget && (() => {
        const memberName = missingReqTarget.member?.full_name || missingReqTarget.member?.email || 'Member';
        const docStatus = missingReqTarget.document_status || missingReqTarget.member?.document_status;
        const photoStatus = missingReqTarget.photo_status || missingReqTarget.member?.photo_status;
        const isDocPending = docStatus === 'pending_review' || Boolean(missingReqTarget.pending_document);
        const isDocApproved = missingReqTarget.has_document || docStatus === 'approved';
        const isPhotoPending = photoStatus === 'pending_review' || Boolean(missingReqTarget.pending_photo);
        const isPhotoApproved = missingReqTarget.has_photo || photoStatus === 'approved';
        const hasBio = Boolean(missingReqTarget.has_bio);
        const pendingDoc = missingReqTarget.pending_document;
        const pendingPhoto = missingReqTarget.pending_photo;

        return (
          <ClientPortal>
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
              onClick={() => setMissingReqTarget(null)}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Profile Approval Checklist</h3>
                      <p className="text-xs text-slate-500 font-medium">{memberName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMissingReqTarget(null)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Before a matrimony profile can be approved, identity documents and photos should be verified. You can approve pending items directly below or inspect the full profile:
                </p>

                {/* Requirements Checklist */}
                <div className="space-y-2.5 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                  {/* Document Requirement */}
                  {isDocPending && pendingDoc ? (
                    <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{pendingDoc.document_type || 'Identity'} Document</p>
                          <p className="text-[11px] text-amber-700 font-medium">Status: Pending Verification</p>
                        </div>
                      </div>
                      {canApprove && (
                        <button
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={() => handleQuickApproveDoc(pendingDoc.id, missingReqTarget.id, true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1"
                          title="Approve document and complete profile approval in one click"
                        >
                          {busyId ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Approve & Finish
                        </button>
                      )}
                    </div>
                  ) : isDocApproved ? (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Identity document is verified.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>No document uploaded or pending upload.</span>
                    </div>
                  )}

                  {/* Photo Requirement */}
                  {isPhotoPending && pendingPhoto ? (
                    <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Camera className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">Profile Photo</p>
                          <p className="text-[11px] text-amber-700 font-medium">Status: Pending Verification</p>
                        </div>
                      </div>
                      {canApprove && (
                        <button
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={() => handleQuickApprovePhoto(pendingPhoto.id, missingReqTarget.id, true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1"
                          title="Approve photo and complete profile approval in one click"
                        >
                          {busyId ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Approve & Finish
                        </button>
                      )}
                    </div>
                  ) : isPhotoApproved ? (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Profile photo is verified.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                      <Camera className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>No profile photo uploaded.</span>
                    </div>
                  )}

                  {/* Bio Requirement */}
                  {!hasBio ? (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200 text-xs text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Member bio is empty or fewer than 5 characters.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Member bio is present.</span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const mId = missingReqTarget.member_id || missingReqTarget.member?.id;
                      setMissingReqTarget(null);
                      if (mId) setInspectMemberId(mId);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> Inspect Full Profile
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMissingReqTarget(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Close
                    </button>
                    {isSuper && (
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => handleApprove(missingReqTarget.id, true)}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                      >
                        {busyId && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                        Force Approve (Super Admin)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ClientPortal>
        );
      })()}
    </>
  );
}
