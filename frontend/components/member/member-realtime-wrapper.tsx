'use client';

import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { RealtimeRequestNotifier } from '@/components/member/realtime-request-notifier';
import { ChatNotificationNotifier } from '@/components/member/chat-notification-notifier';

export function MemberRealtimeWrapper({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <RealtimeRequestNotifier />
      <ChatNotificationNotifier />
      {children}
    </RealtimeProvider>
  );
}
