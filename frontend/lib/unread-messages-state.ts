'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getUnreadMessagesCount } from '@/legacy/services/dataService';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { isConversationMuted } from '@/lib/chat-notification-state';

export const UNREAD_MESSAGES_COUNT_EVENT = 'chat:unread-messages-count-changed';

let globalUnreadCount: number = 0;
let isCountInitialized: boolean = false;

export function getGlobalUnreadCount(): number {
  return globalUnreadCount;
}

export function setGlobalUnreadCount(count: number) {
  const safeCount = Math.max(0, count);
  globalUnreadCount = safeCount;
  isCountInitialized = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNREAD_MESSAGES_COUNT_EVENT, { detail: safeCount }));
  }
}

export function clearGlobalUnreadCount() {
  setGlobalUnreadCount(0);
}

export function incrementGlobalUnreadCount(by = 1) {
  setGlobalUnreadCount(globalUnreadCount + by);
}

/**
 * Hook managing the unread message count for navigation badges (Instagram style).
 * - Displays the real count of unread messages from visitors/matches.
 * - When the user visits /messages, the badge automatically clears to 0.
 * - Live-updates when new messages arrive.
 */
export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const pathname = usePathname();
  const isMessagesPage = pathname ? (pathname === '/messages' || pathname.startsWith('/messages/')) : false;

  const [unreadCount, setUnreadCount] = useState<number>(() => {
    return isMessagesPage ? 0 : globalUnreadCount;
  });

  const refresh = useCallback(async () => {
    if (!user || user.account_type !== 'MEMBER') {
      setGlobalUnreadCount(0);
      return;
    }
    // If user is currently on /messages, keep badge cleared (Instagram behavior)
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/messages')) {
      clearGlobalUnreadCount();
      return;
    }
    try {
      const count = await getUnreadMessagesCount();
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/messages')) {
        clearGlobalUnreadCount();
      } else {
        setGlobalUnreadCount(count);
      }
    } catch {
      // Ignore network errors
    }
  }, [user]);

  // When pathname changes: automatically clear the badge when entering /messages
  useEffect(() => {
    if (isMessagesPage) {
      clearGlobalUnreadCount();
      setUnreadCount(0);
    }
  }, [isMessagesPage]);

  // Listen to custom count change event for cross-component sync
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<number>;
      const count = typeof custom.detail === 'number' ? custom.detail : globalUnreadCount;
      setUnreadCount(isMessagesPage ? 0 : count);
    };
    window.addEventListener(UNREAD_MESSAGES_COUNT_EVENT, handler);
    return () => window.removeEventListener(UNREAD_MESSAGES_COUNT_EVENT, handler);
  }, [isMessagesPage]);

  // Realtime listeners for incoming messages
  useEffect(() => {
    if (!user || user.account_type !== 'MEMBER') return;

    // Initial load if not on /messages
    if (!isMessagesPage) {
      void refresh();
    }

    // When a new chat message arrives
    const unsubChatMessage = subscribe('chat.message', (event) => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/messages')) {
        clearGlobalUnreadCount();
        return;
      }
      const eventData = (event?.data || {}) as Record<string, any>;
      const senderId = eventData.sender_id ?? eventData.message?.sender_id;
      if (senderId && String(senderId) !== String(user.id)) {
        // Do not increment the badge if this conversation is muted
        if (!isConversationMuted(user.id, String(senderId))) {
          incrementGlobalUnreadCount(1);
        }
      }
    });

    // When notification is created for a chat message
    const unsubNotification = subscribe('notification.created', (event) => {
      const eventData = (event?.data || {}) as Record<string, any>;
      const notifType = event?.notification_type || eventData.notification_type;
      if (notifType === 'CHAT_MESSAGE') {
        // Check if the sender of this notification is muted
        const senderId = eventData.sender_id ?? eventData.partner_id;
        if (senderId && isConversationMuted(user.id, String(senderId))) {
          return; // Silent — do not update the badge for muted conversations
        }
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/messages')) {
          clearGlobalUnreadCount();
        } else {
          void refresh();
        }
      }
    });

    // Refresh on focus / visibility change
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && !window.location.pathname.startsWith('/messages')) {
        void refresh();
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      unsubChatMessage();
      unsubNotification();
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [isMessagesPage, refresh, subscribe, user]);

  return {
    unreadCount: isMessagesPage ? 0 : unreadCount,
    clearUnreadCount: clearGlobalUnreadCount,
    refreshUnreadCount: refresh,
  };
}
