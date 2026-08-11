import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ClientAuthGuard } from '@/components/auth/client-auth-guard';
import { MembershipProvider } from '@/components/member/membership-provider';
import { MemberRealtimeWrapper } from '@/components/member/member-realtime-wrapper';
import { MemberSidebar } from '@/components/layout/member/member-sidebar';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <ClientAuthGuard allowed={['MEMBER']} loginPath="/login">
    <MemberRealtimeWrapper>
      <MembershipProvider>
        <MemberSidebar>
        <Suspense fallback={<div className="portal-loading">Loading your account…</div>}>{children}</Suspense>
        </MemberSidebar>
      </MembershipProvider>
    </MemberRealtimeWrapper>
  </ClientAuthGuard>;
}
