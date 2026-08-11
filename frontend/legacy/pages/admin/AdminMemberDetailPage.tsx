'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@/lib/router-compat';
import {
  ArrowLeft, BadgeCheck, Ban, Camera, CreditCard, Edit3, FileText,
  Heart, Info, LoaderCircle, Mail, MapPin, Phone, Shield, User,
  CheckCircle2, XCircle, Clock, AlertTriangle, Star, Trash2,
  Check, X, Save, Eye, ShieldCheck, RotateCcw,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { fetchApi } from '../../services/apiClient';
import ProtectedDocumentViewer from '@/components/documents/ProtectedDocumentViewer';
import { getAdminUsers, updateAdminUser, type AdminUserAction } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime, type RealtimeEvent } from '@/providers/RealtimeProvider';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge, AdminToast,
  formatAdminDate,
} from '../../components/admin/AdminUI';

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

export default function AdminMemberDetailPage({ memberId }: { memberId: string }) {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const navigate = useNavigate();
  const isSuper = typeof window !== 'undefined' && window.location.pathname.startsWith('/super-admin');
  const basePath = isSuper ? '/super-admin/members' : '/admin/members';

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
  const [viewDoc, setViewDoc] = useState<{ id: string; type: string } | null>(null);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{ user: string; action: string; label: string; description: string; dangerous: boolean } | null>(null);

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

  const startEdit = () => {
    if (!m) return;
    setEditData({
      first_name: m.first_name || '',
      last_name: m.last_name || '',
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
      hobbies: m.hobbies || '',
      is_active: m.is_active ?? true,
      is_premium: m.is_premium ?? false,
      is_email_verified: m.is_email_verified ?? false,
      is_mobile_verified: m.is_mobile_verified ?? false,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const result = await fetchApi<any>(`/admin/users/${memberId}/`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });
      setDetail(prev => prev ? { ...prev, member: result } : prev);
      setToast({ message: 'Member updated successfully.', tone: 'success' });
      setEditing(false);
    } catch {
      setToast({ message: 'Failed to update member.', tone: 'error' });
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

  const performAction = async (action: string) => {
    setActionBusy(true);
    try {
      await updateAdminUser(memberId, action as AdminUserAction);
      setToast({ message: 'Action completed.', tone: 'success' });
      setConfirmAction(null);
      load();
    } catch {
      setToast({ message: 'Action failed.', tone: 'error' });
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
          <Link to="../members" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Members
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {(hasAdminPermission('members.manage') || isSuper) && (
            <button onClick={startEdit} className="admin-btn admin-btn-primary flex items-center gap-2">
              <Edit3 className="h-4 w-4" /> Edit Member
            </button>
          )}
        </div>
      </div>

      {/* Member header card */}
      <div className="admin-panel mb-6">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
            {m.photo ? (
              <img src={m.photo as string} alt="" className="h-full w-full object-cover" />
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
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Account Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Full Name" value={m.full_name as string} />
                <InfoField label="Email" value={m.email as string} verified={m.is_email_verified as boolean} />
                <InfoField label="Mobile" value={m.mobile_number as string} verified={m.is_mobile_verified as boolean} />
                <InfoField label="Account Type" value="Member" />
                <InfoField label="Joined" value={formatAdminDate(m.created_at as string)} />
                <InfoField label="Last Login" value={formatAdminDate(m.last_login as string)} />
                <InfoField label="Account Status" value={(m.is_active as boolean) ? 'Active' : 'Inactive'} />
                <InfoField label="Premium" value={(m.is_premium as boolean) ? 'Yes' : 'No'} />
              </div>
            </div>

            {/* Personal info */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Personal Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Gender" value={m.gender as string} />
                <InfoField label="Date of Birth" value={m.date_of_birth as string} />
                <InfoField label="Marital Status" value={m.marital_status as string} />
                <InfoField label="Height" value={m.height as string} />
                <InfoField label="Weight" value={m.weight as string} />
                <InfoField label="Blood Group" value={m.blood_group as string} />
                <InfoField label="Complexion" value={m.complexion as string} />
                <InfoField label="Mother Tongue" value={m.mother_tongue as string} />
                <InfoField label="Work Location" value={m.work_location as string} />
              </div>
              {(m.about as string) && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-500">About</label>
                  <p className="text-sm text-slate-700">{m.about as string}</p>
                </div>
              )}
            </div>

            {/* Religious info */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Religious Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Religion" value={m.religion as string} />
                <InfoField label="Caste" value={m.caste as string} />
                <InfoField label="Sub Caste" value={m.sub_caste as string} />
                <InfoField label="Gothra" value={m.gothra as string} />
                <InfoField label="Manglik" value={m.manglik_status as string} />
              </div>
            </div>

            {/* Professional info */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Professional Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Education" value={m.highest_education as string} />
                <InfoField label="Occupation" value={m.occupation as string} />
                <InfoField label="Employed In" value={m.employed_in as string} />
                <InfoField label="Company" value={m.company as string} />
                <InfoField label="Annual Income" value={m.annual_income as string} />
                <InfoField label="Work Location" value={m.work_location as string} />
              </div>
            </div>

            {/* Partner preferences */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Partner Preferences</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Age Range" value={`${m.pref_age_min || '—'} – ${m.pref_age_max || '—'}`} />
                <InfoField label="Height Range" value={`${m.pref_height_min || '—'} – ${m.pref_height_max || '—'}`} />
                <InfoField label="Religion" value={m.pref_religion as string} />
                <InfoField label="Caste" value={m.pref_caste as string} />
                <InfoField label="Education" value={m.pref_education as string} />
                <InfoField label="Occupation" value={m.pref_occupation as string} />
                <InfoField label="Location" value={m.pref_location as string} />
                <InfoField label="Marital Status" value={m.pref_marital_status as string} />
              </div>
              {(m.pref_about as string) && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Additional Expectations</label>
                  <p className="text-sm text-slate-700">{m.pref_about as string}</p>
                </div>
              )}
            </div>

            {/* Verification overview */}
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Verification Overview</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <VerificationCard label="Profile" status={m.profile_status as string} />
                <VerificationCard label="Photo" status={m.photo_status as string} />
                <VerificationCard label="Document" status={m.document_status as string} />
                <VerificationCard label="Email" status={(m.is_email_verified as boolean) ? 'approved' : 'not_started'} />
                <VerificationCard label="Mobile" status={(m.is_mobile_verified as boolean) ? 'approved' : 'not_started'} />
                <VerificationCard label="Overall" status={(m.is_fully_verified as boolean) ? 'approved' : 'pending_review'} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          editing ? (
            <div className="admin-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Member Profile</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(false)} className="admin-btn flex items-center gap-2">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving} className="admin-btn admin-btn-primary flex items-center gap-2">
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <EditField label="First Name" name="first_name" value={editData.first_name as string} onChange={v => setEditData(p => ({ ...p, first_name: v }))} />
                <EditField label="Last Name" name="last_name" value={editData.last_name as string} onChange={v => setEditData(p => ({ ...p, last_name: v }))} />
                <EditField label="Gender" name="gender" value={editData.gender as string} onChange={v => setEditData(p => ({ ...p, gender: v }))} />
                <EditField label="Date of Birth" name="date_of_birth" type="date" value={editData.date_of_birth as string} onChange={v => setEditData(p => ({ ...p, date_of_birth: v }))} />
                <EditField label="Marital Status" name="marital_status" value={editData.marital_status as string} onChange={v => setEditData(p => ({ ...p, marital_status: v }))} />
                <EditField label="Height" name="height" value={editData.height as string} onChange={v => setEditData(p => ({ ...p, height: v }))} />
                <EditField label="Weight" name="weight" value={editData.weight as string} onChange={v => setEditData(p => ({ ...p, weight: v }))} />
                <EditField label="Blood Group" name="blood_group" value={editData.blood_group as string} onChange={v => setEditData(p => ({ ...p, blood_group: v }))} />
                <EditField label="Complexion" name="complexion" value={editData.complexion as string} onChange={v => setEditData(p => ({ ...p, complexion: v }))} />
                <EditField label="Religion" name="religion" value={editData.religion as string} onChange={v => setEditData(p => ({ ...p, religion: v }))} />
                <EditField label="Mother Tongue" name="mother_tongue" value={editData.mother_tongue as string} onChange={v => setEditData(p => ({ ...p, mother_tongue: v }))} />
                <EditField label="Caste" name="caste" value={editData.caste as string} onChange={v => setEditData(p => ({ ...p, caste: v }))} />
                <EditField label="Sub Caste" name="sub_caste" value={editData.sub_caste as string} onChange={v => setEditData(p => ({ ...p, sub_caste: v }))} />
                <EditField label="Gothra" name="gothra" value={editData.gothra as string} onChange={v => setEditData(p => ({ ...p, gothra: v }))} />
                <EditField label="Star Nakshatra" name="star_nakshatra" value={editData.star_nakshatra as string} onChange={v => setEditData(p => ({ ...p, star_nakshatra: v }))} />
                <EditField label="Manglik Status" name="manglik_status" value={editData.manglik_status as string} onChange={v => setEditData(p => ({ ...p, manglik_status: v }))} />
                <EditField label="Highest Education" name="highest_education" value={editData.highest_education as string} onChange={v => setEditData(p => ({ ...p, highest_education: v }))} />
                <EditField label="Education Detail" name="education_detail" value={editData.education_detail as string} onChange={v => setEditData(p => ({ ...p, education_detail: v }))} />
                <EditField label="Occupation" name="occupation" value={editData.occupation as string} onChange={v => setEditData(p => ({ ...p, occupation: v }))} />
                <EditField label="Employed In" name="employed_in" value={editData.employed_in as string} onChange={v => setEditData(p => ({ ...p, employed_in: v }))} />
                <EditField label="Company" name="company" value={editData.company as string} onChange={v => setEditData(p => ({ ...p, company: v }))} />
                <EditField label="Annual Income" name="annual_income" value={editData.annual_income as string} onChange={v => setEditData(p => ({ ...p, annual_income: v }))} />
                <EditField label="Work Location" name="work_location" value={editData.work_location as string} onChange={v => setEditData(p => ({ ...p, work_location: v }))} />
                <EditField label="Father Status" name="father_status" value={editData.father_status as string} onChange={v => setEditData(p => ({ ...p, father_status: v }))} />
                <EditField label="Mother Status" name="mother_status" value={editData.mother_status as string} onChange={v => setEditData(p => ({ ...p, mother_status: v }))} />
                <EditField label="No. of Brothers" name="num_brothers" type="number" value={String(editData.num_brothers ?? 0)} onChange={v => setEditData(p => ({ ...p, num_brothers: Number(v) }))} />
                <EditField label="No. of Sisters" name="num_sisters" type="number" value={String(editData.num_sisters ?? 0)} onChange={v => setEditData(p => ({ ...p, num_sisters: Number(v) }))} />
                <EditField label="Family Type" name="family_type" value={editData.family_type as string} onChange={v => setEditData(p => ({ ...p, family_type: v }))} />
                <EditField label="Family Status" name="family_status" value={editData.family_status as string} onChange={v => setEditData(p => ({ ...p, family_status: v }))} />
                <EditField label="Family Location" name="family_location" value={editData.family_location as string} onChange={v => setEditData(p => ({ ...p, family_location: v }))} />
              </div>
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Partner Preferences</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <EditField label="Min Age" name="pref_age_min" type="number" value={String(editData.pref_age_min ?? '')} onChange={v => setEditData(p => ({ ...p, pref_age_min: v }))} />
                  <EditField label="Max Age" name="pref_age_max" type="number" value={String(editData.pref_age_max ?? '')} onChange={v => setEditData(p => ({ ...p, pref_age_max: v }))} />
                  <EditField label="Min Height" name="pref_height_min" value={editData.pref_height_min as string} onChange={v => setEditData(p => ({ ...p, pref_height_min: v }))} />
                  <EditField label="Max Height" name="pref_height_max" value={editData.pref_height_max as string} onChange={v => setEditData(p => ({ ...p, pref_height_max: v }))} />
                  <EditField label="Religion" name="pref_religion" value={editData.pref_religion as string} onChange={v => setEditData(p => ({ ...p, pref_religion: v }))} />
                  <EditField label="Caste" name="pref_caste" value={editData.pref_caste as string} onChange={v => setEditData(p => ({ ...p, pref_caste: v }))} />
                  <EditField label="Location" name="pref_location" value={editData.pref_location as string} onChange={v => setEditData(p => ({ ...p, pref_location: v }))} />
                  <EditField label="Education" name="pref_education" value={editData.pref_education as string} onChange={v => setEditData(p => ({ ...p, pref_education: v }))} />
                  <EditField label="Occupation" name="pref_occupation" value={editData.pref_occupation as string} onChange={v => setEditData(p => ({ ...p, pref_occupation: v }))} />
                  <EditField label="Marital Status" name="pref_marital_status" value={editData.pref_marital_status as string} onChange={v => setEditData(p => ({ ...p, pref_marital_status: v }))} />
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Additional Expectations</label>
                  <textarea
                    value={editData.pref_about as string}
                    onChange={e => setEditData(p => ({ ...p, pref_about: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    rows={4}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-500">About</label>
                <textarea
                  value={editData.about as string}
                  onChange={e => setEditData(p => ({ ...p, about: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  rows={4}
                />
              </div>
              {/* Account flags */}
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Account Settings</h3>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editData.is_active} onChange={e => setEditData(p => ({ ...p, is_active: e.target.checked }))} className="rounded border-slate-300" />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editData.is_premium} onChange={e => setEditData(p => ({ ...p, is_premium: e.target.checked }))} className="rounded border-slate-300" />
                    Premium
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editData.is_email_verified} onChange={e => setEditData(p => ({ ...p, is_email_verified: e.target.checked }))} className="rounded border-slate-300" />
                    Email Verified
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editData.is_mobile_verified} onChange={e => setEditData(p => ({ ...p, is_mobile_verified: e.target.checked }))} className="rounded border-slate-300" />
                    Mobile Verified
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-panel">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile Fields</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="First Name" value={m.first_name as string} />
                <InfoField label="Last Name" value={m.last_name as string} />
                <InfoField label="Gender" value={m.gender as string} />
                <InfoField label="Date of Birth" value={m.date_of_birth as string} />
                <InfoField label="Marital Status" value={m.marital_status as string} />
                <InfoField label="Height" value={m.height as string} />
                <InfoField label="Weight" value={m.weight as string} />
                <InfoField label="Religion" value={m.religion as string} />
                <InfoField label="Mother Tongue" value={m.mother_tongue as string} />
                <InfoField label="Caste" value={m.caste as string} />
                <InfoField label="Sub Caste" value={m.sub_caste as string} />
                <InfoField label="Gothra" value={m.gothra as string} />
                <InfoField label="Manglik" value={m.manglik_status as string} />
                <InfoField label="Education" value={m.highest_education as string} />
                <InfoField label="Education Detail" value={m.education_detail as string} />
                <InfoField label="Occupation" value={m.occupation as string} />
                <InfoField label="Employed In" value={m.employed_in as string} />
                <InfoField label="Company" value={m.company as string} />
                <InfoField label="Annual Income" value={m.annual_income as string} />
                <InfoField label="Work Location" value={m.work_location as string} />
              </div>
              {(m.about as string) && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-500">About</label>
                  <p className="text-sm text-slate-700">{m.about as string}</p>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'photos' && (
          <div className="admin-panel">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Member Photos</h2>
            {photos.length === 0 ? (
              <p className="text-sm text-slate-500">No photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <div className="aspect-[4/5] bg-slate-100">
                      <img
                        src={`/api/proxy/profile-photos/${photo.id}/thumbnail/`}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="absolute right-2 top-2 flex flex-col gap-1">
                      {photo.is_primary && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white">Primary</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        photo.status === 'APPROVED' || photo.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        photo.status === 'REJECTED' || photo.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{photo.status}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex translate-y-full gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 transition-transform group-hover:translate-y-0">
                      {(photo.status === 'PENDING' || photo.status === 'pending') && (
                        <>
                          <button onClick={() => setPhotoAction({ photoId: photo.id, approve: true })} className="flex-1 rounded bg-emerald-500 py-1 text-xs font-medium text-white hover:bg-emerald-600">
                            <Check className="mx-auto h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setPhotoAction({ photoId: photo.id, approve: false })} className="flex-1 rounded bg-red-500 py-1 text-xs font-medium text-white hover:bg-red-600">
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
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setViewDoc({ id: doc.id, type: doc.document_type })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        doc.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{doc.status}</span>
                      {doc.rejection_reason && (
                        <span className="text-xs text-red-600" title={doc.rejection_reason}>
                          <AlertTriangle className="h-4 w-4" />
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
                  <QuickActionBtn icon={XCircle} label="Reject Profile" color="red" onClick={() => setConfirmAction({ user: memberId, action: 'reject_profile', label: 'Reject Profile', description: 'Enter a rejection reason and reject this profile?', dangerous: false })} />
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
              <QuickActionBtn icon={RotateCcw} label="Restore Profile" color="emerald" onClick={() => setConfirmAction({ user: memberId, action: 'restore', label: 'Restore Member Profile', description: 'Restore this soft-deleted member profile to active status?', dangerous: false })} />
            ) : (
              <QuickActionBtn icon={Trash2} label="Soft Delete" color="red" onClick={() => setConfirmAction({ user: memberId, action: 'soft_delete', label: 'Soft Delete Member', description: 'This hides the member profile without permanent deletion.', dangerous: true })} />
            )
          )}
        </div>
      </div>

      {/* Grant Membership Plan Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGrantModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Grant Membership Plan</h3>
                <p className="text-xs text-slate-500">Assign a paid plan to {m.full_name as string} without payment.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Membership Plan</label>
                <select
                  value={selectedPlanSlug}
                  onChange={e => setSelectedPlanSlug(e.target.value)}
                  disabled={plansLoading || !grantablePlans.length}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-purple-500 outline-none"
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-purple-500 outline-none"
                >
                  <option value={1}>1 Month (Trial / Short)</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>1 Year (12 Months)</option>
                  <option value={24}>2 Years (24 Months)</option>
                  <option value={36}>3 Years (36 Months)</option>
                </select>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl text-xs text-purple-900 font-medium border border-purple-100">
                ✓ Bypasses payment gate. Grants immediate premium entitlements to the member.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowGrantModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                >
                  Confirm & Grant Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo approve/reject modal */}
      {photoAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setPhotoAction(null); setRejectionReason(''); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {photoAction.approve ? 'Approve Photo' : 'Reject Photo'}
            </h3>
            {!photoAction.approve && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  rows={3}
                  placeholder="Required: explain why this photo is rejected"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setPhotoAction(null); setRejectionReason(''); }} className="admin-btn">Cancel</button>
              <button onClick={performPhotoAction} disabled={actionBusy} className={`admin-btn ${photoAction.approve ? 'admin-btn-primary' : 'admin-btn-danger'} flex items-center gap-2`}>
                {actionBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {photoAction.approve ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      {viewDoc && (
        <ProtectedDocumentViewer
          documentId={viewDoc.id}
          documentType={viewDoc.type}
          namespace="admin"
          onClose={() => setViewDoc(null)}
        />
      )}
    </div>
  );
}

function InfoField({ label, value, verified }: { label: string; value?: string; verified?: boolean }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-500">{label}</label>
      <p className="flex items-center gap-1.5 text-sm text-slate-800">
        {value || '—'}
        {verified !== undefined && (verified ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />)}
      </p>
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

function EditField({ label, name, value, type = 'text', onChange }: { label: string; name: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={`edit-${name}`} className="mb-0.5 block text-xs font-medium text-slate-500">{label}</label>
      {type === 'textarea' ? (
        <textarea id={`edit-${name}`} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={3} />
      ) : (
        <input id={`edit-${name}`} type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
