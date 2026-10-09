'use client';

import SmartImage from '@/components/shared/smart-image';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useMatch, useNavigate } from '@/lib/router-compat';
import {
  CheckCircle2, Filter, LoaderCircle, MoreHorizontal, RefreshCw, Search, ShieldOff,
  Trash2, UserCheck, UserX, X, ShieldAlert, BadgeInfo, CreditCard, Clock, Check, AlertTriangle,
  Users, Camera, FileText, Shield, Ban, ChevronDown, ShieldCheck, RotateCcw,
  Crown, Gem, Award
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAdminUsers, updateAdminUser, grantAdminUserMembership, type AdminUser, type AdminUserAction,
} from '../../services/adminService';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminPageHeader, AdminPagination, AdminPanel, AdminStatusBadge, AdminToast,
  formatAdminDate,
} from '../../components/admin/AdminUI';
import AdminMemberDetailPage from './AdminMemberDetailPage';

interface PendingAction {
  user: AdminUser;
  action: AdminUserAction;
  label: string;
  description: string;
  dangerous: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active Members' },
  { value: 'suspended', label: 'Suspended Members' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'deleted', label: 'Soft Deleted (Trash)' },
];

const MEMBERSHIP_FILTER_OPTIONS = [
  { value: '', label: 'All Memberships' },
  { value: 'gold', label: 'Gold' },
  { value: 'premium', label: 'Premium' },
  { value: 'elite', label: 'Elite' },
  { value: 'free', label: 'Free' },
];

export default function AdminUsersPage() {
  const { user: currentUser, hasAdminPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isSuper = typeof window !== 'undefined' && window.location.pathname.startsWith('/super-admin');
  const basePath = isSuper ? '/super-admin/members' : '/admin/members';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [membershipFilter, setMembershipFilter] = useState(searchParams.get('plan') || searchParams.get('membership') || '');
  const [gender, setGender] = useState(searchParams.get('gender') || '');
  const [verified, setVerified] = useState(searchParams.get('verified') || '');
  const [period, setPeriod] = useState(searchParams.get('period') || '');
  const [ordering, setOrdering] = useState(searchParams.get('ordering') || '-date_joined');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Grant Membership modal state
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantPlanSlug, setGrantPlanSlug] = useState('gold');
  const [grantMonths, setGrantMonths] = useState(12);
  const [grantBusy, setGrantBusy] = useState(false);

  // Sync state when URL search params change
  useEffect(() => {
    const paramStatus = searchParams.get('status') || '';
    const paramPlan = searchParams.get('plan') || searchParams.get('membership') || '';
    const paramSearch = searchParams.get('search') || '';
    const paramPage = Number(searchParams.get('page')) || 1;
    const paramOrdering = searchParams.get('ordering') || '-date_joined';
    const paramGender = searchParams.get('gender') || '';
    const paramVerified = searchParams.get('verified') || '';
    const paramPeriod = searchParams.get('period') || '';

    setStatus(paramStatus);
    setMembershipFilter(paramPlan);
    setSearch(paramSearch);
    setSearchInput(paramSearch);
    setPage(paramPage);
    setOrdering(paramOrdering);
    setGender(paramGender);
    setVerified(paramVerified);
    setPeriod(paramPeriod);
  }, [searchParams]);

  // Detail view
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Summary state from API
  const [dbSummary, setDbSummary] = useState<{
    total: number;
    pendingProfile: number;
    pendingPhoto: number;
    pendingDoc: number;
    verified: number;
    suspended: number;
  } | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminUsers({
        page,
        search,
        status: status || undefined,
        ordering,
        gender: gender || undefined,
        is_verified: verified || undefined,
        period: period || undefined,
        plan: membershipFilter || undefined,
        pageSize: PAGE_SIZE,
      });
      setUsers(data.results || []);
      setCount(data.count || 0);
      if (data.summary) {
        setDbSummary({
          total: data.summary.total ?? data.count ?? 0,
          pendingProfile: data.summary.pending_profile ?? 0,
          pendingPhoto: data.summary.pending_photo ?? 0,
          pendingDoc: data.summary.pending_doc ?? 0,
          verified: data.summary.verified ?? 0,
          suspended: data.summary.suspended ?? 0,
        });
      }
    } catch {
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, ordering, gender, verified, period, membershipFilter]);

  useEffect(() => { load(); }, [load]);

  // Summary stats: actual database totals from API, fallback to current page only if API summary absent
  const summary = useMemo(() => {
    if (dbSummary) {
      return dbSummary;
    }
    const all = users;
    return {
      total: count,
      pendingProfile: all.filter(u => u.profile_status === 'pending_review').length,
      pendingPhoto: all.filter(u => u.photo_status === 'pending_review').length,
      pendingDoc: all.filter(u => u.document_status === 'pending_review').length,
      verified: all.filter(u => u.profile_status === 'approved').length,
      suspended: all.filter(u => !u.is_active).length,
    };
  }, [dbSummary, users, count]);

  const doSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const doAction = async (user: AdminUser, action: AdminUserAction) => {
    setBusy(true);
    try {
      await updateAdminUser(user.id, action);
      setToast({ message: 'Action completed.', tone: 'success' });
      setPendingAction(null);
      load();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Action failed.';
      setToast({ message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleGrantMembership = async () => {
    if (!grantUser) return;
    setGrantBusy(true);
    try {
      await grantAdminUserMembership(grantUser.id, grantPlanSlug, grantMonths);
      setToast({
        message: `Successfully updated membership for ${grantUser.first_name} to ${grantPlanSlug.toUpperCase()} (${grantMonths} months).`,
        tone: 'success',
      });
      setGrantUser(null);
      load();
    } catch (err: any) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to grant membership.';
      setToast({ message: msg, tone: 'error' });
    } finally {
      setGrantBusy(false);
    }
  };

  // If viewing a detail page, render AdminMemberDetailPage
  const matchDetail = useMatch(`${basePath}/:id`);
  if (matchDetail?.params?.id) {
    return <AdminMemberDetailPage memberId={matchDetail.params.id} onBack={() => navigate(basePath)} />;
  }

  return (
    <div className="admin-page">
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <AdminPageHeader
        title="Members"
        description="Manage all registered members"
        actions={
          <button onClick={load} className="admin-btn flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          icon={Users}
          label="Total Members"
          value={summary.total}
          color="rose"
          title="View all members"
          onClick={() => { setStatus(''); setGender(''); setVerified(''); setPeriod(''); setSearch(''); setSearchInput(''); setPage(1); }}
        />
        <SummaryCard
          icon={Shield}
          label="Pending Profile"
          value={summary.pendingProfile}
          color="amber"
          title="Review profile approvals"
          onClick={() => navigate(isSuper ? '/super-admin/profile-verifications' : '/admin/profile-verifications')}
        />
        <SummaryCard
          icon={Camera}
          label="Pending Photo"
          value={summary.pendingPhoto}
          color="purple"
          title="Review photo approvals"
          onClick={() => navigate(isSuper ? '/super-admin/photo-verifications' : '/admin/photo-verifications')}
        />
        <SummaryCard
          icon={FileText}
          label="Pending Document"
          value={summary.pendingDoc}
          color="indigo"
          title="Review document verifications"
          onClick={() => navigate(isSuper ? '/super-admin/document-verifications' : '/admin/document-verifications')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Verified"
          value={summary.verified}
          color="emerald"
          title="Filter verified profiles"
          onClick={() => { setVerified('true'); setStatus(''); setPage(1); }}
        />
        <SummaryCard
          icon={Ban}
          label="Suspended"
          value={summary.suspended}
          color="red"
          title="Filter suspended users"
          onClick={() => { setStatus('suspended'); setPage(1); }}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1" style={{ maxWidth: 320 }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={membershipFilter}
          onChange={e => { setMembershipFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 font-medium text-slate-700"
        >
          {MEMBERSHIP_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={ordering}
          onChange={e => setOrdering(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
        >
          <option value="-date_joined">Newest First</option>
          <option value="date_joined">Oldest First</option>
          <option value="first_name">Name A–Z</option>
          <option value="-first_name">Name Z–A</option>
        </select>
        <button onClick={doSearch} className="admin-btn admin-btn-primary flex items-center gap-2">
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      {/* Active Filter Chips */}
      {(status || membershipFilter || gender || verified || period || search) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50/60 border border-rose-100 px-3 py-2 text-xs">
          <span className="font-semibold text-rose-900">Active filters:</span>
          {status && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-rose-800 shadow-sm border border-rose-200">
              Status: {status.replace(/_/g, ' ')}
              <button type="button" onClick={() => { setStatus(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          {membershipFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-rose-800 shadow-sm border border-rose-200">
              Membership: {membershipFilter.charAt(0).toUpperCase() + membershipFilter.slice(1)}
              <button type="button" onClick={() => { setMembershipFilter(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          {gender && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-rose-800 shadow-sm border border-rose-200">
              Gender: {gender}
              <button type="button" onClick={() => { setGender(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-rose-800 shadow-sm border border-rose-200">
              Verified only
              <button type="button" onClick={() => { setVerified(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          {period && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-rose-800 shadow-sm border border-rose-200">
              Joined: {period}
              <button type="button" onClick={() => { setPeriod(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-rose-800 shadow-sm border border-rose-200">
              Search: &quot;{search}&quot;
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="hover:text-red-500 font-bold">&times;</button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setMembershipFilter('');
              setGender('');
              setVerified('');
              setPeriod('');
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
            className="ml-auto text-xs font-semibold text-rose-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <AdminLoading />
      ) : error ? (
        <AdminErrorState message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <AdminEmptyState title="No members found" description="Try adjusting your search or filters." />
      ) : (
        <div className="admin-panel overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">Member</th>
                <th className="pb-3 pr-4">Profile Summary</th>
                <th className="pb-3 pr-4">Verification</th>
                <th className="pb-3 pr-4">Photos</th>
                <th className="pb-3 pr-4">Documents</th>
                <th className="pb-3 pr-4">Membership</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Joined</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="group border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetailMemberId(user.id)}
                >
                  {/* Member */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                        {user.photo ? (
                          <img src={user.photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400">
                            {(user.first_name?.[0] || '').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{user.id?.slice(0, 8)}…</p>
                      </div>
                    </div>
                  </td>

                  {/* Profile Summary */}
                  <td className="py-3 pr-4">
                    <div className="text-xs text-slate-600">
                      <p>{user.gender || '—'} · {user.age || ''}</p>
                      <p className="truncate max-w-[120px]">{user.city || '—'}</p>
                      {user.completion_percentage !== undefined && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, user.completion_percentage)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{user.completion_percentage}%</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Verification */}
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      <StatusDot status={user.profile_status} label="P" />
                      <StatusDot status={user.photo_status} label="Ph" />
                      <StatusDot status={user.document_status} label="D" />
                    </div>
                  </td>

                  {/* Photo status */}
                  <td className="py-3 pr-4">
                    <BadgeLight
                      label={user.photo_status?.replace(/_/g, ' ') || '—'}
                      color={user.photo_status === 'approved' ? 'emerald' : user.photo_status === 'rejected' ? 'red' : user.photo_status === 'pending_review' ? 'amber' : 'slate'}
                    />
                  </td>

                  {/* Document status */}
                  <td className="py-3 pr-4">
                    <BadgeLight
                      label={user.document_status?.replace(/_/g, ' ') || '—'}
                      color={user.document_status === 'approved' ? 'emerald' : user.document_status === 'rejected' ? 'red' : user.document_status === 'pending_review' ? 'amber' : 'slate'}
                    />
                  </td>

                  {/* Membership */}
                  <td className="py-3 pr-4">
                    <MembershipBadge membership={user.active_membership} />
                  </td>

                  {/* Account Status */}
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      <BadgeLight
                        label={(user as any).is_deleted || (user as any).deleted_at ? 'Soft Deleted' : user.is_active ? 'Active' : 'Suspended'}
                        color={(user as any).is_deleted || (user as any).deleted_at ? 'red' : user.is_active ? 'emerald' : 'red'}
                      />
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Terms Agreed ({formatAdminDate((user as any).terms_accepted_at || user.created_at)})
                      </span>
                    </div>
                  </td>

                  {/* Joined */}
                  <td className="py-3 pr-4">
                    <span className="text-xs text-slate-500">{formatAdminDate(user.created_at) || formatAdminDate(user.date_joined) || '—'}</span>
                  </td>

                  {/* Actions */}
                  <td className="py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetailMemberId(user.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        View
                      </button>
                      {(hasAdminPermission('members.manage') || isSuper) && (
                        <div className="relative group/actions">
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <div className="absolute right-0 top-full z-20 mt-1 hidden min-w-[190px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover/actions:block">
                            {user.profile_status !== 'approved' && (
                              <MenuBtn icon={CheckCircle2} label="Approve Profile" onClick={() => void doAction(user, 'approve_profile')} />
                            )}
                            <MenuBtn icon={UserCheck} label={user.is_active ? 'Suspend' : 'Activate'} onClick={() => setPendingAction({ user, action: user.is_active ? 'deactivate' : 'activate', label: user.is_active ? 'Suspend Member' : 'Activate Member', description: `${user.is_active ? 'Deactivate' : 'Reactivate'} ${user.first_name}'s account?`, dangerous: user.is_active })} />
                            <MenuBtn
                              icon={Crown}
                              label="Grant / Upgrade Plan"
                              onClick={() => {
                                setGrantUser(user);
                                const currentSlug = user.active_membership?.plan_slug || 'gold';
                                setGrantPlanSlug(currentSlug === 'free' ? 'gold' : currentSlug);
                                setGrantMonths(12);
                              }}
                            />
                            {hasAdminPermission('members.delete') && (
                              (user as any).is_deleted || (user as any).deleted_at ? (
                                <MenuBtn icon={RotateCcw} label="Recover Account" onClick={() => setPendingAction({ user, action: 'restore', label: 'Recover Member Account', description: `Recover ${user.first_name} within the 30-day recovery window?`, dangerous: false })} />
                              ) : (
                                <MenuBtn icon={Trash2} label="Delete" onClick={() => setPendingAction({ user, action: 'delete', label: 'Delete Member', description: `Delete ${user.first_name}? The account will have a 30-day recovery window.`, dangerous: true })} />
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {count > PAGE_SIZE && (
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          count={count}
          onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}

      {/* Detail drawer */}
      {detailMemberId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDetailMemberId(null)}>
          <div className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Member Details</h2>
              <button onClick={() => setDetailMemberId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <AdminMemberDetailPage memberId={detailMemberId} onBack={() => setDetailMemberId(null)} />
            </div>
          </div>
        </div>
      )}

      {/* Confirm action dialog */}
      {pendingAction && (
        <AdminConfirmDialog
          open={true}
          title={pendingAction.label}
          description={pendingAction.description}
          confirmLabel={pendingAction.label}
          dangerous={pendingAction.dangerous}
          busy={busy}
          onConfirm={() => doAction(pendingAction.user, pendingAction.action)}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* Grant Membership modal */}
      {grantUser && (
        <GrantMembershipModal
          user={grantUser}
          planSlug={grantPlanSlug}
          setPlanSlug={setGrantPlanSlug}
          months={grantMonths}
          setMonths={setGrantMonths}
          busy={grantBusy}
          onConfirm={handleGrantMembership}
          onClose={() => setGrantUser(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  title,
  onClick,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  title?: string;
  onClick?: () => void;
}) {
  const colorClasses: Record<string, string> = {
    rose: 'bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-100/60',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-100/60',
    purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-100/60',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100/60',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/60',
    red: 'bg-red-50 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-100/60',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-sm active:scale-[0.98]' : ''} ${colorClasses[color] || 'bg-slate-50 border-slate-200 text-slate-700'}`}
    >
      <Icon className="h-8 w-8 flex-shrink-0" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium">{label}</p>
      </div>
    </button>
  );
}

function StatusDot({ status, label }: { status?: string; label: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    pending_review: 'bg-amber-500',
    not_started: 'bg-slate-300',
    changes_requested: 'bg-orange-500',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${colors[status || ''] || 'bg-slate-300'}`} />
      <span className="text-xs text-slate-600">{label}: {status?.replace(/_/g, ' ') || '—'}</span>
    </div>
  );
}

function BadgeLight({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[color] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

function MenuBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </button>
  );
}

function MembershipBadge({ membership }: { membership?: AdminUser['active_membership'] }) {
  if (!membership || membership.is_free || !membership.is_paid) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Free
        </span>
        <span className="text-[10px] text-slate-400 font-medium pl-0.5">Standard Tier</span>
      </div>
    );
  }

  const slug = (membership.plan_slug || membership.plan_name || '').toLowerCase();
  const planName = membership.plan_name || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Paid');
  const daysLeft = membership.days_remaining;
  const isExpired = !membership.is_active || (daysLeft !== null && daysLeft !== undefined && daysLeft <= 0);

  if (isExpired) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
          <Clock className="h-3 w-3 text-rose-500" />
          {planName}
        </span>
        <span className="text-[10px] font-medium text-rose-600 pl-0.5">Expired</span>
      </div>
    );
  }

  if (slug.includes('gold')) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-50 to-yellow-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-xs">
          <Crown className="h-3.5 w-3.5 text-amber-600 fill-amber-400/40" />
          Gold
        </span>
        <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 pl-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active {daysLeft !== null && daysLeft !== undefined ? `(${daysLeft}d left)` : ''}
        </span>
      </div>
    );
  }

  if (slug.includes('premium')) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-300 px-2.5 py-0.5 text-xs font-bold text-purple-950 shadow-xs">
          Premium
        </span>
        <span className="text-[10px] font-semibold text-purple-700 flex items-center gap-1 pl-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active {daysLeft !== null && daysLeft !== undefined ? `(${daysLeft}d left)` : ''}
        </span>
      </div>
    );
  }

  if (slug.includes('elite')) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-xs font-bold text-amber-300 shadow-xs">
          <Gem className="h-3.5 w-3.5 text-amber-300" />
          Elite
        </span>
        <span className="text-[10px] font-semibold text-slate-700 flex items-center gap-1 pl-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active {daysLeft !== null && daysLeft !== undefined ? `(${daysLeft}d left)` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800 shadow-xs">
        <Award className="h-3.5 w-3.5 text-emerald-600" />
        {planName}
      </span>
      <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 pl-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active {daysLeft !== null && daysLeft !== undefined ? `(${daysLeft}d left)` : ''}
      </span>
    </div>
  );
}

function GrantMembershipModal({
  user,
  planSlug,
  setPlanSlug,
  months,
  setMonths,
  busy,
  onConfirm,
  onClose,
}: {
  user: AdminUser;
  planSlug: string;
  setPlanSlug: (slug: string) => void;
  months: number;
  setMonths: (m: number) => void;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const plans = [
    {
      slug: 'gold',
      name: 'Gold',
      icon: Crown,
      price: '₹1,199',
      color: 'border-amber-300 bg-amber-50/50 hover:border-amber-400 text-amber-900',
      activeColor: 'border-amber-500 bg-amber-100 ring-2 ring-amber-400 text-amber-950 font-bold',
    },
    {
      slug: 'premium',
      name: 'Premium',
      icon: ShieldCheck,
      price: '₹2,499',
      color: 'border-purple-300 bg-purple-50/50 hover:border-purple-400 text-purple-900',
      activeColor: 'border-purple-500 bg-purple-100 ring-2 ring-purple-400 text-purple-950 font-bold',
    },
    {
      slug: 'elite',
      name: 'Elite',
      icon: Gem,
      price: '₹1,499',
      color: 'border-slate-300 bg-slate-50 hover:border-slate-500 text-slate-800',
      activeColor: 'border-slate-800 bg-slate-900 text-amber-300 ring-2 ring-slate-800 font-bold',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Grant / Upgrade Membership</h3>
              <p className="text-xs text-slate-500">For {user.first_name} {user.last_name || ''} ({user.email})</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Tier</label>
            <div className="grid grid-cols-3 gap-2.5">
              {plans.map(p => {
                const Icon = p.icon;
                const isSelected = planSlug === p.slug;
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => setPlanSlug(p.slug)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected ? p.activeColor : p.color
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-[10px] opacity-75">{p.price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                    months === m
                      ? 'border-rose-500 bg-rose-50 text-rose-700 ring-1 ring-rose-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m} {m === 1 ? 'Month' : 'Months'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <BadgeInfo className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>This will immediately activate the <strong>{planSlug.toUpperCase()}</strong> plan for <strong>{months} months</strong> and grant all tier features and daily limits.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition flex items-center gap-1.5"
          >
            {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Confirm & Grant
          </button>
        </div>
      </div>
    </div>
  );
}
