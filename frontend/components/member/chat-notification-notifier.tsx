'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getConversations } from '@/legacy/services/dataService';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { smartDecryptText } from '@/legacy/utils/crypto';
import {
  ACTIVE_CHAT_CHANGED_EVENT,
  getActiveChatPartnerId,
} from '@/lib/chat-notification-state';

type ConversationSnapshot = {
  unread: number;
  lastMessage: string;
};

type PendingAlert = {
  name: string;
  unread: number;
  lastText: string;
  flushTimer: ReturnType<typeof setTimeout>;
};

const MAX_UNREAD_COUNT = 4;
const NOTIFICATION_TAG_PREFIX = 'chat-';

function messageCountLabel(unread: number) {
  return unread >= MAX_UNREAD_COUNT ? `${MAX_UNREAD_COUNT}+` : String(Math.max(1, unread));
}

/**
 * Delivers a single grouped browser alert for a conversation while it has
 * unread messages. Opening that exact chat suppresses its alert, closes an
 * existing one, and lets the message screen clear its persisted notification.
 */
export function ChatNotificationNotifier() {
  const { subscribe } = useRealtime();
  const { user } = useAuth();
  const currentUserId = String(user?.id || '');
  const snapshotsRef = useRef<Map<string, ConversationSnapshot>>(new Map());
  const initializedRef = useRef(false);
  const alertedConversationsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, PendingAlert>>(new Map());
  const activeNotificationsRef = useRef<Map<string, Notification>>(new Map());

  const dismissChatNotification = useCallback((partnerId: string) => {
    const key = String(partnerId || '').trim().toLowerCase();
    if (!key) return;

    const pending = pendingRef.current.get(key);
    if (pending) {
      clearTimeout(pending.flushTimer);
      pendingRef.current.delete(key);
    }

    const notification = activeNotificationsRef.current.get(key);
    if (notification) {
      try {
        notification.close();
      } catch {
        // Closing a browser notification is best effort.
      }
      activeNotificationsRef.current.delete(key);
    }
  }, []);

  const scheduleChatNotification = useCallback((name: string, text: string, partnerId: string, unread: number) => {
    const key = String(partnerId || '').trim().toLowerCase();
    if (!key) return;

    if (getActiveChatPartnerId() === key) {
      alertedConversationsRef.current.delete(key);
      dismissChatNotification(key);
      return;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Keep one browser alert for the whole unread batch instead of a toast and
    // sound per message. It becomes eligible again when the conversation is read.
    if (alertedConversationsRef.current.has(key)) return;

    const existing = pendingRef.current.get(key);
    if (existing) {
      existing.unread = Math.max(existing.unread, unread);
      existing.lastText = String(text || '');
      return;
    }

    const entry: PendingAlert = {
      name,
      unread: Math.max(1, unread),
      lastText: String(text || ''),
      flushTimer: setTimeout(() => {
        void (async () => {
          try {
            // The member could have selected this conversation during the
            // short grouping delay.
            if (getActiveChatPartnerId() === key) return;

            let preview = entry.lastText;
            if (currentUserId && preview.startsWith('__E2EE__:')) {
              try {
                preview = (await smartDecryptText(preview, currentUserId, partnerId)) || 'A new message';
              } catch {
                preview = 'A new message';
              }
            }

            const count = messageCountLabel(entry.unread);
            const noun = entry.unread === 1 ? 'message' : 'messages';
            const notification = new Notification(`${entry.name || 'Member'} · ${count} new ${noun}`, {
              body: preview || 'You have a new message on My Dear Partner.',
              icon: '/images/main-logo.png',
              tag: `${NOTIFICATION_TAG_PREFIX}${key}`,
              data: { url: `/messages?user=${partnerId}` },
            });
            activeNotificationsRef.current.set(key, notification);
            alertedConversationsRef.current.add(key);
            notification.onclick = () => {
              window.focus();
              try {
                notification.close();
              } catch {
                // Navigation below still works if the alert is already closed.
              }
              activeNotificationsRef.current.delete(key);
              window.location.assign(`/messages?user=${partnerId}`);
            };
          } catch {
            // Browser notification failures must never interrupt chat.
          } finally {
            pendingRef.current.delete(key);
          }
        })();
      }, 1200),
    };
    pendingRef.current.set(key, entry);
  }, [currentUserId, dismissChatNotification]);

  const refreshUnreadChats = useCallback(async () => {
    try {
      const conversations = await getConversations();
      const activeChatId = getActiveChatPartnerId();
      const next = new Map<string, ConversationSnapshot>();

      for (const conversation of conversations) {
        const conversationId = String(conversation.id || '');
        const conversationKey = conversationId.trim().toLowerCase();
        if (!conversationKey) continue;

        const unread = Math.max(0, Number(conversation.unread || 0));
        const lastMessage = String(conversation.lastMessage || '');
        next.set(conversationId, { unread, lastMessage });

        if (unread === 0) {
          alertedConversationsRef.current.delete(conversationKey);
          dismissChatNotification(conversationKey);
          continue;
        }

        if (activeChatId === conversationKey) {
          dismissChatNotification(conversationKey);
          continue;
        }

        const previous = snapshotsRef.current.get(conversationId);
        if (initializedRef.current && (!previous || unread > previous.unread)) {
          scheduleChatNotification(
            conversation.profile?.name || 'Member',
            lastMessage,
            conversationId,
            unread,
          );
        }
      }

      snapshotsRef.current = next;
      initializedRef.current = true;
    } catch {
      // A future poll safely retries after a temporary network issue.
    }
  }, [dismissChatNotification, scheduleChatNotification]);

  useEffect(() => {
    const dismissActiveChat = () => {
      const active = getActiveChatPartnerId();
      if (active) {
        alertedConversationsRef.current.delete(active);
        dismissChatNotification(active);
      }
    };
    window.addEventListener(ACTIVE_CHAT_CHANGED_EVENT, dismissActiveChat);
    window.addEventListener('focus', dismissActiveChat);
    const timer = window.setInterval(dismissActiveChat, 1500);
    return () => {
      window.removeEventListener(ACTIVE_CHAT_CHANGED_EVENT, dismissActiveChat);
      window.removeEventListener('focus', dismissActiveChat);
      window.clearInterval(timer);
    };
  }, [dismissChatNotification]);

  useEffect(() => () => {
    for (const entry of pendingRef.current.values()) clearTimeout(entry.flushTimer);
    pendingRef.current.clear();
    for (const notification of activeNotificationsRef.current.values()) {
      try {
        notification.close();
      } catch {
        // Nothing to clean up if the browser already dismissed it.
      }
    }
    activeNotificationsRef.current.clear();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('notification.created', (event) => {
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
