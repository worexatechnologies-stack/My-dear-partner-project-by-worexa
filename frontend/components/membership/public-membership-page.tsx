'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import SmartImage from '@/components/shared/smart-image';
import {
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  ClipboardCheck,
  Crown,
  Eye,
  Filter,
  Gift,
  Headphones,
  Heart,
  Image,
  Loader2,
  Lock,
  LockKeyhole,
  MessageCircle,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Unlock,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useGetMembershipPlansQuery, type MembershipPlan } from '@/legacy/services/membershipApi';

const planIcons = [Heart, Star, Gem, Crown, ShieldCheck, Award];

function Gem(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || props.className?.match(/w-(\d+)/)?.[1] || 24}
      height={props.size || props.className?.match(/h-(\d+)/)?.[1] || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M11 3 8 9l4 12 4-12-3-6" />
      <path d="M2 9h20" />
    </svg>
  );
}

const faqs = [
  {
    question: 'Can I upgrade my plan later?',
    answer: 'Yes. You can begin with any plan and request an upgrade whenever you are ready for more profile access, messaging, or advanced search features.',
  },
  {
    question: 'How are paid memberships activated?',
    answer: 'Choose a plan while registering or from your membership page. Your request is processed securely and the plan is activated immediately upon verification.',
  },
  {
    question: 'Is the Free plan really free?',
    answer: 'Yes. The Free plan has no membership charge and gives you essential profile browsing, daily profile unlocks, interests, and basic search tools.',
  },
  {
    question: 'What is the refund policy?',
    answer: 'Paid plans include a 7-day refund window. Contact our support team within seven days of activation and they will guide you through the applicable process.',
  },
  {
    question: 'Can I cancel my membership?',
    answer: 'Yes. You can request cancellation or return to the Free plan. Contact support if you need help with an active paid membership.',
  },
];

const trustIndicators = [
  { icon: ClipboardCheck, title: 'Clear activation', description: 'Every request is reviewed carefully' },
  { icon: ShieldCheck, title: 'Verified community', description: 'Government ID verification supported' },
  { icon: LockKeyhole, title: 'Privacy controls', description: 'Your personal details stay protected' },
  { icon: Headphones, title: 'Human support', description: 'Helpful assistance when you need it' },
];

const formatPrice = (price: string | number): string => {
  const numPrice = typeof price === 'number' ? price : parseFloat(price || '0');
  if (numPrice === 0) return 'Free';
  return `₹${numPrice.toLocaleString('en-IN')}`;
};

const formatDuration = (days: number | null): string => {
  if (!days) return '';
  if (days === 30) return '1 Month';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  if (days === 365 || days === 360) return '12 Months';
  return `${days} Days`;
};

const getFeatures = (plan: MembershipPlan): Array<{ icon: any; text: string }> => {
  const featureIcons = [
    Check,
    Eye,
    Heart,
    MessageCircle,
    Filter,
    TrendingUp,
    Phone,
    Image,
    Star,
    Shield,
    Zap,
    Crown,
    Award,
    Search,
    UserCheck,
    Unlock,
    Lock,
  ];
  return (plan.features || []).map((text: string, i: number) => ({
    icon: featureIcons[i % featureIcons.length],
    text,
  }));
};

export default function PublicMembershipPage() {
  const { data: plans = [], isLoading, error, refetch } = useGetMembershipPlansQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const handleUpdate = () => {
      refetch();
    };
    window.addEventListener('membership-plans:updated', handleUpdate);
    return () => window.removeEventListener('membership-plans:updated', handleUpdate);
  }, [refetch]);

  if (isLoading) {
    return (
      <main className="mp-page">
        <section className="mp-state" aria-live="polite">
          <span className="mp-state__icon"><Loader2 className="mp-spin" size={27} /></span>
          <h1>Preparing your membership options</h1>
          <p>We&apos;re loading the latest plans and benefits.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mp-page">
        <section className="mp-state" role="alert">
          <span className="mp-state__icon mp-state__icon--error"><ShieldCheck size={28} /></span>
          <h1>Membership plans are temporarily unavailable</h1>
          <p>Please try again in a moment. Your account and current membership are unaffected.</p>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
        </section>
      </main>
    );
  }

  const activePlans = [...plans]
    .filter((plan) => Number.parseFloat(plan.price) > 0)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <main className="mp-page">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#f4eee8] px-6 pb-20 pt-32 sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_25%,rgba(185,207,174,.45),transparent_24%),radial-gradient(circle_at_88%_20%,rgba(255,255,255,.9),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_.8fr]">
          <div>
            <span className="mp-eyebrow">Membership options</span>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-light leading-[.94] tracking-[-.06em] text-[#2c2928] sm:text-6xl">
              More room for your <em className="font-serif font-normal text-[#bd6970]">love story.</em>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-stone-600">
              Choose the support and access that feels right for your journey. Special Diwali festival offers are now active.
            </p>
          </div>
          <div className="relative mx-auto h-64 w-full max-w-sm overflow-hidden rounded-t-[9rem] bg-[#d8dfd1] shadow-[0_22px_50px_rgba(64,52,43,.14)] sm:h-72">
            <SmartImage src="/images/couple-sunset.jpg" alt="A couple sharing a quiet moment" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="relative bg-[#fff8f3] px-4 py-16 sm:px-6 lg:px-8" id="membership-plans" aria-labelledby="plans-title">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/80 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#713049] shadow-sm backdrop-blur">
              Membership options
            </span>
            <h2 id="plans-title" className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#20111a] sm:text-4xl">
              Choose a plan that works for you.
            </h2>
            <p className="mt-2 text-sm text-stone-600 sm:text-base">
              Compare the benefits clearly and start with the access that feels right for your journey.
            </p>
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-2 text-left text-xs text-amber-900 shadow-sm">
              <ClipboardCheck className="h-5 w-5 text-amber-700 shrink-0" />
              <div>
                <strong className="block font-bold">Clear and carefully activated</strong>
                <span className="text-[11px] text-amber-800">Paid membership requests are reviewed by our team.</span>
              </div>
            </div>
          </div>

          {/* DIWALI FESTIVE OFFER BANNER */}
          <div className="relative mx-auto mb-12 max-w-4xl overflow-hidden rounded-3xl border border-amber-400/50 bg-gradient-to-r from-[#fffbf5] via-[#fff7ee] to-[#fffbf5] p-5 shadow-[0_12px_36px_rgba(217,119,6,0.12)] sm:p-6 transition-all duration-300 hover:shadow-[0_16px_44px_rgba(217,119,6,0.18)]">
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-rose-400/15 blur-2xl" />

            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30 text-2xl animate-pulse">
                  🪔
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                      ✨ Deepavali Festive Offer
                    </span>
                    <span className="rounded-full bg-rose-500/15 border border-rose-400/30 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
                      Save Up to 58%
                    </span>
                  </div>
                  <h3 className="mt-1 text-base sm:text-lg font-black tracking-tight text-[#20111a]">
                    Special Festive Pricing Active on All Plans
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-600">
                    Verified profiles, direct messaging, and personal matchmaking benefits at exclusive festive rates.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center sm:items-end">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-amber-500/30">
                  🎆 Limited Time Festive Special
                </span>
                <span className="mt-1 text-[11px] font-semibold text-stone-500">
                  Special discounts auto-applied
                </span>
              </div>
            </div>
          </div>

          {/* ─────────────────────────── Centered Plans Layout (EXACT SAME AS MEMBER PAGE) ─────────────────────────── */}
          {activePlans.length ? (
            <div className="mx-auto flex max-w-6xl flex-wrap items-stretch justify-center gap-6 pb-16 sm:gap-8">
              {activePlans.map((plan, index) => {
                const Icon = planIcons[index % planIcons.length];
                const features = getFeatures(plan);
                const planName = plan.display_name || plan.name;
                const isFeatured = plan.is_featured;

                const themeClasses = 'border-slate-200 bg-white';
                const btnTheme = isFeatured
                  ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-700'
                  : 'bg-slate-800 text-white hover:bg-slate-900 shadow-sm border border-slate-900';
                const iconTheme = 'bg-slate-100 text-slate-600 border border-slate-200';

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`w-full max-w-[340px] sm:w-[330px] relative overflow-hidden rounded-2xl border ${themeClasses} transition-all duration-200 flex flex-col justify-between ${
                      isFeatured
                        ? 'shadow-brand-md md:scale-105 z-10 border-rose-300 ring-2 ring-rose-100 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Badge as set by Admin */}
                    {plan.badge && (
                      <div
                        className={`absolute top-0 left-0 right-0 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest ${
                          isFeatured
                            ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600'
                            : 'bg-rose-600'
                        }`}
                      >
                        {plan.badge}
                      </div>
                    )}

                    <div className={`p-6 sm:p-8 flex-1 flex flex-col relative z-10 ${plan.badge ? 'pt-10 sm:pt-12' : 'pt-8'}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${iconTheme}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold tracking-tight font-display text-ink">{planName}</h3>
                          <p className="mt-1 text-xs font-medium text-muted">{plan.description || 'Thoughtful benefits for your matchmaking journey.'}</p>
                        </div>
                      </div>

                      <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Investment</p>
                        <div className="space-y-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl sm:text-4xl font-black tracking-tight text-ink">
                              {formatPrice(plan.price)}
                            </span>
                            {plan.duration_days && (
                              <span className="text-sm font-semibold text-slate-500">
                                / {formatDuration(plan.duration_days)}
                              </span>
                            )}
                          </div>
                          {plan.duration_days && parseFloat(plan.price) > 0 && (
                            <div className="text-xs font-medium text-slate-600">
                              About ₹{Math.round(parseFloat(plan.price) / (plan.duration_days / 30)).toLocaleString('en-IN')} / month
                            </div>
                          )}
                          {(plan.price_3m || plan.price_6m || plan.price_1y) && (
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                              {plan.price_3m && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-slate-600">3 months</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-ink">{formatPrice(plan.price_3m)}</span>
                                    {plan.discount_3m && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{plan.discount_3m}</span>}
                                  </div>
                                </div>
                              )}
                              {plan.price_6m && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-slate-600">6 months</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-ink">{formatPrice(plan.price_6m)}</span>
                                    {plan.discount_6m && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{plan.discount_6m}</span>}
                                  </div>
                                </div>
                              )}
                              {plan.price_1y && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-slate-600">12 months</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-ink">{formatPrice(plan.price_1y)}</span>
                                    {plan.discount_1y && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{plan.discount_1y}</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-4 mb-8 flex-1">
                        {features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 text-slate-400">
                              <feature.icon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-600 leading-tight">
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto">
                        <Link
                          href={`/register?plan=${encodeURIComponent(plan.slug)}`}
                          className={`w-full py-3.5 px-4 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 ${btnTheme}`}
                        >
                          Request {planName}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <p className="mt-2 text-center text-[11px] text-stone-400">Activation follows membership review.</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="mp-empty">
              <Gift size={30} />
              <h3>Membership options are temporarily unavailable.</h3>
              <p>You can still create a free profile and begin exploring verified matches today.</p>
              <Link href="/register">Create free profile <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="mp-trust-section" aria-labelledby="membership-trust-title">
        <div className="mp-shell">
          <div className="mp-trust-heading">
            <span className="mp-eyebrow">Designed around trust</span>
            <h2 id="membership-trust-title">More access, without compromising your privacy.</h2>
          </div>
          <div className="mp-trust-grid">
            {trustIndicators.map(({ icon: Icon, title, description }) => (
              <article className="mp-trust-card" key={title}>
                <span className="mp-trust-icon"><Icon size={21} /></span>
                <div><strong>{title}</strong><span>{description}</span></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="mp-faq-section" aria-labelledby="membership-faq-title">
        <div className="mp-shell">
          <div className="mp-faq-heading">
            <span className="mp-eyebrow">Frequently asked</span>
            <h2 id="membership-faq-title">Everything you need to know.</h2>
          </div>
          <div className="mp-faq-list">
            {faqs.map(({ question, answer }, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={question} className={`mp-faq-item ${isOpen ? 'mp-faq-item--open' : ''}`}>
                  <button
                    type="button"
                    className="mp-faq-trigger"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{question}</span>
                    <ChevronDown size={18} className={`mp-faq-chevron ${isOpen ? 'mp-faq-chevron--rotated' : ''}`} />
                  </button>
                  {isOpen && <div className="mp-faq-body"><p>{answer}</p></div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
