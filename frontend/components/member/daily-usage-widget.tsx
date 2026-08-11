'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGetUnlockUsageQuery } from '@/legacy/services/profileApi';
import { Activity, Heart, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Daily Usage Widget
 * 
 * Displays user's daily usage statistics:
 * - Profile unlocks remaining
 * - Interests remaining
 * - Time until reset
 * 
 * Shows on dashboard and profile pages to help users track their limits.
 */
export default function DailyUsageWidget() {
  const { data: usage, refetch, isLoading } = useGetUnlockUsageQuery();

  // Refetch usage on component mount and when page regains focus
  useEffect(() => {
    refetch();
    
    // Refetch when window regains focus
    const handleFocus = () => refetch();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  if (isLoading || !usage) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-48 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  const unlockPercentage =
    usage.daily_limit && usage.daily_limit > 0
      ? (usage.used_today / usage.daily_limit) * 100
      : 0;

  const interestPercentage =
    usage.interest_limit && usage.interest_limit > 0
      ? ((usage.interest_used_today ?? 0) / usage.interest_limit) * 100
      : 0;

  const resetTime = new Date(usage.resets_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl shadow-sm border border-rose-200 p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Daily Usage</h3>
            <p className="text-sm text-slate-600">Resets at {resetTime} IST</p>
          </div>
        </div>
      </div>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Profile Unlocks */}
        <div className="bg-white rounded-xl p-4 border border-rose-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Profile Unlocks</h4>
            {usage.remaining_today !== null && usage.remaining_today <= 2 && (
              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                Low
              </span>
            )}
          </div>

          <div className="mb-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-rose-600">
              {usage.remaining_today ?? '∞'}
            </span>
            <span className="text-sm text-slate-600">
              / {usage.daily_limit ?? '∞'}
            </span>
          </div>

          {usage.daily_limit && usage.daily_limit > 0 && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(unlockPercentage, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="bg-gradient-to-r from-rose-500 to-pink-600 h-2 rounded-full"
              />
            </div>
          )}

          <p className="text-xs text-slate-500 mt-2">Viewing same profile = 1 unlock</p>
        </div>

        {/* Interests */}
        <div className="bg-white rounded-xl p-4 border border-rose-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Interests</h4>
            {usage.interest_remaining_today !== undefined && usage.interest_remaining_today !== null && usage.interest_remaining_today <= 2 && (
              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                Low
              </span>
            )}
          </div>

          <div className="mb-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-rose-600">
              {usage.interest_remaining_today ?? '∞'}
            </span>
            <span className="text-sm text-slate-600">
              / {usage.interest_limit ?? '∞'}
            </span>
          </div>

          {usage.interest_limit && usage.interest_limit > 0 && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(interestPercentage, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="bg-gradient-to-r from-rose-500 to-pink-600 h-2 rounded-full"
              />
            </div>
          )}

          <p className="text-xs text-slate-500 mt-2">Mutual interest = messaging enabled</p>
        </div>
      </div>

      {/* Reset Timer */}
      <div className="flex items-center gap-2 text-sm text-slate-600 bg-white rounded-lg p-3">
        <Clock className="w-4 h-4 text-rose-500 flex-shrink-0" />
        <span>
          Your daily quota resets at <strong>{resetTime} IST</strong> tomorrow (Asia/Kolkata timezone)
        </span>
      </div>

      {/* CTA */}
      {usage.remaining_today !== null && usage.remaining_today <= 2 && usage.daily_limit && (
        <Link
          href="/membership"
          className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-sm shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <span>Upgrade for More Unlocks</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </motion.div>
  );
}
