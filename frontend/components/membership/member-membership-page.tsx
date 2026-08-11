'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Gem, Crown, Star, Heart, Loader2, X, ArrowUpCircle, AlertTriangle, 
  Clock, Shield, ShieldCheck, Zap, Users, MessageCircle, Eye, Search, Camera, 
  Gift, Award, TrendingUp, Lock, Unlock,
  Phone, Mail, Globe, UserCheck, Filter, Image, ChevronRight,
  Printer, Receipt, FileText, RotateCcw, ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import { 
  useGetMembershipPlansQuery,
  useCreateMembershipOrderMutation,
  useVerifyMembershipPaymentMutation,
  useGetMembershipSummaryQuery,
  useGetAvailableUpgradesQuery,
  useUpgradeMembershipMutation,
  useActivateFreePlanMutation,
  useCancelMembershipMutation,
  useGetMembershipStatusDetailQuery,
  type MembershipPlan 
} from '@/legacy/services/membershipApi';
import { useGetVerificationStatusQuery } from '@/legacy/services/verificationStatusApi';

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; }; }
}

const planIcons = [Heart, Star, Gem, Crown, ShieldCheck, Award];

const planTheme = (plan: MembershipPlan, isCurrent: boolean) => {
  const defaultBorder = 'border-slate-200 bg-white';
  const activeBorder = 'border-emerald-300 ring-1 ring-emerald-100';
  const border = isCurrent ? activeBorder : (plan.color ? `border-slate-200 bg-white ring-1 ${plan.color}` : defaultBorder);
  return border;
};

export default function MemberMembershipPage() {
  const { user, updateUser } = useAuth();
  // Memberships can be changed by an administrator while this page is open.
  // Polling keeps the displayed plan, plan catalogue and upgrade options current
  // without requiring the member to manually reload the page.
  const { data: plans = [], isLoading, error } = useGetMembershipPlansQuery(undefined);
  const { data: summary, refetch: refetchSummary } = useGetMembershipSummaryQuery(undefined);
  const { data: statusDetail, refetch: refetchStatus } = useGetMembershipStatusDetailQuery(undefined, { skip: false });
  const { data: upgrades } = useGetAvailableUpgradesQuery(undefined);
  const [createOrder, { isLoading: isActivating }] = useCreateMembershipOrderMutation();
  const [verifyPayment] = useVerifyMembershipPaymentMutation();
  const [upgradeMembership, { isLoading: isUpgrading }] = useUpgradeMembershipMutation();
  const [activateFree] = useActivateFreePlanMutation();
  const [cancelMembership, { isLoading: isCancelling }] = useCancelMembershipMutation();
  const { data: verification, refetch: refetchVerification } = useGetVerificationStatusQuery();

  useEffect(() => {
    refetchVerification();
  }, [refetchVerification]);
  
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'choose_duration' | 'processing' | 'success' | 'error'>('select');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Payment History and Receipt states
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  const loadPaymentHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchApi<any[]>('/payments/history/');
      setPaymentHistory(Array.isArray(data) ? data : []);
    } catch {
      // Fallback
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  useEffect(() => {
    if (document.querySelector('script[data-razorpay-checkout]')) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    document.body.appendChild(script);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg">
        <div className="text-center p-8 bg-white rounded-xl shadow-brand-sm border border-line">
          <div className="text-error mb-4 font-medium">Failed to load membership plans</div>
          <button onClick={() => window.location.reload()} className="text-rose-600 font-medium hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  const handleSelectPlan = (plan: MembershipPlan) => {
    if (plan.slug === 'free') {
      setErrorMsg('You cannot downgrade to a free plan. Contact support if you need to cancel your membership.');
      setCheckoutStep('error');
      return;
    }
    setSelectedPlan(plan);
    setSelectedDuration(null);
    setCheckoutStep('choose_duration');
  };

  const handleProceedToPayment = async (durationDays: number | null) => {
    const plan = selectedPlan;
    if (!plan) return;
    setSelectedDuration(durationDays);
    setCheckoutStep('processing');
    setErrorMsg('');
    try {
      const rawOrder = await createOrder({ plan_id: plan.id, duration_days: durationDays ?? undefined }).unwrap();
      const order = (rawOrder as any)?.data || rawOrder;

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay checkout SDK. Please check your connection and try again.'));
          document.body.appendChild(script);
        });
      }

      if (!window.Razorpay) throw new Error('Secure checkout could not be loaded. Please try again.');
      setCheckoutStep('select');
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'My Dear Partner',
        description: `${order.plan?.name || plan.name} membership`,
        order_id: order.razorpay_order_id,
        handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setCheckoutStep('processing');
          try {
            const verified = await verifyPayment({
              internal_order_id: order.internal_order_id,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }).unwrap();
            const mem = verified?.membership;
            if (mem) {
              setSuccessMsg(`Your ${mem.plan_name} membership is active until ${new Date(mem.expires_at).toLocaleDateString()}.`);
            } else {
              setSuccessMsg('Your membership has been activated successfully!');
            }
            setCheckoutStep('success');
            await refetchSummary();
            updateUser(await fetchApi<any>('/member-auth/me/'));
            setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
          } catch (error: any) {
            setErrorMsg(error.message || 'We could not verify your payment. Please contact support if you were charged.');
            setCheckoutStep('error');
          }
        },
        modal: { ondismiss: () => setCheckoutStep('select') },
      });
      checkout.open();
    } catch (err: any) {
      const missing = err?.errors?.missing;
      setErrorMsg(missing?.length ? `Finish these checks first: ${missing.join(', ').replaceAll('_', ' ')}.` : (err.message || 'Failed to start secure checkout'));
      setCheckoutStep('error');
    }
  };

  const handleUpgrade = async (planSlug: string) => {
    try {
      await upgradeMembership({ plan_slug: planSlug }).unwrap();
      setSuccessMsg('Plan upgraded successfully!');
      setCheckoutStep('success');
      await refetchSummary();
      updateUser(await fetchApi<any>('/member-auth/me/'));
      setTimeout(() => setCheckoutStep('select'), 1200);
    } catch (err: any) {
      setErrorMsg(err?.data?.message || err.message || 'Upgrade failed.');
      setCheckoutStep('error');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your membership? You will lose access to all premium features.')) return;
    try {
      await cancelMembership({ reason: 'member_requested' }).unwrap();
      setSuccessMsg('Membership cancelled. You have been downgraded to Free.');
      setCheckoutStep('success');
      await refetchSummary();
      updateUser(await fetchApi<any>('/member-auth/me/'));
      setTimeout(() => setCheckoutStep('select'), 1200);
    } catch (err: any) {
      setErrorMsg(err?.data?.message || err.message || 'Failed to cancel.');
      setCheckoutStep('error');
    }
  };

  const formatPrice = (price: string): string => {
    const numPrice = parseFloat(price);
    if (numPrice === 0) return 'Free';
    return `\u20B9${numPrice.toLocaleString('en-IN')}`;
  };

  const formatDuration = (days: number | null): string => {
    if (!days) return '';
    if (days === 30) return '1 Month';
    if (days === 90) return '3 Months';
    if (days === 180) return '6 Months';
    if (days === 365) return '12 Months';
    return `${days} Days`;
  };

  const getFeatures = (plan: MembershipPlan): Array<{icon: any, text: string, highlight?: boolean}> => {
    const featureIcons = [Check, Eye, Heart, MessageCircle, Filter, TrendingUp, Phone, Image, Star, Shield, Zap, Crown, Award, Search, UserCheck, Unlock, Lock];
    return (plan.features || []).map((text: string, i: number) => ({
      icon: featureIcons[i % featureIcons.length],
      text,
      highlight: false,
    }));
  };

  const isCurrentPlan = (slug: string) => summary?.plan_slug === slug;

  return (
    <div className="min-h-[100svh] bg-[#fcfaf9] pb-24 font-sans text-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-20 pt-6 sm:pt-8">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-4 py-2.5 text-sm font-bold text-[#703047] shadow-sm transition hover:-translate-x-0.5 hover:border-rose-200 hover:bg-rose-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        
        {/* Verification Notice */}
        {verification && !verification.is_verified && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center flex-shrink-0 text-amber-600">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink mb-1">Account Verification Required</h3>
                  <p className="text-muted text-sm">
                    Complete verification to purchase premium plans:{' '}
                    <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 ml-1">
                      {verification.next_action}
                    </span>
                  </p>
                </div>
              </div>
              <a 
                href="/verification" 
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all text-sm shadow-sm shrink-0 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                Verify Now
              </a>
            </div>
          </motion.div>
        )}

        {/* Expiry Warning */}
        {summary?.has_active_plan && !summary?.is_free && summary?.days_remaining !== null && summary?.days_remaining !== undefined && summary?.days_remaining <= 7 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-rose-900 text-sm font-medium">
              Your membership expires in <strong className="text-rose-700 font-bold">{summary.days_remaining} day{summary.days_remaining !== 1 ? 's' : ''}</strong>.{' '}
              {summary.days_remaining <= 3 ? 'Renew now to keep your premium features active!' : 'Consider renewing to avoid interruption.'}
            </span>
          </motion.div>
        )}

        {/* ─────────────────────────── Centered Plans Layout ─────────────────────────── */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-stretch justify-center gap-6 px-2 pb-16 sm:gap-8">
          {[...plans]
            .filter(plan => Number.parseFloat(plan.price) > 0)
            .sort((a, b) => a.display_order - b.display_order)
            .map((plan, index) => {
              const Icon = planIcons[index % planIcons.length];
              const features = getFeatures(plan);
              const planName = plan.display_name || plan.name;
              const isCurrent = isCurrentPlan(plan.slug);
              const upgradeInfo = upgrades?.plans?.find((p: any) => p.slug === plan.slug);
              const isUpgradable = upgradeInfo?.is_upgrade && !isCurrent && Number.parseFloat(plan.price) > 0;
              
              const themeClasses = plan.color ? `border-slate-200 bg-white` : 'border-slate-200 bg-white';
              const badgeTheme = '';
              const btnTheme = plan.is_featured ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-700' : 'bg-slate-800 text-white hover:bg-slate-900 shadow-sm border border-slate-900';
              const iconTheme = 'bg-slate-100 text-slate-600 border border-slate-200';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`w-full max-w-[340px] sm:w-[330px] relative overflow-hidden rounded-2xl border ${themeClasses} transition-all duration-200 flex flex-col justify-between ${
                    plan.is_featured
                      ? 'shadow-brand-md md:scale-105 z-10 border-rose-300 ring-2 ring-rose-100'
                      : isCurrent
                      ? 'shadow-sm border-emerald-300 ring-1 ring-emerald-100'
                      : 'shadow-sm'
                  }`}
                >
                  
                  {plan.badge && (
                    <div className="absolute top-0 left-0 right-0 bg-rose-600 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">
                      {plan.badge}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute top-0 left-0 right-0 bg-emerald-600 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">
                      {summary?.days_remaining !== null && summary?.days_remaining !== undefined && !summary?.is_free
                        ? `${summary.days_remaining} day${summary.days_remaining !== 1 ? 's' : ''} remaining`
                        : 'Current Plan'}
                    </div>
                  )}

                  <div className={`p-6 sm:p-8 flex-1 flex flex-col relative z-10 ${plan.is_featured || isCurrent ? 'pt-10 sm:pt-12' : 'pt-8'}`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${iconTheme}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight font-display text-ink">{planName}</h3>
                        <p className="mt-1 text-xs font-medium text-muted">{plan.description || 'Elevate your experience.'}</p>
                      </div>
                    </div>

                    <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Investment</p>
                      <div className="space-y-2">
                        {!isCurrent && upgradeInfo?.prorated_discount && upgradeInfo.prorated_discount > 0 ? (
                          <div>
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-lg font-bold line-through text-slate-400">
                                {formatPrice(plan.price)}
                              </span>
                              <span className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-700">
                                {formatPrice(upgradeInfo.upgrade_price ?? plan.price)}
                              </span>
                              {plan.duration_days && (
                                <span className="text-sm font-semibold text-slate-500">
                                  / {formatDuration(plan.duration_days)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                              <span>Includes {'\u20B9'}{upgradeInfo.prorated_discount.toLocaleString('en-IN')} credit for remaining active days</span>
                            </div>
                          </div>
                        ) : (
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
                        )}
                        {plan.duration_days && parseFloat(plan.price) > 0 && (
                          <div className="text-xs font-medium text-slate-600">
                            About {'\u20B9'}{Math.round((!isCurrent ? upgradeInfo?.upgrade_price : undefined) ?? parseFloat(plan.price) / (plan.duration_days / 30)).toLocaleString('en-IN')} / month
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
                          <div className={`mt-0.5 flex-shrink-0 ${feature.highlight ? 'text-rose-600' : 'text-slate-400'}`}>
                            {feature.highlight ? <Check className="w-4 h-4" /> : <feature.icon className="w-4 h-4" />}
                          </div>
                          <span className={`text-sm leading-tight ${feature.highlight ? 'font-semibold text-ink' : 'font-medium text-slate-600'}`}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <div className="mt-auto">
                      {isCurrent ? (
                        <button disabled className="w-full py-3.5 px-4 rounded-xl font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default flex items-center justify-center gap-2">
                          <Check className="w-5 h-5" /> Your Active Plan
                        </button>
                      ) : isUpgradable ? (
                        <button
                          onClick={() => handleSelectPlan(plan)}
                          disabled={isActivating || (plan.slug !== 'free' && verification?.is_verified === false)}
                          className={`w-full py-3.5 px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btnTheme}`}
                        >
                          {isActivating ? (
                            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Activating...</span>
                          ) : verification?.is_verified === false ? (
                            'Verify to upgrade'
                          ) : (
                            <span className="flex items-center justify-center gap-2"><ArrowUpCircle className="w-5 h-5" /> Upgrade to {planName}</span>
                          )}
                        </button>
                      ) : Number.parseFloat(plan.price) === 0 ? (
                        <button disabled className="w-full py-3.5 px-4 rounded-xl font-bold bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2">
                          <Lock className="w-5 h-5" /> Current Plan
                        </button>
                      ) : upgradeInfo?.is_downgrade ? (
                        <button disabled className="w-full py-3.5 px-4 rounded-xl font-bold bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2">
                          <Lock className="w-5 h-5" /> Downgrade Blocked
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectPlan(plan)}
                          disabled={isActivating || (plan.slug !== 'free' && verification?.is_verified === false)}
                          className={`w-full py-3.5 px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btnTheme}`}
                        >
                          {isActivating ? (
                            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Activating...</span>
                          ) : verification?.is_verified === false ? (
                            'Verify to purchase'
                          ) : (
                            <span className="flex items-center justify-center gap-2"><Gift className="w-5 h-5" /> Get {planName}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </div>

        {/* Razorpay Compliance & Security Disclaimer */}
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 sm:p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-white">100% Secure Checkout powered by Razorpay</h4>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">PCI-DSS Encrypted</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  All transactions are processed in INR (₹) using 256-bit bank-grade SSL encryption. Eligible refunds are processed back to your original payment method within 5–7 business days per platform terms.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-300 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/60 w-full md:w-auto justify-end">
              <a href="/terms" className="hover:text-white transition-colors underline underline-offset-2">Terms</a>
              <span className="text-slate-600">•</span>
              <a href="/privacy" className="hover:text-white transition-colors underline underline-offset-2">Privacy</a>
              <span className="text-slate-600">•</span>
              <a href="/refund-policy" className="hover:text-white transition-colors underline underline-offset-2">Refund Policy</a>
            </div>
          </div>
        </div>

        {/* ─────────────────────────── Bento Grid: Why Upgrade? ─────────────────────────── */}
        <div className="mt-12 mb-20 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-ink font-display tracking-tight mb-4">Why go premium?</h2>
            <p className="text-muted text-sm sm:text-base max-w-xl mx-auto">Supercharge your search with tools designed to get you on better dates, faster.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bento Card 1: See Who Likes You */}
            <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-white border border-line p-8 group shadow-brand-sm">
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-600 mb-6">
                    <Heart className="w-6 h-6 fill-rose-100" />
                  </div>
                  <h3 className="text-xl font-bold text-ink mb-2">See who likes you</h3>
                  <p className="text-muted font-medium max-w-sm leading-relaxed text-sm">Don't wait around. Instantly match with people who have already sent you an interest.</p>
                </div>
                
                <div className="mt-8 flex gap-3">
                  <div className="w-20 h-28 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden relative flex items-center justify-center">
                    <Heart className="w-6 h-6 text-slate-300" />
                  </div>
                  <div className="w-20 h-28 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden relative hidden sm:flex items-center justify-center">
                    <Heart className="w-6 h-6 text-slate-300" />
                  </div>
                  <div className="w-20 h-28 rounded-xl bg-rose-50 border border-rose-200 overflow-hidden relative flex items-center justify-center flex-col gap-1">
                    <span className="text-lg font-bold text-rose-600">+24</span>
                    <span className="text-[9px] font-bold uppercase text-rose-400">Others</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Advanced Search */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-line p-8 group shadow-brand-sm">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-gold-50 border border-gold-100 rounded-xl flex items-center justify-center text-gold-600 mb-6">
                  <Filter className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">Laser focus</h3>
                <p className="text-muted font-medium leading-relaxed mb-8 text-sm">Unlock advanced filters like education, income, and lifestyle habits.</p>
                
                <div className="space-y-3">
                  <div className="h-10 w-full bg-slate-50 rounded-lg border border-slate-200 flex items-center px-4 gap-3">
                    <div className="w-4 h-4 rounded-full bg-gold-500" />
                    <div className="h-2 w-1/2 bg-slate-200 rounded-full" />
                  </div>
                  <div className="h-10 w-4/5 bg-slate-50 rounded-lg border border-slate-200 flex items-center px-4 gap-3">
                    <div className="w-4 h-4 rounded-full border border-slate-300" />
                    <div className="h-2 w-1/3 bg-slate-200 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Messaging */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-line p-8 group shadow-brand-sm">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-plum-50 border border-plum-100 rounded-xl flex items-center justify-center text-plum-700 mb-6">
                  <MessageCircle className="w-6 h-6 fill-plum-100" />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">Direct access</h3>
                <p className="text-muted font-medium leading-relaxed text-sm">Message matches directly without waiting for a mutual connection.</p>
              </div>
            </div>

            {/* Bento Card 4: Verified Contacts */}
            <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-white border border-line p-8 group shadow-brand-sm flex flex-col sm:flex-row gap-8 items-center">
              <div className="flex-1">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6">
                  <Phone className="w-6 h-6 fill-emerald-100" />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">Verified Contacts</h3>
                <p className="text-muted font-medium leading-relaxed text-sm">Take the conversation offline. Access verified phone numbers and emails securely.</p>
              </div>
              
              <div className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-2.5 w-20 bg-slate-300 rounded-full mb-1.5" />
                    <div className="h-2 w-12 bg-slate-200 rounded-full" />
                  </div>
                </div>
                <div className="bg-emerald-50 text-emerald-700 text-xs font-bold py-2.5 px-3 rounded-lg flex justify-between items-center border border-emerald-200">
                  <span>+91 98765 43210</span>
                  <Check className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ─────────────────────────── Payment & Billing History Section ─────────────────────────── */}
        <div className="mt-16 mb-20 max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-ink font-display tracking-tight flex items-center gap-2">
                <Receipt className="w-6 h-6 text-rose-600" />
                Payment & Billing History
              </h2>
              <p className="text-muted text-xs sm:text-sm mt-1">View past membership orders and download official payment receipts / invoices.</p>
            </div>
            <button
              onClick={loadPaymentHistory}
              disabled={historyLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-line shadow-brand-sm overflow-hidden">
            {historyLoading ? (
              <div className="p-8 text-center text-muted flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-rose-600" /> Loading payment records...
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-sm">No Payment Records Found</p>
                <p className="text-xs text-slate-400 mt-1">Purchased plan receipts and invoices will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                      <th className="py-3.5 px-4">Invoice No</th>
                      <th className="py-3.5 px-4">Plan Tier</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Billing Period</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action / Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {paymentHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.invoice_no || `INV-${item.id.slice(0, 8).toUpperCase()}`}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{item.plan_name}</span>
                          {item.is_admin_grant && <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Admin Grant</span>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {item.currency === 'INR' ? '₹' : item.currency} {item.amount}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {item.starts_at ? new Date(item.starts_at).toLocaleDateString() : 'N/A'} - {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.status === 'ACTIVE' || item.status === 'SUCCESS' || item.status === 'CAPTURED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Check className="w-3 h-3 text-emerald-600" />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setActiveReceipt(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shadow-xs cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Receipt / Invoice (PDF)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────── Official Tax Invoice / Payslip PDF Modal ─────────────────────────── */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" onClick={() => setActiveReceipt(null)}>
          <div
            id="printable-receipt"
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-pink-600 p-6 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <img src="/images/main-logo.png" alt="My Dear Partner" className="w-8 h-8 object-contain bg-white/10 rounded-lg p-1" />
                  <div>
                    <span className="text-xl font-extrabold tracking-tight font-display block">MY DEAR PARTNER</span>
                    <span className="text-[10px] tracking-wider uppercase text-rose-200 font-bold block">A Worexa Technologies Platform</span>
                  </div>
                </div>
                <p className="text-xs text-rose-100 mt-2 font-medium">Official Matrimonial Membership Receipt & Tax Invoice</p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest border border-white/30">
                  {activeReceipt.status || 'PAID'}
                </span>
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Invoice Reference</span>
                  <strong className="text-sm font-mono text-slate-900">{activeReceipt.invoice_no || `INV-${activeReceipt.id.slice(0, 8).toUpperCase()}`}</strong>
                  <span className="text-slate-500 block mt-1">Date: {activeReceipt.created_at ? new Date(activeReceipt.created_at).toLocaleString() : new Date().toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Payment ID</span>
                  <strong className="text-xs font-mono text-slate-700">{activeReceipt.payment_id || 'N/A'}</strong>
                  <span className="text-slate-500 block mt-1">Payment Method: Online / Admin Grant</span>
                </div>
              </div>

              {/* Billed To */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Billed To (Customer Details)</span>
                <p className="font-bold text-slate-900 text-sm">{activeReceipt.member_name || user?.full_name || user?.email}</p>
                <p className="text-slate-600 mt-0.5">Email: {activeReceipt.member_email || user?.email}</p>
                <p className="text-slate-600">Mobile: {activeReceipt.member_mobile || user?.mobile_number || 'N/A'}</p>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Item / Service Description</th>
                      <th className="p-3">Billing Period</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    <tr>
                      <td className="p-3">
                        <strong className="text-slate-900 text-sm block">{activeReceipt.plan_name} Plan</strong>
                        <span className="text-slate-500 text-[11px]">Unlimited Premium Matchmaking & Direct Connect</span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {activeReceipt.starts_at ? new Date(activeReceipt.starts_at).toLocaleDateString() : 'Immediate'} to {activeReceipt.expires_at ? new Date(activeReceipt.expires_at).toLocaleDateString() : 'Expiry'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 text-sm">
                        ₹{activeReceipt.amount}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Official Verified Digital Receipt</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Total Paid</span>
                  <strong className="text-xl font-extrabold text-emerald-900">
                    {activeReceipt.currency === 'INR' ? '₹' : activeReceipt.currency} {activeReceipt.amount}
                  </strong>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print / Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duration Picker Modal */}
      <AnimatePresence>
        {checkoutStep === 'choose_duration' && selectedPlan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4 backdrop-blur-sm"
          >
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-brand-lg border border-line">
              <h3 className="text-xl font-bold text-ink mb-1">{selectedPlan.display_name || selectedPlan.name}</h3>
              <p className="text-sm text-muted mb-3">Choose your billing period</p>
              {(() => {
                const upgradeList: any[] = Array.isArray(upgrades) ? upgrades : ((upgrades as any)?.available_upgrades || statusDetail?.available_upgrades || []);
                const upgradeItem = upgradeList.find((u: any) => u.slug === selectedPlan.slug);
                const activeCredit: number = (summary as any)?.prorated_credit ?? (upgradeItem?.prorated_discount ?? 0);
                return (
                  <>
                    {activeCredit > 0 && (
                      <div className="mb-5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{'\u20B9'}{activeCredit.toLocaleString('en-IN')} credit applied from active plan</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      {/* Base / 1 Month */}
                      {(() => {
                        const rawPrice = parseFloat(selectedPlan.price);
                        const netPayable = Math.max(0, rawPrice - activeCredit);
                        const creditApplied = Math.min(rawPrice, activeCredit);
                        return (
                          <button
                            onClick={() => handleProceedToPayment(selectedPlan.duration_days)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-left"
                          >
                            <div>
                              <div className="font-bold text-ink">{formatDuration(selectedPlan.duration_days)}</div>
                              <div className="text-xs text-muted">About {'\u20B9'}{Math.round(netPayable / ((selectedPlan.duration_days || 30) / 30)).toLocaleString('en-IN')} / month</div>
                            </div>
                            <div className="text-right">
                              {activeCredit > 0 && rawPrice > 0 ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="line-through text-xs text-slate-400">{'\u20B9'}{rawPrice.toLocaleString('en-IN')}</span>
                                    <span className="font-black text-lg text-emerald-600">{netPayable === 0 ? 'Free' : `\u20B9${netPayable.toLocaleString('en-IN')}`}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                                    {'\u20B9'}{creditApplied.toLocaleString('en-IN')} credit applied
                                  </div>
                                </div>
                              ) : (
                                <div className="font-black text-lg text-ink">{formatPrice(selectedPlan.price)}</div>
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      {/* 3 Months */}
                      {selectedPlan.price_3m && Number(selectedPlan.price_3m) > 0 && (!selectedPlan.duration_days || selectedPlan.duration_days !== 90) && (() => {
                        const rawPrice = parseFloat(selectedPlan.price_3m);
                        const netPayable = Math.max(0, rawPrice - activeCredit);
                        const creditApplied = Math.min(rawPrice, activeCredit);
                        return (
                          <button
                            onClick={() => handleProceedToPayment(90)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-left"
                          >
                            <div>
                              <div className="font-bold text-ink">3 Months</div>
                              <div className="text-xs text-muted">About {'\u20B9'}{Math.round(netPayable / 3).toLocaleString('en-IN')} / month</div>
                            </div>
                            <div className="text-right">
                              {activeCredit > 0 ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="line-through text-xs text-slate-400">{'\u20B9'}{rawPrice.toLocaleString('en-IN')}</span>
                                    <span className="font-black text-lg text-emerald-600">{netPayable === 0 ? 'Free' : `\u20B9${netPayable.toLocaleString('en-IN')}`}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                                    {'\u20B9'}{creditApplied.toLocaleString('en-IN')} credit applied
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="font-black text-lg text-ink">{formatPrice(selectedPlan.price_3m)}</div>
                                  {selectedPlan.discount_3m && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedPlan.discount_3m}</span>}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      {/* 6 Months */}
                      {selectedPlan.price_6m && Number(selectedPlan.price_6m) > 0 && (!selectedPlan.duration_days || selectedPlan.duration_days !== 180) && (() => {
                        const rawPrice = parseFloat(selectedPlan.price_6m);
                        const netPayable = Math.max(0, rawPrice - activeCredit);
                        const creditApplied = Math.min(rawPrice, activeCredit);
                        return (
                          <button
                            onClick={() => handleProceedToPayment(180)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-left"
                          >
                            <div>
                              <div className="font-bold text-ink">6 Months</div>
                              <div className="text-xs text-muted">About {'\u20B9'}{Math.round(netPayable / 6).toLocaleString('en-IN')} / month</div>
                            </div>
                            <div className="text-right">
                              {activeCredit > 0 ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="line-through text-xs text-slate-400">{'\u20B9'}{rawPrice.toLocaleString('en-IN')}</span>
                                    <span className="font-black text-lg text-emerald-600">{netPayable === 0 ? 'Free' : `\u20B9${netPayable.toLocaleString('en-IN')}`}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                                    {'\u20B9'}{creditApplied.toLocaleString('en-IN')} credit applied
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="font-black text-lg text-ink">{formatPrice(selectedPlan.price_6m)}</div>
                                  {selectedPlan.discount_6m && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedPlan.discount_6m}</span>}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      {/* 12 Months */}
                      {selectedPlan.price_1y && Number(selectedPlan.price_1y) > 0 && (!selectedPlan.duration_days || (selectedPlan.duration_days !== 365 && selectedPlan.duration_days !== 360)) && (() => {
                        const rawPrice = parseFloat(selectedPlan.price_1y);
                        const netPayable = Math.max(0, rawPrice - activeCredit);
                        const creditApplied = Math.min(rawPrice, activeCredit);
                        return (
                          <button
                            onClick={() => handleProceedToPayment(365)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 transition-all text-left"
                          >
                            <div>
                              <div className="font-bold text-ink">12 Months</div>
                              <div className="text-xs text-muted">About {'\u20B9'}{Math.round(netPayable / 12).toLocaleString('en-IN')} / month</div>
                            </div>
                            <div className="text-right">
                              {activeCredit > 0 ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="line-through text-xs text-slate-400">{'\u20B9'}{rawPrice.toLocaleString('en-IN')}</span>
                                    <span className="font-black text-lg text-emerald-600">{netPayable === 0 ? 'Free' : `\u20B9${netPayable.toLocaleString('en-IN')}`}</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                                    {'\u20B9'}{creditApplied.toLocaleString('en-IN')} credit applied
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="font-black text-lg text-ink">{formatPrice(selectedPlan.price_1y)}</div>
                                  {selectedPlan.discount_1y && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedPlan.discount_1y}</span>}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
              <button
                onClick={() => setCheckoutStep('select')}
                className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Secured by <strong>Razorpay</strong> • 256-bit PCI-DSS Encryption</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {checkoutStep === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4 backdrop-blur-sm"
          >
            <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-brand-lg border border-line">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-ink">Success!</h3>
              <p className="text-muted mb-4">{successMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutStep === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4 backdrop-blur-sm"
          >
            <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-brand-lg border border-line">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-ink">Request Failed</h3>
              <p className="text-muted mb-6">{errorMsg}</p>
              <button
                onClick={() => setCheckoutStep('select')}
                className="w-full bg-slate-100 text-slate-800 py-2.5 px-4 rounded-xl font-bold hover:bg-slate-200 transition-colors border border-slate-200"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutStep === 'processing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4 backdrop-blur-sm"
          >
            <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-brand-lg border border-line">
              <Loader2 className="w-16 h-16 animate-spin text-rose-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-ink">Processing...</h3>
              <p className="text-muted">Please wait while we process your request.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
