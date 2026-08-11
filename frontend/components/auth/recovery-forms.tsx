'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, Check, Mail, Send, ShieldCheck, Smartphone, KeyRound, AlertTriangle, CheckCircle2, Lock, RotateCw } from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';

const identifierSchema = z.string().trim().min(3, 'Enter your registered email address or mobile number.');

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [channel, setChannel] = useState<'email' | 'mobile'>('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [developerOtp, setDeveloperOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // 30-second Resend OTP Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send Reset OTP
  const handleRequestResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const parsed = identifierSchema.safeParse(identifier);
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchApi<{ expires_in: number; developer_otp?: string; message?: string }>('/member-auth/forgot-password/', {
        method: 'POST',
        body: JSON.stringify({ identifier: parsed.data, channel }),
        skipAuthRefresh: true,
      });
      setDeveloperOtp(result.developer_otp ?? '');
      setSuccessMsg(result.message || `Reset code sent to your registered ${channel}!`);
      setAttemptsRemaining(null);
      setResendCooldown(30);
      setStep(2);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 & 3: Submit New Password & Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!code.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi<{ message?: string; data?: { attempts_remaining?: number } }>('/member-auth/reset-password/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          new_password: password,
        }),
        skipAuthRefresh: true,
      });
      
      setSuccessMsg('Password updated successfully! Redirecting to sign in...');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (err: any) {
      const remaining = err?.data?.attempts_remaining ?? err?.attempts_remaining;
      if (typeof remaining === 'number') {
        setAttemptsRemaining(remaining);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset password. Please check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(217,179,108,0.18),_transparent_30%),linear-gradient(145deg,_#fffdf9_0%,_#f7f0e8_100%)] px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#e11d48]/12 bg-white shadow-[0_24px_70px_rgba(43,16,29,0.13)] md:grid-cols-[0.85fr_1.15fr]">
        
        {/* Left Hero Sidebar */}
        <aside className="bg-gradient-to-br from-[#1e293b] via-[#4b1d34] to-[#e11d48] p-8 text-white flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d9b36c]/35 bg-white/10 text-[#f3d27e]">
              <KeyRound className="h-6 w-6" />
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.17em] text-[#f3d27e]">Password Recovery</p>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight">Recover your account safely.</h1>
            <p className="mt-4 text-sm leading-relaxed text-white/70">Verify your registered contact details and create a strong new password in 3 easy steps.</p>
          </div>

          <div className="space-y-3 border-t border-white/15 pt-6 text-xs text-white/80">
            <p className={`flex items-center gap-2 font-medium ${step >= 1 ? 'text-[#f3d27e]' : ''}`}>
              <CheckCircle2 className="h-4 w-4" /> 1. Request One-Time Code
            </p>
            <p className={`flex items-center gap-2 font-medium ${step >= 2 ? 'text-[#f3d27e]' : ''}`}>
              <CheckCircle2 className="h-4 w-4" /> 2. Verify OTP & Rate Limit Guard
            </p>
            <p className={`flex items-center gap-2 font-medium ${step >= 3 ? 'text-[#f3d27e]' : ''}`}>
              <CheckCircle2 className="h-4 w-4" /> 3. Set New Password & Sign In
            </p>
          </div>
        </aside>

        {/* Right Interactive Wizard Form */}
        <section className="p-6 sm:p-9">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d9b36c]/35 bg-[#fff8e9] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6f451c]">
              <ShieldCheck className="h-4 w-4 text-[#e11d48]" /> Step {step} of 3
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#1e293b]">
              {step === 1 ? 'Reset Your Password' : step === 2 ? 'Verify Reset Code' : 'Choose New Password'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-600">
              {step === 1 ? 'Enter your registered email or mobile number to receive a verification code.' : 'Enter the code you received along with your new password.'}
            </p>
          </div>

          {/* Feedback Badges & Attempt Warnings */}
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p>{errorMsg}</p>
                {attemptsRemaining !== null && (
                  <p className="mt-1 font-bold text-rose-900 bg-rose-100 px-2 py-1 rounded inline-block">
                    ⚠️ {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before temporary lockout!
                  </p>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {developerOtp && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 flex items-center justify-between shadow-sm">
              <div>
                <span>Development Test OTP: </span>
                <span className="font-mono text-base font-extrabold bg-amber-200 text-amber-950 px-2.5 py-1 rounded-md ml-1 tracking-widest">{developerOtp}</span>
              </div>
              <button
                type="button"
                onClick={() => setCode(developerOtp)}
                className="text-[11px] font-bold bg-[#e11d48] text-white px-3 py-1.5 rounded-lg hover:bg-[#6f2c41] transition cursor-pointer"
              >
                Auto-fill Code
              </button>
            </div>
          )}

          {/* STEP 1: Select Channel & Enter Identifier */}
          {step === 1 && (
            <form onSubmit={handleRequestResetOtp} className="space-y-4">
              {/* Channel Selector Toggle */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 mb-4">
                <button
                  type="button"
                  onClick={() => { setChannel('email'); setIdentifier(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    channel === 'email'
                      ? 'bg-white text-[#e11d48] shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Send via Email
                </button>
                <button
                  type="button"
                  onClick={() => { setChannel('mobile'); setIdentifier(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    channel === 'mobile'
                      ? 'bg-white text-[#e11d48] shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Send via Mobile SMS
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#68535d]">
                  {channel === 'email' ? 'Registered Email Address' : 'Registered 10-Digit Mobile Number'}
                </span>
                <div className="relative">
                  {channel === 'email' ? (
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" />
                  ) : (
                    <Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" />
                  )}
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={channel === 'email' ? 'e.g. member@example.com' : 'e.g. 9876543210'}
                    className="w-full rounded-xl border border-[#1e293b]/15 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] outline-none transition focus:border-[#e11d48] focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10"
                    required
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#e11d48] py-3.5 px-4 text-sm font-bold text-white shadow-md transition hover:bg-[#6f2c41] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Sending Code...' : <><Send className="w-4 h-4" /> Send OTP to {channel === 'email' ? 'Email' : 'Mobile SMS'}</>}
              </button>
            </form>
          )}

          {/* STEP 2 & 3: Verification & Password Reset */}
          {step >= 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <label className="block">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#68535d]">6-Digit Verification Code</span>
                  <button
                    type="button"
                    onClick={() => handleRequestResetOtp()}
                    disabled={resendCooldown > 0 || loading}
                    className="text-xs font-bold text-[#e11d48] hover:text-[#6f2c41] disabled:text-slate-400 flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP Code'}
                  </button>
                </div>
                <div className="relative">
                  <Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter the 6-digit OTP code"
                    className="w-full rounded-xl border border-[#1e293b]/15 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] font-mono font-bold tracking-widest outline-none transition focus:border-[#e11d48] focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#68535d]">New Password</span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-[#1e293b]/15 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] outline-none transition focus:border-[#e11d48] focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#68535d]">Confirm New Password</span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl border border-[#1e293b]/15 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] outline-none transition focus:border-[#e11d48] focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10"
                    required
                  />
                </div>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 rounded-xl border border-slate-300 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 rounded-xl bg-[#e11d48] py-3.5 px-4 text-sm font-bold text-white shadow-md transition hover:bg-[#6f2c41] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Updating Password...' : <><CheckCircle2 className="w-4 h-4" /> Reset Password</>}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link href="/login" className="text-xs font-bold text-[#e11d48] hover:underline inline-flex items-center gap-1">
              Return to Login <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ResetPasswordForm() {
  return <ForgotPasswordForm />;
}

type OtpForm = { identifier: string; code: string };

export function VerifyOtpForm() {
  const { requestOtp, loginWithOtp, isAuthenticated, user, updateUser } = useAuth();
  const router = useRouter();
  const { register, getValues, handleSubmit, formState: { isSubmitting } } = useForm<OtpForm>();
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const contactMode = isAuthenticated;

  // 30-second Resend OTP cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const request = async () => {
    const parsed = identifierSchema.safeParse(getValues('identifier'));
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
    try {
      const result = await requestOtp(parsed.data, contactMode ? 'PHONE_VERIFY' : 'PASSWORDLESS_LOGIN');
      setMessage('A verification code has been sent to your selected contact.');
      setResendCooldown(30);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'A code could not be sent.'); }
  };

  const verify = handleSubmit(async ({ identifier, code }) => {
    try {
      if (contactMode) {
        const result = await fetchApi<{ user: Record<string, unknown> }>('/member-auth/otp/verify/', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), purpose: 'PHONE_VERIFY' }) });
        updateUser(result.user as any);
        router.replace('/verification');
      } else {
        await loginWithOtp(identifier.trim(), code.trim());
        router.replace('/dashboard');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The code is invalid or expired.'); }
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(217,179,108,0.18),_transparent_30%),linear-gradient(145deg,_#fffdf9_0%,_#f7f0e8_100%)] px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#e11d48]/12 bg-white shadow-[0_24px_70px_rgba(43,16,29,0.13)] md:grid-cols-[0.82fr_1.18fr]">
        <aside className="hidden bg-gradient-to-br from-[#1e293b] via-[#4b1d34] to-[#e11d48] p-8 text-white md:flex md:flex-col md:justify-between"><div><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d9b36c]/35 bg-white/10 text-[#f3d27e]"><ShieldCheck className="h-6 w-6" /></div><p className="mt-8 text-xs font-bold uppercase tracking-[0.17em] text-[#f3d27e]">Secure verification</p><h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">A more trusted profile starts here.</h1><p className="mt-4 text-sm leading-relaxed text-white/70">Confirm your registered contact with a one-time code. It only takes a moment.</p></div><div className="space-y-3 border-t border-white/15 pt-6 text-sm text-white/80"><p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f3d27e]" /> One-time code verification</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f3d27e]" /> Your details stay private</p></div></aside>
        <section className="p-6 sm:p-9"><div className="mb-7"><span className="inline-flex items-center gap-2 rounded-full border border-[#d9b36c]/35 bg-[#fff8e9] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6f451c]"><ShieldCheck className="h-4 w-4 text-[#e11d48]" /> Contact verification</span><h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-[#1e293b] sm:text-3xl">{contactMode ? 'Verify your email or mobile' : 'Sign in with a one-time code'}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{contactMode ? 'Enter one registered contact, request a code, then confirm it below.' : 'Use your verified email address or mobile number to receive a secure code.'}</p></div>
          <form onSubmit={verify} noValidate className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#68535d]">Email or mobile number</span><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" /><input autoComplete="username" defaultValue={user?.mobile_number || user?.email || ''} {...register('identifier', { required: true })} placeholder="Enter your registered email or mobile" className="w-full rounded-xl border border-[#1e293b]/12 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] outline-none transition placeholder:text-slate-400 focus:border-[#e11d48]/45 focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10" /></div></label><button type="button" onClick={request} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e11d48]/25 bg-[#f6e9ee] px-4 py-3 text-sm font-bold text-[#e11d48] transition hover:border-[#e11d48]/45 hover:bg-[#f0dfe6]"><Send className="h-4 w-4" /> Send verification code</button><div className="mt-3 text-center">{resendCooldown > 0 ? (<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400"><RotateCw className="h-3.5 w-3.5" /> Resend available in {resendCooldown}s</span>) : (<button type="button" onClick={request} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e11d48] transition hover:underline"><RotateCw className="h-3.5 w-3.5" /> Didn't receive? Resend code</button>)}</div><div className="relative py-1 text-center"><span className="relative z-10 bg-white px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Then enter your code</span><span className="absolute left-0 right-0 top-1/2 h-px bg-[#1e293b]/10" /></div><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#68535d]">Verification code</span><div className="relative"><Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e11d48]" /><input inputMode="numeric" autoComplete="one-time-code" {...register('code', { required: true })} placeholder="Enter the code you received" className="w-full rounded-xl border border-[#1e293b]/12 bg-[#f9f6f1] py-3 pl-10 pr-4 text-sm text-[#1e293b] outline-none transition placeholder:text-slate-400 focus:border-[#e11d48]/45 focus:bg-white focus:ring-4 focus:ring-[#e11d48]/10" /></div></label><button disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e11d48] px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#6f2c41] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Verifying…' : <>{contactMode ? 'Verify contact details' : 'Verify and sign in'} <ArrowRight className="h-4 w-4" /></>}</button></form>
          {message && <p className="mt-5 rounded-xl border border-[#d9b36c]/35 bg-[#fff8e9] px-4 py-3 text-sm font-medium leading-relaxed text-[#5d3d21]" role="status">{message}</p>}
          <div className="mt-6 border-t border-[#1e293b]/[0.08] pt-5 text-center text-sm text-slate-600"><Link href={contactMode ? '/verification' : '/login'} className="inline-flex items-center gap-1 font-bold text-[#e11d48] transition hover:text-[#6f2c41]">{contactMode ? 'Back to verification' : 'Use your password instead'} <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      </div>
    </main>
  );
}

function AuthCard({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <main className="auth-utility-page"><section className="auth-utility-card"><p>Secure account access</p><h1>{title}</h1><p>{copy}</p>{children}</section></main>;
}
