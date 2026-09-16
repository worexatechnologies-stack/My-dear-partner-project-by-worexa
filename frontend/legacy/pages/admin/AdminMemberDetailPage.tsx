'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from '@/lib/router-compat';
import {
  ArrowLeft, BadgeCheck, Ban, Camera, CreditCard, Edit3, FileText,
  Heart, Info, LoaderCircle, Mail, MapPin, Phone, Shield, User,
  CheckCircle2, XCircle, Clock, AlertTriangle, Star, Trash2,
  Check, X, Save, Eye, ShieldCheck, RotateCcw, Maximize2, ShieldAlert,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { fetchApi } from '../../services/apiClient';
import AdminDocumentLightbox, { LightboxDocument } from '../../components/admin/AdminDocumentLightbox';
import AdminPhotoLightbox, { LightboxPhoto } from '../../components/admin/AdminPhotoLightbox';
import { getAdminUsers, updateAdminUser, type AdminUserAction } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime, type RealtimeEvent } from '@/providers/RealtimeProvider';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge, AdminToast,
  formatAdminDate,
} from '../../components/admin/AdminUI';

function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

type MemberDetail = {
  member: Record<string, unknown>;
  photos: Array<Record<string, unknown>>;
  verifications: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
};

type GrantableMembershipPlan = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  duration_days?: number;
};

const VERIFICATION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  pending_review: 'bg-amber-100 text-amber-800',
  not_started: 'bg-slate-100 text-slate-600',
  changes_requested: 'bg-orange-100 text-orange-800',
};

function Badge({ label, colorClass }: { label: string; colorClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass || 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  );
}

export default function AdminMemberDetailPage({
  memberId,
  onBack,
}: {
  memberId: string;
  onBack?: () => void;
}) {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const navigate = useNavigate();
  const isSuper = typeof window !== 'undefined' && window.location.pathname.startsWith('/super-admin');
  const isSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.account_type === 'SUPER_ADMIN' ||
    currentUser?.admin_role === 'SUPER_ADMIN' ||
    Boolean(currentUser?.is_superuser) ||
    Boolean((currentUser as any)?.is_super_admin) ||
    isSuper;
  const basePath = isSuper ? '/super-admin/members' : '/admin/members';

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(basePath);
    }
  };

  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Photo approve/reject
  const [photoAction, setPhotoAction] = useState<{ photoId: string; approve: boolean } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Document moderation states
  const [rejectDocTarget, setRejectDocTarget] = useState<{ id: string; type: string } | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('');

  // Document lightbox state
  const [docLightboxOpen, setDocLightboxOpen] = useState(false);
  const [docLightboxIndex, setDocLightboxIndex] = useState(0);
  const [docLightboxDocs, setDocLightboxDocs] = useState<LightboxDocument[]>([]);

  const openDocLightbox = (targetDoc: any) => {
    const all = (detail?.documents || []) as any[];
    const mapped: LightboxDocument[] = all.map((d) => ({
      id: d.id,
      document_type: d.document_type || d.document_type_display || 'Document',
      display_name: d.document_type_display || d.document_type || 'Document',
      original_file_name: d.original_file_name || d.document_type || 'document',
      mime_type: d.mime_type || 'application/pdf',
      file_size: d.file_size || 0,
      status: d.status || 'PENDING',
      rejection_reason: d.rejection_reason,
      uploaded_at: d.uploaded_at || '',
      reviewer_name: d.reviewer_name || null,
    }));
    const idx = mapped.findIndex((d) => d.id === targetDoc.id);
    setDocLightboxDocs(mapped);
    setDocLightboxIndex(idx >= 0 ? idx : 0);
    setDocLightboxOpen(true);
  };

  // Missing requirements popup modal state
  const [missingReqModal, setMissingReqModal] = useState<{ message: string } | null>(null);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{ user: string; action: string; label: string; description: string; dangerous: boolean } | null>(null);

  // Profile approve / reject / request-changes (reason required)
  const [profileReview, setProfileReview] = useState<{ action: AdminUserAction; label: string } | null>(null);
  const [profileReviewReason, setProfileReviewReason] = useState('');

  // Grant Membership modal state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantablePlans, setGrantablePlans] = useState<GrantableMembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState('');
  const [selectedDurationMonths, setSelectedDurationMonths] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi<MemberDetail>(`/admin/users/${memberId}/`);
      setDetail(data);
    } catch {
      setError('Failed to load member details.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const openGrantMembershipModal = async () => {
    setShowGrantModal(true);
    setPlansLoading(true);
    try {
      const data = await fetchApi<{ results?: GrantableMembershipPlan[] } | GrantableMembershipPlan[]>('/admin/membership-plans/?page_size=100');
      const list = Array.isArray(data) ? data : data.results || [];
      const activePlans = list.filter((plan) => plan.is_active && plan.slug);
      setGrantablePlans(activePlans);
      setSelectedPlanSlug((current) => activePlans.some((plan) => plan.slug === current) ? current : (activePlans[0]?.slug || ''));
    } catch {
      setGrantablePlans([]);
      setSelectedPlanSlug('');
      setToast({ message: 'Unable to load membership plans.', tone: 'error' });
    } finally {
      setPlansLoading(false);
    }
  };

  // Live refresh when the member (or a moderator) updates the profile. The
  // event is debounced and request-sequenced so an older response can never
  // overwrite a newer one. This never touches the member's own edit form.
  const { subscribe } = useRealtime();
  const loadSeqRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      const seq = ++loadSeqRef.current;
      fetchApi<MemberDetail>(`/admin/users/${memberId}/`)
        .then((data) => {
          if (seq === loadSeqRef.current) setDetail(data);
        })
        .catch(() => {
          /* Keep the existing detail on a transient refresh failure. */
        });
    };
    const handler = (event: RealtimeEvent) => {
      const eventMemberId = (event.data?.member_id as string) || event.entity_id;
      if (eventMemberId !== memberId) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(refresh, 600);
    };
    const unsubscribers = [
      subscribe('profile.updated', handler),
      subscribe('profile.submitted', handler),
      subscribe('profile.approved', handler),
      subscribe('profile.rejected', handler),
      subscribe('profile.changes_requested', handler),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [memberId, subscribe]);

  const m = detail?.member as Record<string, any> | undefined;
  const photos = detail?.photos || [];
  const verifications = detail?.verifications || [];
  const documents = detail?.documents || [];
  const memberships = detail?.memberships || [];
  const activity = detail?.activity || [];

  // Photo Zoom Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);

  const openAvatarZoom = () => {
    if (!m) return;
    if (photos.length > 0) {
      const mapped: LightboxPhoto[] = photos.map((p: any) => ({
        id: p.id,
        src: `/api/proxy/profile-photos/${p.id}/image/`,
        alt: `${m.full_name || 'Member'}'s photo`,
        is_primary: Boolean(p.is_primary),
        status: p.status,
        uploaded_at: p.uploaded_at || p.created_at,
      }));
      const primaryIdx = photos.findIndex((p: any) => p.is_primary);
      setLightboxPhotos(mapped);
      setLightboxIndex(primaryIdx >= 0 ? primaryIdx : 0);
    } else if (m.photo) {
      setLightboxPhotos([{
        src: m.photo as string,
        alt: `${m.full_name || 'Member'}'s photo`,
        is_primary: true,
        status: (m.photo_status as string) || undefined,
      }]);
      setLightboxIndex(0);
    }
  };

  const openPhotoZoom = (index: number) => {
    if (!photos || photos.length === 0) return;
    const mapped: LightboxPhoto[] = photos.map((p: any) => ({
      id: p.id,
      src: `/api/proxy/profile-photos/${p.id}/image/`,
      alt: `${m?.full_name || 'Member'}'s photo`,
      is_primary: Boolean(p.is_primary),
      status: p.status,
      uploaded_at: p.uploaded_at || p.created_at,
    }));
    setLightboxPhotos(mapped);
    setLightboxIndex(index);
  };

  const startEdit = () => {
    if (!isSuperAdmin) {
      setToast({ message: 'Only Super Admins can edit member profiles.', tone: 'error' });
      return;
    }
    if (!m) return;
    setEditData({
      first_name: m.first_name || '',
      last_name: m.last_name || '',
      profile_created_by: m.profile_created_by || 'SELF',
      gender: m.gender || '',
      date_of_birth: m.date_of_birth || '',
      marital_status: m.marital_status || '',
      height: m.height || '',
      weight: m.weight || '',
      blood_group: m.blood_group || '',
      complexion: m.complexion || '',
      religion: m.religion || '',
      mother_tongue: m.mother_tongue || '',
      caste: m.caste || '',
      sub_caste: m.sub_caste || '',
      gothra: m.gothra || '',
      star_nakshatra: m.star_nakshatra || '',
      manglik_status: m.manglik_status || '',
      highest_education: m.highest_education || '',
      education_detail: m.education_detail || '',
      occupation: m.occupation || '',
      employed_in: m.employed_in || '',
      company: m.company || '',
      annual_income: m.annual_income || '',
      work_location: m.work_location || '',
      father_status: m.father_status || '',
      mother_status: m.mother_status || '',
      num_brothers: m.num_brothers ?? 0,
      num_sisters: m.num_sisters ?? 0,
      family_type: m.family_type || '',
      family_status: m.family_status || '',
      family_location: m.family_location || '',
      pref_age_min: m.pref_age_min ?? '',
      pref_age_max: m.pref_age_max ?? '',
      pref_height_min: m.pref_height_min ?? '',
      pref_height_max: m.pref_height_max ?? '',
      pref_religion: m.pref_religion || '',
      pref_caste: m.pref_caste || '',
      pref_location: m.pref_location || '',
      pref_education: m.pref_education || '',
      pref_occupation: m.pref_occupation || '',
      pref_marital_status: m.pref_marital_status || '',
      pref_about: m.pref_about || '',
      about: m.about || '',
      hobbies: Array.isArray(m.hobbies) ? m.hobbies.join(', ') : (m.hobbies || ''),
      is_active: m.is_active ?? true,
      is_premium: m.is_premium ?? false,
      is_mobile_verified: m.is_mobile_verified ?? false,
    });
    setActiveTab('profile');
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...editData,
        num_brothers: Number(editData.num_brothers ?? 0),
        num_sisters: Number(editData.num_sisters ?? 0),
      };
      if (editData.pref_age_min !== '' && editData.pref_age_min !== undefined) {
        payload.pref_age_min = Number(editData.pref_age_min);
      }
      if (editData.pref_age_max !== '' && editData.pref_age_max !== undefined) {
        payload.pref_age_max = Number(editData.pref_age_max);
      }
      const result = await fetchApi<any>(`/admin/users/${memberId}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setDetail(prev => prev ? { ...prev, member: result } : prev);
      setToast({ message: 'Member updated successfully.', tone: 'success' });
      setEditing(false);
      await load();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to update member.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const performPhotoAction = async () => {
    if (!photoAction) return;
    if (!photoAction.approve && !rejectionReason.trim()) {
      setToast({ message: 'Rejection reason is required.', tone: 'error' });
      return;
    }
    setActionBusy(true);
    try {
      await fetchApi(`/admin/profile-photos/${photoAction.photoId}/${photoAction.approve ? 'approve' : 'reject'}/`, {
        method: 'POST',
        body: photoAction.approve ? undefined : JSON.stringify({ reason: rejectionReason }),
      });
      setToast({ message: `Photo ${photoAction.approve ? 'approved' : 'rejected'} successfully.`, tone: 'success' });
      setPhotoAction(null);
      setRejectionReason('');
      load();
    } catch {
      setToast({ message: 'Failed to process photo.', tone: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleApproveDocument = async (docId: string, andApproveProfile: boolean = false) => {
    setActionBusy(true);
    try {
      await fetchApi(`/admin/documents/${docId}/approve/`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setToast({ message: 'Document approved successfully.', tone: 'success' });
      setMissingReqModal(null);
      if (andApproveProfile) {
        await updateAdminUser(memberId, 'approve_profile' as AdminUserAction);
        setToast({ message: 'Document and Profile approved successfully!', tone: 'success' });
      }
      await load();
    } catch (err: any) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to approve document.', tone: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectDocumentConfirm = async () => {
    if (!rejectDocTarget || !docRejectReason.trim()) return;
    setActionBusy(true);
    try {
      await fetchApi(`/admin/documents/${rejectDocTarget.id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason: docRejectReason.trim() }),
      });
      setToast({ message: 'Document marked as rejected.', tone: 'success' });
      setRejectDocTarget(null);
      setDocRejectReason('');
      await load();
    } catch (err: any) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to reject document.', tone: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  const performAction = async (action: string, force: boolean = false) => {
    setActionBusy(true);
    try {
      if (force) {
        await updateAdminUser(memberId, { action: action as AdminUserAction, force: true } as any);
      } else {
        await updateAdminUser(memberId, action as AdminUserAction);
      }
      setToast({ message: 'Action completed.', tone: 'success' });
      setConfirmAction(null);
      setMissingReqModal(null);
      await load();
    } catch (err: any) {
      const message = err instanceof Error && err.message ? err.message : 'Action failed.';
      if (action === 'approve_profile' && (message.toLowerCase().includes('missing') || message.toLowerCase().includes('requirement'))) {
        setMissingReqModal({ message });
      } else {
        setToast({ message, tone: 'error' });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const performProfileReview = async () => {
    if (!profileReview || !profileReviewReason.trim()) return;
    setActionBusy(true);
    try {
      await updateAdminUser(memberId, { action: profileReview.action, reason: profileReviewReason.trim() });
      setToast({ message: `${profileReview.label} recorded.`, tone: 'success' });
      setProfileReview(null);
      setProfileReviewReason('');
      load();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Action failed.';
      setToast({ message, tone: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminErrorState message={error} onRetry={load} />;
  if (!m) return <AdminEmptyState title="Member not found" />;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'verification', label: 'Verification', icon: Shield },
    { id: 'membership', label: 'Membership', icon: CreditCard },
    { id: 'activity', label: 'Activity', icon: Clock },
  ];

  return (
    <div className="admin-page">
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      <div className="admin-page-header">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            <ArrowLeft className="h-4 w-4" /> Members
          </button>
        </div>
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="admin-btn flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="admin-btn admin-btn-primary flex items-center gap-2"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          ) : (
            isSuperAdmin && (
              <button
                type="button"
                onClick={startEdit}
                className="admin-btn admin-btn-primary flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" /> Edit Member
              </button>
            )
          )}
        </div>
      </div>

      {/* Member header card */}
      <div className="admin-panel mb-6">
        <div className="flex items-start gap-5">
          <div
            className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-slate-200 relative ${
              m.photo || photos.length > 0
                ? 'cursor-zoom-in group/avatar ring-2 ring-transparent hover:ring-rose-500 shadow-md transition-all duration-200'
                : ''
            }`}
            onClick={openAvatarZoom}
            title={m.photo || photos.length > 0 ? 'Click to zoom profile photo' : undefined}
          >
            {m.photo ? (
              <>
                <img
                  src={m.photo as string}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-200 group-hover/avatar:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
                </div>
              </>
            ) : photos.length > 0 ? (
              <>
                <img
                  src={`/api/proxy/profile-photos/${photos[0].id}/thumbnail/`}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-200 group-hover/avatar:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
                {((m.first_name as string)?.[0] || '').toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{m.full_name as string}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{m.email as string}</span>
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{m.mobile_number as string || 'N/A'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{m.city as string || m.work_location as string || 'N/A'}</span>
              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{m.gender as string || 'N/A'}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {m.is_deleted || m.deleted_at ? (
              <Badge label="Soft Deleted (Trash)" colorClass="bg-rose-100 text-rose-800 font-bold" />
            ) : (
              <Badge
                label={m.is_active ? 'Active' : 'Inactive'}
                colorClass={m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
              />
            )}
            <Badge
              label="Terms & Privacy Agreed"
              colorClass="bg-emerald-100 text-emerald-800 font-bold"
            />
            <Badge
              label={`Profile: ${m.profile_status as string}`}
              colorClass={VERIFICATION_COLORS[m.profile_status as string] || 'bg-slate-100 text-slate-600'}
            />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-rose-500 text-rose-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Account info */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Account Information</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Member ID" value={(m.id as string) || '—'} />
                <InfoField label="Full Name" value={m.full_name as string} />
                <InfoField label="Email" value={m.email as string} verified={m.is_email_verified as boolean} />
                <InfoField label="Mobile" value={m.mobile_number as string} verified={m.is_mobile_verified as boolean} />
                <InfoField label="Profile Created By" value={(m.profile_created_by as string) || 'Self'} />
                <InfoField label="Account Type" value="Member" />
                <InfoField label="Account Status" value={(m.account_status as string) || ((m.is_active as boolean) ? 'Active' : 'Inactive')} />
                <InfoField label="Membership Plan" value={((m.active_membership as any)?.plan?.name as string) || ((m.is_premium as boolean) ? 'Premium' : 'Free')} />
                <InfoField label="Terms & Privacy" value={m.terms_accepted_at ? `Agreed (${formatAdminDate(m.terms_accepted_at as string)})` : 'Agreed'} />
                <InfoField label="Joined" value={formatAdminDate(m.created_at as string)} />
                <InfoField label="Last Login" value={formatAdminDate(m.last_login as string)} />
                <InfoField label="Last Profile Update" value={formatAdminDate(m.updated_at as string)} />
              </div>
            </div>

            {/* Personal info */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Personal & Lifestyle Information</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Gender" value={m.gender as string} />
                <InfoField label="Date of Birth" value={m.date_of_birth as string} />
                <InfoField label="Age" value={m.age ? `${m.age} yrs` : '—'} />
                <InfoField label="Marital Status" value={m.marital_status as string} />
                <InfoField label="Height" value={m.height as string} />
                <InfoField label="Weight" value={m.weight as string} />
                <InfoField label="Blood Group" value={m.blood_group as string} />
                <InfoField label="Complexion" value={m.complexion as string} />
                <InfoField label="Mother Tongue" value={m.mother_tongue as string} />
                <InfoField label="Work Location / City" value={(m.work_location as string) || (m.city as string)} />
                <InfoField label="Hobbies & Interests" value={Array.isArray(m.hobbies) ? m.hobbies.join(', ') : ((m.hobbies as string) || '—')} />
                <InfoField label="Profile Created By" value={(m.profile_created_by as string) || 'Self'} />
              </div>
              {(m.about as string) && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">About Me / Bio</label>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.about as string}</p>
                </div>
              )}
            </div>

            {/* Religious info */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Religious & Astrology Information</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Religion" value={m.religion as string} />
                <InfoField label="Caste" value={m.caste as string} />
                <InfoField label="Sub Caste" value={m.sub_caste as string} />
                <InfoField label="Gothra" value={m.gothra as string} />
                <InfoField label="Star / Nakshatra" value={m.star_nakshatra as string} />
                <InfoField label="Manglik Status" value={m.manglik_status as string} />
              </div>
            </div>

            {/* Professional info */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Professional & Education Information</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Highest Education" value={m.highest_education as string} />
                <InfoField label="Education Detail" value={m.education_detail as string} />
                <InfoField label="Occupation" value={m.occupation as string} />
                <InfoField label="Employed In" value={m.employed_in as string} />
                <InfoField label="Company" value={m.company as string} />
                <InfoField label="Annual Income" value={m.annual_income as string} />
                <InfoField label="Work Location" value={m.work_location as string} />
              </div>
            </div>

            {/* Family Details panel */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Family Details</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Father Status" value={m.father_status as string} />
                <InfoField label="Mother Status" value={m.mother_status as string} />
                <InfoField label="No. of Brothers" value={String(m.num_brothers ?? 0)} />
                <InfoField label="No. of Sisters" value={String(m.num_sisters ?? 0)} />
                <InfoField label="Family Type" value={m.family_type as string} />
                <InfoField label="Family Status" value={m.family_status as string} />
                <InfoField label="Family Location" value={m.family_location as string} />
              </div>
            </div>

            {/* Partner preferences */}
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Partner Preferences</h2>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Age Range" value={`${m.pref_age_min || '—'} – ${m.pref_age_max || '—'} yrs`} />
                <InfoField label="Height Range" value={`${m.pref_height_min || '—'} – ${m.pref_height_max || '—'}`} />
                <InfoField label="Preferred Religion" value={m.pref_religion as string} />
                <InfoField label="Preferred Caste" value={m.pref_caste as string} />
                <InfoField label="Preferred Education" value={m.pref_education as string} />
                <InfoField label="Preferred Occupation" value={m.pref_occupation as string} />
                <InfoField label="Preferred Location" value={m.pref_location as string} />
                <InfoField label="Preferred Marital Status" value={m.pref_marital_status as string} />
              </div>
              {(m.pref_about as string) && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Additional Expectations</label>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.pref_about as string}</p>
                </div>
              )}
            </div>

            {/* Verification overview */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Verification Overview</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <VerificationCard label="Profile" status={m.profile_status as string} />
                <VerificationCard label="Photo" status={m.photo_status as string} />
                <VerificationCard label="Document" status={m.document_status as string} />
                <VerificationCard label="Mobile" status={(m.is_mobile_verified as boolean) ? 'approved' : 'not_started'} />
                <VerificationCard label="Overall" status={(m.is_fully_verified as boolean) ? 'approved' : 'pending_review'} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          editing && isSuperAdmin ? (
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="admin-panel flex flex-wrap items-center justify-between gap-3 bg-rose-50/50 border-rose-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-rose-600" /> Edit Member Profile
                  </h2>
                  <p className="text-xs text-slate-500">Update personal details, background, astrology, family, and partner preferences.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="admin-btn flex items-center gap-2">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                  <button type="button" onClick={saveEdit} disabled={saving} className="admin-btn admin-btn-primary flex items-center gap-2">
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Personal Information */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  1. Personal & Lifestyle Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="First Name" name="first_name" value={editData.first_name as string} onChange={v => setEditData(p => ({ ...p, first_name: v }))} />
                  <EditField label="Last Name" name="last_name" value={editData.last_name as string} onChange={v => setEditData(p => ({ ...p, last_name: v }))} />
                  <EditField
                    label="Profile Created By"
                    name="profile_created_by"
                    type="select"
                    options={[
                      { value: 'Self', label: 'Self' },
                      { value: 'Parent', label: 'Parent' },
                      { value: 'Sibling', label: 'Sibling' },
                      { value: 'Relative', label: 'Relative' },
                      { value: 'Friend', label: 'Friend' },
                    ]}
                    value={editData.profile_created_by as string}
                    onChange={v => setEditData(p => ({ ...p, profile_created_by: v }))}
                  />
                  <EditField
                    label="Gender"
                    name="gender"
                    type="select"
                    options={[
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    value={editData.gender as string}
                    onChange={v => setEditData(p => ({ ...p, gender: v }))}
                  />
                  <EditField label="Date of Birth" name="date_of_birth" type="date" value={editData.date_of_birth as string} onChange={v => setEditData(p => ({ ...p, date_of_birth: v }))} />
                  <EditField
                    label="Marital Status"
                    name="marital_status"
                    type="select"
                    options={[
                      { value: 'Never Married', label: 'Never Married' },
                      { value: 'Divorced', label: 'Divorced' },
                      { value: 'Widowed', label: 'Widowed' },
                      { value: 'Awaiting Divorce', label: 'Awaiting Divorce' },
                      { value: 'Annulled', label: 'Annulled' },
                    ]}
                    value={editData.marital_status as string}
                    onChange={v => setEditData(p => ({ ...p, marital_status: v }))}
                  />
                  <EditField label="Height (e.g. 5' 9'' / 175 cm)" name="height" value={editData.height as string} onChange={v => setEditData(p => ({ ...p, height: v }))} />
                  <EditField label="Weight (e.g. 70 kg)" name="weight" value={editData.weight as string} onChange={v => setEditData(p => ({ ...p, weight: v }))} />
                  <EditField
                    label="Blood Group"
                    name="blood_group"
                    type="select"
                    options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']}
                    value={editData.blood_group as string}
                    onChange={v => setEditData(p => ({ ...p, blood_group: v }))}
                  />
                  <EditField label="Complexion" name="complexion" value={editData.complexion as string} onChange={v => setEditData(p => ({ ...p, complexion: v }))} />
                  <EditField label="Mother Tongue" name="mother_tongue" value={editData.mother_tongue as string} onChange={v => setEditData(p => ({ ...p, mother_tongue: v }))} />
                  <EditField label="Hobbies & Interests (comma-separated)" name="hobbies" value={editData.hobbies as string} onChange={v => setEditData(p => ({ ...p, hobbies: v }))} />
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">About Member / Bio</label>
                  <textarea
                    value={editData.about as string}
                    onChange={e => setEditData(p => ({ ...p, about: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-rose-400 outline-none"
                    rows={4}
                    placeholder="Describe background, personality, and values..."
                  />
                </div>
              </div>

              {/* Religious & Astrology Details */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  2. Religious & Astrological Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="Religion" name="religion" value={editData.religion as string} onChange={v => setEditData(p => ({ ...p, religion: v }))} />
                  <EditField label="Caste" name="caste" value={editData.caste as string} onChange={v => setEditData(p => ({ ...p, caste: v }))} />
                  <EditField label="Sub Caste" name="sub_caste" value={editData.sub_caste as string} onChange={v => setEditData(p => ({ ...p, sub_caste: v }))} />
                  <EditField label="Gothra" name="gothra" value={editData.gothra as string} onChange={v => setEditData(p => ({ ...p, gothra: v }))} />
                  <EditField label="Star / Nakshatra" name="star_nakshatra" value={editData.star_nakshatra as string} onChange={v => setEditData(p => ({ ...p, star_nakshatra: v }))} />
                  <EditField
                    label="Manglik Status"
                    name="manglik_status"
                    type="select"
                    options={[
                      { value: 'No', label: 'No' },
                      { value: 'Yes', label: 'Yes' },
                      { value: 'Both / Partial', label: 'Both / Partial' },
                      { value: 'Do not know', label: 'Do not know' },
                    ]}
                    value={editData.manglik_status as string}
                    onChange={v => setEditData(p => ({ ...p, manglik_status: v }))}
                  />
                </div>
              </div>

              {/* Professional & Education */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  3. Education & Professional Background
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="Highest Education" name="highest_education" value={editData.highest_education as string} onChange={v => setEditData(p => ({ ...p, highest_education: v }))} />
                  <EditField label="Education Detail (Degree / College)" name="education_detail" value={editData.education_detail as string} onChange={v => setEditData(p => ({ ...p, education_detail: v }))} />
                  <EditField label="Occupation" name="occupation" value={editData.occupation as string} onChange={v => setEditData(p => ({ ...p, occupation: v }))} />
                  <EditField label="Employed In" name="employed_in" value={editData.employed_in as string} onChange={v => setEditData(p => ({ ...p, employed_in: v }))} />
                  <EditField label="Company / Employer" name="company" value={editData.company as string} onChange={v => setEditData(p => ({ ...p, company: v }))} />
                  <EditField label="Annual Income" name="annual_income" value={editData.annual_income as string} onChange={v => setEditData(p => ({ ...p, annual_income: v }))} />
                  <EditField label="Work Location / City" name="work_location" value={editData.work_location as string} onChange={v => setEditData(p => ({ ...p, work_location: v }))} />
                </div>
              </div>

              {/* Family Details */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  4. Family Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="Father Status" name="father_status" value={editData.father_status as string} onChange={v => setEditData(p => ({ ...p, father_status: v }))} />
                  <EditField label="Mother Status" name="mother_status" value={editData.mother_status as string} onChange={v => setEditData(p => ({ ...p, mother_status: v }))} />
                  <EditField label="No. of Brothers" name="num_brothers" type="number" value={String(editData.num_brothers ?? 0)} onChange={v => setEditData(p => ({ ...p, num_brothers: Number(v) }))} />
                  <EditField label="No. of Sisters" name="num_sisters" type="number" value={String(editData.num_sisters ?? 0)} onChange={v => setEditData(p => ({ ...p, num_sisters: Number(v) }))} />
                  <EditField
                    label="Family Type"
                    name="family_type"
                    type="select"
                    options={[
                      { value: 'Nuclear', label: 'Nuclear' },
                      { value: 'Joint', label: 'Joint' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    value={editData.family_type as string}
                    onChange={v => setEditData(p => ({ ...p, family_type: v }))}
                  />
                  <EditField
                    label="Family Status"
                    name="family_status"
                    type="select"
                    options={[
                      { value: 'Middle Class', label: 'Middle Class' },
                      { value: 'Upper Middle Class', label: 'Upper Middle Class' },
                      { value: 'Rich', label: 'Rich' },
                      { value: 'Affluent', label: 'Affluent' },
                    ]}
                    value={editData.family_status as string}
                    onChange={v => setEditData(p => ({ ...p, family_status: v }))}
                  />
                  <EditField label="Family Location" name="family_location" value={editData.family_location as string} onChange={v => setEditData(p => ({ ...p, family_location: v }))} />
                </div>
              </div>

              {/* Partner Preferences */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  5. Partner Preferences
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="Min Age" name="pref_age_min" type="number" value={String(editData.pref_age_min ?? '')} onChange={v => setEditData(p => ({ ...p, pref_age_min: v }))} />
                  <EditField label="Max Age" name="pref_age_max" type="number" value={String(editData.pref_age_max ?? '')} onChange={v => setEditData(p => ({ ...p, pref_age_max: v }))} />
                  <EditField label="Min Height" name="pref_height_min" value={editData.pref_height_min as string} onChange={v => setEditData(p => ({ ...p, pref_height_min: v }))} />
                  <EditField label="Max Height" name="pref_height_max" value={editData.pref_height_max as string} onChange={v => setEditData(p => ({ ...p, pref_height_max: v }))} />
                  <EditField label="Preferred Religion" name="pref_religion" value={editData.pref_religion as string} onChange={v => setEditData(p => ({ ...p, pref_religion: v }))} />
                  <EditField label="Preferred Caste" name="pref_caste" value={editData.pref_caste as string} onChange={v => setEditData(p => ({ ...p, pref_caste: v }))} />
                  <EditField label="Preferred Location" name="pref_location" value={editData.pref_location as string} onChange={v => setEditData(p => ({ ...p, pref_location: v }))} />
                  <EditField label="Preferred Education" name="pref_education" value={editData.pref_education as string} onChange={v => setEditData(p => ({ ...p, pref_education: v }))} />
                  <EditField label="Preferred Occupation" name="pref_occupation" value={editData.pref_occupation as string} onChange={v => setEditData(p => ({ ...p, pref_occupation: v }))} />
                  <EditField label="Preferred Marital Status" name="pref_marital_status" value={editData.pref_marital_status as string} onChange={v => setEditData(p => ({ ...p, pref_marital_status: v }))} />
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Additional Expectations</label>
                  <textarea
                    value={editData.pref_about as string}
                    onChange={e => setEditData(p => ({ ...p, pref_about: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-rose-400 outline-none"
                    rows={4}
                    placeholder="Describe specific preferences or expectations..."
                  />
                </div>
              </div>

              {/* Account Flags */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  6. Account Settings & Verification
                </h3>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={!!editData.is_active} onChange={e => setEditData(p => ({ ...p, is_active: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                    Account Active
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={!!editData.is_premium} onChange={e => setEditData(p => ({ ...p, is_premium: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                    Premium Member
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={!!editData.is_mobile_verified} onChange={e => setEditData(p => ({ ...p, is_mobile_verified: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                    Mobile Verified
                  </label>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="admin-panel flex items-center justify-end gap-3 bg-slate-50">
                <button type="button" onClick={() => setEditing(false)} className="admin-btn flex items-center gap-2">
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button type="button" onClick={saveEdit} disabled={saving} className="admin-btn admin-btn-primary flex items-center gap-2">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header card for Profile tab */}
              <div className="admin-panel flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Member Profile Details</h2>
                  <p className="text-xs text-slate-500">Comprehensive profile, astrology, family, and partner preference data.</p>
                </div>
                {isSuperAdmin && (
                  <button onClick={startEdit} className="admin-btn admin-btn-primary flex items-center gap-2">
                    <Edit3 className="h-4 w-4" /> Edit Profile
                  </button>
                )}
              </div>

              {/* Personal & Lifestyle info */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-rose-500" /> Personal & Lifestyle Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="First Name" value={m.first_name as string} />
                  <InfoField label="Last Name" value={m.last_name as string} />
                  <InfoField label="Full Name" value={m.full_name as string} />
                  <InfoField label="Profile Created By" value={(m.profile_created_by as string) || 'Self'} />
                  <InfoField label="Gender" value={m.gender as string} />
                  <InfoField label="Date of Birth" value={m.date_of_birth as string} />
                  <InfoField label="Age" value={m.age ? `${m.age} yrs` : '—'} />
                  <InfoField label="Marital Status" value={m.marital_status as string} />
                  <InfoField label="Height" value={m.height as string} />
                  <InfoField label="Weight" value={m.weight as string} />
                  <InfoField label="Blood Group" value={m.blood_group as string} />
                  <InfoField label="Complexion" value={m.complexion as string} />
                  <InfoField label="Mother Tongue" value={m.mother_tongue as string} />
                  <InfoField label="Work Location / City" value={(m.work_location as string) || (m.city as string)} />
                  <InfoField label="Hobbies & Interests" value={Array.isArray(m.hobbies) ? m.hobbies.join(', ') : ((m.hobbies as string) || '—')} />
                </div>
                {(m.about as string) && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">About Me / Bio</label>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.about as string}</p>
                  </div>
                )}
              </div>

              {/* Religious & Astrology info */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> Religious & Astrological Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="Religion" value={m.religion as string} />
                  <InfoField label="Caste" value={m.caste as string} />
                  <InfoField label="Sub Caste" value={m.sub_caste as string} />
                  <InfoField label="Gothra" value={m.gothra as string} />
                  <InfoField label="Star / Nakshatra" value={m.star_nakshatra as string} />
                  <InfoField label="Manglik Status" value={m.manglik_status as string} />
                </div>
              </div>

              {/* Professional & Education info */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-rose-500" /> Career & Education Background
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="Highest Education" value={m.highest_education as string} />
                  <InfoField label="Education Detail" value={m.education_detail as string} />
                  <InfoField label="Occupation" value={m.occupation as string} />
                  <InfoField label="Employed In" value={m.employed_in as string} />
                  <InfoField label="Company" value={m.company as string} />
                  <InfoField label="Annual Income" value={m.annual_income as string} />
                  <InfoField label="Work Location" value={m.work_location as string} />
                </div>
              </div>

              {/* Family Details */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" /> Family Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="Father Status" value={m.father_status as string} />
                  <InfoField label="Mother Status" value={m.mother_status as string} />
                  <InfoField label="No. of Brothers" value={String(m.num_brothers ?? 0)} />
                  <InfoField label="No. of Sisters" value={String(m.num_sisters ?? 0)} />
                  <InfoField label="Family Type" value={m.family_type as string} />
                  <InfoField label="Family Status" value={m.family_status as string} />
                  <InfoField label="Family Location" value={m.family_location as string} />
                </div>
              </div>

              {/* Partner preferences */}
              <div className="admin-panel">
                <h3 className="mb-4 text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Partner Preferences
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="Preferred Age Range" value={`${m.pref_age_min || '—'} – ${m.pref_age_max || '—'} yrs`} />
                  <InfoField label="Preferred Height Range" value={`${m.pref_height_min || '—'} – ${m.pref_height_max || '—'}`} />
                  <InfoField label="Preferred Religion" value={m.pref_religion as string} />
                  <InfoField label="Preferred Caste" value={m.pref_caste as string} />
                  <InfoField label="Preferred Education" value={m.pref_education as string} />
                  <InfoField label="Preferred Occupation" value={m.pref_occupation as string} />
                  <InfoField label="Preferred Location" value={m.pref_location as string} />
                  <InfoField label="Preferred Marital Status" value={m.pref_marital_status as string} />
                </div>
                {(m.pref_about as string) && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Additional Expectations</label>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.pref_about as string}</p>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {activeTab === 'photos' && (
          <div className="admin-panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Member Photos</h2>
                <p className="text-xs text-slate-500">Click any photo to zoom in full resolution, inspect details, or pan.</p>
              </div>
              {photos.length > 0 && (
                <button
                  type="button"
                  onClick={() => openPhotoZoom(0)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> View Fullscreen
                </button>
              )}
            </div>
            {photos.length === 0 ? (
              <p className="text-sm text-slate-500">No photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo: any, index: number) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition hover:shadow-md">
                    <div
                      className="aspect-[4/5] bg-slate-100 cursor-zoom-in relative overflow-hidden group/img"
                      onClick={() => openPhotoZoom(index)}
                      title="Click anywhere to zoom photo"
                    >
                      <img
                        src={`/api/proxy/profile-photos/${photo.id}/thumbnail/`}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-md">
                          <Maximize2 className="h-3.5 w-3.5" /> Click to Zoom
                        </span>
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 flex flex-col gap-1 pointer-events-none">
                      {photo.is_primary && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white shadow-sm">Primary</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ${
                        photo.status === 'APPROVED' || photo.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        photo.status === 'REJECTED' || photo.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{photo.status}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex translate-y-full gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 transition-transform group-hover:translate-y-0">
                      {(photo.status === 'PENDING' || photo.status === 'pending') && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoAction({ photoId: photo.id, approve: true });
                            }}
                            className="flex-1 rounded bg-emerald-500 py-1 text-xs font-medium text-white hover:bg-emerald-600 shadow-sm"
                            title="Approve Photo"
                          >
                            <Check className="mx-auto h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoAction({ photoId: photo.id, approve: false });
                            }}
                            className="flex-1 rounded bg-red-500 py-1 text-xs font-medium text-white hover:bg-red-600 shadow-sm"
                            title="Reject Photo"
                          >
                            <X className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="admin-panel">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Member Documents</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{doc.document_type}</p>
                        <p className="text-xs text-slate-500">Uploaded: {formatAdminDate(doc.uploaded_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openDocLightbox(doc)}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-500" /> View
                      </button>

                      {/* Document Approval & Rejection buttons */}
                      {doc.status !== 'APPROVED' && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleApproveDocument(doc.id)}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                          title="Approve this document"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}

                      {doc.status !== 'REJECTED' && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => {
                            setRejectDocTarget({ id: doc.id, type: doc.document_type });
                            setDocRejectReason('');
                          }}
                          className="flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                          title="Reject this document"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}

                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        doc.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        doc.status === 'REJECTED' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>{doc.status}</span>

                      {doc.rejection_reason && (
                        <span className="text-xs text-rose-600 flex items-center gap-1 font-medium bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200" title={doc.rejection_reason}>
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          <span className="max-w-[200px] truncate">{doc.rejection_reason}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'verification' && (
          <div className="admin-panel">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Verification Requests</h2>
            {verifications.length === 0 ? (
              <p className="text-sm text-slate-500">No verification requests.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">{v.verification_type}</p>
                      <p className="text-xs text-slate-500">Submitted: {formatAdminDate(v.submitted_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        v.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        v.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        v.status === 'pending_review' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>{v.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'membership' && (
          <div className="admin-panel">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Membership Plans</h2>
            {memberships.length === 0 ? (
              <p className="text-sm text-slate-500">No membership plans purchased.</p>
            ) : (
              <div className="space-y-3">
                {memberships.map((ms: any) => (
                  <div key={ms.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">{ms.plan__name}</p>
                      <p className="text-xs text-slate-500">
                        {ms.start_date ? `${formatAdminDate(ms.start_date)} – ${ms.end_date ? formatAdminDate(ms.end_date) : 'No expiry'}` : 'No dates'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ms.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>{ms.is_active ? 'Active' : ms.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="admin-panel">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Admin Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Module</th>
                      <th className="pb-2 pr-4">Description</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a: any) => (
                      <tr key={a.id} className="border-b border-slate-100 text-sm">
                        <td className="py-2 pr-4 font-medium text-slate-900">{a.action}</td>
                        <td className="py-2 pr-4 text-slate-600">{a.module}</td>
                        <td className="py-2 pr-4 text-slate-600">{a.description || '—'}</td>
                        <td className="py-2 text-slate-500">{formatAdminDate(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {(hasAdminPermission('members.manage') || isSuper) && (
            <>
              {m.profile_status === 'approved' ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Profile approved
                </span>
              ) : (
                <>
                  <QuickActionBtn icon={CheckCircle2} label="Approve Profile" color="emerald" onClick={() => void performAction('approve_profile')} />
                  <QuickActionBtn icon={XCircle} label="Reject Profile" color="red" onClick={() => { setProfileReview({ action: 'reject_profile', label: 'Reject Profile' }); setProfileReviewReason(''); }} />
                  <QuickActionBtn icon={AlertTriangle} label="Request Changes" color="orange" onClick={() => { setProfileReview({ action: 'changes_requested', label: 'Request Changes' }); setProfileReviewReason(''); }} />
                </>
              )}
              <QuickActionBtn icon={CheckCircle2} label="Verify Contacts" color="rose" onClick={() => setConfirmAction({ user: memberId, action: 'verify', label: 'Verify Contacts', description: 'Mark email and mobile as verified?', dangerous: false })} />
            </>
          )}
          {(hasAdminPermission('members.suspend') || isSuper) && (
            m.is_active
              ? <QuickActionBtn icon={Ban} label="Suspend" color="orange" onClick={() => setConfirmAction({ user: memberId, action: 'deactivate', label: 'Suspend Member', description: 'Deactivate this member account?', dangerous: true })} />
              : <QuickActionBtn icon={Check} label="Activate" color="emerald" onClick={() => setConfirmAction({ user: memberId, action: 'activate', label: 'Activate Member', description: 'Reactivate this member account?', dangerous: false })} />
          )}
          {(hasAdminPermission('members.manage') || isSuper) && (
            <QuickActionBtn icon={CreditCard} label="Grant Membership Plan" color="purple" onClick={() => void openGrantMembershipModal()} />
          )}
          {(hasAdminPermission('members.delete') || isSuper) && (
            m.is_deleted || m.deleted_at ? (
              <QuickActionBtn icon={RotateCcw} label="Recover Account" color="emerald" onClick={() => setConfirmAction({ user: memberId, action: 'restore', label: 'Recover Member Account', description: 'Recover this account within its 30-day recovery window?', dangerous: false })} />
            ) : (
              <QuickActionBtn icon={Trash2} label="Delete" color="red" onClick={() => setConfirmAction({ user: memberId, action: 'delete', label: 'Delete Member', description: 'This hides the member immediately and starts the 30-day recovery window.', dangerous: true })} />
            )
          )}
        </div>
      </div>

      {/* Grant Membership Plan Modal */}
      {showGrantModal && (
        <ClientPortal>
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setShowGrantModal(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Grant Membership Plan</h3>
                  <p className="text-xs text-slate-500">Assign a paid plan to {m?.full_name as string || 'member'} without payment.</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Membership Plan</label>
                  <select
                    value={selectedPlanSlug}
                    onChange={e => setSelectedPlanSlug(e.target.value)}
                    disabled={plansLoading || !grantablePlans.length}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-purple-500 outline-none"
                  >
                    {plansLoading && <option>Loading plans…</option>}
                    {!plansLoading && !grantablePlans.length && <option>No active membership plans available</option>}
                    {grantablePlans.map((plan) => (
                      <option key={plan.id} value={plan.slug}>{plan.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Duration</label>
                  <select
                    value={selectedDurationMonths}
                    onChange={e => setSelectedDurationMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-purple-500 outline-none"
                  >
                    <option value={1}>1 Month (Trial / Short)</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>1 Year (12 Months)</option>
                    <option value={24}>2 Years (24 Months)</option>
                    <option value={36}>3 Years (36 Months)</option>
                  </select>
                </div>

                <div className="p-3 bg-purple-50/70 rounded-xl text-xs text-purple-900 font-medium border border-purple-100 flex items-start gap-2">
                  <span className="text-purple-600 font-bold">✓</span>
                  <span>Bypasses payment gate. Grants immediate premium entitlements to the member.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionBusy || plansLoading || !selectedPlanSlug}
                  onClick={async () => {
                    if (!selectedPlanSlug) {
                      setToast({ message: 'Select an active membership plan before granting it.', tone: 'error' });
                      return;
                    }
                    setActionBusy(true);
                    try {
                      const res = await fetchApi<{ message: string }>(`/admin/users/${memberId}/grant-membership/`, {
                        method: 'POST',
                        body: JSON.stringify({ plan_slug: selectedPlanSlug, duration_months: selectedDurationMonths }),
                      });
                      setToast({ message: res.message || 'Membership plan granted successfully!', tone: 'success' });
                      setShowGrantModal(false);
                      await load();
                    } catch (e: any) {
                      setToast({ message: e.message || 'Failed to grant plan.', tone: 'error' });
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Confirm & Grant Plan
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Photo approve/reject modal */}
      {photoAction && (() => {
        const targetPhoto = photos.find((p: any) => p.id === photoAction.photoId);
        const PHOTO_REJECT_PRESETS = [
          'Blurry or low resolution',
          'Group photo / not individual',
          'Face obscured or not clear',
          'Inappropriate or offensive',
          'Watermark or text overlay',
          'Celebrity or fake photo',
        ];

        return (
          <ClientPortal>
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
              onClick={() => { setPhotoAction(null); setRejectionReason(''); }}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      photoAction.approve ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {photoAction.approve ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {photoAction.approve ? 'Approve Member Photo' : 'Reject Member Photo'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {photoAction.approve
                          ? 'Verify and publish this photo to the member profile'
                          : 'Provide feedback so the member can upload a suitable replacement'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPhotoAction(null); setRejectionReason(''); }}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Photo Preview & Details */}
                <div className="flex items-start gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-28 w-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200 relative shadow-xs">
                    <img
                      src={`/api/proxy/profile-photos/${photoAction.photoId}/thumbnail/`}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {Boolean(targetPhoto?.is_primary) && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {m?.full_name as string || 'Member'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ID: <span className="font-mono text-slate-500">{String(photoAction.photoId).slice(0, 10)}…</span>
                      </p>
                    </div>
                    {photoAction.approve ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-100 text-[11px] text-emerald-800 leading-relaxed font-medium">
                        ✓ Once approved, this photo will be live and visible to matched members across the platform.
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-rose-50/80 border border-rose-100 text-[11px] text-rose-800 leading-relaxed font-medium">
                        The photo will be rejected and removed from pending reviews. The feedback below will be shown to the member.
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejection Form with Presets */}
                {!photoAction.approve && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quick Reason Tags:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PHOTO_REJECT_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRejectionReason(preset)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                              rejectionReason === preset
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
                        onChange={e => setRejectionReason(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none min-h-[75px]"
                        placeholder="Required: explain why this photo was rejected..."
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setPhotoAction(null); setRejectionReason(''); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={performPhotoAction}
                    disabled={actionBusy || (!photoAction.approve && !rejectionReason.trim())}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-white ${
                      photoAction.approve ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    {photoAction.approve ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {photoAction.approve ? 'Approve Photo' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          </ClientPortal>
        );
      })()}

      {/* Profile review (reject / request changes) reason modal */}
      {profileReview && (() => {
        const isReject = profileReview.action === 'reject_profile';
        const REVIEW_PRESETS = isReject
          ? [
              'Inappropriate or offensive content',
              'Fake or unverifiable profile',
              'Commercial or promotional account',
              'Duplicate profile account',
              'Violates community terms of service',
            ]
          : [
              'Upload a clear, recent profile photo',
              'Complete "About Me" bio & hobbies',
              'Fill in career & education details',
              'Provide valid family background',
              'Specify partner preference criteria',
            ];

        return (
          <ClientPortal>
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
              onClick={() => { setProfileReview(null); setProfileReviewReason(''); }}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      isReject ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {isReject ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{profileReview.label}</h3>
                      <p className="text-xs text-slate-500">
                        {isReject
                          ? 'Enter a rejection reason. The member will see this feedback.'
                          : 'Explain what changes the member must make before approval.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setProfileReview(null); setProfileReviewReason(''); }}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Member Preview Strip */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500">Member: </span>
                    <strong className="text-slate-900">{m?.full_name as string || 'Unnamed'}</strong>
                    <span className="text-slate-400 ml-1.5">({m?.email as string})</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    ID: {memberId.slice(0, 8)}…
                  </span>
                </div>

                {/* Preset Suggestions */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quick Suggestions:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {REVIEW_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setProfileReviewReason(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                          profileReviewReason === preset
                            ? isReject
                              ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                              : 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Detailed Reason / Instructions <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={profileReviewReason}
                    onChange={e => setProfileReviewReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[90px]"
                    placeholder={
                      isReject
                        ? 'Explain why this profile is rejected...'
                        : 'Describe what the member needs to update before approval...'
                    }
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setProfileReview(null); setProfileReviewReason(''); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void performProfileReview()}
                    disabled={!profileReviewReason.trim() || actionBusy}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-white ${
                      isReject ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    {isReject ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {isReject ? 'Confirm Rejection' : 'Send Change Request'}
                  </button>
                </div>
              </div>
            </div>
          </ClientPortal>
        );
      })()}

      {/* Confirm dialogs */}
      {confirmAction && (
        <AdminConfirmDialog
          open={true}
          title={confirmAction.label}
          description={confirmAction.description}
          confirmLabel={confirmAction.label}
          dangerous={confirmAction.dangerous}
          busy={actionBusy}
          onConfirm={() => performAction(confirmAction.action)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Document Rejection Modal */}
      {rejectDocTarget && (() => {
        const DOC_REJECT_PRESETS = [
          'Document is expired or outdated',
          'Blurry, dark, or illegible text',
          'Name or DOB does not match profile',
          'Document edges are cropped or incomplete',
          'Invalid or unacceptable document type',
        ];

        return (
          <ClientPortal>
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
              onClick={() => setRejectDocTarget(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Reject Document</h3>
                      <p className="text-xs text-slate-500">{rejectDocTarget.type} verification</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRejectDocTarget(null)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quick Reason Tags:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DOC_REJECT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDocRejectReason(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                          docRejectReason === preset
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
                    Rejection Reason <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    value={docRejectReason}
                    onChange={e => setDocRejectReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none min-h-[85px]"
                    placeholder="Explain why this document is rejected..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRejectDocTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || !docRejectReason.trim()}
                    onClick={handleRejectDocumentConfirm}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-white bg-rose-600 hover:bg-rose-700"
                  >
                    {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          </ClientPortal>
        );
      })()}

      {/* Clean Missing Requirements Modal */}
      {missingReqModal && (() => {
        const pendingDoc = documents.find((d: any) => d.status === 'PENDING' || d.status === 'pending') as any;
        const pendingPhoto = photos.find((p: any) => p.status === 'PENDING' || p.status === 'pending') as any;
        const bioText = String(m?.about_me || (m as any)?.profile?.about || '').trim();
        const hasBio = bioText.length > 5;

        return (
          <ClientPortal>
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-in fade-in duration-150"
              onClick={() => setMissingReqModal(null)}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Profile Approval Requirements</h3>
                      <p className="text-xs text-slate-500">Items requiring verification before approval</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMissingReqModal(null)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  To maintain platform trust, standard approval requires an approved document, approved photo, and completed bio. You can resolve these directly below:
                </p>

                {/* Requirements Checklist Card */}
                <div className="space-y-2 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                  {/* Document Requirement */}
                  {pendingDoc ? (
                    <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{pendingDoc.document_type} Document</p>
                          <p className="text-[11px] text-amber-700 font-medium">Status: Pending Verification</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleApproveDocument(pendingDoc.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1"
                        title="Approve this document and immediately approve the member profile"
                      >
                        {actionBusy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Approve & Finish
                      </button>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>No identity document uploaded by member.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Document is approved.</span>
                    </div>
                  )}

                  {/* Photo Requirement */}
                  {pendingPhoto ? (
                    <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Camera className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">Profile Photo</p>
                          <p className="text-[11px] text-amber-700 font-medium">Status: Pending Review</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={async () => {
                          setActionBusy(true);
                          try {
                            await fetchApi(`/admin/profile-photos/${pendingPhoto.id}/approve/`, { method: 'POST' });
                            setToast({ message: 'Photo approved.', tone: 'success' });
                            await load();
                            await performAction('approve_profile');
                          } catch {
                            setToast({ message: 'Failed to approve photo.', tone: 'error' });
                          } finally {
                            setActionBusy(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        Approve & Finish
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Photo is approved.</span>
                    </div>
                  )}

                  {/* Bio Requirement */}
                  {!hasBio ? (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200 text-xs text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Member bio is empty or incomplete (fewer than 5 characters).</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-emerald-200 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Member bio is present.</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setMissingReqModal(null);
                      setActiveTab('documents');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
                  >
                    <FileText className="h-3.5 w-3.5" /> Go to Documents Tab
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMissingReqModal(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Close
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => performAction('approve_profile', true)}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                      >
                        {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
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
      {docLightboxOpen && (
        <AdminDocumentLightbox
          isOpen={docLightboxOpen}
          documents={docLightboxDocs}
          currentIndex={docLightboxIndex}
          onClose={() => setDocLightboxOpen(false)}
          onIndexChange={(idx) => setDocLightboxIndex(idx)}
          onApprove={async (docId) => {
            await handleApproveDocument(docId);
            // refresh lightbox statuses
            setDocLightboxDocs((prev) =>
              prev.map((d) => d.id === docId ? { ...d, status: 'APPROVED' } : d)
            );
          }}
          onReject={(docId) => {
            const doc = documents.find((d: any) => d.id === docId) as any;
            setRejectDocTarget({ id: docId, type: doc?.document_type || 'Document' });
            setDocRejectReason('');
            setDocLightboxOpen(false);
          }}
          isActionBusy={actionBusy}
        />
      )}
      <AdminPhotoLightbox
        isOpen={lightboxIndex !== null}
        photos={lightboxPhotos}
        currentIndex={lightboxIndex ?? 0}
        memberName={(m?.full_name as string) || 'Member'}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(idx) => setLightboxIndex(idx)}
        onApprove={(photoId) => {
          setPhotoAction({ photoId, approve: true });
        }}
        onReject={(photoId) => {
          setPhotoAction({ photoId, approve: false });
        }}
        isActionBusy={actionBusy}
      />
    </div>
  );
}

function InfoField({ label, value, verified }: { label: string; value?: string | number | null; verified?: boolean }) {
  const displayVal = value !== undefined && value !== null && value !== '' ? String(value) : '—';
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-500">{label}</label>
      <div className="flex items-center gap-1.5 text-sm text-slate-800 font-medium">
        <span>{displayVal}</span>
        {verified !== undefined && (verified ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />)}
      </div>
    </div>
  );
}

function VerificationCard({ label, status }: { label: string; status: string }) {
  const colorMap: Record<string, string> = {
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
    pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
    not_started: 'border-slate-200 bg-slate-50 text-slate-500',
    changes_requested: 'border-orange-200 bg-orange-50 text-orange-700',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[status] || 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-semibold">{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
    </div>
  );
}

function EditField({
  label, name, value, type = 'text', options, onChange
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  options?: Array<{ value: string; label: string }> | string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={`edit-${name}`} className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      {type === 'textarea' ? (
        <textarea id={`edit-${name}`} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-rose-400 outline-none" rows={3} />
      ) : type === 'select' && options ? (
        <select
          id={`edit-${name}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-white focus:border-rose-400 outline-none"
        >
          <option value="">Select {label}</option>
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      ) : (
        <input id={`edit-${name}`} type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 outline-none" />
      )}
    </div>
  );
}

function QuickActionBtn({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  const colorClasses: Record<string, string> = {
    emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    red: 'border-red-200 text-red-700 hover:bg-red-50',
    blue: 'border-rose-200 text-rose-700 hover:bg-rose-50',
    orange: 'border-orange-200 text-orange-700 hover:bg-orange-50',
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${colorClasses[color] || 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
