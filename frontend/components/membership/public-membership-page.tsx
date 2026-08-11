'use client';

import { useState } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/shared/smart-image';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardCheck,
  Crown,
  Gem,
  Gift,
  Headphones,
  Heart,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useGetMembershipPlansQuery, type MembershipPlan } from '@/legacy/services/membershipApi';

const planIcons = [Heart, Star, Gem, Crown, ShieldCheck, Award];

const faqs = [
  {
    question: 'Can I upgrade my plan later?',
    answer: 'Yes. You can begin with the Free plan and request an upgrade whenever you are ready for more profile access, messaging, or advanced search features.',
  },
  {
    question: 'How are paid memberships activated?',
    answer: 'Choose a plan while registering or from your membership page. Your request is reviewed by our team and the plan is activated after approval.',
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
  { icon: BadgeCheck, title: 'Verified community', description: 'Government ID verification supported' },
  { icon: LockKeyhole, title: 'Privacy controls', description: 'Your personal details stay protected' },
  { icon: Headphones, title: 'Human support', description: 'Helpful assistance when you need it' },
];

function formatPrice(price: string): string {
  const amount = Number.parseFloat(price);
  if (!Number.isFinite(amount) || amount === 0) return 'Free';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDuration(days: number | null): string {
  if (!days) return 'No expiry';
  if (days === 30) return '1 month';
  if (days === 90) return '3 months';
  if (days === 180) return '6 months';
  if (days === 365) return '12 months';
  return `${days} days`;
}

function monthlyPrice(plan: MembershipPlan): string | null {
  const amount = Number.parseFloat(plan.price);
  if (!plan.duration_days || !Number.isFinite(amount) || amount <= 0) return null;
  const monthly = Math.round(amount / (plan.duration_days / 30));
  return `About ₹${monthly.toLocaleString('en-IN')} per month`;
}

function planFeatures(plan: MembershipPlan): string[] {
  return (plan.features || []).slice(0, 8);
}

function cardTone(_plan: MembershipPlan): string {
  return 'mp-plan-card--standard';
}

export default function PublicMembershipPage() {
  const { data: plans = [], isLoading, error } = useGetMembershipPlansQuery();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const sortedPlans = [...plans].sort((a, b) => a.display_order - b.display_order);

  return (
    <main className="mp-page">
      <section className="relative overflow-hidden bg-[#f4eee8] px-6 pb-20 pt-32 sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_25%,rgba(185,207,174,.45),transparent_24%),radial-gradient(circle_at_88%_20%,rgba(255,255,255,.9),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_.8fr]">
          <div><span className="mp-eyebrow">Membership options</span><h1 className="mt-5 max-w-xl font-display text-5xl font-light leading-[.94] tracking-[-.06em] text-[#2c2928] sm:text-6xl">More room for your <em className="font-serif font-normal text-[#bd6970]">love story.</em></h1><p className="mt-6 max-w-lg text-base leading-7 text-stone-600">Choose the support and access that feels right for your journey. You can always start free.</p></div>
          <div className="relative mx-auto h-64 w-full max-w-sm overflow-hidden rounded-t-[9rem] bg-[#d8dfd1] shadow-[0_22px_50px_rgba(64,52,43,.14)] sm:h-72"><SmartImage src="/images/couple-sunset.jpg" alt="A couple sharing a quiet moment" className="h-full w-full object-cover" /></div>
        </div>
      </section>
      <section className="mp-plans-section" id="membership-plans" aria-labelledby="plans-title">
        <div className="mp-shell">
          <div className="mp-plans-intro">
            <div className="mp-plans-intro__copy">
              <span className="mp-eyebrow">Membership options</span>
              <h2 id="plans-title">Choose a plan that works for you.</h2>
              <p>Compare the benefits clearly and start with the access that feels right for your journey.</p>
            </div>
            <div className="mp-approval-note">
              <ClipboardCheck size={21} />
              <p><strong>Clear and carefully activated</strong><span>Paid membership requests are reviewed by our team.</span></p>
            </div>
          </div>

          {sortedPlans.length ? (
            <div className={`mp-plans-grid ${sortedPlans.length <= 2 ? 'mp-plans-grid--2' : `mp-plans-grid--${Math.min(sortedPlans.length, 4)}`}`}>
              {sortedPlans.map((plan, index) => {
                const Icon = planIcons[index % planIcons.length];
                const features = planFeatures(plan);
                const perMonth = monthlyPrice(plan);
                const isFree = Number.parseFloat(plan.price) === 0;
                const durationLabel = isFree ? 'Always free' : formatDuration(plan.duration_days);

                return (
                  <article
                    key={plan.id}
                    className={`mp-plan-card mp-plan-card--standard ${plan.is_featured ? 'mp-plan-card--featured' : ''}`}
                  >
                    {plan.badge ? <span className="mp-plan-badge">{plan.badge}</span> : plan.is_featured ? <span className="mp-plan-badge">Most popular</span> : null}
                    <div className="mp-plan-header">
                      <div className="mp-plan-header__top">
                        <span className="mp-plan-icon"><Icon size={22} /></span>
                        <span className="mp-plan-duration">{durationLabel}</span>
                      </div>
                      <h3>{plan.display_name || plan.name}</h3>
                      <p>{plan.description || 'Thoughtful benefits for your matchmaking journey.'}</p>

                      <div className="mp-plan-pricing">
                        <div className="mp-plan-price">
                          <strong>{formatPrice(plan.price)}</strong>
                          {!isFree && <span>/ {formatDuration(plan.duration_days)}</span>}
                        </div>
                        <small className="mp-plan-monthly">{perMonth || (isFree ? 'No payment required' : 'One membership period')}</small>
                        {(plan.price_3m || plan.price_6m || plan.price_1y) && (
                          <div className="mp-plan-durations">
                            {plan.price_3m && (
                              <div className="mp-plan-duration-row">
                                <span>3 months</span>
                                <span className="mp-plan-duration-price">{formatPrice(plan.price_3m)}</span>
                                {plan.discount_3m && <span className="mp-plan-discount-badge">{plan.discount_3m}</span>}
                              </div>
                            )}
                            {plan.price_6m && (
                              <div className="mp-plan-duration-row">
                                <span>6 months</span>
                                <span className="mp-plan-duration-price">{formatPrice(plan.price_6m)}</span>
                                {plan.discount_6m && <span className="mp-plan-discount-badge">{plan.discount_6m}</span>}
                              </div>
                            )}
                            {plan.price_1y && (
                              <div className="mp-plan-duration-row">
                                <span>12 months</span>
                                <span className="mp-plan-duration-price">{formatPrice(plan.price_1y)}</span>
                                {plan.discount_1y && <span className="mp-plan-discount-badge">{plan.discount_1y}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mp-plan-body">
                      <div className="mp-plan-divider" />
                      <p className="mp-plan-includes">What&apos;s included</p>
                      <ul className="mp-plan-features">
                        {features.map((feature, index) => (
                          <li key={feature} className={index === 0 && !isFree ? 'mp-feature--inherit' : ''}>
                            <span className="mp-feature-check"><Check size={12} /></span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={isFree ? '/register' : `/register?plan=${encodeURIComponent(plan.slug)}`}
                        className={`mp-plan-cta ${plan.is_featured ? 'mp-plan-cta--featured' : 'mp-plan-cta--default'}`}
                      >
                        {isFree ? 'Start free' : `Request ${plan.display_name || plan.name}`}
                        <ArrowRight size={16} />
                      </Link>
                      <p className="mp-plan-footnote">{isFree ? 'Create your profile in minutes.' : 'Activation follows membership review.'}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mp-empty">
              <Gift size={30} />
              <h3>New membership options are coming soon.</h3>
              <p>You can still create a free profile and begin exploring verified matches today.</p>
              <Link href="/register">Create free profile <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </section>

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

      <section className="mp-faq-section" aria-labelledby="membership-faq-title">
        <div className="mp-shell mp-faq-layout">
          <div className="mp-faq-heading">
            <span className="mp-eyebrow">Questions, answered</span>
            <h2 id="membership-faq-title">Everything you need to choose confidently.</h2>
            <p>Still unsure which plan is right for you? Our support team can walk you through the options.</p>
            <Link href="/contact">Talk to our team <ArrowRight size={16} /></Link>
          </div>

          <div className="mp-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <article className={`mp-faq-item ${isOpen ? 'is-open' : ''}`} key={faq.question}>
                  <button
                    type="button"
                    className="mp-faq-button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    aria-controls={`membership-faq-answer-${index}`}
                  >
                    <span>{faq.question}</span>
                    <span className="mp-faq-chevron"><ChevronDown size={17} /></span>
                  </button>
                  <div className="mp-faq-answer-grid" id={`membership-faq-answer-${index}`}>
                    <div className="mp-faq-answer"><p>{faq.answer}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mp-cta-section">
        <div className="mp-shell">
          <div className="mp-cta-banner">
            <div className="mp-cta-mark"><Heart size={24} fill="currentColor" /></div>
            <div>
              <span>Begin with confidence</span>
              <h2>Your search deserves the right support.</h2>
              <p>Create your profile for free today. Upgrade only when you are ready for more.</p>
            </div>
            <div className="mp-cta-actions">
              <Link href="/register" className="mp-cta-primary">Create free profile <ArrowRight size={17} /></Link>
              <Link href="/success-stories" className="mp-cta-secondary">Read success stories</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
