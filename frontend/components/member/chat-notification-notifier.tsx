'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getConversations } from '@/legacy/services/dataService';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { smartDecryptText } from '@/legacy/utils/crypto';

type ConversationSnapshot = {
  unread: number;
  lastMessage: string;
};

/**
 * Delivers chat alerts even during a short websocket reconnect. The server
 * websocket remains the primary live path; this only detects unread-message
 * changes that arrived while that path was unavailable.
 */
export function ChatNotificationNotifier() {
  const { subscribe } = useRealtime();
  const { user } = useAuth();
  const currentUserId = String(user?.id || '');
  const snapshotsRef = useRef<Map<string, ConversationSnapshot>>(new Map());
  const initializedRef = useRef(false);

  const pendingRef = useRef<Map<string, { name: string; count: number; lastText: string; flushTimer: ReturnType<typeof setTimeout> }>>(new Map());

  // Group chat notifications per partner (Instagram/WhatsApp-style) instead of
  // firing a browser notification for every single message. Rapid messages within
  // the debounce window collapse into ONE notification that shows the total count.
  const scheduleChatNotification = useCallback((name: string, text: string, partnerId: string) => {
    if (!partnerId) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const pending = pendingRef.current;
    const existing = pending.get(partnerId);
    if (existing) {
      existing.count += 1;
      existing.lastText = String(text || '');
      return; // already scheduled → just bump the count
    }

    const entry: { name: string; count: number; lastText: string; flushTimer: ReturnType<typeof setTimeout> } = {
      name,
      count: 1,
      lastText: String(text || ''),
      flushTimer: setTimeout(() => {
        void (async () => {
          // Chat is end-to-end encrypted: the server body is ciphertext, so
          // decrypt it before showing a readable preview.
          let preview = String(entry.lastText || '');
          if (currentUserId && partnerId && preview.startsWith('__E2EE__:')) {
            try {
              preview = (await smartDecryptText(preview, currentUserId, partnerId)) || 'A new message';
            } catch {
              preview = 'A new message';
            }
          }
          const title = `${entry.name || 'Member'} · ${entry.count} new ${entry.count === 1 ? 'message' : 'messages'}`;
          const notification = new Notification(title, {
            body: preview || 'You have a new message on My Dear Partner.',
            icon: '/images/main-logo.png',
            tag: `chat-${partnerId}`,
            data: { url: `/messages?user=${partnerId}` },
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(`/messages?user=${partnerId}`);
            notification.close();
          };
          pending.delete(partnerId);
        })();
      }, 900),
    };
    pending.set(partnerId, entry);
  }, [currentUserId]);

  const refreshUnreadChats = useCallback(async () => {
    try {
      const conversations = await getConversations();
      const next = new Map<string, ConversationSnapshot>();

      for (const conversation of conversations) {
        const unread = Number(conversation.unread || 0);
        const lastMessage = String(conversation.lastMessage || '');
        next.set(conversation.id, { unread, lastMessage });

        const previous = snapshotsRef.current.get(conversation.id);
        if (
          initializedRef.current
          && unread > 0
          && (!previous || unread > previous.unread)
        ) {
          scheduleChatNotification(
            conversation.profile?.name || 'Member',
            lastMessage,
            conversation.id,
          );
        }
      }

      snapshotsRef.current = next;
      initializedRef.current = true;
    } catch {
      // The next poll retries. A failed refresh must not affect chat itself.
    }
  }, [scheduleChatNotification]);

  // Flush/clear any pending grouped notifications when the notifier unmounts.
  useEffect(() => () => {
    for (const entry of pendingRef.current.values()) clearTimeout(entry.flushTimer);
    pendingRef.current.clear();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('notification.created', (event) => {
      // The central realtime provider handles native alerts for this event.
      // Refresh here as well so its fallback baseline stays current and never
      // repeats that same alert after a reconnect.
      if (event.notification_type === 'CHAT_MESSAGE' || event.data.notification_type === 'CHAT_MESSAGE') {
        void refreshUnreadChats();
      }
    });

    void refreshUnreadChats();
    const timer = window.setInterval(() => void refreshUnreadChats(), 10000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refreshUnreadChats, subscribe]);

  return null;
}
