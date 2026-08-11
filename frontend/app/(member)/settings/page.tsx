'use client';

import Link from 'next/link';
import { Bell, ChevronRight, CreditCard, Shield, UserRound } from 'lucide-react';

const options = [
  { href: '/settings/profile', title: 'Profile details', text: 'Update your personal details, photos, preferences, and verification.', icon: UserRound, tone: 'bg-rose-50 text-rose-700' },
  { href: '/settings/security', title: 'Security & access', text: 'Change your password and manage signed-in devices.', icon: Shield, tone: 'bg-amber-50 text-amber-700' },
  { href: '/settings/notifications', title: 'Notifications', text: 'Review important account, match, and support updates.', icon: Bell, tone: 'bg-sky-50 text-sky-700' },
  { href: '/settings/membership', title: 'Membership', text: 'Review your plan and available member benefits.', icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700' },
];

export default function SettingsPage() {
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#2b101d] via-[#743047] to-[#8e3d58] p-6 text-white shadow-[0_18px_45px_rgba(43,16,29,.16)] sm:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#f1d18f]/15 blur-3xl" />
      <div className="relative"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#f1d18f]">Member account</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Settings, made simple.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">Manage your profile, privacy, account security, and membership from one calm workspace.</p></div>
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      {options.map(({ href, title, text, icon: Icon, tone }) => <Link key={href} href={href} className="group rounded-3xl border border-[#eadfd8] bg-white p-5 shadow-[0_10px_30px_rgba(43,16,29,.05)] transition hover:-translate-y-0.5 hover:border-[#dcaebb] hover:shadow-[0_16px_36px_rgba(43,16,29,.10)]"><div className="flex items-start justify-between gap-4"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span><ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#8e3d58]" /></div><h2 className="mt-5 font-extrabold text-[#24151c]">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[#77656d]">{text}</p></Link>)}
    </section>
  </div>;
}
