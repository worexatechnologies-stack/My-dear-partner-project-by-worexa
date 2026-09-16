'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import {
  Filter,
  LoaderCircle,
  RefreshCw,
  ClipboardCheck,
  Check,
  X,
  Maximize2,
  Search,
  LayoutGrid,
  List,
  Clock,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import {
  normalizeMemberPhoto,
  type MemberPhoto,
  useApproveProfilePhotoMutation,
  useRejectProfilePhotoMutation,
} from '../../services/photoApi';
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
import AdminAssignModal from '../../components/admin/AdminAssignModal';
import AdminPhotoLightbox, { LightboxPhoto } from '../../components/admin/AdminPhotoLightbox';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import '../../pages/AdminPage.css';

interface PhotoVerification {
  id: string;
  member?: {
    id: string;
    full_name?: string;
    email?: string;
  } | null;
  verification_type: string;
  status: string;
  priority: string;
  submitted_at: string;
  rejection_reason?: string | null;
  current_assignment?: {
    assigned_to_staff?: {
      full_name?: string;
    } | null;
  } | null;
  profile_photos: MemberPhoto[];
}

interface PhotoVerificationWire extends Omit<PhotoVerification, 'profile_photos'> {
  profile_photos?: unknown[];
}

interface PhotoVerificationPage {
  count: number;
  results: PhotoVerificationWire[];
}

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

const PRESET_REJECTION_REASONS = [
  'Blurry or low resolution photo',
  'Face is not clearly visible',
  'Group photo with multiple people',
  'Side profile / face is partially covered',
  'Celebrity or copyrighted image',
  'Inappropriate or offensive content',
];

export default function AdminPhotoApprovalsPage() {
  const { hasAdminPermission, user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN' || user?.account_type === 'SUPER_ADMIN' || (user as any)?.is_super_admin;
  const basePath = isSuper ? '/super-admin' : '/admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [verifications, setVerifications] = useState<PhotoVerification[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState(searchParams.get('status') || 'pending_review');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{ photoId: string; memberName: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Zoom lightbox state
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    photos: LightboxPhoto[];
    currentIndex: number;
    memberName: string;
    memberId?: string;
  }>({
    isOpen: false,
    photos: [],
    currentIndex: 0,
    memberName: '',
    memberId: undefined,
  });

  // Assign modal state
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);

  const [approveProfilePhoto] = useApproveProfilePhotoMutation();
  const [rejectProfilePhoto] = useRejectProfilePhotoMutation();

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '24',
        verification_type: 'PROFILE_PHOTO',
      };
      if (status) params.status = status;

      const data = await fetchApi<PhotoVerificationPage>('/admin/verifications/', { params });
      setVerifications(
        (data.results ?? [])
          .filter((verification) => verification.verification_type === 'PROFILE_PHOTO')
          .map((verification) => ({
            ...verification,
            profile_photos: (verification.profile_photos ?? [])
              .map(normalizeMemberPhoto)
              .filter((photo) => Boolean(photo.id)),
          }))
      );
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo verifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  useRealtimeRefresh({
    eventTypes: ['photo.uploaded', 'photo.approved', 'photo.rejected', 'photo.deleted'],
    refresh: () => load(true),
    debounceMs: 300,
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }, [status, page, setSearchParams]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const canAssign = hasAdminPermission('verification.assign');
  const canApprove = hasAdminPermission('verification.approve');
  const canReject = hasAdminPermission('verification.reject');

  const handleApprovePhoto = async (photoId: string) => {
    setBusyPhotoId(photoId);
    setActionError('');
    try {
      await approveProfilePhoto(photoId).unwrap();
      setSuccessToast('Photo approved successfully.');

      // Optimistically update photo in list in-place
      setVerifications((prev) =>
        prev.map((v) => ({
          ...v,
          profile_photos: v.profile_photos.map((p) =>
            p.id === photoId ? { ...p, status: 'approved' } : p
          ),
        }))
      );

      // If open in lightbox, auto-advance or close
      if (lightboxState.isOpen && lightboxState.photos[lightboxState.currentIndex]?.id === photoId) {
        if (lightboxState.photos.length > 1) {
          setLightboxState((prev) => ({
            ...prev,
            currentIndex: (prev.currentIndex + 1) % prev.photos.length,
          }));
        } else {
          setLightboxState((prev) => ({ ...prev, isOpen: false }));
        }
      }
      await load(true);
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be approved.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setActionError('A rejection reason is required.');
      return;
    }
    setBusyPhotoId(rejectModal.photoId);
    setActionError('');
    try {
      await rejectProfilePhoto({ photoId: rejectModal.photoId, reason }).unwrap();
      setSuccessToast('Photo rejected.');

      // Optimistically update photo in list in-place
      setVerifications((prev) =>
        prev.map((v) => ({
          ...v,
          profile_photos: v.profile_photos.map((p) =>
            p.id === rejectModal.photoId ? { ...p, status: 'rejected' } : p
          ),
        }))
      );

      setRejectModal(null);
      setRejectionReason('');
      if (lightboxState.isOpen && lightboxState.photos[lightboxState.currentIndex]?.id === rejectModal.photoId) {
        if (lightboxState.photos.length > 1) {
          setLightboxState((prev) => ({
            ...prev,
            currentIndex: (prev.currentIndex + 1) % prev.photos.length,
          }));
        } else {
          setLightboxState((prev) => ({ ...prev, isOpen: false }));
        }
      }
      await load(true);
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be rejected.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  // Build flattened list of all photos for global lightbox navigation
  const allLightboxPhotos = useMemo<LightboxPhoto[]>(() => {
    const list: LightboxPhoto[] = [];
    for (const v of verifications) {
      const memberName = v.member?.full_name || 'Member';
      const memberId = v.member?.id || (v as any).member_id;
      for (const photo of v.profile_photos) {
        list.push({
          id: photo.id,
          member_id: memberId,
          member_name: memberName,
          src: `/api/proxy/profile-photos/${photo.id}/image/`,
          alt: `${memberName}'s photo`,
          is_primary: photo.is_primary,
          status: photo.status,
          uploaded_at: photo.updated_at,
        });
      }
    }
    return list;
  }, [verifications]);

  const openZoomForPhoto = (photoId: string, memberName: string, memberId?: string) => {
    const idx = allLightboxPhotos.findIndex((p) => p.id === photoId);
    if (idx >= 0) {
      setLightboxState({
        isOpen: true,
        photos: allLightboxPhotos,
        currentIndex: idx,
        memberName,
        memberId,
      });
    } else {
      setLightboxState({
        isOpen: true,
        photos: [
          {
            id: photoId,
            member_id: memberId,
            member_name: memberName,
            src: `/api/proxy/profile-photos/${photoId}/image/`,
            alt: `${memberName}'s photo`,
            status: 'PENDING',
          },
        ],
        currentIndex: 0,
        memberName,
        memberId,
      });
    }
  };

  // Filtered verifications based on search query
  const filteredVerifications = useMemo(() => {
    if (!searchQuery.trim()) return verifications;
    const q = searchQuery.toLowerCase().trim();
    return verifications.filter(
      (v) =>
        v.member?.full_name?.toLowerCase().includes(q) ||
        v.member?.email?.toLowerCase().includes(q)
    );
  }, [verifications, searchQuery]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Photo approvals"
        description="Verify and moderate submitted profile pictures. Inspect full details with high-resolution zoom."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="admin-btn admin-btn-secondary flex items-center gap-2 shadow-sm"
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      <AdminPanel className="admin-table-panel space-y-5">
        {/* Toolbar: Filters, Search, View Mode Toggle */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status filter dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="pending_review">Pending Review</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="">All statuses</option>
              </select>
            </div>

            <div className="text-xs font-medium text-slate-500 px-2">
              <strong className="text-slate-900 font-bold">{count}</strong> requests
            </div>
          </div>

          {/* Search bar & View mode toggle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member or email..."
                className="w-56 sm:w-64 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'grid'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
                title="Grid Gallery View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'table'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback banners */}
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

        {loading && !verifications.length && (
          <div className="py-16 text-center text-slate-400">
            <LoaderCircle className="h-8 w-8 animate-spin mx-auto text-rose-500" />
            <p className="mt-3 text-sm font-medium text-slate-600">Loading photo approvals queue...</p>
          </div>
        )}

        {/* --- Card Grid View --- */}
        {filteredVerifications.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
            {filteredVerifications.map((v) => {
              const memberName = v.member?.full_name || 'Unnamed Member';
              const memberEmail = v.member?.email || 'No email provided';
              const photos = v.profile_photos;
              const hasPhotos = photos.length > 0;
              const primaryPhoto = photos.find((p) => p.is_primary) || photos[0];

              return (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group/card"
                >
                  {/* Photo area */}
                  {hasPhotos && primaryPhoto ? (
                    <div
                      className="aspect-[4/5] bg-slate-100 relative overflow-hidden cursor-zoom-in group/photo"
                      onClick={() => openZoomForPhoto(primaryPhoto.id, memberName, v.member?.id || (v as any).member_id)}
                      title="Click anywhere to zoom photo"
                    >
                      <img
                        src={`/api/proxy/profile-photos/${primaryPhoto.id}/thumbnail/`}
                        alt={memberName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover/photo:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />

                      {/* Zoom hint overlay on hover */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity duration-200">
                        <span className="flex items-center gap-1.5 rounded-full bg-black/75 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm shadow-xl">
                          <Maximize2 className="h-3.5 w-3.5 text-rose-400" /> Click to Zoom
                        </span>
                      </div>

                      {/* Badges overlay */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${primaryPhoto.status?.toLowerCase() === 'approved'
                            ? 'bg-emerald-500 text-white'
                            : primaryPhoto.status?.toLowerCase() === 'rejected'
                              ? 'bg-rose-500 text-white'
                              : 'bg-amber-500 text-white'
                            }`}
                        >
                          {primaryPhoto.status?.toUpperCase() || 'PENDING'}
                        </span>

                        {primaryPhoto.is_primary && (
                          <span className="bg-amber-400 text-slate-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-sm tracking-wide">
                            PRIMARY
                          </span>
                        )}
                      </div>

                      {photos.length > 1 && (
                        <div className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                          +{photos.length - 1} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[4/5] bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <User className="h-12 w-12 stroke-[1.5] text-slate-300 mb-2" />
                      <span className="text-xs font-medium">No photo files found</span>
                    </div>
                  )}

                  {/* Card details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <a
                        href={(v.member?.id || (v as any).member_id) ? `${basePath}/members/${v.member?.id || (v as any).member_id}` : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="group/member block cursor-pointer text-left"
                        title={`View ${memberName}'s account`}
                        onClick={(e) => {
                          if (!v.member?.id && !(v as any).member_id) e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <h3 className="font-bold text-slate-900 group-hover/member:text-indigo-600 text-sm truncate flex items-center gap-1 transition-colors" title={memberName}>
                          {memberName}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/member:opacity-100 transition-opacity text-indigo-500 shrink-0" />
                        </h3>
                        <p className="text-xs text-slate-500 group-hover/member:text-slate-700 truncate mt-0.5 transition-colors" title={memberEmail}>
                          {memberEmail}
                        </p>
                      </a>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatAdminDate(v.submitted_at)}
                        </span>
                        {v.priority && (
                          <span
                            className={`font-semibold uppercase tracking-wider ${v.priority === 'URGENT' || v.priority === 'HIGH'
                              ? 'text-rose-600 font-bold'
                              : 'text-slate-500'
                              }`}
                          >
                            {v.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      {hasPhotos && primaryPhoto ? (
                        <>
                          <button
                            type="button"
                            disabled={busyPhotoId === primaryPhoto.id}
                            onClick={() => handleApprovePhoto(primaryPhoto.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            title="Approve this photo"
                          >
                            {busyPhotoId === primaryPhoto.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={busyPhotoId === primaryPhoto.id}
                            onClick={() =>
                              setRejectModal({
                                photoId: primaryPhoto.id,
                                memberName,
                              })
                            }
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            title="Reject this photo with reason"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      ) : null}

                      {canAssign && v.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => setAssignTargetId(v.id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Assign to staff"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Compact Table View --- */}
        {filteredVerifications.length > 0 && viewMode === 'table' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-20">Photo</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVerifications.map((v) => {
                  const memberName = v.member?.full_name || 'Unnamed member';
                  const photos = v.profile_photos;
                  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0];

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Photo Thumbnail */}
                      <td className="py-3 px-4">
                        {primaryPhoto ? (
                          <div
                            className="relative h-16 w-12 rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in group/table-photo shadow-sm border border-slate-200"
                            onClick={() => openZoomForPhoto(primaryPhoto.id, memberName)}
                            title="Click to zoom photo"
                          >
                            <img
                              src={`/api/proxy/profile-photos/${primaryPhoto.id}/thumbnail/`}
                              alt=""
                              className="h-full w-full object-cover transition-transform group-hover/table-photo:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/table-photo:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-16 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                      </td>

                      {/* Member Info */}
                      <td className="py-3 px-4">
                        <a
                          href={(v.member?.id || (v as any).member_id) ? `${basePath}/members/${v.member?.id || (v as any).member_id}` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="group/member block cursor-pointer text-left"
                          title={`View ${memberName}'s account`}
                          onClick={(e) => {
                            if (!v.member?.id && !(v as any).member_id) e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <p className="font-bold text-slate-900 group-hover/member:text-indigo-600 flex items-center gap-1 transition-colors">
                            {memberName}
                            <ExternalLink size={11} className="opacity-0 group-hover/member:opacity-100 text-indigo-500 transition-opacity" />
                          </p>
                          <p className="text-slate-500 text-[11px] mt-0.5">{v.member?.email || '—'}</p>
                        </a>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700">{v.priority}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <AdminStatusBadge status={v.status} />
                      </td>

                      {/* Current Assignee */}
                      <td className="py-3 px-4 text-slate-500">
                        {v.current_assignment?.assigned_to_staff?.full_name || (
                          <span className="italic text-slate-400">Unassigned</span>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3 px-4 text-slate-500">{formatAdminDate(v.submitted_at)}</td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {primaryPhoto && (
                            <>
                              <button
                                type="button"
                                disabled={busyPhotoId === primaryPhoto.id}
                                onClick={() => handleApprovePhoto(primaryPhoto.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
                                title="Approve photo"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>

                              <button
                                type="button"
                                disabled={busyPhotoId === primaryPhoto.id}
                                onClick={() =>
                                  setRejectModal({
                                    photoId: primaryPhoto.id,
                                    memberName,
                                  })
                                }
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition"
                                title="Reject photo"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}

                          {canAssign && v.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setAssignTargetId(v.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                              title="Assign Task"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
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
            title="No photo reviews pending"
            description={
              searchQuery
                ? 'No photo verifications matched your search criteria.'
                : 'The queue is clear. New submissions will appear here automatically.'
            }
          />
        )}

        <AdminPagination page={page} count={count} pageSize={24} onPageChange={setPage} />
      </AdminPanel>

      {/* --- Fullscreen Interactive Zoom Lightbox --- */}
      <AdminPhotoLightbox
        isOpen={lightboxState.isOpen}
        photos={lightboxState.photos}
        currentIndex={lightboxState.currentIndex}
        memberName={lightboxState.memberName}
        memberId={lightboxState.memberId}
        onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
        onIndexChange={(newIdx) => setLightboxState((prev) => ({ ...prev, currentIndex: newIdx }))}
        onApprove={(photoId) => handleApprovePhoto(photoId)}
        onReject={(photoId) => {
          setRejectModal({
            photoId,
            memberName: lightboxState.memberName,
          });
        }}
        isActionBusy={Boolean(busyPhotoId)}
      />

      {/* --- Rejection Reason Modal --- */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reject Profile Photo</h3>
                <p className="text-xs text-slate-500 mt-0.5">{rejectModal.memberName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal(null)}
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
                    onClick={() => setRejectionReason(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium ${rejectionReason === preset
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
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Required: Provide an explanation for the member..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || Boolean(busyPhotoId)}
                onClick={handleConfirmReject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {busyPhotoId ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      <AdminAssignModal
        open={Boolean(assignTargetId)}
        onClose={() => setAssignTargetId(null)}
        targetId={assignTargetId || ''}
        assignmentType="PHOTO_VERIFICATION"
        onSuccess={load}
      />
    </>
  );
}
