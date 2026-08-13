'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowRight, Camera, Check, Clock, FileText,
  Loader2, LockKeyhole, ShieldCheck, Smartphone, UserRound,
} from 'lucide-react';
import { useGetVerificationStatusQuery } from '@/legacy/services/verificationStatusApi';

type StepStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';
type Step = {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  href: string;
  action: string;
  reason?: string | null;
  icon: typeof UserRound;
};

const statusCopy: Record<StepStatus, string> = {
  incomplete: 'Not started',
  pending: 'In review',
  approved: 'Verified',
  rejected: 'Action needed',
};

export default function VerificationCenterPage() {
  const { data, isLoading, error, refetch } = useGetVerificationStatusQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  useEffect(() => { void refetch(); }, [refetch]);

  const steps = useMemo<Step[]>(() => {
    if (!data) return [];
    const verified = Boolean(data.is_verified) || data.account_status === 'VERIFIED';
    const mobileVerified = Boolean(data.contact?.mobile_verified);
    const resolved = (value: StepStatus): StepStatus => verified ? 'approved' : value;

    return [
      {
        id: 'contact',
        title: 'Verify your mobile number',
        description: mobileVerified
          ? 'Your registered mobile number is confirmed.'
          : 'Confirm your registered mobile number with an OTP.',
        status: resolved(mobileVerified ? 'approved' : 'incomplete'),
        href: '/settings/profile#profile-section-verification',
        action: 'Verify mobile',
        reason: data.contact.reason,
        icon: Smartphone,
      },
      { id: 'profile', title: 'Complete your profile', description: 'Add the personal details that help create meaningful matches.', status: resolved(data.profile.status as StepStatus), href: '/settings/profile', action: 'Complete profile', reason: data.profile.reason, icon: UserRound },
      { id: 'photo', title: 'Add a profile photo', description: 'Upload a clear, recent photo to make your profile recognisable.', status: resolved(data.primary_photo.status as StepStatus), href: '/settings/profile#profile-section-photos', action: 'Add photo', reason: data.primary_photo.reason, icon: Camera },
      { id: 'document', title: 'Submit government ID', description: 'Provide a valid identity document for the final safety review.', status: resolved(data.documents.status as StepStatus), href: '/settings/profile#profile-section-verification', action: 'Submit document', reason: data.documents.reason, icon: FileText },
    ];
  }, [data]);

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#f8f5f2]"><Loader2 className="h-8 w-8 animate-spin text-[#8e3d58]" /></div>;
  if (error || !data) return <div className="grid min-h-screen place-items-center bg-[#f8f5f2] px-4"><div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><AlertCircle className="mx-auto h-11 w-11 text-rose-500" /><h1 className="mt-4 text-xl font-bold text-[#2b101d]">Verification is unavailable</h1><p className="mt-2 text-sm text-slate-500">We could not load your verification status.</p><button type="button" onClick={() => void refetch()} className="mt-6 rounded-xl bg-[#8e3d58] px-5 py-3 text-sm font-bold text-white">Try again</button></div></div>;

  const done = steps.filter((step) => step.status === 'approved').length;
  const progress = Math.round((done / steps.length) * 100);
  const fullyVerified = Boolean(data.is_verified) || data.account_status === 'VERIFIED';

  return (
    <main className="min-h-screen bg-[#f8f5f2] px-4 pb-16 pt-24 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#2b101d] px-6 py-8 text-white shadow-[0_24px_60px_rgba(43,16,29,.22)] sm:px-9 sm:py-10">
          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#d9b36c]/25 blur-3xl" />
          <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full border-[24px] border-[#d9b36c]/10" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_260px] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#f1d18f]"><ShieldCheck className="h-4 w-4" /> Trust & safety</span>
              <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Make your profile feel safe and genuine.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">Complete these simple checks to help people connect with confidence.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#d9b36c ${progress * 3.6}deg, rgba(255,255,255,.14) 0deg)` }}><div className="grid h-12 w-12 place-items-center rounded-full bg-[#2b101d] text-sm font-black">{progress}%</div></div><div><p className="text-xs font-semibold text-[#f1d18f]">Verification progress</p><p className="mt-1 text-xl font-black">{done} of {steps.length} complete</p></div></div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#8e3d58]">Your journey</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[#2b101d]">Verification checklist</h2></div>{fullyVerified && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" /> Fully verified</span>}</div>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const complete = step.status === 'approved';
                const pending = step.status === 'pending';
                const rejected = step.status === 'rejected';
                const accent = complete || pending ? 'border-emerald-200 bg-emerald-50/70' : rejected ? 'border-rose-200 bg-rose-50/70' : 'border-[#2b101d]/10 bg-[#fffdfa]';
                return <motion.article key={step.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} className={`rounded-2xl border p-4 transition ${accent}`}>
                  <div className="flex gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${complete || pending ? 'bg-emerald-600 text-white' : rejected ? 'bg-rose-500 text-white' : 'bg-[#f3e9ed] text-[#8e3d58]'}`}>{complete || pending ? <Check className="h-5 w-5" /> : rejected ? <AlertCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Step {String(index + 1).padStart(2, '0')}</p><h3 className="mt-1 font-bold text-[#2b101d]">{step.title}</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${complete ? 'bg-emerald-200 text-emerald-800' : pending ? 'bg-amber-100 text-amber-800' : rejected ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{statusCopy[step.status]}</span></div><p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.description}</p>{rejected && step.reason && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-rose-700">{step.reason}</p>}{complete ? <button disabled type="button" className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" /> Verified</button> : pending ? <button disabled type="button" className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800"><Clock className="h-4 w-4" /> Under review</button> : <Link href={step.href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#8e3d58] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#6f2c41]">{rejected ? 'Update details' : step.action}<ArrowRight className="h-4 w-4" /></Link>}</div></div>
                </motion.article>;
              })}
            </div>
          </section>

          <aside className="space-y-5"><section className="rounded-[2rem] bg-gradient-to-br from-[#8e3d58] to-[#4d2034] p-6 text-white shadow-lg shadow-rose-200"><LockKeyhole className="h-8 w-8 text-[#f1d18f]" /><h2 className="mt-5 text-xl font-black">Your data stays private.</h2><p className="mt-3 text-sm leading-relaxed text-white/75">Documents and verification details are reviewed securely and are never visible to other members.</p><div className="mt-6 border-t border-white/20 pt-5 text-xs font-bold text-white/90">Safe matching starts with trusted profiles.</div></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">Need help?</p><h2 className="mt-2 text-lg font-black text-[#2b101d]">Talk to our support team</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">We can help if a verification item was rejected or you are unsure what to upload.</p><Link href="/tickets" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#8e3d58]">Contact support <ArrowRight className="h-4 w-4" /></Link></section></aside>
        </div>
      </div>
    </main>
  );
}
