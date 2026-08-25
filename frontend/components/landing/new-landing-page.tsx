'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  MessageSquare,
  Headphones,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';

const stats = [
  { value: '50K+', label: 'Verified Members' },
  { value: '200+', label: 'Communities' },
  { value: '100+', label: 'Connected Cities' },
  { value: '4.9/5', label: 'Member Satisfaction' },
];

const journeySteps = [
  {
    step: '01',
    title: 'Create Your Profile',
    text: 'Fill your profile with all necessary information like your personal details, family background, education, profession, interests and preference for a partner.',
  },
  {
    step: '02',
    title: 'Discover Compatible Matches',
    text: 'Our rule-based matching system surfaces profiles using your preferences, values, lifestyle, and compatibility details—saving you time while helping you meet the right people.',
  },
  {
    step: '03',
    title: 'Connect with Confidence',
    text: 'Express your interest, start secure conversations, exchange details, and involve your family whenever you’re ready to take the next step.',
  },
  {
    step: '04',
    title: 'Begin Your Forever',
    text: 'When the connection feels right, let your story unfold. Every successful relationship begins with trust, understanding, and one meaningful conversation.',
  },
];

const trustFeatures = [
  {
    icon: ShieldCheck,
    title: 'Verified Profiles',
    text: 'Every profile goes through a careful verification process to create a genuine and trustworthy community.',
  },
  {
    icon: LockKeyhole,
    title: 'Privacy First',
    text: 'Choose who can view your profile, photos, and personal information with advanced privacy settings.',
  },
  {
    icon: MessageSquare,
    title: 'Secure Communication',
    text: 'Connect with Trust, build meaningful conversations in a private and secure environment.',
  },
  {
    icon: Headphones,
    title: 'Dedicated Support',
    text: 'Always by Your Side. Expert guidance whenever you need it on your journey to finding the right partner.',
  },
];

const premiumBenefits = [
  'Unlimited Profile Views',
  'Direct Contact Access',
  'Priority Profile Visibility',
  'Advanced Match Preferences',
  'Relationship Advisor',
  'Video Profile & Introductions',
  'Priority Customer Support',
];

export default function NewLandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const check = () => {
      const stored =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('mdp.auth.authenticated') === 'true';
      setIsLoggedIn(stored);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return (
    <div className="overflow-hidden bg-[#fffefd] text-[#2c2928]">
      {/* ── HERO SECTION ────────────────────────────────────────── */}
      <section className="relative isolate min-h-[680px] overflow-hidden bg-[#f7eeea] pb-20 pt-28 sm:min-h-[740px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_30%,rgba(240,196,197,.56),transparent_25%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,.92),transparent_32%),linear-gradient(105deg,#fffdfb_8%,#f8eee9_52%,#f2dfe1_100%)]" />
        <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-[#e11d48]/[.07] blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-[#d9b36c]/[.12] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[#fffefd] [clip-path:polygon(0_64%,100%_0,100%_100%,0_100%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div className="z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b64a68]/20 bg-white/70 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#8e3d58] shadow-[0_4px_14px_rgba(142,61,88,.08)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#e11d48] to-[#b64a68]" />
              Trusted Matrimony Platform
            </span>
            <h1 className="mt-5 font-display text-4xl font-light leading-[1.02] tracking-[-.055em] text-[#2c2928] sm:text-6xl lg:text-7xl">
              Where Two Hearts Begin{' '}
              <em className="bg-[linear-gradient(120deg,#e11d48_0%,#b64a68_45%,#8e3d58_100%)] bg-clip-text font-serif font-normal text-transparent">
                One Beautiful Journey.
              </em>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-8 text-slate-700">
              At MyDearPartner, we believe the strongest relationships are built on trust, shared values, and genuine understanding. Whether you’re searching for yourself or a loved one, we’re here to help you discover a connection that’s meant to last a lifetime.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#b64a68_0%,#8e3d58_100%)] px-8 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(142,61,88,.32),inset_0_1px_0_rgba(255,255,255,.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(142,61,88,.4)] hover:brightness-[1.06] active:scale-[0.97]"
                >
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#b64a68_0%,#8e3d58_100%)] px-8 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(142,61,88,.32),inset_0_1px_0_rgba(255,255,255,.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(142,61,88,.4)] hover:brightness-[1.06] active:scale-[0.97]"
                >
                  Create Free Profile <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                href={isLoggedIn ? '/search' : '/register'}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-[#8e3d58]/20 bg-white/85 px-8 text-sm font-extrabold text-[#8e3d58] shadow-[0_8px_18px_rgba(67,37,50,.06)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#8e3d58]/45 hover:bg-white active:scale-[0.97]"
              >
                Explore Matches
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs font-bold text-[#68585e]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-2 shadow-[0_6px_16px_rgba(67,37,50,.06),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5 text-[#8e3d58]" /> Thoughtful verification
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-2 shadow-[0_6px_16px_rgba(67,37,50,.06),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-md">
                <LockKeyhole className="h-3.5 w-3.5 text-[#8e3d58]" /> Privacy in your control
              </span>
            </div>

            {/* Statistics Bar */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-[#3b1425]/10 pt-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="group">
                  <p className="bg-[linear-gradient(135deg,#b64a68,#8e3d58)] bg-clip-text font-display text-2xl font-black text-transparent transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-6 rounded-[2.75rem] bg-[linear-gradient(135deg,rgba(225,29,72,.22),rgba(217,179,108,.28),rgba(255,244,239,.84))] blur-3xl" />
            <div className="absolute -right-4 -top-4 z-10 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_16px_36px_rgba(67,22,39,.14)] backdrop-blur-xl">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#8e3d58]">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% Verified
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-500">Genuine profiles only</p>
            </div>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white p-3 shadow-[0_32px_80px_rgba(62,22,39,.20),inset_0_1px_0_rgba(255,255,255,.9)]">
              <SmartImage
                src="/images/landing-hero-couple-v3.png"
                alt="A couple beginning their journey together"
                className="aspect-[4/5] w-full rounded-[1.5rem] object-cover"
                priority
              />
              <div className="absolute inset-x-3 bottom-3 rounded-b-[1.5rem] bg-gradient-to-t from-[#20111a]/85 via-[#20111a]/20 to-transparent px-6 pb-6 pt-20 text-white">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-rose-200">
                  MyDearPartner
                </p>
                <p className="mt-2 font-display text-2xl font-extrabold leading-tight">
                  Where two hearts begin one beautiful journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEARCH SECTION ──────────────────────────────────────── */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">
            FIND YOUR PERFECT MATCH
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
            Begin Your Search with Confidence
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg leading-8 text-slate-600">
            If you are looking for a perfect match from the perspective of faith, profession, education, community or any other criterion, MyDearPartner will help you find people who suit your requirements.
          </p>
        </div>
      </section>

      {/* ── SECTION 2 – JOURNEY ────────────────────────────────── */}
      <section className="bg-[#fffaf7] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">
              YOUR JOURNEY
            </p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
              A Simple Path to Finding Your Forever
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-8 text-slate-600">
              Every successful relationship starts with a meaningful introduction. We have devised an easy and transparent journey for you that lets you meet the right person at the right time.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {journeySteps.map((step) => (
              <div
                key={step.step}
                className="group relative flex flex-col justify-between overflow-hidden rounded-[1.4rem] border border-[#3b1425]/[.07] bg-white p-7 shadow-[0_4px_18px_rgba(67,22,39,.05),inset_0_1px_0_rgba(255,255,255,.9)] transition duration-300 hover:-translate-y-1.5 hover:border-[#b64a68]/25 hover:shadow-[0_20px_44px_rgba(67,22,39,.12)]"
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#b64a68]/[.06] blur-2xl transition duration-300 group-hover:bg-[#b64a68]/[.12]" />
                <div className="relative">
                  <span className="bg-[linear-gradient(135deg,#e5afb9,#f0d5da)] bg-clip-text font-display text-5xl font-black text-transparent transition duration-300 group-hover:bg-[linear-gradient(135deg,#e11d48,#8e3d58)]">
                    {step.step}
                  </span>
                  <h3 className="mt-4 text-xl font-extrabold tracking-[-0.01em] text-[#20111a]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3 – TRUST ──────────────────────────────────── */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">
              TRUST &amp; SAFETY
            </p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
              Because Trust Comes Before Every Relationship
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-8 text-slate-600">
              At MyDearPartner, your safety and privacy are our highest priorities. Every feature is thoughtfully designed to help individuals and families connect with confidence while maintaining complete control over their personal information.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {trustFeatures.map((feat) => {
              const IconComponent = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-[1.4rem] border border-[#3b1425]/[.07] bg-[#fffaf7] p-8 shadow-[0_4px_18px_rgba(67,22,39,.05)] transition duration-300 hover:-translate-y-1.5 hover:border-[#b64a68]/25 hover:bg-white hover:shadow-[0_20px_44px_rgba(67,22,39,.12)]"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#b64a68,#8e3d58)] text-white shadow-[0_10px_22px_rgba(142,61,88,.28),inset_0_1px_0_rgba(255,255,255,.25)]">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold text-[#20111a]">
                    {feat.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feat.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 4 – PREMIUM MEMBERSHIP ─────────────────────── */}
      <section className="relative overflow-hidden bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#e11d48]/[.14] blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#d9b36c]/[.12] blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d9b36c]/30 bg-[#d9b36c]/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[.16em] text-[#f0c4c5]">
                <Crown className="h-4 w-4 text-[#d9b36c]" /> PREMIUM EXPERIENCE
              </p>
              <h2 className="mt-4 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
                Unlock More{' '}
                <span className="bg-[linear-gradient(120deg,#f0c4c5,#d9b36c)] bg-clip-text text-transparent">
                  Meaningful Opportunities
                </span>
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-8 text-slate-300">
                Upgrade your membership to enjoy exclusive features that help you find your ideal life partner faster and more effectively.
              </p>
              <div className="mt-8">
                <Link
                  href="/membership"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#e11d48_0%,#b64a68_100%)] px-8 text-sm font-extrabold text-white shadow-[0_16px_36px_rgba(225,29,72,.35),inset_0_1px_0_rgba(255,255,255,.22)] transition hover:-translate-y-0.5 hover:brightness-[1.07] active:scale-[0.97]"
                >
                  Explore Premium Plans <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.06] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md sm:p-10">
              <h3 className="text-xl font-extrabold text-white mb-6">
                Included with Premium:
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {premiumBenefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-sm font-bold text-slate-200 transition hover:border-[#d9b36c]/25 hover:bg-white/10"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#d9b36c]" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#8e3d58_0%,#b64a68_55%,#c9547a_100%)] px-7 py-16 text-center text-white shadow-[0_32px_72px_rgba(142,61,88,.32)] sm:px-12">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/[.08] blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#d9b36c]/[.18] blur-3xl" />
          <p className="relative text-xs font-extrabold uppercase tracking-[.16em] text-rose-200">
            YOUR STORY STARTS HERE
          </p>
          <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
            The Right Person Could Be Just One Conversation Away.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-base sm:text-lg leading-7 text-rose-100">
            Thousands of meaningful relationships begin with a simple hello. Join MyDearPartner today and take the first step toward finding someone who truly understands your journey, values, and dreams.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-extrabold text-[#8e3d58] shadow-[0_12px_28px_rgba(32,17,26,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(32,17,26,.32)] active:scale-[0.97]"
            >
              Create Free Profile <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={isLoggedIn ? '/search' : '/register'}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-white/45 bg-white/10 px-8 text-sm font-extrabold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/20 active:scale-[0.97]"
            >
              Browse Matches
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
