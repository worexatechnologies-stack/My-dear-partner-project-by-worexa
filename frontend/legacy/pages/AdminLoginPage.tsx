'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/router-compat';
import { ArrowRight, LockKeyhole, ShieldCheck, Lock, AlertTriangle, Key } from 'lucide-react';
import { TwoFactorRequiredError, useAuth } from '../contexts/AuthContext';
import type { AccountType } from '../services/apiClient';

interface AdministrativeLoginPageProps {
  accountType?: Exclude<AccountType, 'MEMBER'>;
  title?: string;
  dashboardPath?: string;
}

const labels: Record<Exclude<AccountType, 'MEMBER'>, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};


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
  const [otp, setOtp] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [developerOtp, setDeveloperOtp] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [mismatchInfo, setMismatchInfo] = useState<{ portal: string; url: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const label = title || labels[accountType];
  const requested = searchParams.get('next');
  const destination = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : dashboardPath;

  const alreadySignedIn = isAuthenticated && user?.account_type === accountType;

  useEffect(() => {
    if (!alreadySignedIn) return;
    // Ensure the correct role cookie is available to Next middleware, then do
    // a document navigation so a restored App Router login segment cannot
    // leave an authenticated administrator stuck on this screen.
    document.cookie = `mdp_portal=${accountType}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.replace(destination);
  }, [accountType, alreadySignedIn, destination]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMismatchInfo(null);
    setSubmitting(true);
    try {
      await login(email, password, accountType, needsTwoFactor ? otp : undefined);
      document.cookie = `mdp_portal=${accountType}; path=/; max-age=31536000; SameSite=Lax`;
      window.location.replace(destination);
    } catch (caught) {
      if (caught instanceof TwoFactorRequiredError) {
        setNeedsTwoFactor(true);
        setDeveloperOtp(caught.developerOtp);
        setError('Verification code sent. Enter the code to authenticate.');
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
          setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadySignedIn) {
    return <main className="min-h-screen bg-slate-950 flex items-center justify-center text-sm font-semibold text-slate-200">Opening your workspace…</main>;
  }

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-4 md:p-8 selection:bg-indigo-500 selection:text-white">
      {/* Glow effects */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-900/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main split-screen container */}
      <section className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-800 max-w-5xl w-full min-h-[640px] grid grid-cols-1 md:grid-cols-2 relative z-10">
        
        {/* Left column: Visual security shield info */}
        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#110c2e] to-[#040114] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle grid layer */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
          {/* Glowing orbs */}
          <div className="absolute top-10 right-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3">
            <img src="/images/main-logo.png" alt="My Dear Partner Logo" className="w-10 h-10 object-contain" />
            <b className="font-display font-black text-xl tracking-tight text-white">My Dear <span className="text-pink-500">Partner</span></b>
          </div>

          <div className="relative z-10 my-12">
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Restricted Portal
            </span>
            <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight leading-none mt-4 text-white">
              Protect trust.<br />
              <span className="font-serif italic font-normal text-indigo-200">Work within your role.</span>
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed mt-6 max-w-sm">
              This dashboard access point checks only the administrative databases and opens your dedicated, role-based configuration console.
            </p>
          </div>

          <div className="relative z-10 space-y-3 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
              <LockKeyhole className="w-4.5 h-4.5 text-indigo-400" />
              <span>Multi-Factor Authentication &amp; 2FA Protection</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
              <Lock className="w-4.5 h-4.5 text-indigo-400" />
              <span>Session Log Auditing &amp; Permission Checking Active</span>
            </div>
          </div>
        </div>

        {/* Right column: Interactive login form */}
        <div className="p-8 md:p-12 flex flex-col justify-between bg-white relative">
          
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 border-b border-gray-100 pb-4">
            <span>SECURE GATEWAY</span>
            <span className="text-indigo-600 font-bold uppercase tracking-wider">{label} Mode</span>
          </div>

          <div className="my-auto py-8">
            <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-sm mb-6 border border-indigo-100">
              <LockKeyhole className="w-6 h-6" />
            </span>
            <span className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">{label} ACCESS</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-2">Sign in to your workspace</h1>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Use the official administrator email and password issued for this administrative tier.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor={`${accountType}-email`}>
                  Official email address
                </label>
                <input
                  id={`${accountType}-email`}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none text-sm transition-all font-semibold bg-gray-50/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor={`${accountType}-password`}>
                  Password
                </label>
                <input
                  id={`${accountType}-password`}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none text-sm transition-all font-semibold bg-gray-50/30"
                />
              </div>

              {needsTwoFactor && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider" htmlFor="super-admin-otp">
                      Two-factor code (MFA)
                    </label>
                    {process.env.NODE_ENV === 'development' && developerOtp && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                        Dev OTP: {developerOtp}
                      </span>
                    )}
                  </div>
                  <input
                    id="super-admin-otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-indigo-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none text-center text-lg font-black tracking-widest bg-white"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-900 rounded-r-lg text-xs leading-relaxed flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {mismatchInfo && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <p className="text-[11px] text-amber-900 leading-normal font-semibold">
                    This account is registered for another role workspace.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(mismatchInfo.url)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Go to {mismatchInfo.portal.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} login
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (needsTwoFactor && otp.length !== 6)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-800 hover:to-purple-950 text-white font-bold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-950/15 hover:shadow-indigo-950/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Authenticating gateway...' : 'Open dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="flex items-start gap-3 border-t border-gray-100 pt-6 text-[10px] leading-normal text-gray-400">
            <Lock className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Identity Gate:</strong> Logins are audited. Unauthorized connection attempts violate security compliance rules.
            </span>
          </div>

        </div>
      </section>
    </main>
  );
}
