'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useGetMemberEntitlementsQuery, type MemberEntitlements } from '@/legacy/services/entitlementApi';

type EntitlementKey = keyof Pick<MemberEntitlements,
  'can_send_interest' | 'can_chat' | 'can_view_contact_details' |
  'profile_visibility_boost' | 'can_see_who_viewed_profile' | 'can_view_received_interests'>;

export function EntitlementGate({ requires, children, fallback }: {
  requires: EntitlementKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data, isLoading } = useGetMemberEntitlementsQuery();
  if (isLoading) return null;
  if (data?.entitlements?.[requires]) return <>{children}</>;
  return <>{fallback ?? <div className="content-card"><h2>Upgrade to unlock this feature</h2><p>Your current plan does not include this feature.</p><Link href="/membership">View membership plans</Link></div>}</>;
}
