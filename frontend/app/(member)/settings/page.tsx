'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  LogOut,
  UserRound,
  ChevronRight,
  Loader2,
  ExternalLink,
  Pause,
  Play,
  Mail,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { useMembership } from '@/components/member/membership-provider';
import { ApiError, fetchApi } from '@/legacy/services/apiClient';
import { useToast } from '@/components/ui';

type SettingsTab = 'security' | 'membership' | 'actions';

export default function SettingsPage() {
  const { user, logout, logoutAll, updateUser } = useAuth();
  const { membershipSummary } = useMembership();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('security');

  // ── Password change state ──
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ text: string; error?: boolean } | null>(null);

  // ── Account actions state ──
  const [profilePaused, setProfilePaused] = useState<boolean>(() => Boolean(user?.is_hidden));
  const [pauseBusy, setPauseBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Sync pause state with user or backend on load
  useEffect(() => {
    let cancelled = false;
    async function loadPauseStatus() {
      try {
        const res: any = await fetchApi('/member-auth/account/pause/');
        const isPaused = Boolean(res?.data?.is_paused ?? res?.data?.is_hidden);
        if (!cancelled) {
          setProfilePaused(isPaused);
          if (user && user.is_hidden !== isPaused) {
            updateUser({ ...user, is_hidden: isPaused });
          }
        }
      } catch {
        if (!cancelled && user?.is_hidden !== undefined) {
          setProfilePaused(Boolean(user.is_hidden));
        }
      }
    }
    loadPauseStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePause = async () => {
    if (pauseBusy) return;
    setPauseBusy(true);
    try {
      const nextPaused = !profilePaused;
      const res: any = await fetchApi('/member-auth/account/pause/', {
        method: 'POST',
        body: JSON.stringify({ pause: nextPaused }),
      });
      const isPaused = Boolean(res?.data?.is_paused ?? res?.data?.is_hidden ?? nextPaused);
      setProfilePaused(isPaused);
      if (user) {
        updateUser({ ...user, is_hidden: isPaused });
      }
      showToast(
        isPaused
          ? 'Profile paused temporarily. Hidden from searches.'
          : 'Profile resumed successfully. Visible to matches.',
        'success'
      );
    } catch (err: any) {
      showToast(
        err instanceof ApiError ? err.message : 'Could not update profile status. Please try again.',
        'error'
      );
    } finally {
      setPauseBusy(false);
    }
  };

  // ── Password strength evaluation ──
  const calculateStrength = (pw: string) => {
    if (!pw) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-emerald-600'];
    return { score, label: labels[score] || '', color: colors[score] || 'bg-slate-200' };
  };

  const pwStrength = calculateStrength(passwords.new_password);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current_password) {
      setPwNotice({ text: 'Current password is required.', error: true });
      return;
    }
    if (!passwords.new_password) {
      setPwNotice({ text: 'New password is required.', error: true });
      return;
    }
    if (passwords.new_password.length < 8) {
      setPwNotice({ text: 'New password must be at least 8 characters long.', error: true });
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      setPwNotice({ text: 'New passwords do not match.', error: true });
      return;
    }
    if (passwords.new_password === passwords.current_password) {
      setPwNotice({ text: 'New password must be different from current password.', error: true });
      return;
    }

    setPwBusy(true);
    setPwNotice(null);
    try {
      await fetchApi('/member-auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: passwords.current_password,
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        }),
      });
      setPwNotice({ text: 'Password has been updated successfully.' });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password updated successfully', 'success');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Could not change password. Please check your credentials.';
      setPwNotice({ text: msg, error: true });
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of all active devices?')) return;
    setLoggingOutAll(true);
    try {
      await logoutAll();
      showToast('Logged out of all sessions', 'success');
    } catch {
      showToast('Could not log out of all sessions', 'error');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await fetchApi('/member-auth/account/delete/', { method: 'DELETE' });
      await logout();
      window.location.assign('/login');
    } catch (err: any) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to schedule account deletion. Please try again.');
      setDeleteBusy(false);
    }
  };

  const planName = membershipSummary?.plan_name || (user?.is_premium ? 'Premium Plan' : 'Free Plan');
  const isPremium = user?.is_premium || (membershipSummary?.has_active_plan && !membershipSummary?.is_free);
  const remainingConnects = membershipSummary?.daily_profile_unlocks_remaining;
  const totalLimit = membershipSummary?.daily_profile_unlock_limit;
  const connectsText = remainingConnects != null
    ? (totalLimit ? `${remainingConnects} / ${totalLimit} left today` : `${remainingConnects} left today`)
    : (isPremium ? 'Unlimited' : '10 / day');

  const memberId = user?.id ? `MDP-${user.id.slice(0, 6).toUpperCase()}` : 'MDP-MEMBER';

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#0f0f10]">
          Account Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your security credentials, membership, and account actions.
        </p>
      </div>

      {/* ── Top Navigation Tabs (No inner sidebar, clean brand colors) ── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#e11d48] text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 hover:bg-[#f7f4f5] hover:text-[#0f0f10]'
          }`}
        >
          <Lock className="w-3.5 h-3.5" strokeWidth={activeTab === 'security' ? 2.2 : 1.85} />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('membership')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'membership'
              ? 'bg-[#e11d48] text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 hover:bg-[#f7f4f5] hover:text-[#0f0f10]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" strokeWidth={activeTab === 'membership' ? 2.2 : 1.85} />
          <span>Membership</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'actions'
              ? 'bg-[#e11d48] text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 hover:bg-[#f7f4f5] hover:text-[#0f0f10]'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={activeTab === 'actions' ? 2.2 : 1.85} />
          <span>Account Actions</span>
        </button>
      </div>

      {/* ── Tab 1: Security & Password ── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          {/* Change Password Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6] flex items-center justify-center">
                <KeyRound className="w-5 h-5" strokeWidth={1.85} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f0f10]">Change Account Password</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose a strong, unique password to secure your account.
                </p>
              </div>
            </div>

            {pwNotice && (
              <div
                className={`mt-4 rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2 ${
                  pwNotice.error
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                {pwNotice.error ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{pwNotice.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="mt-5 space-y-4 max-w-lg">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwords.current_password}
                    onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))}
                    placeholder="Enter your current password"
                    className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => ({ ...p, current: !p.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    value={passwords.new_password}
                    onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))}
                    placeholder="At least 8 characters"
                    className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {passwords.new_password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Password strength:</span>
                      <span className="font-bold text-slate-700">{pwStrength.label}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-150 overflow-hidden">
                      <div
                        className={`h-full ${pwStrength.color} transition-all duration-300`}
                        style={{ width: `${(pwStrength.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwords.confirm_password}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm_password: e.target.value }))}
                    placeholder="Repeat your new password"
                    className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="h-10 px-6 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {pwBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{pwBusy ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Account Credentials & Active Sessions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.85} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f0f10]">Account Credentials & Sessions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review your registered login identifiers and manage device sessions.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Member Identifier</span>
                <span className="font-mono font-bold text-slate-800 text-xs mt-1 block">{memberId}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Registered Email</span>
                <span className="font-semibold text-slate-800 text-xs mt-1 truncate block flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{user?.email || 'Not configured'}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Registered Mobile</span>
                <span className="font-semibold text-slate-800 text-xs mt-1 block flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{user?.mobile_number || 'Not configured'}</span>
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800">Log out of all devices</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  If you suspect unauthorized access, this terminates all active browser and app sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={loggingOutAll}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.85} />
                <span>{loggingOutAll ? 'Signing out...' : 'Log Out All Sessions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Membership ── */}
      {activeTab === 'membership' && (
        <div className="space-y-5">
          {/* Active Plan Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6] flex items-center justify-center">
                <CreditCard className="w-5 h-5" strokeWidth={1.85} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f0f10]">Current Membership Tier</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review your active subscription benefits and daily unlock quotas.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Active Plan</span>
                <span className="text-base font-black text-slate-900 mt-1 block">{planName}</span>
                <span className="text-xs text-slate-500 mt-1 block">
                  {isPremium ? 'Full messaging, priority contact unlocks & advanced matching active.' : 'Basic membership with daily search limits.'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Daily Profile Unlocks</span>
                <span className="text-base font-black text-[#e11d48] mt-1 block">{connectsText}</span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Resets daily at midnight.
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Need more daily unlocks or direct phone access?
              </p>
              <Link
                href="/membership"
                className="h-10 px-5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
              >
                <span>{isPremium ? 'Manage Membership' : 'Upgrade Membership'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Account Actions (Danger Zone) ── */}
      {activeTab === 'actions' && (
        <div className="space-y-5">
          {/* Pause Profile */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  profilePaused
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {profilePaused ? <Play className="w-5 h-5" strokeWidth={1.85} /> : <Pause className="w-5 h-5" strokeWidth={1.85} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#0f0f10]">
                      {profilePaused ? 'Profile is Currently Paused' : 'Temporarily Pause Profile'}
                    </h3>
                    {profilePaused && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                    {profilePaused
                      ? 'Your profile is hidden from search results and matchmaking recommendations. Your existing matches and chats remain accessible. Tap Resume whenever you want to be visible again.'
                      : 'Take a break from matchmaking. Your profile will be temporarily hidden from new search results while preserving your existing matches and conversation history.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={pauseBusy}
                onClick={handleTogglePause}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                  profilePaused
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                }`}
              >
                {pauseBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : profilePaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Profile</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Permanent Deletion (Red Warning) */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" strokeWidth={1.85} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-rose-950">Delete Account & Profile</h3>
                <p className="text-xs text-rose-800/80 mt-1 leading-relaxed max-w-xl">
                  Permanently schedule your account for deletion. All personal details, partner preferences, photo assets, and chat conversations will be removed according to our privacy policy with a 30-day grace period.
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Delete My Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Account Deletion Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" strokeWidth={2} />
            </div>

            <h2 className="text-base font-bold text-slate-900">Are you absolutely sure?</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              This action schedules your matrimony profile for permanent deletion. To proceed, please type <strong className="text-rose-600 font-mono">DELETE</strong> in the box below.
            </p>

            {deleteError && (
              <p className="mt-3 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {deleteError}
              </p>
            )}

            <div className="mt-4">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                disabled={deleteBusy}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteBusy || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{deleteBusy ? 'Deleting...' : 'Confirm Deletion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
