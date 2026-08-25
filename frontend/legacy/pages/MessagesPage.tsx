'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Crown,
  Heart,
  LockKeyhole,
  MessageCircleMore,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { Link, useLocation, useNavigate, useSearchParams } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { getConversations, getConversationsPage, getMessages, getProfile, markMessagesRead, sendMessage } from '../services/dataService';
import { fetchApi } from '../services/apiClient';
import { useRealtime } from '../../providers/RealtimeProvider';
import { useChatSocket } from '../../hooks/use-chat-socket';
import { usePresence } from '../../hooks/use-presence';
import { deriveFallbackKey, encryptMessage, smartDecryptText } from '../utils/crypto';
import { clearActiveChatPartnerId, setActiveChatPartnerId } from '@/lib/chat-notification-state';
import { profileHref } from '@/lib/profile-url';

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  time: string;
  date: string;
  read: boolean;
  pending?: boolean;
  failed?: boolean;
  deletedForEveryone?: boolean;
}

function conversationTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function lastSeenLabel(value?: string | null) {
  if (!value) return 'Offline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Offline';
  const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (elapsedMinutes < 1) return 'Last seen recently';
  if (elapsedMinutes < 60) return `Last seen ${elapsedMinutes}m ago`;
  if (date.toDateString() === new Date().toDateString()) return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function profileName(conversation: any) {
  return conversation?.profile?.name || conversation?.profile?.full_name || 'Member';
}

function profileId(conversation: any) {
  return String(conversation?.id || conversation?.profile?.id || '');
}

function unreadBadge(count: unknown) {
  const unread = Math.max(0, Number(count) || 0);
  return unread >= 100 ? '99+' : String(unread);
}

function mergeMessagesByTime(...groups: ChatMessage[][]) {
  const unique = new Map<string, ChatMessage>();
  for (const group of groups) {
    for (const message of group) unique.set(message.id, message);
  }
  return [...unique.values()].sort((first, second) => {
    const firstTime = Date.parse(first.createdAt);
    const secondTime = Date.parse(second.createdAt);
    return (Number.isNaN(firstTime) ? 0 : firstTime) - (Number.isNaN(secondTime) ? 0 : secondTime)
      || first.id.localeCompare(second.id);
  });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get('user');
  const requestedProfile = (location.state as { profile?: any } | null)?.profile;

  const [membershipAllowed, setMembershipAllowed] = useState<boolean | null>(null);
  const [membershipPlan, setMembershipPlan] = useState<string | null>(null);
  const [membershipVersion, setMembershipVersion] = useState(0);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [conversationQuery, setConversationQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [restriction, setRestriction] = useState('');
  const [blockedState, setBlockedState] = useState<'blocked_by_user' | 'you_blocked' | ''>('');
  const [error, setError] = useState('');
  const [limitOpen, setLimitOpen] = useState(false);
  const [typingByPartner, setTypingByPartner] = useState<Record<string, boolean>>({});
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);

  const feedRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<any>(null);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const outgoingTypingStopRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const pendingRouteSelectionRef = useRef<string | null>(requestedUserId);
  const isAtBottomRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);
  activeRef.current = activeConversation;

  const isMember = user?.account_type === 'MEMBER';
  const blockedByMembership = isMember && membershipAllowed === false;
  const currentUserId = user?.id;

  const formatMessageRows = useCallback(async (rows: any[], conversation: any) => {
    const partnerId = profileId(conversation);
    return Promise.all(rows.map(async (message) => {
      const senderId = message.sender_id ?? message.sender?.id;
      const createdAt = new Date(message.created_at || Date.now());
      const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
      return {
        id: String(message.id),
        senderId: String(senderId) === String(currentUserId) ? 'me' : String(senderId),
        text: await smartDecryptText(message.text, currentUserId, partnerId, conversation.id),
        createdAt: safeCreatedAt.toISOString(),
        time: safeCreatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: safeCreatedAt.toLocaleDateString(),
        read: Boolean(message.is_read),
        deletedForEveryone: Boolean(message.deleted_for_everyone),
      } satisfies ChatMessage;
    }));
  }, [currentUserId]);

  useEffect(() => {
    if (!isMember) {
      setMembershipAllowed(true);
      return;
    }
    let cancelled = false;
    setMembershipAllowed(null);
    fetchApi<{ can_message?: boolean; has_active_plan?: boolean; plan_name?: string }>('/member-auth/membership/summary/')
      .then((summary) => {
        if (cancelled) return;
        setMembershipAllowed(typeof summary.can_message === 'boolean' ? summary.can_message : Boolean(summary.has_active_plan));
        setMembershipPlan(summary.plan_name ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setMembershipAllowed(false);
          setMembershipPlan(null);
        }
      });
    return () => { cancelled = true; };
  }, [isMember, membershipVersion, currentUserId]);

  const decryptConversations = useCallback(async (rows: any[]) => Promise.all(rows.map(async (row) => {
    const partnerId = profileId(row);
    const text = await smartDecryptText(row.lastMessage, currentUserId, partnerId);
    return { ...row, lastMessage: text };
  })), [currentUserId]);

  useEffect(() => {
    // A profile link or browser notification may ask us to open one thread.
    // Consume it once, then keep all later list refreshes selection-neutral.
    pendingRouteSelectionRef.current = requestedUserId || null;
  }, [requestedUserId]);

  const refreshConversations = useCallback(async () => {
    try {
      const pendingRouteId = pendingRouteSelectionRef.current;
      // Fetch the first page and remember whether older pages remain so we do
      // not load all conversations up front (fix: pagination/limiting).
      const { conversations: firstPage, hasMore } = await getConversationsPage(1, 50);
      let rows = await decryptConversations(firstPage);
      setHasMoreConversations(hasMore);
      setConversationPage(1);
      if (pendingRouteId && !rows.some((row) => profileId(row) === pendingRouteId)) {
        const profile = requestedProfile || await getProfile(pendingRouteId);
        rows = [{ id: pendingRouteId, profile, lastMessage: '', time: '', unread: 0 }, ...rows];
      }
      setConversations(rows);
      const requestedConversation = pendingRouteId
        ? rows.find((row) => profileId(row) === pendingRouteId) || null
        : null;
      setActiveConversation((current: any) => {
        const currentId = profileId(current);
        return requestedConversation
          || rows.find((row) => profileId(row) === currentId)
          || null;
      });
      if (requestedConversation) {
        pendingRouteSelectionRef.current = null;
        setMobileChatOpen(true);
        // Do not leave a stale `?user=` behind. Otherwise a browser reload can
        // reopen a thread the member already backed out of.
        navigate('/messages', { replace: true, preventScrollReset: true });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Conversations could not be loaded.');
    } finally {
      setLoadingConversations(false);
    }
  }, [decryptConversations, navigate, requestedProfile, requestedUserId]);

  const loadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;
    setLoadingMoreConversations(true);
    try {
      const nextPage = conversationPage + 1;
      const { conversations: more, hasMore } = await getConversationsPage(nextPage, 50);
      setConversations((current) => {
        const seen = new Set(current.map((row) => String(profileId(row))));
        const fresh = more.filter((row) => !seen.has(String(profileId(row))));
        return [...current, ...fresh];
      });
      setConversationPage(nextPage);
      setHasMoreConversations(hasMore);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'More conversations could not be loaded.');
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [conversationPage, hasMoreConversations, loadingMoreConversations]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  const visiblePartnerIds = useMemo(() => Array.from(new Set(
    conversations.map(profileId).concat(activeConversation ? [profileId(activeConversation)] : []).filter(Boolean),
  )), [activeConversation, conversations]);
  const { isOnline, getLastSeen } = usePresence(visiblePartnerIds);

  const setPartnerTypingState = useCallback((partnerId: string, isTyping: boolean) => {
    if (!partnerId) return;
    const currentTimer = typingTimeoutsRef.current.get(partnerId);
    if (currentTimer) {
      window.clearTimeout(currentTimer);
      typingTimeoutsRef.current.delete(partnerId);
    }
    setTypingByPartner((current) => ({ ...current, [partnerId]: isTyping }));

    if (isTyping) {
      const timer = window.setTimeout(() => {
        typingTimeoutsRef.current.delete(partnerId);
        setTypingByPartner((current) => ({ ...current, [partnerId]: false }));
      }, 3500);
      typingTimeoutsRef.current.set(partnerId, timer);
      if (partnerId === profileId(activeRef.current) && isAtBottomRef.current) {
        shouldScrollToLatestRef.current = true;
      }
    }
  }, []);

  const handleSocketMessage = useCallback(async (data: any) => {
    const current = activeRef.current;
    if (!current || !currentUserId) return;
    if (data.type === 'error') {
      if (data.code === 'DAILY_MESSAGE_LIMIT_REACHED') setLimitOpen(true);
      else setError(data.message || 'The message could not be delivered.');
      return;
    }
    if (data.type === 'typing') {
      if (String(data.sender_id) === profileId(current)) {
        setPartnerTypingState(profileId(current), Boolean(data.is_typing));
      }
      return;
    }
    if (data.type === 'read_receipt') {
      const ids = (data.message_ids ?? (data.message_id ? [data.message_id] : [])).map(String);
      setMessages((currentMessages) => currentMessages.map((message) => ids.includes(String(message.id)) ? { ...message, read: true } : message));
      return;
    }

    if (data.type === 'message_deleted') {
      setMessages((currentMessages) => data.for_everyone
        ? currentMessages.map((message) => String(message.id) === String(data.message_id) ? { ...message, text: 'Message deleted', deletedForEveryone: true } : message)
        : currentMessages.filter((message) => String(message.id) !== String(data.message_id)));
      return;
    }

    const partnerId = profileId(current);
    const text = await smartDecryptText(String(data.text || ''), currentUserId, partnerId, current.id);
    const createdAt = new Date(data.created_at || Date.now());
    const incoming: ChatMessage = {
      id: String(data.id),
      senderId: String(data.sender_id) === String(currentUserId) ? 'me' : String(data.sender_id),
      text,
      createdAt: createdAt.toISOString(),
      time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: createdAt.toLocaleDateString(),
      read: Boolean(data.is_read),
      deletedForEveryone: Boolean(data.deleted_for_everyone),
    };
    setPartnerTypingState(partnerId, false);
    const feed = feedRef.current;
    const nearBottom = !feed || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
    shouldScrollToLatestRef.current = nearBottom;
    if (!nearBottom && incoming.senderId !== 'me') {
      setNewMessagesBelow((count) => count + 1);
    }
    setMessages((currentMessages) => {
      if (incoming.senderId === 'me') {
        const pendingIndex = currentMessages.findIndex((message) => message.pending);
        if (pendingIndex >= 0) {
          const next = [...currentMessages];
          next[pendingIndex] = incoming;
          return mergeMessagesByTime(next);
        }
      }
      return currentMessages.some((message) => message.id === incoming.id)
        ? currentMessages
        : mergeMessagesByTime(currentMessages, [incoming]);
    });
    setConversations((currentRows) => {
      const index = currentRows.findIndex((row) => profileId(row) === partnerId);
      if (index < 0) return currentRows;
      const next = [...currentRows];
      next[index] = { ...next[index], lastMessage: text, time: incoming.time };
      const [updated] = next.splice(index, 1);
      return [updated, ...next];
    });
  }, [currentUserId, setPartnerTypingState]);

  const currentPartnerId = activeConversation ? profileId(activeConversation) : '';
  const partnerTyping = Boolean(currentPartnerId && typingByPartner[currentPartnerId]);

  // Conversation selection happens in local state, so publish it separately
  // from the URL. This immediately silences chat alerts for the open thread.
  useEffect(() => {
    if (!currentPartnerId) return;
    setActiveChatPartnerId(currentPartnerId);
    return () => clearActiveChatPartnerId(currentPartnerId);
  }, [currentPartnerId]);

  useEffect(() => subscribe('chat.typing', (event) => {
    const senderId = typeof event.data.sender_id === 'string' ? event.data.sender_id : '';
    if (!senderId || senderId === String(currentUserId || '')) return;
    setPartnerTypingState(senderId, Boolean(event.data.is_typing));
  }), [currentUserId, setPartnerTypingState, subscribe]);

  const syncLatestMessages = useCallback(async () => {
    const conversation = activeRef.current;
    const partnerId = profileId(conversation);
    if (!conversation || !partnerId || !currentUserId) return;
    try {
      const page = await getMessages(partnerId, { pageSize: 20 });
      const formatted = await formatMessageRows(page.messages, conversation);
      if (profileId(activeRef.current) !== partnerId) return;
      if (isAtBottomRef.current) shouldScrollToLatestRef.current = true;
      else if (formatted.some((message) => message.senderId !== 'me')) setNewMessagesBelow((count) => Math.max(count, 1));
      setMessages((current) => mergeMessagesByTime(current, formatted));
    } catch {
      // The normal history request remains the source of truth. A later
      // reconnect will make another bounded sync attempt.
    }
  }, [currentUserId, formatMessageRows]);

  const { connected, state: chatSocketState, send: sendSocket } = useChatSocket({
    partnerId: currentPartnerId,
    enabled: Boolean(currentPartnerId && currentUserId && membershipAllowed),
    onMessage: handleSocketMessage,
    onClose: (code) => { if (code === 4004) setLimitOpen(true); },
    onOpen: () => { void syncLatestMessages(); },
  });

  useEffect(() => {
    if (!membershipAllowed || !activeConversation || !currentUserId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setLoadingOlderMessages(false);
    setMessages([]);
    setNextMessageCursor(null);
    setNewMessagesBelow(0);
    isAtBottomRef.current = false;
    setIsAtBottom(false);
    setRestriction('');
    setError('');
    setBlockedState('');
    getMessages(profileId(activeConversation), { pageSize: 20 })
      .then(async (page) => {
        const formatted = await formatMessageRows(page.messages, activeConversation);
        if (!cancelled) {
          shouldScrollToLatestRef.current = true;
          setMessages((current) => mergeMessagesByTime(current, formatted));
          setNextMessageCursor(page.nextCursor);
        }
      })
      .catch((requestError: any) => {
        if (cancelled) return;
        const message = String(requestError?.message || requestError || '');
        if (requestError?.code === 'DAILY_MESSAGE_LIMIT_REACHED') setLimitOpen(true);
        else if (requestError?.code === 'blocked_by_user' || /blocked by this user/i.test(message)) setBlockedState('blocked_by_user');
        else if (requestError?.code === 'messaging_blocked' || requestError?.code === 'you_blocked' || /blocked/i.test(message)) setBlockedState('you_blocked');
        else if (/interest|mutual/i.test(message)) setRestriction('You can chat after both members accept the interest.');
        else if (/membership|plan|premium|gold|upgrade/i.test(message)) setRestriction('Messaging is not included in your current membership.');
        else if (/approve|pending|available/i.test(message)) setRestriction('This member is not currently available for chat.');
        else setError(message || 'Message history could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeConversation?.id, formatMessageRows, membershipAllowed]);

  const loadOlderMessages = useCallback(async () => {
    const conversation = activeRef.current;
    const partnerId = profileId(conversation);
    if (!conversation || !partnerId || !nextMessageCursor || loadingOlderMessages) return;

    const feed = feedRef.current;
    const previousHeight = feed?.scrollHeight ?? 0;
    const previousTop = feed?.scrollTop ?? 0;
    setLoadingOlderMessages(true);
    try {
      const page = await getMessages(partnerId, { cursor: nextMessageCursor, pageSize: 20 });
      const formatted = await formatMessageRows(page.messages, conversation);
      if (profileId(activeRef.current) !== partnerId) return;
      setMessages((current) => mergeMessagesByTime(formatted, current));
      setNextMessageCursor(page.nextCursor);
      window.requestAnimationFrame(() => {
        const currentFeed = feedRef.current;
        if (currentFeed) currentFeed.scrollTop = previousTop + currentFeed.scrollHeight - previousHeight;
      });
    } catch (requestError: any) {
      if (profileId(activeRef.current) === partnerId) {
        setError(requestError?.message || 'Older messages could not be loaded. Please try again.');
      }
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [formatMessageRows, loadingOlderMessages, nextMessageCursor]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    setNewMessagesBelow(0);
  }, []);

  const handleFeedScroll = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
    if (isAtBottomRef.current !== nearBottom) {
      isAtBottomRef.current = nearBottom;
      setIsAtBottom(nearBottom);
    }
    if (nearBottom) setNewMessagesBelow(0);
    if (feed.scrollTop < 120) void loadOlderMessages();
  }, [loadOlderMessages]);

  useEffect(() => {
    if (!shouldScrollToLatestRef.current) return;
    shouldScrollToLatestRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      scrollToLatest(messages.length > 1 ? 'smooth' : 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, partnerTyping, scrollToLatest]);

  useEffect(() => {
    if (!activeConversation || !currentPartnerId || loadingMessages) return;
    const unreadIds = messages.filter((message) => message.senderId !== 'me' && !message.read).map((message) => message.id);
    if (unreadIds.length === 0) return;

    // Keep the live receipt for the sender, but persist the read state through
    // HTTP too. This clears the matching bell notification if the chat socket
    // reconnects at exactly the wrong moment.
    const receiptSent = connected && sendSocket({ type: 'read_receipt', message_ids: unreadIds });
    setMessages((current) => current.map((message) => unreadIds.includes(message.id) ? { ...message, read: true } : message));
    setConversations((current) => current.map((conversation) => profileId(conversation) === currentPartnerId ? { ...conversation, unread: 0 } : conversation));
    window.dispatchEvent(new Event('notifications:read-changed'));

    const persistRead = async () => {
      // Give the socket consumer a chance to send the sender's read receipt;
      // the HTTP endpoint is idempotent and provides the reliable fallback.
      if (receiptSent) await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
      try {
        await markMessagesRead(currentPartnerId);
        window.dispatchEvent(new Event('notifications:read-changed'));
      } catch {
        // A later sync will retry; the live receipt remains a valid read path.
      }
    };
    void persistRead();
  }, [activeConversation, connected, currentPartnerId, loadingMessages, messages, sendSocket]);

  // Coalesce conversation-list refreshes: N realtime CHAT_MESSAGE events in a
  // short window produce at most ONE API request, and never two overlapping
  // requests (a second "pending" refresh runs only after the first completes).
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInflightRef = useRef(false);
  const refreshPendingRef = useRef(false);
  const runRefresh = useCallback(async () => {
    if (refreshInflightRef.current) {
      refreshPendingRef.current = true;
      return;
    }
    refreshInflightRef.current = true;
    try {
      await refreshConversations();
    } finally {
      refreshInflightRef.current = false;
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        void runRefresh();
      }
    }
  }, [refreshConversations]);

  const scheduleConversationRefresh = useCallback(() => {
    if (refreshTimerRef.current) return; // already scheduled, drain into ONE call
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void runRefresh();
    }, 2000);
  }, [runRefresh]);

  useEffect(() => {
    const unsubscribe = subscribe('notification.created', (event) => {
      if (event.data?.notification_type === 'CHAT_MESSAGE') scheduleConversationRefresh();
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [scheduleConversationRefresh, subscribe]);

  useEffect(() => () => {
    for (const timer of typingTimeoutsRef.current.values()) window.clearTimeout(timer);
    typingTimeoutsRef.current.clear();
    if (outgoingTypingStopRef.current) window.clearTimeout(outgoingTypingStopRef.current);
  }, []);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matches = !query || `${profileName(conversation)} ${conversation.lastMessage || ''}`.toLowerCase().includes(query);
      return matches && (filter === 'all' || Number(conversation.unread || 0) > 0);
    });
  }, [conversationQuery, conversations, filter]);

  const stopOutgoingTyping = useCallback(() => {
    if (outgoingTypingStopRef.current) window.clearTimeout(outgoingTypingStopRef.current);
    outgoingTypingStopRef.current = null;
    if (isTypingRef.current) sendSocket({ type: 'typing', is_typing: false });
    isTypingRef.current = false;
  }, [sendSocket]);

  useEffect(() => () => {
    stopOutgoingTyping();
  }, [currentPartnerId, stopOutgoingTyping]);

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!connected) {
      if (outgoingTypingStopRef.current) window.clearTimeout(outgoingTypingStopRef.current);
      outgoingTypingStopRef.current = null;
      isTypingRef.current = false;
      return;
    }
    if (!value.trim()) {
      stopOutgoingTyping();
      return;
    }

    if (!isTypingRef.current) {
      sendSocket({ type: 'typing', is_typing: true });
      isTypingRef.current = true;
    }
    if (outgoingTypingStopRef.current) window.clearTimeout(outgoingTypingStopRef.current);
    outgoingTypingStopRef.current = window.setTimeout(() => stopOutgoingTyping(), 1800);
  };

  const sendViaHttp = async (partnerId: string, text: string, temporaryId: string) => {
    try {
      const response: any = await sendMessage(partnerId, text);
      setMessages((current) => current.map((message) => message.id === temporaryId ? {
        ...message,
        id: String(response?.id || temporaryId),
        pending: false,
      } : message));
    } catch (requestError: any) {
      setMessages((current) => current.map((message) => message.id === temporaryId ? { ...message, pending: false, failed: true } : message));
      if (requestError?.code === 'DAILY_MESSAGE_LIMIT_REACHED') setLimitOpen(true);
      else setError(requestError?.message || 'Message could not be sent.');
    }
  };

  const handleSend = async (preset?: string) => {
    const plainText = (preset ?? draft).trim();
    if (!plainText || !activeConversation || !currentUserId || restriction) return;
    const partnerId = profileId(activeConversation);
    let wireText = plainText;
    try {
      const key = await deriveFallbackKey([currentUserId, partnerId].sort().join('_'));
      wireText = await encryptMessage(plainText, key);
    } catch {
      // Plaintext remains a safe compatibility fallback if Web Crypto is unavailable.
    }
    const temporaryId = `temp_${Date.now()}`;
    const createdAt = new Date();
    const optimistic: ChatMessage = {
      id: temporaryId,
      senderId: 'me',
      text: plainText,
      createdAt: createdAt.toISOString(),
      time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: createdAt.toLocaleDateString(),
      read: false,
      pending: true,
    };
    stopOutgoingTyping();
    setDraft('');
    setError('');
    setNewMessagesBelow(0);
    shouldScrollToLatestRef.current = true;
    setMessages((current) => mergeMessagesByTime(current, [optimistic]));
    setConversations((current) => {
      const index = current.findIndex((conversation) => profileId(conversation) === partnerId);
      if (index < 0) return current;
      const next = [...current];
      next[index] = { ...next[index], lastMessage: plainText, time: optimistic.time };
      const [updated] = next.splice(index, 1);
      return [updated, ...next];
    });
    if (connected) {
      if (!sendSocket({ text: wireText })) await sendViaHttp(partnerId, wireText, temporaryId);
    } else {
      await sendViaHttp(partnerId, wireText, temporaryId);
    }
  };

  const handleDeleteMessage = async (message: ChatMessage, action: 'for_me' | 'for_everyone') => {
    try {
      await fetchApi(`/messages/${message.id}/delete/`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setMessages((currentMessages) => action === 'for_everyone'
        ? currentMessages.map((item) => item.id === message.id ? { ...item, text: 'Message deleted', deletedForEveryone: true } : item)
        : currentMessages.filter((item) => item.id !== message.id));
    } catch (requestError: any) {
      setError(requestError?.message || 'The message could not be deleted.');
    }
  };

  const selectConversation = (conversation: any) => {
    const partnerId = profileId(conversation);
    stopOutgoingTyping();
    setActiveConversation(conversation);
    setMobileChatOpen(true);
    setDetailsOpen(typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
    // Optimistically clear the badge for the thread the member opened; the
    // server read marker persists it across reloads.
    setConversations((current) => current.map((row) => profileId(row) === partnerId ? { ...row, unread: 0 } : row));
    // Remove any lingering ?user= deep link so a refresh opens the list, not
    // the same thread again.
    if (pendingRouteSelectionRef.current || (typeof window !== 'undefined' && window.location.search.includes('user='))) {
      pendingRouteSelectionRef.current = null;
      navigate('/messages', { replace: true, preventScrollReset: true });
    }
  };

  const closeActiveConversation = () => {
    stopOutgoingTyping();
    setDraft('');
    setDetailsOpen(false);
    setMobileChatOpen(false);
    setActiveConversation(null);
    setMessages([]);
    setNewMessagesBelow(0);
    isAtBottomRef.current = false;
    setIsAtBottom(false);
    clearActiveChatPartnerId();
  };

  const activeOnline = activeConversation ? Boolean(isOnline(currentPartnerId)) : false;
  const activeLastSeen = activeConversation ? getLastSeen(currentPartnerId) : null;

  useEffect(() => {
    if (activeConversation && window.matchMedia('(min-width: 1280px)').matches) {
      setDetailsOpen(true);
    }
  }, [activeConversation?.id]);

  if (isMember && membershipAllowed === null) {
    return (
      <div className="flex h-full min-h-[34rem] items-center justify-center bg-[#f4f6f7] pb-20 lg:pb-0">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-[#267255]" /> Opening secure messages
        </div>
      </div>
    );
  }

  if (blockedByMembership) {
    return (
      <div className="flex h-full min-h-[34rem] items-center justify-center bg-[#f4f6f7] px-4 pb-20 lg:pb-0">
        <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-9">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#fff6dc] text-[#9a6712]"><Crown className="h-6 w-6" /></div>
          <h1 className="mt-5 text-2xl font-extrabold text-[#17232d]">Messaging is not in your plan</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Your {membershipPlan || 'current'} plan does not include direct messaging. Choose a messaging plan to talk with accepted matches.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => setMembershipVersion((version) => version + 1)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Recheck plan</button>
            <Link to="/membership" className="rounded-lg bg-[#bd304d] px-4 py-2.5 text-sm font-bold text-white">View membership</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`/* ── Sidebar motion — reuses the existing palette (no new colors) ── */
.sb-card { animation: sb-card-in .5s cubic-bezier(.22,1,.36,1) both; }
@keyframes sb-card-in { from { opacity:0; transform:translateY(7px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
.sb-card-lift { transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease, background-color .28s ease; }
.sb-card-lift:hover { transform: translateY(-2px); }
.sb-card-lift:active { transform: scale(.988); }
.sb-indicator { animation: sb-bar-in .42s cubic-bezier(.22,1,.36,1) both; transform-origin: top; }
@keyframes sb-bar-in { from { transform:scaleY(0); opacity:0; } to { transform:scaleY(1); opacity:1; } }
.sb-avatar { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease; }
.sb-card-lift:hover .sb-avatar { transform: scale(1.05); box-shadow: 0 6px 16px -6px rgba(120,40,70,.35); }
.sb-badge { animation: sb-badge-in .55s cubic-bezier(.22,1,.36,1) both; }
@keyframes sb-badge-in { 0% { opacity:0; transform:scale(.4); } 60% { transform:scale(1.15); } 100% { opacity:1; transform:scale(1); } }
.sb-dot { animation: sb-dot-pulse 1.9s ease-in-out infinite; }
@keyframes sb-dot-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(47,201,122,.35); } 50% { box-shadow:0 0 0 4px rgba(47,201,122,0); } }
.sb-search { transition: all .3s ease; }
.sb-search:focus { box-shadow: 0 0 0 4px rgba(246,195,212,.5); }
.sb-head-in { animation: sb-head-in .45s cubic-bezier(.22,1,.36,1) both; }
@keyframes sb-head-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
`}</style>
    <div className="chat-shell flex h-full w-full items-stretch justify-center overflow-hidden bg-[#f6f1f4] lg:h-[calc(100vh-64px)] lg:p-5">
      <div className="relative flex h-full w-full overflow-hidden bg-white shadow-[0_24px_70px_-28px_rgba(112,38,66,0.28)] lg:mx-auto lg:max-w-[1180px] lg:rounded-[30px] lg:border lg:border-[#f4e6ee]">
        {/* Soft decorative blooms — extreme low opacity */}
        <span aria-hidden className="pointer-events-none absolute -left-10 -top-10 z-0 h-40 w-40 rounded-full bg-gradient-to-br from-[#ffe0ea]/50 to-[#fff4f8]/60 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-14 -right-10 z-0 h-44 w-44 rounded-full bg-gradient-to-tl from-[#ffe9f0]/50 to-[#fff6fa]/60 blur-2xl" />

        <aside className={`${mobileChatOpen ? 'hidden lg:flex' : 'flex'} relative z-10 h-full w-full shrink-0 flex-col border-r border-[#f3e7ee] bg-white lg:w-[376px]`}>
          <header className="sb-head-in px-5 pb-2 pt-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffe0e9] to-[#fff0f4] text-[#b3265e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_-6px_rgba(190,50,90,0.35)]">
                  <MessageCircleMore className="h-5 w-5" fill="currentColor" strokeWidth={1.6} />
                </span>
                <div>
                  <h1 className="text-[21px] font-extrabold leading-tight tracking-tight text-[#3c1830]">Messages</h1>
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-[#b48ea0]">
                    <Heart className="h-3 w-3 fill-[#e8799e] text-[#e8799e]" /> Your connections
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#c39aae]" />
              <input
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Search conversations..."
                className="sb-search h-11 w-full rounded-full border border-[#f0e4ec] bg-[#fbf7f9] pl-11 pr-9 text-sm font-semibold text-[#4a2338] outline-none transition-all placeholder:text-[#c8a6b6] focus:border-[#f6c3d4] focus:bg-white focus:ring-4 focus:ring-[#fff0f6]"
              />
              {conversationQuery && (
                <button type="button" onClick={() => setConversationQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#fdeef3] text-[#c25780] transition-colors hover:bg-[#fcdde8]">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex gap-1 rounded-2xl bg-[#faf4f7] p-1" aria-label="Conversation filter">
              <button type="button" onClick={() => setFilter('all')} className={`flex-1 rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition-all ${filter === 'all' ? 'bg-white text-[#c2185b] shadow-[0_2px_8px_-3px_rgba(200,60,100,0.25)]' : 'text-[#9b7385] hover:text-[#c25780]'}`}>
                All
              </button>
              <button type="button" onClick={() => setFilter('unread')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition-all ${filter === 'unread' ? 'bg-white text-[#c6227b] shadow-[0_2px_8px_-3px_rgba(200,60,100,0.25)]' : 'text-[#9b7385] hover:text-[#c25780]'}`}>
                Unread
                {conversations.filter((c) => Number(c.unread || 0) > 0).length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-[#f25d8b] to-[#e4335f] px-1 text-[9px] font-extrabold text-white shadow-sm">
                    {conversations.filter((c) => Number(c.unread || 0) > 0).length}
                  </span>
                )}
              </button>
              <button type="button" className="flex-1 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-[#9b7385] transition-all hover:text-[#c25780]">
                Archived
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-1">
            {loadingConversations && (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#f3c6d4] border-t-[#e4335f]" />
                <p className="text-xs font-bold text-[#b48ea0]">Loading conversations…</p>
              </div>
            )}
            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="px-7 py-14 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#d86d95] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <MessageCircleMore className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
                </span>
                <p className="mt-4 text-sm font-extrabold text-[#4a2338]">No conversations yet</p>
                <p className="mt-1 text-xs leading-5 text-[#b48ea0]">Accepted interests appear here when messaging is available.</p>
                <Link to="/search" className="mt-4 inline-flex items-center gap-1 rounded-full border border-[#f3c6d4] bg-[#fff7fa] px-4 py-2 text-xs font-bold text-[#c2185b] transition-all hover:bg-[#ffeef4]">Discover profiles <ChevronRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
            {filteredConversations.map((conversation, index) => {
              const id = profileId(conversation);
              const selected = id === currentPartnerId;
              const online = Boolean(isOnline(id));
              const typing = Boolean(typingByPartner[id]);
              const unread = Number(conversation.unread || 0);
              const stagger = Math.min(index, 10) * 35;
              return (
                <button key={id} type="button" onClick={() => selectConversation(conversation)} className={`sb-card sb-card-lift group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-left transition-all duration-200 ${selected ? 'bg-gradient-to-r from-[#fff0f6] to-[#fffafc] shadow-[0_8px_20px_-12px_rgba(170,54,96,0.35)]' : 'hover:bg-[#fdf7fa]'}`} style={{ animationDelay: `${stagger}ms` }}>
                  {selected && <span className="sb-indicator absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-[#ef82a6] to-[#e4335f]" />}
                  <span className="relative shrink-0">
                    <span className="sb-avatar block h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-[#fdf0f5] shadow-[0_3px_10px_-4px_rgba(90,30,60,0.3)]">
                      <SmartImage src={conversation.profile?.photo} alt={profileName(conversation)} className="h-full w-full object-cover" />
                    </span>
                    {online && <span className="sb-dot absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2fc97a]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`flex min-w-0 items-center gap-1 truncate text-[14px] transition-colors ${unread > 0 ? 'font-extrabold text-[#3c1830]' : 'font-bold text-[#4a2338]'}`}>
                        <span className="truncate">{profileName(conversation)}</span>
                        {conversation.profile?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#2aa584]" aria-label="Verified" />}
                      </span>
                      <span className={`shrink-0 text-[10.5px] font-semibold ${unread > 0 ? 'text-[#e0557e]' : 'text-[#c39aae]'}`}>{conversationTime(conversation.time)}</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className={`min-w-0 truncate text-[12.5px] ${typing ? 'font-semibold text-[#e0557e]' : unread > 0 ? 'font-semibold text-[#9a6278]' : 'text-[#b691a1]'}`}>
                        {typing ? 'typing…' : conversation.lastMessage || 'Say hello 👋'}
                      </span>
                      {unread > 0 && (
                        <span className="sb-badge unread-pop flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f25d8b] to-[#e4335f] px-1.5 text-[9.5px] font-extrabold text-white shadow-[0_3px_8px_-2px_rgba(230,60,100,0.55)]">
                          {unreadBadge(unread)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {hasMoreConversations && (
              <button
                type="button"
                onClick={() => void loadMoreConversations()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#f3c6d4] bg-[#fff7fa] px-3 py-2.5 text-xs font-bold text-[#c2185b] transition-all hover:bg-[#ffeef4] active:scale-[0.995]"
              >
                {loadingMoreConversations ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f3c6d4] border-t-[#e4335f]" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {loadingMoreConversations ? 'Loading conversations…' : 'Load older conversations'}
              </button>
            )}
          </div>
        </aside>

        {activeConversation ? (
          <section className={`${mobileChatOpen ? 'flex' : 'hidden lg:flex'} relative min-w-0 flex-1 flex-col bg-[#fbf7f9]`}>
            <header className="absolute inset-x-0 top-0 z-30 flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-[#f1e4ec] bg-white/85 px-4 backdrop-blur-md sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={closeActiveConversation} aria-label="Back to conversations" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#9b7385] transition-colors hover:bg-[#fdf0f5] hover:text-[#c2185b] lg:hidden"><ArrowLeft className="h-5 w-5" /></button>
                <Link to={activeConversation ? profileHref(activeConversation.profile || activeConversation) : '#'} className="relative shrink-0">
                  <span className="block h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-[#fdf0f5] shadow-[0_3px_10px_-3px_rgba(90,30,60,0.35)]">
                    <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} aspectRatio="4:5" className="h-full w-full object-cover" />
                  </span>
                  {activeOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2fc97a]" />}
                </Link>
                <div className="flex min-w-0 flex-col justify-center">
                  <Link to={activeConversation ? profileHref(activeConversation.profile || activeConversation) : '#'} className="flex min-w-0 items-center gap-1.5 truncate text-[15.5px] font-extrabold tracking-tight text-[#3c1830] transition-colors hover:text-[#d13a72]">
                    <span className="truncate">{profileName(activeConversation)}</span>
                  </Link>
                  <p className={`flex items-center gap-1.5 truncate text-[11.5px] font-semibold ${partnerTyping ? 'text-[#e0557e]' : activeOnline ? 'text-[#2aa584]' : 'text-[#b48ea0]'}`}>
                    {partnerTyping ? (
                      <>
                        <span className="flex gap-0.5"><span className="h-1 w-1 animate-bounce rounded-full bg-[#e0557e]" /><span className="h-1 w-1 animate-bounce rounded-full bg-[#e0557e]" style={{ animationDelay: '120ms' }} /><span className="h-1 w-1 animate-bounce rounded-full bg-[#e0557e]" style={{ animationDelay: '240ms' }} /></span>
                        Typing
                      </>
                    ) : activeOnline ? 'Online' : chatSocketState === 'connecting' ? 'Connecting…' : lastSeenLabel(activeLastSeen)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-label="More options" className="flex h-10 w-10 items-center justify-center rounded-full text-[#9b7385] transition-colors hover:bg-[#fdf0f5] hover:text-[#c2185b]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                </button>
              </div>
            </header>

            {error && (
              <div className="absolute inset-x-0 top-[76px] z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[#f8d7e2] bg-[#fff5f8] px-4 py-2.5 text-xs font-semibold text-[#b3265e] shadow-sm">
                <span className="flex min-w-0 items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><span className="truncate">{error}</span></span>
                <button type="button" onClick={() => setError('')} className="rounded-full px-2 py-0.5 font-bold transition-colors hover:bg-[#fde3ec]">Dismiss</button>
              </div>
            )}
            {blockedState ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 pt-[76px] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#f3e4ec] bg-white text-[#d8a7bc] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"><Ban className="h-7 w-7" /></div>
                <h2 className="mt-5 text-lg font-extrabold text-[#3c1830]">{blockedState === 'blocked_by_user' ? 'You have been blocked by this user' : 'You have blocked this user'}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#b48ea0]">
                  {blockedState === 'blocked_by_user'
                    ? 'You can no longer send messages in this conversation.'
                    : 'You have blocked this user. Unblock them from Blocked & Rejected to message again.'}
                </p>
                {blockedState === 'you_blocked' && (
                  <Link to="/blocked" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#d13a72] to-[#c2185b] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(210,60,120,0.6)] transition-all hover:brightness-105">
                    <ShieldCheck className="h-4 w-4" /> Manage blocked
                  </Link>
                )}
              </div>
            ) : restriction ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 pt-[76px] text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4fbf8] text-[#2aa584]"><LockKeyhole className="h-6 w-6" /></div>
                <h2 className="mt-4 text-lg font-extrabold text-[#3c1830]">Conversation unavailable</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#b48ea0]">{restriction}</p>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1">
                  <div className="chat-pattern pointer-events-none absolute inset-0 opacity-[0.5]" aria-hidden />
                  <div ref={feedRef} onScroll={handleFeedScroll} className="relative h-full overflow-y-auto px-4 pb-5 pt-[96px] sm:px-8">
                  <div className="mx-auto max-w-3xl">
                    <div className="mx-auto mb-8 flex w-fit max-w-md items-start gap-2.5 rounded-full border border-[#efe0e9] bg-white/80 px-4 py-2 text-[11px] font-medium leading-5 text-[#b48ea0] shadow-[0_2px_10px_-6px_rgba(90,30,60,0.12)] backdrop-blur-sm">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c394ab]" />
                      Messages are encrypted. Stay safe.
                    </div>

                    {loadingMessages && (
                      <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#f3c6d4] border-t-[#e4335f]" />
                        <p className="text-xs font-bold text-[#b48ea0]">Loading conversation…</p>
                      </div>
                    )}
                    {!loadingMessages && messages.length > 0 && (
                      <p className="mb-6 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c9a7b4]">
                        {loadingOlderMessages ? 'Loading older messages…' : nextMessageCursor ? 'Scroll up for older messages' : 'Beginning of conversation'}
                      </p>
                    )}
                    {!loadingMessages && messages.length === 0 && !partnerTyping && (
                      <div className="pb-12 pt-6 text-center">
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#ffe0e9] to-[#fff0f4] text-[#d86d95] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-12px_rgba(190,50,90,0.4)]">
                          <MessageCircleMore className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
                        </span>
                        <h2 className="mt-5 text-lg font-extrabold tracking-tight text-[#3c1830]">Start the conversation</h2>
                        <p className="mt-1 text-[12.5px] text-[#b48ea0]">A warm, thoughtful introduction goes a long way.</p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                          {['Hello, nice to meet you.', 'I enjoyed reading your profile.', 'Would you like to talk?'].map((prompt) => (
                            <button key={prompt} type="button" onClick={() => void handleSend(prompt)} className="rounded-full border border-[#f3c6d4] bg-white px-4 py-2 text-[12.5px] font-bold text-[#c25780] shadow-[0_2px_8px_-4px_rgba(200,60,100,0.2)] transition-all hover:-translate-y-0.5 hover:border-[#e899b2] hover:bg-[#fff4f8] hover:text-[#c2185b]">{prompt}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {messages.map((message, index) => {
                        const mine = message.senderId === 'me';
                        const showDate = index === 0 || messages[index - 1].date !== message.date;
                        const deleted = message.deletedForEveryone;
                        return (
                          <div key={message.id} className="msg-in">
                            {showDate && (
                              <div className="my-7 text-center">
                                <span className="rounded-full border border-[#efe3e9] bg-white/90 px-4 py-1.5 text-[10.5px] font-bold tracking-wide text-[#b48ea0] shadow-[0_2px_8px_-5px_rgba(90,30,60,0.16)] backdrop-blur-sm">{message.date}</span>
                              </div>
                            )}
                            <div className={`flex items-end ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`group relative max-w-[85%] sm:max-w-[72%] ${mine
                                ? 'rounded-[22px] rounded-br-[8px] bg-gradient-to-br from-[#ffd9e4] to-[#ffecf2] text-[#6b1737] shadow-[0_6px_18px_-10px_rgba(200,50,95,0.4)]'
                                : 'rounded-[22px] rounded-bl-[8px] border border-[#f0e4ec] bg-white text-[#46303c] shadow-[0_4px_16px_-10px_rgba(80,30,55,0.25)]'}`}>
                                <p className={`whitespace-pre-wrap break-words px-4 pt-2.5 text-[14.5px] leading-[1.5] ${deleted ? 'italic text-[13px] text-[#c2a3b1]' : ''}`}>
                                  {deleted ? 'Message deleted' : message.text}
                                </p>
                                <div className={`flex items-center justify-end gap-1.5 px-4 pb-2 pt-1 text-[10px] font-semibold ${mine ? 'text-[#b3376a]/65' : 'text-[#c3a6b2]'}`}>
                                  <span>{message.failed ? 'Not sent' : message.pending ? 'Sending…' : message.time}</span>
                                  {mine && !message.failed && !deleted && (
                                    <span className={`flex items-center transition-colors ${message.read ? 'text-[#c2185b]' : 'text-[#c2417d]/45'}`} aria-label={message.read ? 'Read' : 'Delivered'}>
                                      <CheckCheck className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>
                                {!message.pending && !message.failed && !deleted && (
                                  <div className={`flex gap-3 rounded-b-[22px] px-4 pb-2 pt-0.5 text-[10px] font-bold opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${mine ? 'justify-end text-[#c25780]' : 'justify-start text-[#c3a6b2]'}`}>
                                    <button type="button" onClick={() => void handleDeleteMessage(message, 'for_me')} className="hover:underline underline-offset-2">Delete for me</button>
                                    {mine && <button type="button" onClick={() => void handleDeleteMessage(message, 'for_everyone')} className="hover:underline underline-offset-2">Delete for everyone</button>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {partnerTyping && (
                        <div className="msg-in flex justify-start">
                          <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-[8px] border border-[#f0e4ec] bg-white px-4 py-3.5 shadow-[0_4px_14px_-8px_rgba(80,40,55,0.25)]" aria-label={`${profileName(activeConversation)} is typing`}>
                            {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-[#e8799e]" style={{ animationDelay: `${dot * 120}ms` }} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                  {(!isAtBottom || newMessagesBelow > 0) && (
                    <button
                      type="button"
                      onClick={() => scrollToLatest('smooth')}
                      aria-label={newMessagesBelow > 0 ? `Jump to ${newMessagesBelow} new messages` : 'Scroll to latest message'}
                      className="absolute bottom-4 right-6 z-10 inline-flex items-center gap-1.5 rounded-full border border-[#f3e4ec] bg-white px-3.5 py-2 text-[11px] font-bold text-[#c2185b] shadow-[0_8px_20px_-8px_rgba(200,60,100,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <ArrowDown className="h-4 w-4 text-[#d26d95]" />
                      {newMessagesBelow > 0 && <span className="unread-pop flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-[#f25d8b] to-[#e4335f] px-1 text-[9px] font-extrabold text-white">{newMessagesBelow}</span>}
                    </button>
                  )}
                </div>

                <footer className="relative z-20 shrink-0 border-t-0 bg-[#0f172a] px-3 py-3 sm:px-4">
                  <div className="mx-auto flex max-w-3xl items-end gap-2.5">
                    <textarea
                      value={draft}
                      onChange={(event) => updateDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
                      rows={1}
                      maxLength={2000}
                      placeholder="Write a message..."
                      aria-label="Message"
                      className="max-h-[140px] min-h-[48px] min-w-0 flex-1 resize-none rounded-[14px] border-0 bg-white px-5 py-3 text-[15px] leading-normal text-[#0f172a] outline-none transition-all placeholder:text-[#c4a9b5] focus:ring-2 focus:ring-[#eed7de]/30"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim()}
                      title="Send message"
                      aria-label="Send message"
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[12px] bg-[#eed7de] text-white transition-all duration-200 hover:bg-[#e4c9d1] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-slate-500 disabled:active:scale-100"
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" /></svg>
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>
        ) : (
          <section className="hidden min-w-0 flex-1 flex-col items-center justify-center border-l border-[#f3e7ee] bg-[#fbf7f9] px-8 text-center lg:flex">
            <span className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#ffe0e9] to-[#fff0f4] blur-xl opacity-70" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#ffe0e9] to-[#fff0f4] text-[#d86d95] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_-14px_rgba(190,50,90,0.5)]">
                <MessageCircleMore className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
              </span>
            </span>
            <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-[#3c1830]">Your conversations</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#b48ea0]">Choose a conversation to continue an elegant chat with your accepted match.</p>
          </section>
        )}

        {detailsOpen && activeConversation && (
          <aside className="hidden h-full w-[300px] shrink-0 flex-col border-l border-[#f3e7ee] bg-white xl:flex">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#f3e7ee] px-5">
              <p className="text-sm font-extrabold text-[#3c1830]">Profile details</p>
              <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details" className="flex h-8 w-8 items-center justify-center rounded-full text-[#b48ea0] transition-colors hover:bg-[#fdf0f5] hover:text-[#c2185b]"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 text-center">
              <span className="mx-auto block h-44 w-32 overflow-hidden rounded-2xl border-2 border-white bg-[#fdf0f5] shadow-[0_12px_28px_-14px_rgba(100,30,60,0.4)]">
                <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} aspectRatio="4:5" className="h-full w-full object-cover" />
              </span>
              <h2 className="mt-5 text-lg font-extrabold tracking-tight text-[#3c1830]">{profileName(activeConversation)}</h2>
              <p className="mt-1 text-xs font-medium text-[#c39aae]">{activeConversation.profile?.occupation || 'Member'}</p>
              {activeOnline && <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2aa584]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2aa584] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2fc97a]" /></span> Online</p>}
              <Link to={profileHref(activeConversation.profile || activeConversation)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#17232d] to-[#2a3b49] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(23,35,45,0.8)] transition-all hover:brightness-110"><UserRound className="h-4 w-4" /> View full profile</Link>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#ffe0e9] bg-[#fff6fa] p-3.5 text-left">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#d86d95]" />
                <div><p className="text-xs font-bold text-[#8d3a57]">Stay on the platform</p><p className="mt-0.5 text-[11px] leading-5 text-[#b48ea0]">Use in-app chat until you trust the other member.</p></div>
              </div>
            </div>
          </aside>
        )}

        {detailsOpen && activeConversation && (
          <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label="Profile details">
            <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close profile details" className="absolute inset-0 bg-[#4a2033]/40 backdrop-blur-sm" />
            <aside className="absolute bottom-0 right-0 top-0 flex w-[min(88vw,360px)] flex-col border-l border-[#f3e7ee] bg-white shadow-2xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#f3e7ee] px-5">
                <p className="text-sm font-extrabold text-[#3c1830]">Profile details</p>
                <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details" className="flex h-9 w-9 items-center justify-center rounded-full text-[#b48ea0] transition-colors hover:bg-[#fdf0f5] hover:text-[#c2185b]"><X className="h-4 w-4" /></button>
              </div>
              <div className="overflow-y-auto p-5 text-center">
                <span className="mx-auto block h-48 w-36 overflow-hidden rounded-2xl border-2 border-white bg-[#fdf0f5] shadow-[0_12px_28px_-14px_rgba(100,30,60,0.4)]">
                  <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} aspectRatio="4:5" className="h-full w-full object-cover" />
                </span>
                <h2 className="mt-5 text-lg font-extrabold tracking-tight text-[#3c1830]">{profileName(activeConversation)}</h2>
                <p className="mt-1 text-xs font-medium text-[#c39aae]">{activeConversation.profile?.occupation || 'Member'}</p>
                <Link to={profileHref(activeConversation.profile || activeConversation)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#17232d] to-[#2a3b49] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(23,35,45,0.8)] transition-all hover:brightness-110"><UserRound className="h-4 w-4" /> View full profile</Link>
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#ffe0e9] bg-[#fff6fa] p-3.5 text-left">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#d86d95]" />
                  <div><p className="text-xs font-bold text-[#8d3a57]">Stay on the platform</p><p className="mt-0.5 text-[11px] leading-5 text-[#b48ea0]">Use in-app chat until you trust the other member.</p></div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {limitOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="message-limit-title">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><SlidersHorizontal className="h-5 w-5" /></div>
            <h2 id="message-limit-title" className="mt-4 text-lg font-extrabold text-[#17232d]">Daily message limit reached</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Your current plan&apos;s message allowance resets at midnight. Upgrade for a higher limit.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setLimitOpen(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600">Close</button>
              <Link to="/membership" className="flex-1 rounded-lg bg-[#bd304d] px-3 py-2.5 text-sm font-bold text-white">View plans</Link>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
