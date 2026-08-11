'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Check, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMembership } from './membership-provider';
import { useGetMembershipPlansQuery, type MembershipPlan } from '@/legacy/services/membershipApi';

interface UpgradeModalProps {
  feature: 'messaging' | 'advanced_search' | 'contact_details' | 'all_photos';
  onClose: () => void;
}

const featureConfig = {
  messaging: {
    icon: '💬',
    title: 'Messaging',
    description: 'Send direct messages to connections',
    benefits: [
      'Direct messaging with connections',
      'Chat history saved',
      'Real-time notifications',
      'Message at no extra cost',
    ],
    planCheck: (plan: MembershipPlan) =>
      plan.messaging_mode !== 'DISABLED' || (plan as any).can_message === true,
  },
  advanced_search: {
    icon: '🔍',
    title: 'Advanced Search',
    description: 'Find your match with detailed filters',
    benefits: [
      'Filter by income, education, caste',
      'Location-based search',
      'Horoscope compatibility',
      'Save search preferences',
    ],
    planCheck: (plan: MembershipPlan) => plan.can_use_advanced_search === true,
  },
  contact_details: {
    icon: '📞',
    title: 'Contact Information',
    description: 'Get full contact details of connections',
    benefits: [
      'View phone number',
      'See email address',
      'Save contact info',
      'Share safely',
    ],
    planCheck: (plan: MembershipPlan) => plan.contact_access_mode !== 'NONE',
  },
  all_photos: {
    icon: '📸',
    title: 'All Photos',
    description: 'View all approved photos',
    benefits: [
      'See all profile photos',
      'Photo validation',
      'Album view',
    ],
    planCheck: (plan: MembershipPlan) =>
      plan.photo_access_mode === 'ALL_APPROVED' || plan.photo_access_mode === 'ALL',
  },
};

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (!num) return 'Free';
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatDuration(days: number | null): string {
  if (!days) return '';
  if (days <= 31) return '1 Month';
  if (days <= 92) return '3 Months';
  if (days <= 185) return '6 Months';
  if (days <= 370) return '12 Months';
  return `${days} Days`;
}

export default function UpgradeModal({ feature, onClose }: UpgradeModalProps) {
  const [mounted, setMounted] = useState(false);
  const { membershipSummary } = useMembership();
  const { data: allPlans = [], isLoading } = useGetMembershipPlansQuery();
  const config = featureConfig[feature];

  // Disable background scrolling while modal is active & track mount for portal
  useEffect(() => {
    setMounted(true);
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!mounted) return null;

  // Only show active, paid plans that include this feature (sorted by display_order)
  const eligiblePlans = allPlans
    .filter((p) => p.slug !== 'free' && config.planCheck(p))
    .sort((a, b) => a.display_order - b.display_order);

  // Name of the cheapest plan that has the feature
  const requiredPlanName = eligiblePlans[0]?.display_name || eligiblePlans[0]?.name || 'Gold';

  const modalNode = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2rem] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden relative my-auto"
      >
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl flex items-center justify-center h-10 w-10 rounded-2xl bg-rose-50 border border-rose-100">
              {config.icon}
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{config.title}</h3>
              <p className="text-xs text-slate-500">{config.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upgrade Requirement Banner */}
          <div className="text-center bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-purple-500/10 border border-amber-200/60 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-900 flex items-center justify-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Premium Feature
            </p>
            <p className="text-xs text-slate-600">
              Available with <span className="font-extrabold text-rose-600">{requiredPlanName}</span> and higher plans
            </p>
          </div>

          {/* Current Plan Info */}
          {membershipSummary && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                  Your Current Plan
                </p>
                <p className="text-base font-bold text-slate-900">{membershipSummary.plan_name}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                membershipSummary.is_free 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {membershipSummary.is_free ? 'Upgrade Needed' : 'Active'}
              </span>
            </div>
          )}

          {/* Benefits */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              Included Benefits
            </h4>
            <div className="space-y-2.5">
              {config.benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-xs font-medium text-slate-700">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          {/* Eligible Plans from database */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              Select a Plan to Upgrade
            </h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              </div>
            ) : eligiblePlans.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No available plans found.</p>
            ) : (
              <div className="space-y-3">
                {eligiblePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-2xl p-4 transition-all relative ${
                      plan.is_featured
                        ? 'border-amber-400/80 bg-amber-50/50 shadow-sm'
                        : 'border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          {plan.display_name || plan.name}
                          {plan.is_featured && (
                            <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full tracking-wider">
                              Popular
                            </span>
                          )}
                        </h5>
                        {plan.description && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-normal line-clamp-2">{plan.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 mt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-slate-900">
                          {formatPrice(plan.price)}
                        </span>
                        {plan.duration_days && (
                          <span className="text-xs text-slate-500 font-medium">
                            / {formatDuration(plan.duration_days)}
                          </span>
                        )}
                      </div>
                      <Link
                        href="/membership"
                        onClick={onClose}
                        className="text-xs font-extrabold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 px-3 py-1.5 rounded-xl transition-all"
                      >
                        Choose <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="flex-none p-5 pt-3 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm space-y-2 z-10">
          <Link
            href="/membership"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold text-sm shadow-md hover:from-rose-600 hover:to-rose-700 transition-all flex items-center justify-center gap-2"
          >
            <span>View All Membership Plans</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-slate-500 font-semibold text-xs hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modalNode, document.body);
}