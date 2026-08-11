'use client';

import { motion } from 'framer-motion';
import { Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface UnlockModalProps {
  dailyLimit: number;
  usedToday: number;
  resetsAt: string;
  onClose?: () => void;
}

export default function UnlockModal({
  dailyLimit,
  usedToday,
  resetsAt,
  onClose,
}: UnlockModalProps) {
  const resetTime = new Date(resetsAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const resetDate = new Date(resetsAt).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="min-h-screen pt-32 pb-16 bg-[#FFFAF9] flex items-center justify-center px-4"
    >
      <div className="w-full max-w-lg bg-white border border-rose-100 rounded-3xl p-8 sm:p-10 text-center shadow-xl">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-6">
          <Crown className="w-8 h-8 text-amber-500" />
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mb-4">
          Daily Unlock Limit Reached
        </h2>

        {/* Message */}
        <p className="text-slate-600 text-sm sm:text-base mb-8 leading-relaxed">
          You have used all{' '}
          <strong className="text-slate-800 font-bold">{dailyLimit}</strong> profile unlocks
          available today.
        </p>

        {/* Reset Time */}
        <div className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-100 rounded-2xl p-4 mb-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Your daily limit resets at
          </p>
          <p className="text-lg font-bold text-slate-900">
            {resetTime}
            <span className="text-sm text-slate-600 font-normal ml-2">
              ({resetDate})
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Asia/Kolkata timezone</p>
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Used Today
            </p>
            <p className="text-2xl font-bold text-slate-900">{usedToday}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Daily Limit
            </p>
            <p className="text-2xl font-bold text-slate-900">{dailyLimit}</p>
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Upgrade to a premium plan to get more profile unlocks. Gold, Platinum, and Elite plans
          include more daily unlocks to help you find your match faster.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/membership"
            className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-md hover:brightness-110 transition-all text-center flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>Choose Premium Plan</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (onClose) {
                onClose();
              } else if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/dashboard';
              }
            }}
            className="py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all text-center cursor-pointer border-0"
          >
            Back to Matches
          </button>
        </div>

        {/* Footer Tip */}
        <p className="text-xs text-slate-400 mt-6 pt-6 border-t border-slate-100">
          💡 Tip: Viewing the same profile multiple times on the same day only counts as 1 unlock.
        </p>
      </div>
    </motion.div>
  );
}