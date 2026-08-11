'use client';

import type { ReactNode } from 'react';
import { ClientAuthGuard } from '@/components/auth/client-auth-guard';
import { MembershipProvider } from '@/components/member/membership-provider';
import { MemberRealtimeWrapper } from '@/components/member/member-realtime-wrapper';
import { MemberSidebar } from '@/components/layout/member/member-sidebar';

export function MemberShell({ children }: { children: ReactNode }) {
  return (
    <ClientAuthGuard allowed={['MEMBER']} loginPath="/login">
      <MemberRealtimeWrapper>
        <MembershipProvider>
          <MemberSidebar>{children}</MemberSidebar>
        </MembershipProvider>
      </MemberRealtimeWrapper>
    </ClientAuthGuard>
  );
}
