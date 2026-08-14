'use client';

import { useState } from 'react';
import { Shield, Key, LogOut, Eye, EyeOff, CheckCircle, Loader2, AlertTriangle, LockKeyhole, Check, Smartphone } from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi, ApiError } from '@/legacy/services/apiClient';

export default function SecurityPage() {
  const { user, logoutAll } = useAuth();

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const updateField = (field: string, value: string) => setPasswords((p) => ({ ...p, [field]: value }));

  const passwordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const map = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
    return { score, label: map[score] || '', color: colors[score] || 'bg-gray-200' };
  };

  const strength = passwordStrength(passwords.new_password);

  const validate = () => {
    if (!passwords.current_password) return 'Current password is required.';
    if (!passwords.new_password) return 'New password is required.';
    if (!passwords.confirm_password) return 'Please confirm your new password.';
    if (passwords.new_password !== passwords.confirm_password) return 'New passwords do not match.';
    if (passwords.new_password.length < 8) return 'New password must be at least 8 characters.';
    if (passwords.new_password === passwords.current_password) return 'New password must differ from your current password.';
    return null;
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) return setNotice({ text: error, error: true });
    setBusy(true);
    setNotice(null);
    try {
      await fetchApi('/member-auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: passwords.current_password,
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        }),
      });
      setNotice({ text: 'Password changed successfully.' });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setNotice({ text: err instanceof ApiError ? err.message : 'Failed to change password.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Sign out of all devices? This will end every active session, including this one.')) return;
    setBusy(true);
    try {
      await logoutAll();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#2b101d] via-[#743047] to-[#8e3d58] p-6 md:p-8 text-white shadow-[0_18px_45px_rgba(43,16,29,0.16)]">
        <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[#f1d18f]/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-5">
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <Shield className="h-5 w-5 text-[#f1d18f]" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Security &amp; access</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">Keep your account protected with a strong password and control over your active sessions.</p>
          </div>
          <span className="hidden rounded-full border border-[#f1d18f]/35 bg-[#f1d18f]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f5dca8] sm:inline-flex">Account protected</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-[#eadfd8] bg-white shadow-[0_12px_36px_rgba(43,16,29,0.06)]">
      <div className="border-b border-[#f0e6df] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#24151c]">
          <Key className="h-5 w-5 text-[#8e3d58]" /> Update password
        </h2>
        <p className="mt-1 text-sm text-[#77656d]">Choose a unique password you do not use anywhere else.</p>
      </div>

      {notice && (
        <div className={`mx-6 mt-6 rounded-2xl border p-4 text-sm font-medium md:mx-8 ${notice.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          <div className="flex items-center gap-2">
            {notice.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {notice.text}
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="grid gap-8 border-b border-[#f0e6df] p-6 md:p-8 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={changePassword} className="max-w-xl space-y-4">
          {['current_password', 'new_password', 'confirm_password'].map((field) => {
            const labels: Record<string, string> = {
              current_password: 'Current Password',
              new_password: 'New Password',
              confirm_password: 'Confirm New Password',
            };
            const show = showPassword[field as keyof typeof showPassword];
            return (
              <div key={field}>
                <label className="mb-1.5 block text-sm font-bold text-[#58444d]">{labels[field]}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={passwords[field as keyof typeof passwords]}
                    onChange={(e) => updateField(field, e.target.value)}
                    className="w-full rounded-xl border border-[#dfd2cb] bg-[#fffdfa] px-4 py-3 text-sm text-[#24151c] pr-10 outline-none transition focus:border-[#8e3d58] focus:ring-4 focus:ring-[#8e3d58]/10"
                    required
                    autoComplete={field === 'current_password' ? 'current-password' : field === 'new_password' ? 'new-password' : 'new-password'}
                  />
                  <button type="button" onClick={() => setShowPassword((s) => ({ ...s, [field]: !show }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {field === 'new_password' && passwords.new_password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-[#77656d]">{strength.label || 'Enter a password'}</p>
                  </div>
                )}
              </div>
            );
          })}
          <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#743047] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(116,48,71,0.22)] transition hover:bg-[#541e37] disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Updating...' : 'Change Password'}
          </button>
        </form>

        <aside className="rounded-2xl bg-[#fffaf2] p-5 ring-1 ring-[#f1dfbb]">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#58444d]"><LockKeyhole className="h-4 w-4 text-[#a9792e]" /> Password checklist</div>
          <p className="mt-2 text-xs leading-relaxed text-[#77656d]">A strong password makes it harder for someone else to access your profile.</p>
          <div className="mt-5 space-y-3 text-xs font-semibold text-[#58444d]">
            {['At least 8 characters', 'A mix of upper and lowercase letters', 'At least one number or symbol'].map((item) => (
              <div key={item} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f1dfbb] text-[#a9792e]"><Check className="h-3 w-3" /></span>{item}</div>
            ))}
          </div>
        </aside>
      </div>

      {/* Sessions */}
      <div className="p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-[#24151c]">
          <LogOut className="h-4 w-4 text-[#8e3d58]" /> Active sessions
        </h2>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f8f5f2] p-4">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#77656d]" />
          <p className="text-sm leading-relaxed text-[#77656d]">Sign out of all devices to revoke every active session, including this one.</p>
        </div>
        <button type="button" disabled={busy} onClick={handleLogoutAll} className="mt-4 rounded-xl border border-[#edcbd4] px-5 py-2.5 text-sm font-bold text-[#8e3d58] transition hover:bg-[#fff4f5] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Signing out...' : 'Sign Out All Devices'}
        </button>
      </div>
      </div>
    </div>
  );
}
