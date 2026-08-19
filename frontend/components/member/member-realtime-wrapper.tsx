'use client';

import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { NotificationCenterProvider } from '@/components/member/notification-center';
import { RealtimeRequestNotifier } from '@/components/member/realtime-request-notifier';

export function MemberRealtimeWrapper({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <NotificationCenterProvider>
        <RealtimeRequestNotifier />
        {children}
      </NotificationCenterProvider>
    </RealtimeProvider>
  );
}
