'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useNavigate, useSearchParams } from '@/lib/router-compat';
import {
  ShieldCheck, Crown, Eye, EyeOff, AlertCircle, ArrowRight,
  Lock, ArrowLeft, KeyRound
} from 'lucide-react';
import { TwoFactorRequiredError, useAuth } from '../contexts/AuthContext';
import type { AccountType } from '../services/apiClient';

interface AdministrativeLoginPageProps {
  accountType?: Exclude<AccountType, 'MEMBER'>;
  title?: string;
  dashboardPath?: string;
}

export default function AdminLoginPage({
  accountType = 'ADMIN',
  title,
  dashboardPath = '/admin/dashboard',
}: AdministrativeLoginPageProps) {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [mismatchInfo, setMismatchInfo] = useState<{ portal: string; url: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSuper = accountType === 'SUPER_ADMIN';
  const roleLabel = title || (isSuper ? 'Super Admin' : 'Admin');
  const portalName = isSuper ? 'Super Admin Portal' : 'Admin Portal';

  const requested = searchParams.get('next');
  const destination = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : dashboardPath;
  const alreadySignedIn = isAuthenticated && user?.account_type === accountType;

  useEffect(() => {
    if (!alreadySignedIn) return;
    document.cookie = `mdp_portal=${accountType}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.replace(destination);
  }, [accountType, alreadySignedIn, destination]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMismatchInfo(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password, accountType, accountType === 'ADMIN' && needsTwoFactor ? otp : undefined);
      document.cookie = `mdp_portal=${accountType}; path=/; max-age=31536000; SameSite=Lax`;
      window.location.replace(destination);
    } catch (caught) {
      if (caught instanceof TwoFactorRequiredError && accountType === 'ADMIN') {
        setNeedsTwoFactor(true);
        setError('A 6-digit verification code has been sent. Please enter it below.');
      } else {
        const isMismatch = caught && typeof caught === 'object' && 'data' in caught && (caught as any).data?.code === 'ACCOUNT_PORTAL_MISMATCH';
        if (isMismatch) {
          const mismatchData = (caught as any).data;
          setError(caught instanceof Error ? caught.message : 'Portal mismatch error.');
          setMismatchInfo({
            portal: mismatchData.correct_portal,
            url: mismatchData.correct_login_url,
          });
        } else {
          setError(caught instanceof Error ? caught.message : 'Invalid email or password. Please try again.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadySignedIn) {
    return (
      <main className="min-h-screen bg-[#faf7f5] flex items-center justify-center p-6 text-center">
        <div>
          <div className="w-10 h-10 border-2 border-[#8e3d58] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#230914]">Opening {roleLabel} Console…</h1>
          <p className="mt-1 text-sm text-slate-500">Authenticated. Preparing your workspace.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f5] text-slate-900 flex flex-col justify-between py-10 px-4 sm:px-6 selection:bg-[#f3b8cb] selection:text-[#5a1b30]">
      {/* Top Bar / Logo */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between pb-6">
        <Link href="/" className="inline-flex items-center gap-2.5 text-decoration-none group">
          <img
            src="/images/main-logo.png"
            alt="My Dear Partner"
            className="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
          />
          <span className="font-extrabold text-lg tracking-tight text-[#230914]">
            My Dear <span className="text-[#8e3d58]">Partner</span>
          </span>
        </Link>

        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#8e3d58] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Member Login</span>
        </Link>
      </header>

      {/* Main Form Container */}
      <div className="w-full max-w-md mx-auto my-auto">
        <div className="bg-white rounded-3xl border border-[#ede3e7] p-8 sm:p-10 shadow-[0_12px_40px_-15px_rgba(40,15,25,0.08)]">
          {/* Badge & Title */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf2f5] border border-[#f5d5df] text-[#8e3d58] text-xs font-bold uppercase tracking-wider mb-4">
              {isSuper ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>Super Admin Portal</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8e3d58]" />
                  <span>Admin Portal</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#230914]">
              {roleLabel} Sign In
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {isSuper
                ? 'Sign in with your super-admin credentials to manage governance, security, and system settings.'
                : 'Sign in to access member management, verification queues, and profile moderation.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {/* Email field */}
            <div>
              <label
                htmlFor={`${accountType}-email`}
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
              >
                Work Email Address
              </label>
              <input
                id={`${accountType}-email`}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isSuper ? 'superadmin@mydearpartner.com' : 'admin@mydearpartner.com'}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#fcfbfc] border border-[#e5dce0] text-slate-900 placeholder-slate-400 text-sm font-medium outline-none transition-all focus:border-[#8e3d58] focus:bg-white focus:ring-2 focus:ring-[#8e3d58]/10"
              />
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={`${accountType}-password`}
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id={`${accountType}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#fcfbfc] border border-[#e5dce0] text-slate-900 placeholder-slate-400 text-sm font-medium outline-none transition-all focus:border-[#8e3d58] focus:bg-white focus:ring-2 focus:ring-[#8e3d58]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 2FA Field */}
            {accountType === 'ADMIN' && needsTwoFactor && (
              <div className="p-4 rounded-xl bg-[#fdf5f7] border border-[#f3ccd7] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="admin-otp" className="text-xs font-bold text-[#8e3d58] uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Authentication Code (MFA)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">6 digits</span>
                </div>
                <input
                  id="admin-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-white border border-[#e5dce0] text-slate-900 placeholder-slate-300 text-center text-lg font-mono font-bold tracking-widest outline-none focus:border-[#8e3d58] focus:ring-2 focus:ring-[#8e3d58]/10"
                />
                <p className="text-[11px] text-slate-500">
                  Enter the 6-digit code sent to your registered authenticator or phone.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Mismatch Card */}
            {mismatchInfo && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold">
                  This account belongs to another role workspace.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(mismatchInfo.url)}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Go to {mismatchInfo.portal.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || (accountType === 'ADMIN' && needsTwoFactor && otp.length !== 6)}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-white text-sm font-bold shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 ${
                isSuper
                  ? 'bg-[#7a1832] hover:bg-[#631126] shadow-[#7a1832]/20'
                  : 'bg-[#8e3d58] hover:bg-[#783048] shadow-[#8e3d58]/20'
              }`}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


        </div>
      </div>

      {/* Clean Footer */}
      <footer className="w-full max-w-md mx-auto pt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Lock className="w-3.5 h-3.5" />
        <span>My Dear Partner Internal Platform • Authorized Use Only</span>
      </footer>
    </main>
  );
}
