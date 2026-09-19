'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { useMembership } from '@/components/member/membership-provider';

export function MemberHeaderConnects() {
  const { membershipSummary, isLoading } = useMembership();

  if (isLoading) {
    return <div className="hidden sm:block w-20 h-7 rounded-full bg-slate-100 animate-pulse" />;
  }

  const hasActivePlan = membershipSummary?.has_active_plan && !membershipSummary?.is_free;
  const planName = membershipSummary?.plan_name || 'Free';

  if (hasActivePlan) {
    return (
      <Link
        href="/membership"
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-all hover:scale-102"
        title="Active Membership"
      >
        <Crown className="w-3.5 h-3.5 text-amber-600" />
        <span>{planName}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/membership"
      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#e11d48] bg-rose-50/80 hover:bg-rose-100 border border-rose-200/70 transition-all hover:scale-102"
      title="Upgrade Plan"
    >
      <Crown className="w-3.5 h-3.5 text-[#e11d48]" />
      <span>Upgrade</span>
    </Link>
  );
}
