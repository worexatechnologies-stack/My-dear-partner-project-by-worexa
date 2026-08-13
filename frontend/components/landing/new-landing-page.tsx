'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  LockKeyhole,
  MessageSquare,
  Headphones,
  CheckCircle2,
  Crown,
  Search,
  UsersRound,
  Sparkles,
  Award,
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
    text: 'Our intelligent matching system recommends profiles based on your preferences, values, lifestyle, and compatibility—saving you time while helping you meet the right people.',
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
      <section className="relative isolate min-h-[680px] overflow-hidden bg-[#f4eee8] pt-28 pb-20 sm:min-h-[740px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_30%,rgba(184,207,175,.48),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,.9),transparent_31%),linear-gradient(105deg,#fbf8f4_8%,#f5eee8_50%,#dce4d5_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[#fffefd] [clip-path:polygon(0_64%,100%_0,100%_100%,0_100%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div className="z-10">
            <h1 className="font-display text-4xl font-light leading-[1.02] tracking-[-.055em] text-[#2c2928] sm:text-6xl lg:text-7xl">
              Where Two Hearts Begin{' '}
              <em className="font-serif font-normal text-[#bd6970]">
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
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#8e3d58] px-7 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(142,61,88,.25)] transition hover:-translate-y-0.5 hover:bg-[#702d45]"
                >
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#8e3d58] px-7 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(142,61,88,.25)] transition hover:-translate-y-0.5 hover:bg-[#702d45]"
                >
                  Create Free Profile <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                href={isLoggedIn ? '/search' : '/register'}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#3b1425]/12 bg-white/80 px-7 text-sm font-extrabold text-[#633447] transition hover:bg-white"
              >
                Explore Matches
              </Link>
            </div>

            {/* Statistics Bar */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-[#3b1425]/10 pt-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-2xl font-black text-[#8e3d58] sm:text-3xl">
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
            <div className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-rose-200/60 to-amber-100/70 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white p-3 shadow-[0_24px_70px_rgba(62,22,39,.16)]">
              <SmartImage
                src="/images/landing-hero-couple-v3.png"
                alt="A couple beginning their journey together"
                className="aspect-[4/5] w-full rounded-[1.9rem] object-cover"
                priority
              />
              <div className="absolute inset-x-3 bottom-3 rounded-b-[1.9rem] bg-gradient-to-t from-[#20111a]/85 via-[#20111a]/20 to-transparent px-6 pb-6 pt-20 text-white">
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
                className="group relative flex flex-col justify-between rounded-[2rem] border border-[#3b1425]/10 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div>
                  <span className="font-display text-5xl font-black text-[#8e3d58]/20 group-hover:text-[#8e3d58] transition">
                    {step.step}
                  </span>
                  <h3 className="mt-4 text-xl font-extrabold text-[#20111a]">
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
                  className="rounded-[2rem] border border-[#3b1425]/10 bg-[#fffaf7] p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
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
      <section className="bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-rose-300">
                <Crown className="h-4 w-4 text-amber-400" /> PREMIUM EXPERIENCE
              </p>
              <h2 className="mt-4 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
                Unlock More Meaningful Opportunities
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-8 text-slate-300">
                Upgrade your membership to enjoy exclusive features that help you find your ideal life partner faster and more effectively.
              </p>
              <div className="mt-8">
                <Link
                  href="/membership"
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#8e3d58] px-8 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#a64a69]"
                >
                  Explore Premium Plans <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-white/10 bg-white/[.06] p-8 sm:p-10 backdrop-blur-md">
              <h3 className="text-xl font-extrabold text-white mb-6">
                Included with Premium:
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {premiumBenefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-3 text-sm font-bold text-slate-200"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-400" />
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
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#8e3d58] to-[#b64a68] px-7 py-14 text-center text-white shadow-[0_24px_60px_rgba(142,61,88,.22)] sm:px-12">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-rose-200">
            YOUR STORY STARTS HERE
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
            The Right Person Could Be Just One Conversation Away.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg leading-7 text-rose-100">
            Thousands of meaningful relationships begin with a simple hello. Join MyDearPartner today and take the first step toward finding someone who truly understands your journey, values, and dreams.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-8 text-sm font-extrabold text-[#8e3d58] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create Free Profile <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={isLoggedIn ? '/search' : '/register'}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-8 text-sm font-extrabold text-white transition hover:bg-white/20"
            >
              Browse Matches
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
