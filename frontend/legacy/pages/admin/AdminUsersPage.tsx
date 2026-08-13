'use client';

import SmartImage from '@/components/shared/smart-image';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useMatch, useNavigate } from '@/lib/router-compat';
import {
  CheckCircle2, Filter, LoaderCircle, MoreHorizontal, RefreshCw, Search, ShieldOff,
  Trash2, UserCheck, UserX, X, ShieldAlert, BadgeInfo, CreditCard, Clock, Check, AlertTriangle,
  Users, Camera, FileText, Shield, Ban, ChevronDown, ShieldCheck, RotateCcw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAdminUsers, updateAdminUser, type AdminUser, type AdminUserAction,
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
  { value: 'not_started', label: 'Not Started' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'deleted', label: 'Soft Deleted (Trash)' },
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
  const [ordering, setOrdering] = useState(searchParams.get('ordering') || '-date_joined');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Detail view
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminUsers({ page, search, status, ordering, pageSize: PAGE_SIZE });
      setUsers(data.results || []);
      setCount(data.count || 0);
    } catch {
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, ordering]);

  useEffect(() => { load(); }, [load]);

  // Summary stats computed from the data
  const summary = useMemo(() => {
    const all = users;
    return {
      total: count,
      pendingProfile: all.filter(u => u.profile_status === 'pending_review').length,
      pendingPhoto: all.filter(u => u.photo_status === 'pending_review').length,
      pendingDoc: all.filter(u => u.document_status === 'pending_review').length,
      verified: all.filter(u => u.is_verified).length,
      suspended: all.filter(u => !u.is_active).length,
    };
  }, [users, count]);

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

  // If viewing a detail page, render AdminMemberDetailPage
  const matchDetail = useMatch(`${basePath}/:id`);
  if (matchDetail?.params?.id) {
    return <AdminMemberDetailPage memberId={matchDetail.params.id} />;
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
        <SummaryCard icon={Users} label="Total Members" value={summary.total} color="rose" />
        <SummaryCard icon={Shield} label="Pending Profile" value={summary.pendingProfile} color="amber" />
        <SummaryCard icon={Camera} label="Pending Photo" value={summary.pendingPhoto} color="purple" />
        <SummaryCard icon={FileText} label="Pending Document" value={summary.pendingDoc} color="indigo" />
        <SummaryCard icon={CheckCircle2} label="Verified" value={summary.verified} color="emerald" />
        <SummaryCard icon={Ban} label="Suspended" value={summary.suspended} color="red" />
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
                    {user.active_membership ? (
                      <div>
                        <p className="text-xs font-medium text-slate-800">{user.active_membership.plan_name || 'Plan'}</p>
                        <BadgeLight
                          label={user.active_membership.is_active ? 'Active' : 'Expired'}
                          color={user.active_membership.is_active ? 'emerald' : 'slate'}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Free</span>
                    )}
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
                          <div className="absolute right-0 top-full z-20 mt-1 hidden min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover/actions:block">
                            {user.profile_status !== 'approved' && (
                              <MenuBtn icon={CheckCircle2} label="Approve Profile" onClick={() => void doAction(user, 'approve_profile')} />
                            )}
                            <MenuBtn icon={UserCheck} label={user.is_active ? 'Suspend' : 'Activate'} onClick={() => setPendingAction({ user, action: user.is_active ? 'deactivate' : 'activate', label: user.is_active ? 'Suspend Member' : 'Activate Member', description: `${user.is_active ? 'Deactivate' : 'Reactivate'} ${user.first_name}'s account?`, dangerous: user.is_active })} />
                            {hasAdminPermission('members.delete') && (
                              (user as any).is_deleted || (user as any).deleted_at ? (
                                <MenuBtn icon={RotateCcw} label="Restore Profile" onClick={() => setPendingAction({ user, action: 'restore', label: 'Restore Member Profile', description: `Restore soft-deleted profile for ${user.first_name}?`, dangerous: false })} />
                              ) : (
                                <MenuBtn icon={Trash2} label="Soft Delete" onClick={() => setPendingAction({ user, action: 'soft_delete', label: 'Delete Member', description: `Soft-delete ${user.first_name}? This hides the profile.`, dangerous: true })} />
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
              <AdminMemberDetailPage memberId={detailMemberId} />
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
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-rose-50 border-rose-200 text-rose-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${colorClasses[color] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
      <Icon className="h-8 w-8 flex-shrink-0" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium">{label}</p>
      </div>
    </div>
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
