'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Calendar, Camera, CheckCircle2, Eye, FileText, KeyRound, LoaderCircle, Mail, Pencil, Phone, Plus, RefreshCw,
  Search, Shield, ShieldCheck, Trash2, Upload, User, UserCheck, UserX, X
} from 'lucide-react';
import {
  createAdminAccount, getAdminAccounts, updateAdminAccount,
  type AdminAccount
} from '../../services/adminService';
import { fetchApi } from '../../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader,
  AdminPagination, AdminPanel, AdminStatusBadge, formatAdminDate
} from '../../components/admin/AdminUI';

export default function AdminAccountsManagementPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.account_type === 'SUPER_ADMIN' || (user as any)?.is_super_admin;

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailAccount, setDetailAccount] = useState<AdminAccount | null>(null);
  const [editTarget, setEditTarget] = useState<AdminAccount | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    employeeCode: '',
    photo: '',
    bio: '',
  });
  const [updatingAdmin, setUpdatingAdmin] = useState(false);
  const [editError, setEditError] = useState('');

  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'ADMIN' as 'ADMIN' | 'SUPER_ADMIN',
    employeeCode: '',
    photo: '',
    bio: '',
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createError, setCreateError] = useState('');

  // Password reset modal state
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Deleting admin ID state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Approval stats state
  const [approvalStats, setApprovalStats] = useState<{
    profiles_approved: { count: number; items: any[] };
    photos_approved: { count: number; items: any[] };
    documents_approved: { count: number; items: any[] };
  } | null>(null);
  const [approvalStatsLoading, setApprovalStatsLoading] = useState(false);
  const [showApprovalType, setShowApprovalType] = useState<string | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo file size must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!detailAccount) { setApprovalStats(null); setShowApprovalType(null); return; }
    setApprovalStatsLoading(true);
    fetchApi<typeof approvalStats>(`/admin/accounts/${detailAccount.id}/approvals/`)
      .then(setApprovalStats)
      .catch(() => setApprovalStats(null))
      .finally(() => setApprovalStatsLoading(false));
  }, [detailAccount]);

  const openEditModal = (account: AdminAccount) => {
    setEditTarget(account);
    setEditForm({
      fullName: account.full_name || '',
      phone: account.phone || '',
      employeeCode: account.employee_code || account.admin_id || '',
      photo: account.photo || '',
      bio: account.bio || '',
    });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setUpdatingAdmin(true);
    setEditError('');
    try {
      await updateAdminAccount(editTarget.id, {
        full_name: editForm.fullName,
        phone: editForm.phone,
        employee_code: editForm.employeeCode,
        photo: editForm.photo,
        bio: editForm.bio,
      });
      alert(`Admin profile for "${editForm.fullName}" updated successfully!`);
      setEditTarget(null);
      await loadAccounts(page);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update Admin profile.');
    } finally {
      setUpdatingAdmin(false);
    }
  };

  const loadAccounts = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminAccounts({
        page: targetPage,
        page_size: 20,
        search: search || undefined,
        role: (roleFilter as any) || undefined,
      });
      let results = response.results || [];
      if (statusFilter === 'active') {
        results = results.filter((a) => a.is_active);
      } else if (statusFilter === 'inactive') {
        results = results.filter((a) => !a.is_active);
      }
      setAccounts(results);
      setTotalCount(response.count || results.length);
      setPage(targetPage);
    } catch (err: any) {
      setError(err?.message || 'Failed to load administrative accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
    const timer = window.setTimeout(() => loadAccounts(1), 200);
    return () => window.clearTimeout(timer);
  }, [search, roleFilter, statusFilter, loadAccounts]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.fullName || !newAdmin.email || !newAdmin.password) {
      setCreateError('Full Name, Email, and Password are required.');
      return;
    }
    setCreatingAdmin(true);
    setCreateError('');
    try {
      await createAdminAccount({
        full_name: newAdmin.fullName,
        email: newAdmin.email,
        phone: newAdmin.phone,
        password: newAdmin.password,
        role: newAdmin.role as any,
        employee_code: newAdmin.employeeCode,
        photo: newAdmin.photo,
        bio: newAdmin.bio,
      });
      alert(`Admin account successfully created for "${newAdmin.fullName}"!`);
      setShowCreateModal(false);
      setNewAdmin({ fullName: '', email: '', phone: '', password: '', role: 'ADMIN', employeeCode: '', photo: '', bio: '' });
      await loadAccounts(1);
    } catch (err: any) {
      let msg = err?.message || 'Failed to create Admin profile.';
      if (err?.errors && typeof err.errors === 'object') {
        const details = Object.entries(err.errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' | ');
        if (details) msg = `${msg} (${details})`;
      }
      setCreateError(msg);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleToggleStatus = async (account: AdminAccount) => {
    const action = account.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} account "${account.full_name}"?`)) {
      return;
    }
    try {
      await updateAdminAccount(account.id, { action, is_active: !account.is_active });
      alert(`Account "${account.full_name}" is now ${action}d.`);
      await loadAccounts(page);
    } catch (err: any) {
      alert(err?.message || `Failed to ${action} account.`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    setResettingPassword(true);
    try {
      await updateAdminAccount(resetTarget.id, { action: 'reset_password', new_password: newPassword });
      alert(`Password updated for ${resetTarget.full_name}.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err?.message || 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<AdminAccount | null>(null);

  const handleDeleteAdmin = async (account: AdminAccount) => {
    setConfirmDelete(account);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const account = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(account.id);
    try {
      await fetchApi(`/super-admin/admins/${account.id}/`, { method: 'DELETE' });
      if (detailAccount?.id === account.id) setDetailAccount(null);
      await loadAccounts(page);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete Admin profile.');
    } finally {
      setDeletingId(null);
    }
  };

  // Metric counts
  const activeCount = accounts.filter((a) => a.is_active).length;
  const superAdminCount = accounts.filter((a) => a.role === 'SUPER_ADMIN').length;
  const inactiveCount = accounts.filter((a) => !a.is_active).length;

  if (loading && !accounts.length) {
    return <AdminLoading label="Loading administrative accounts list..." />;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Super Admin Governance"
        title="Admin Accounts Management"
        description="Create, monitor, manage, activate, deactivate, or delete administrative user accounts."
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="admin-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm text-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Admin Profile
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => loadAccounts(page)}
            >
              <RefreshCw className="w-4 h-4" /> Refresh List
            </button>
          </div>
        }
      />

      {/* ─────────────────────────── Summary Production Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Admins</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Admins</span>
            <div className="text-2xl font-black text-emerald-900 mt-0.5">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Super Admins</span>
            <div className="text-2xl font-black text-purple-900 mt-0.5">{superAdminCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Deactivated</span>
            <div className="text-2xl font-black text-rose-900 mt-0.5">{inactiveCount}</div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────── Search & Filter Bar ─────────────────────────── */}
      <AdminPanel className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </AdminPanel>

      {/* ─────────────────────────── Admin Cards & Table View ─────────────────────────── */}
      {error ? (
        <AdminErrorState message={error} onRetry={() => loadAccounts(page)} />
      ) : accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                !acc.is_active ? 'border-slate-200 opacity-75 bg-slate-50/50' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg overflow-hidden shrink-0">
                      {acc.photo ? (
                        <img src={acc.photo} alt={acc.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{acc.full_name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ID: {acc.employee_code || acc.admin_id || 'ADM-00001'}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            acc.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {acc.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <AdminStatusBadge status={acc.is_active ? 'ACTIVE' : 'INACTIVE'} />
                </div>

                <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold">{acc.email}</span>
                  </div>
                  {acc.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{acc.phone}</span>
                    </div>
                  )}

                  {acc.bio && (
                    <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-slate-700 text-xs italic font-medium mt-2">
                      "{acc.bio}"
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100/60 mt-2">
                    <span>Account Type: <strong className="text-slate-600">{acc.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'}</strong></span>
                    <span>Joined: {formatAdminDate(acc.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(acc)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    acc.is_active
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {acc.is_active ? 'Deactivate' : 'Activate'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    title="Edit Admin Profile"
                    className="p-1.5 rounded-lg text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailAccount(acc)}
                    title="View Full Profile Details"
                    className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetTarget(acc)}
                    title="Reset Password"
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAdmin(acc)}
                      disabled={deletingId === acc.id}
                      title="Delete Admin Profile"
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          title="No admin accounts found"
          description="No administrative accounts match your search query or filter selection."
        />
      )}

      {/* ─────────────────────────── Create Admin Modal ─────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" /> Create Admin Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ullas Gowda"
                  value={newAdmin.fullName}
                  onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ullas.admin@mydearpartner.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Role *</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as 'ADMIN' | 'SUPER_ADMIN' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin ID / Employee Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ADM-00045"
                  value={newAdmin.employeeCode}
                  onChange={(e) => setNewAdmin({ ...newAdmin, employeeCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Profile Photo (Optional)</label>
                <div className="flex items-center gap-3">
                  {newAdmin.photo && (
                    <img src={newAdmin.photo} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Camera size={14} /> Choose File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoFileChange(e, (url) => setNewAdmin({ ...newAdmin, photo: url }))}
                    />
                  </label>
                  {newAdmin.photo && (
                    <button type="button" onClick={() => setNewAdmin({ ...newAdmin, photo: '' })} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bio / Role Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Regional Verification Manager"
                  value={newAdmin.bio}
                  onChange={(e) => setNewAdmin({ ...newAdmin, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {creatingAdmin ? 'Creating...' : 'Create Admin Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────── Edit Admin Profile Modal ─────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" /> Edit Admin Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin ID / Employee Code</label>
                <input
                  type="text"
                  placeholder="e.g. ADM-101"
                  value={editForm.employeeCode}
                  onChange={(e) => setEditForm({ ...editForm, employeeCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Profile Photo</label>
                <div className="flex items-center gap-3">
                  {editForm.photo && (
                    <img src={editForm.photo} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Camera size={14} /> Choose File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoFileChange(e, (url) => setEditForm({ ...editForm, photo: url }))}
                    />
                  </label>
                  {editForm.photo && (
                    <button type="button" onClick={() => setEditForm({ ...editForm, photo: '' })} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bio / Role Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Support Admin Specialist"
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingAdmin}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {updatingAdmin ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────── Password Reset Modal ─────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" /> Reset Password
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Enter a new password for <strong>{resetTarget.full_name}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {resettingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─────────────────────────── Admin Full Details Modal ─────────────────────────── */}
      {detailAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg overflow-hidden shrink-0">
                  {detailAccount.photo ? (
                    <img src={detailAccount.photo} alt={detailAccount.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{detailAccount.full_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        detailAccount.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}
                    >
                      {detailAccount.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                    </span>
                    <AdminStatusBadge status={detailAccount.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailAccount(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin ID / Employee Code</span>
                  <div className="font-extrabold text-slate-800 text-sm mt-0.5">
                    {detailAccount.employee_code ? `#${detailAccount.employee_code}` : detailAccount.admin_id || 'Not Assigned'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System UUID</span>
                  <div className="font-mono text-[11px] font-semibold text-slate-600 truncate mt-0.5" title={detailAccount.id}>
                    {detailAccount.id}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" /> Email Address
                  </span>
                  <a href={`mailto:${detailAccount.email}`} className="font-semibold text-indigo-600 hover:underline">
                    {detailAccount.email}
                  </a>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" /> Mobile Number
                  </span>
                  <span className="font-semibold text-slate-800">{detailAccount.phone || 'Not Provided'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Date Joined
                  </span>
                  <span className="font-semibold text-slate-800">{formatAdminDate(detailAccount.created_at)}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" /> Last Login
                  </span>
                  <span className="font-semibold text-slate-800">
                    {detailAccount.last_login ? formatAdminDate(detailAccount.last_login) : 'Never'}
                  </span>
                </div>
              </div>

              {detailAccount.bio && (
                <div className="bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">Bio / Notes</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{detailAccount.bio}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Approval Activity</span>
                {approvalStatsLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs"><LoaderCircle className="admin-spinner" size={14} /> Loading stats...</div>
                ) : approvalStats ? (
                  <div className="grid grid-cols-3 gap-2">
                    {(['profiles_approved', 'photos_approved', 'documents_approved'] as const).map((key) => {
                      const label = key === 'profiles_approved' ? 'Profiles' : key === 'photos_approved' ? 'Photos' : 'Documents';
                      const icon = key === 'profiles_approved' ? <User className="w-3.5 h-3.5" /> : key === 'photos_approved' ? <Camera className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />;
                      const stat = approvalStats[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setShowApprovalType(showApprovalType === key ? null : key)}
                          className={`text-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                            showApprovalType === key
                              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                              : 'bg-slate-50 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 text-indigo-600 mb-1">{icon} <span className="text-[10px] font-bold">{label}</span></div>
                          <div className="text-lg font-black text-slate-800">{stat.count}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {showApprovalType && approvalStats && (
                  <div className="mt-3 bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                    {approvalStats[showApprovalType as keyof typeof approvalStats].items.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">No items</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr>
                            <th className="text-left p-2 font-bold text-slate-500">Member</th>
                            {showApprovalType === 'documents_approved' && <th className="text-left p-2 font-bold text-slate-500">Type</th>}
                            <th className="text-right p-2 font-bold text-slate-500">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvalStats[showApprovalType as keyof typeof approvalStats].items.map((item: any, i: number) => (
                            <tr key={item.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="p-2 font-semibold text-slate-700">{item.member_name || item.member_email || 'Unknown'}</td>
                              {showApprovalType === 'documents_approved' && <td className="p-2 text-slate-500">{item.document_type}</td>}
                              <td className="p-2 text-right text-slate-400">{item.approved_at ? formatAdminDate(item.approved_at) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = detailAccount;
                  setDetailAccount(null);
                  handleToggleStatus(target);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  detailAccount.is_active
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {detailAccount.is_active ? 'Deactivate Account' : 'Activate Account'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailAccount;
                    setDetailAccount(null);
                    setResetTarget(target);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Reset Password
                </button>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAdmin(detailAccount!)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Confirm Permanent Deletion</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                You are about to <strong className="text-rose-700">permanently delete</strong> this admin profile:
              </p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="font-semibold text-slate-800">{confirmDelete.full_name}</p>
                <p className="text-xs text-slate-500">{confirmDelete.email}</p>
              </div>
              <p className="text-xs text-rose-600 font-medium">This action cannot be undone. All data associated with this account will be removed.</p>
            </div>
            <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
              >
                {deletingId === confirmDelete.id ? <LoaderCircle className="admin-spinner" size={14} /> : <Trash2 className="w-3.5 h-3.5" />}
                {deletingId === confirmDelete.id ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
