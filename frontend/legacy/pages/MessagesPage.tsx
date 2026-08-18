'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  CheckCheck,
  ChevronRight,
  Crown,
  Info,
  LockKeyhole,
  MessageCircleMore,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { Link, useLocation, useNavigate, useSearchParams } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { getConversations, getMessages, getProfile, markMessagesRead, sendMessage } from '../services/dataService';
import { fetchApi } from '../services/apiClient';
import { useRealtime } from '../../providers/RealtimeProvider';
import { useChatSocket } from '../../hooks/use-chat-socket';
import { usePresence } from '../../hooks/use-presence';
import { deriveFallbackKey, encryptMessage, smartDecryptText } from '../utils/crypto';
import { clearActiveChatPartnerId, setActiveChatPartnerId } from '@/lib/chat-notification-state';

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
  return unread >= 4 ? '4+' : String(unread);
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
      let rows = await decryptConversations(await getConversations());
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
    if (!activeConversation || !currentPartnerId || loadingMessages || !isAtBottom) return;
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
  }, [activeConversation, connected, currentPartnerId, isAtBottom, loadingMessages, messages, sendSocket]);

  useEffect(() => {
    const unsubscribe = subscribe('notification.created', (event) => {
      if (event.data?.notification_type === 'CHAT_MESSAGE') void refreshConversations();
    });
    return unsubscribe;
  }, [refreshConversations, subscribe]);

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
    <div className="flex h-full min-h-[36rem] overflow-hidden bg-[#eef1f2] pb-16 lg:p-5 lg:pb-5">
      <div className="mx-auto flex h-full w-full max-w-[1440px] overflow-hidden border-slate-200 bg-white lg:rounded-lg lg:border lg:shadow-sm">
        <aside className={`${mobileChatOpen ? 'hidden lg:flex' : 'flex'} h-full w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-[350px] xl:w-[390px]`}>
          <header className="border-b border-slate-200 px-4 pb-4 pt-5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-[#bd304d]">Connections</p>
                <h1 className="mt-1 text-xl font-extrabold text-[#17232d]">Messages</h1>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-[#eef7f3] px-2.5 py-1.5 text-[11px] font-bold text-[#267255]">
                <LockKeyhole className="h-3.5 w-3.5" /> Private
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="Search conversations" className="h-10 w-full rounded-lg border border-slate-200 bg-[#f7f8f8] pl-9 pr-9 text-sm text-[#17232d] outline-none placeholder:text-slate-400 focus:border-[#9ebbad] focus:bg-white" />
              {conversationQuery && <button type="button" onClick={() => setConversationQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mt-3 flex gap-1 rounded-lg bg-[#f2f4f5] p-1" aria-label="Conversation filter">
              {(['all', 'unread'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold capitalize ${filter === value ? 'bg-white text-[#17232d] shadow-sm' : 'text-slate-500'}`}>{value}</button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingConversations && <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#bd304d] border-t-transparent" /> Loading conversations</div>}
            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="px-7 py-14 text-center">
                <MessageCircleMore className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-[#17232d]">No conversations found</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Accepted interests appear here when messaging is available.</p>
                <Link to="/search" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#bd304d]">Discover profiles <ChevronRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
            {filteredConversations.map((conversation) => {
              const id = profileId(conversation);
              const selected = id === currentPartnerId;
              const online = Boolean(isOnline(id));
              const typing = Boolean(typingByPartner[id]);
              return (
                <button key={id} type="button" onClick={() => selectConversation(conversation)} className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left hover:bg-[#f7f8f8] sm:px-5 ${selected ? 'bg-[#f1f7f4]' : 'bg-white'}`}>
                  <div className="relative shrink-0">
                    <SmartImage src={conversation.profile?.photo} alt={profileName(conversation)} className="h-12 w-12 rounded-lg object-cover" />
                    {online && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2aa66f]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1 truncate text-sm font-extrabold text-[#17232d]">
                        <span className="truncate">{profileName(conversation)}</span>
                        {conversation.profile?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#267255]" aria-label="Verified" />}
                      </p>
                      <span className={`shrink-0 text-[10px] font-bold ${conversation.unread ? 'text-[#267255]' : 'text-slate-400'}`}>{conversationTime(conversation.time)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className={`truncate text-xs ${typing ? 'font-semibold text-[#267255]' : 'text-slate-500'}`}>
                        {typing ? 'typing...' : conversation.lastMessage || 'Start a conversation'}
                      </p>
                      {Number(conversation.unread || 0) > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#267255] px-1 text-[10px] font-extrabold text-white">{unreadBadge(conversation.unread)}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {activeConversation ? (
          <section className={`${mobileChatOpen ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col bg-[#f8f9f9]`}>
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={closeActiveConversation} aria-label="Back to conversations" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 lg:hidden"><ArrowLeft className="h-5 w-5" /></button>
                <Link to={`/profile/${currentPartnerId}`} className="relative shrink-0">
                  <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} className="h-10 w-10 rounded-lg object-cover" />
                  {activeOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#2aa66f]" />}
                </Link>
                <div className="min-w-0">
                  <Link to={`/profile/${currentPartnerId}`} className="flex items-center gap-1.5 truncate text-sm font-extrabold text-[#17232d] hover:text-[#bd304d]">
                    <span className="truncate">{profileName(activeConversation)}</span>
                    {activeConversation.profile?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#267255]" />}
                  </Link>
                  <p className={`truncate text-[11px] font-semibold ${partnerTyping || activeOnline || chatSocketState === 'connecting' ? 'text-[#267255]' : 'text-slate-400'}`}>
                    {partnerTyping ? 'Typing...' : activeOnline ? 'Online' : chatSocketState === 'connecting' ? 'Connecting...' : lastSeenLabel(activeLastSeen)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setDetailsOpen((open) => !open)} title="Profile details" aria-label="Profile details" className={`flex h-9 w-9 items-center justify-center rounded-full ${detailsOpen ? 'bg-[#eef7f3] text-[#267255]' : 'text-slate-500 hover:bg-slate-100'}`}><Info className="h-4 w-4" /></button>
              </div>
            </header>

            {error && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                <span className="flex min-w-0 items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><span className="truncate">{error}</span></span>
                <button type="button" onClick={() => setError('')} className="font-bold">Dismiss</button>
              </div>
            )}
            {restriction ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#267255] shadow-sm"><LockKeyhole className="h-6 w-6" /></div>
                <h2 className="mt-4 text-lg font-extrabold text-[#17232d]">Conversation unavailable</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{restriction}</p>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1">
                  <div ref={feedRef} onScroll={handleFeedScroll} className="h-full overflow-y-auto px-3 py-5 sm:px-6">
                  <div className="mx-auto max-w-3xl">
                    <div className="mx-auto mb-6 flex max-w-md items-start gap-2 rounded-lg border border-[#dce9e3] bg-[#f2f8f5] px-3 py-2.5 text-[11px] leading-5 text-[#4b6d5f]">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#267255]" />
                      Messages are encrypted. Keep personal and financial information private.
                    </div>

                    {loadingMessages && <div className="py-16 text-center text-xs font-bold text-slate-400">Loading conversation...</div>}
                    {!loadingMessages && messages.length > 0 && (
                      <p className="mb-4 text-center text-[11px] font-semibold text-slate-400">
                        {loadingOlderMessages ? 'Loading older messages...' : nextMessageCursor ? 'Scroll up to load older messages' : 'Beginning of this conversation'}
                      </p>
                    )}
                    {!loadingMessages && messages.length === 0 && !partnerTyping && (
                      <div className="py-12 text-center">
                        <MessageCircleMore className="mx-auto h-9 w-9 text-slate-300" />
                        <h2 className="mt-3 text-base font-extrabold text-[#17232d]">Start the conversation</h2>
                        <p className="mt-1 text-xs text-slate-500">A simple, thoughtful introduction works best.</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {['Hello, nice to meet you.', 'I enjoyed reading your profile.', 'Would you like to talk?'].map((prompt) => (
                            <button key={prompt} type="button" onClick={() => void handleSend(prompt)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#9ebbad] hover:text-[#267255]">{prompt}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {messages.map((message, index) => {
                        const mine = message.senderId === 'me';
                        const showDate = index === 0 || messages[index - 1].date !== message.date;
                        return (
                          <div key={message.id}>
                            {showDate && <div className="my-5 text-center"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-400">{message.date}</span></div>}
                            <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[86%] rounded-lg px-3.5 py-2.5 shadow-sm sm:max-w-[72%] ${mine ? 'bg-[#245f4a] text-white' : 'border border-slate-200 bg-white text-[#17232d]'}`}>
                                <p className={`whitespace-pre-wrap break-words text-sm leading-5 ${message.deletedForEveryone ? 'italic opacity-70' : ''}`}>{message.text}</p>
                                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                                  <span>{message.failed ? 'Not sent' : message.pending ? 'Sending' : message.time}</span>
                                  {mine && !message.failed && (
                                    <span className={`inline-flex items-center justify-center ${message.read ? 'rounded-full bg-white p-0.5 text-[#0b3d91] shadow-sm' : 'text-white/60'}`} aria-label={message.read ? 'Read' : 'Delivered'}>
                                      <CheckCheck className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>
                                {!message.pending && !message.failed && !message.deletedForEveryone && (
                                  <div className={`mt-2 flex gap-2 text-[10px] ${mine ? 'justify-end text-white/70' : 'justify-start text-slate-400'}`}>
                                    <button type="button" onClick={() => void handleDeleteMessage(message, 'for_me')} className="underline underline-offset-2">Delete for me</button>
                                    {mine && <button type="button" onClick={() => void handleDeleteMessage(message, 'for_everyone')} className="underline underline-offset-2">Delete for everyone</button>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {partnerTyping && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm" aria-label={`${profileName(activeConversation)} is typing`}>
                            {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#267255]" style={{ animationDelay: `${dot * 120}ms` }} />)}
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
                      className="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#17232d] px-3 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-[#bd304d] focus:outline-none focus:ring-2 focus:ring-[#bd304d] focus:ring-offset-2"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      {newMessagesBelow > 0 && <span>{newMessagesBelow} new {newMessagesBelow === 1 ? 'message' : 'messages'}</span>}
                    </button>
                  )}
                </div>

                <footer className="shrink-0 border-t border-slate-200 bg-white p-3 sm:px-5 sm:py-4">
                  <div className="mx-auto flex max-w-3xl items-end gap-2">
                    <textarea value={draft} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} rows={1} maxLength={2000} placeholder="Write a message" aria-label="Message" className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-[#f7f8f8] px-3.5 py-3 text-sm leading-5 text-[#17232d] outline-none placeholder:text-slate-400 focus:border-[#9ebbad] focus:bg-white" />
                    <button type="button" onClick={() => void handleSend()} disabled={!draft.trim()} title="Send message" aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#bd304d] text-white shadow-sm hover:bg-[#a72742] disabled:cursor-not-allowed disabled:bg-slate-300"><Send className="h-4 w-4" /></button>
                  </div>
                  <p className="mx-auto mt-1.5 hidden max-w-3xl text-[10px] text-slate-400 sm:block">Enter to send. Shift + Enter for a new line.</p>
                </footer>
              </>
            )}
          </section>
        ) : (
          <section className="hidden min-w-0 flex-1 flex-col items-center justify-center bg-[#f8f9f9] px-8 text-center lg:flex">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[#267255] shadow-sm"><MessageCircleMore className="h-7 w-7" /></div>
            <h2 className="mt-4 text-xl font-extrabold text-[#17232d]">Your conversations</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Choose a conversation to continue talking with an accepted match.</p>
          </section>
        )}

        {detailsOpen && activeConversation && (
          <aside className="hidden h-full w-[280px] shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <p className="text-sm font-extrabold text-[#17232d]">Profile details</p>
              <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 text-center">
              <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} className="mx-auto aspect-[4/5] w-full rounded-lg object-cover" />
              <h2 className="mt-4 text-lg font-extrabold text-[#17232d]">{profileName(activeConversation)}</h2>
              <p className="mt-1 text-xs text-slate-500">{activeConversation.profile?.occupation || 'Member'}</p>
              <Link to={`/profile/${currentPartnerId}`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#17232d] px-4 py-2.5 text-sm font-bold text-white"><UserRound className="h-4 w-4" /> View full profile</Link>
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#dce9e3] bg-[#f2f8f5] p-3 text-left">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#267255]" />
                <div><p className="text-xs font-bold text-[#1f5f47]">Stay on the platform</p><p className="mt-1 text-[11px] leading-5 text-[#5a7469]">Use in-app chat until you trust the other member.</p></div>
              </div>
            </div>
          </aside>
        )}

        {detailsOpen && activeConversation && (
          <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label="Profile details">
            <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close profile details" className="absolute inset-0 bg-slate-950/35" />
            <aside className="absolute bottom-0 right-0 top-0 flex w-[min(88vw,360px)] flex-col border-l border-slate-200 bg-white shadow-2xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
                <p className="text-sm font-extrabold text-[#17232d]">Profile details</p>
                <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="overflow-y-auto p-5 text-center">
                <SmartImage src={activeConversation.profile?.photo} alt={profileName(activeConversation)} className="mx-auto aspect-[4/5] w-full rounded-lg object-cover" />
                <h2 className="mt-4 text-lg font-extrabold text-[#17232d]">{profileName(activeConversation)}</h2>
                <p className="mt-1 text-xs text-slate-500">{activeConversation.profile?.occupation || 'Member'}</p>
                <Link to={`/profile/${currentPartnerId}`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#17232d] px-4 py-2.5 text-sm font-bold text-white"><UserRound className="h-4 w-4" /> View full profile</Link>
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#dce9e3] bg-[#f2f8f5] p-3 text-left">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#267255]" />
                  <div><p className="text-xs font-bold text-[#1f5f47]">Stay on the platform</p><p className="mt-1 text-[11px] leading-5 text-[#5a7469]">Use in-app chat until you trust the other member.</p></div>
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
  );
}
