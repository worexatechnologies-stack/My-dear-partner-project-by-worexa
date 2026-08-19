'use client';

import {
  Bell,
  ChevronRight,
  Crown,
  Eye,
  Heart,
  MessageCircle,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import { getActiveChatPartnerId } from '@/lib/chat-notification-state';
import { useAuth } from '@/legacy/contexts/AuthContext';
import {
  supportService,
  type Notification as MemberNotification,
} from '@/legacy/services/supportService';
import { useRealtime, type RealtimeEvent } from '@/providers/RealtimeProvider';

export type PushStatus =
  | 'checking'
  | 'default'
  | 'enabled'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'unavailable';

export type NotificationVisual = {
  icon: LucideIcon;
  iconClassName: string;
};

type NotificationCenterContextValue = {
  notifications: MemberNotification[];
  unreadCount: number;
  initialized: boolean;
  realtimeStatus: ReturnType<typeof useRealtime>['status'];
  pushStatus: PushStatus;
  pushError: string | null;
  lastChange: NotificationStateChange | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  enableBrowserPush: () => Promise<PushStatus>;
};

export type NotificationStateChange = {
  type: 'read' | 'marked-all-read' | 'cleared';
  notificationId?: string;
};

type CrossTabEvent =
  | { type: 'read'; notificationId: string; unreadCount?: number }
  | { type: 'marked-all-read' }
  | { type: 'cleared' };

const NOTIFICATION_CHANNEL = 'my-dear-partner:notifications';

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mergeNotifications(
  current: MemberNotification[],
  incoming: MemberNotification[],
  limit?: number,
): MemberNotification[] {
  const rows = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    const existing = rows.get(row.id);
    rows.set(row.id, { ...existing, ...row });
  }
  const ordered = Array.from(rows.values()).sort((a, b) => (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ));
  return limit ? ordered.slice(0, limit) : ordered;
}

function eventToNotification(event: RealtimeEvent): MemberNotification | null {
  if (event.type !== 'notification.created') return null;
  const data = event.data;
  const id = asText(data.id, event.entity_id);
  if (!id) return null;
  return {
    id,
    notification_type: asText(data.notification_type, event.notification_type || ''),
    title: asText(data.title, event.title || 'My Dear Partner'),
    message: asText(data.message, event.message || 'You have a new update.'),
    link_url: asText(data.link_url, event.link_url || ''),
    priority: asText(data.priority, 'NORMAL'),
    is_read: asBoolean(data.is_read, false),
    created_at: asText(data.created_at, event.timestamp),
  };
}

function pushPayloadToNotification(payload: Record<string, unknown>): MemberNotification | null {
  const id = asText(payload.id);
  if (!id) return null;
  return {
    id,
    notification_type: asText(payload.notification_type),
    title: asText(payload.title, 'My Dear Partner'),
    message: asText(payload.body, 'You have a new update.'),
    link_url: asText(payload.url, '/notifications'),
    priority: asText(payload.priority, 'NORMAL'),
    is_read: false,
    created_at: asText(payload.created_at, new Date().toISOString()),
  };
}

function partnerIdFromLink(linkUrl?: string): string {
  const match = /[?&]user=([^&]+)/.exec(linkUrl || '');
  return match ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function safeNotificationUrl(linkUrl?: string): string | null {
  return linkUrl && linkUrl.startsWith('/') && !linkUrl.startsWith('//') ? linkUrl : null;
}

function urlBase64ToUint8Array(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

export function notificationVisual(row: Pick<MemberNotification, 'notification_type' | 'title'>): NotificationVisual {
  const type = `${row.notification_type} ${row.title}`.toLowerCase();
  if (type.includes('message') || type.includes('chat')) {
    return { icon: MessageCircle, iconClassName: 'bg-[#f8e9ee] text-[#8e3d58]' };
  }
  if (type.includes('interest') || type.includes('match') || type.includes('shortlist') || type.includes('like')) {
    return { icon: Heart, iconClassName: 'bg-[#f8e9ee] text-[#b64a68]' };
  }
  if (type.includes('view') || type.includes('visitor')) {
    return { icon: Eye, iconClassName: 'bg-[#f7efe9] text-[#8e6358]' };
  }
  if (type.includes('membership') || type.includes('payment') || type.includes('billing')) {
    return { icon: Crown, iconClassName: 'bg-[#f8edf0] text-[#8e3d58]' };
  }
  if (type.includes('security') || type.includes('verification') || type.includes('account')) {
    return { icon: ShieldCheck, iconClassName: 'bg-[#f8e9ee] text-[#8e3d58]' };
  }
  return { icon: Bell, iconClassName: 'bg-[#f8f1ed] text-[#8a747d]' };
}

export function notificationTime(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NotificationLiveToast({
  notification,
  onDismiss,
  onOpen,
}: {
  notification: MemberNotification | null;
  onDismiss: () => void;
  onOpen: (notification: MemberNotification) => void;
}) {
  if (!notification) return null;
  const visual = notificationVisual(notification);
  const Icon = visual.icon;
  const isChat = notification.notification_type.toUpperCase() === 'CHAT_MESSAGE';

  return (
    <aside
      className="fixed right-4 top-20 z-[90] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-[#e5d5d0] bg-white/95 p-3.5 shadow-[0_16px_42px_rgba(69,35,47,0.16)] backdrop-blur-md motion-safe:animate-[ui-toast-in_.3s_cubic-bezier(.2,.8,.25,1)_both]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.iconClassName}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#302328]">{notification.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#78676d]">
            {isChat ? 'You have a new message.' : notification.message}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[#a08c93] transition hover:bg-[#f8e9ee] hover:text-[#8e3d58] focus-visible:outline-2 focus-visible:outline-[#b64a68]"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#f0e5e0] pt-2.5">
        <span className="text-[11px] font-semibold text-[#9a878e]">{notificationTime(notification.created_at)}</span>
        <button
          type="button"
          onClick={() => onOpen(notification)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] focus-visible:outline-2 focus-visible:outline-[#b64a68]"
        >
          View <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { status: realtimeStatus, subscribe } = useRealtime();
  const router = useRouter();
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('checking');
  const [pushError, setPushError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<NotificationStateChange | null>(null);
  const [liveToast, setLiveToast] = useState<MemberNotification | null>(null);
  const notificationsRef = useRef<MemberNotification[]>([]);
  const knownIdsRef = useRef(new Set<string>());
  const stateEpochRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const previousRealtimeStatusRef = useRef(realtimeStatus);

  const applyReadLocally = useCallback((notificationId: string, knownUnreadCount?: number) => {
    const wasUnread = notificationsRef.current.some((row) => (
      row.id === notificationId && !row.is_read
    ));
    setNotifications((current) => current.map((row) => {
      if (row.id !== notificationId || row.is_read) return row;
      return { ...row, is_read: true, read_at: new Date().toISOString() };
    }));
    setUnreadCount((current) => knownUnreadCount ?? (wasUnread ? Math.max(0, current - 1) : current));
    setLastChange({ type: 'read', notificationId });
  }, []);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const applyMarkAllReadLocally = useCallback(() => {
    setNotifications((current) => current.map((row) => ({ ...row, is_read: true })));
    setUnreadCount(0);
    setLastChange({ type: 'marked-all-read' });
  }, []);

  const applyClearLocally = useCallback(() => {
    stateEpochRef.current += 1;
    knownIdsRef.current.clear();
    setNotifications([]);
    setUnreadCount(0);
    setLiveToast(null);
    setLastChange({ type: 'cleared' });
  }, []);

  const refreshUnread = useCallback(async () => {
    const stateEpoch = stateEpochRef.current;
    const response = await supportService.getUnreadNotificationsCount();
    if (stateEpoch === stateEpochRef.current) {
      setUnreadCount(Math.max(0, Number(response.unread_count) || 0));
    }
  }, []);

  const refresh = useCallback(async () => {
    const stateEpoch = stateEpochRef.current;
    const [feed, unread] = await Promise.all([
      supportService.getNotifications({ limit: 6 }),
      supportService.getUnreadNotificationsCount(),
    ]);
    if (stateEpoch !== stateEpochRef.current) return;
    for (const row of feed.results) knownIdsRef.current.add(row.id);
    setNotifications((current) => mergeNotifications(current, feed.results, 6));
    setUnreadCount(Math.max(0, Number(unread.unread_count) || 0));
    setInitialized(true);
  }, []);

  const broadcastToTabs = useCallback((event: CrossTabEvent) => {
    channelRef.current?.postMessage(event);
  }, []);

  const markRead = useCallback(async (notificationId: string) => {
    applyReadLocally(notificationId);
    try {
      const response = await supportService.markNotificationRead(notificationId) as { unread_count?: number };
      const nextUnread = asNumber(response?.unread_count);
      if (nextUnread !== null) setUnreadCount(Math.max(0, nextUnread));
      broadcastToTabs({ type: 'read', notificationId, unreadCount: nextUnread ?? undefined });
      return true;
    } catch {
      void refresh().catch(() => undefined);
      return false;
    }
  }, [applyReadLocally, broadcastToTabs, refresh]);

  const markAllRead = useCallback(async () => {
    applyMarkAllReadLocally();
    try {
      await supportService.markAllNotificationsRead();
      broadcastToTabs({ type: 'marked-all-read' });
      return true;
    } catch {
      void refresh().catch(() => undefined);
      return false;
    }
  }, [applyMarkAllReadLocally, broadcastToTabs, refresh]);

  const clearAll = useCallback(async () => {
    applyClearLocally();
    try {
      await supportService.clearAllNotifications();
      broadcastToTabs({ type: 'cleared' });
      return true;
    } catch {
      void refresh().catch(() => undefined);
      return false;
    }
  }, [applyClearLocally, broadcastToTabs, refresh]);

  const showLiveToast = useCallback((notification: MemberNotification) => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const partnerId = partnerIdFromLink(notification.link_url);
    if (partnerId && partnerId === getActiveChatPartnerId()) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setLiveToast(notification);
    toastTimerRef.current = window.setTimeout(() => setLiveToast(null), 7000);
  }, []);

  const enableBrowserPush = useCallback(async (): Promise<PushStatus> => {
    setPushError(null);
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return 'unsupported';
    }

    try {
      const config = await supportService.getWebPushConfig();
      if (!config.enabled || !config.public_key) {
        setPushStatus('unavailable');
        setPushError('Browser push has not been configured for this environment yet.');
        return 'unavailable';
      }
      if (Notification.permission === 'denied') {
        setPushStatus('denied');
        return 'denied';
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        const status = permission === 'denied' ? 'denied' : 'default';
        setPushStatus(status);
        return status;
      }

      const registration = await navigator.serviceWorker.register('/notification-sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.public_key),
      });
      const data = subscription.toJSON();
      const p256dh = data.keys?.p256dh;
      const auth = data.keys?.auth;
      if (!subscription.endpoint || !p256dh || !auth) throw new Error('Your browser returned an incomplete push subscription.');
      await supportService.subscribeToWebPush({ endpoint: subscription.endpoint, p256dh, auth });
      setPushStatus('enabled');
      return 'enabled';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push notifications could not be enabled.';
      setPushError(message);
      setPushStatus(Notification.permission === 'denied' ? 'denied' : 'default');
      return Notification.permission === 'denied' ? 'denied' : 'default';
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      stateEpochRef.current += 1;
      knownIdsRef.current.clear();
      setNotifications([]);
      setUnreadCount(0);
      setInitialized(false);
      setLiveToast(null);
      setLastChange({ type: 'cleared' });
      return;
    }
    void refresh().catch(() => setInitialized(true));
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const config = await supportService.getWebPushConfig();
        if (cancelled) return;
        if (!config.enabled || !config.public_key) {
          setPushStatus('unavailable');
          return;
        }
        if (Notification.permission === 'denied') {
          setPushStatus('denied');
          return;
        }
        if (Notification.permission !== 'granted') {
          setPushStatus('default');
          return;
        }
        const registration = await navigator.serviceWorker.register('/notification-sw.js', { scope: '/' });
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setPushStatus(subscription ? 'enabled' : 'granted');
      } catch {
        if (!cancelled) setPushStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`${NOTIFICATION_CHANNEL}:${user.id}`);
    channelRef.current = channel;
    channel.onmessage = (message: MessageEvent<CrossTabEvent>) => {
      const event = message.data;
      if (!event || typeof event !== 'object') return;
      if (event.type === 'read') applyReadLocally(event.notificationId, event.unreadCount);
      if (event.type === 'marked-all-read') applyMarkAllReadLocally();
      if (event.type === 'cleared') applyClearLocally();
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applyClearLocally, applyMarkAllReadLocally, applyReadLocally, user?.id]);

  useEffect(() => {
    const unsubscribeCreated = subscribe('notification.created', (event) => {
      const notification = eventToNotification(event);
      if (!notification) return;
      const existed = knownIdsRef.current.has(notification.id);
      knownIdsRef.current.add(notification.id);
      setNotifications((current) => mergeNotifications(current, [notification], 6));
      if (!existed && !notification.is_read) setUnreadCount((current) => current + 1);
      // A tiny aggregate request repairs counts for an updated grouped chat
      // notification without reloading a whole notification page.
      void refreshUnread().catch(() => undefined);
      if (!existed || notification.notification_type.toUpperCase() === 'CHAT_MESSAGE') showLiveToast(notification);
    });
    const unsubscribeRead = subscribe('notification.read', (event) => {
      const notificationId = asText(event.data.notification_id, event.entity_id);
      const nextUnread = asNumber(event.data.unread_count);
      if (notificationId) applyReadLocally(notificationId, nextUnread ?? undefined);
    });
    const unsubscribeMarkedAllRead = subscribe('notification.marked_all_read', () => applyMarkAllReadLocally());
    const unsubscribeCleared = subscribe('notification.cleared', () => applyClearLocally());
    return () => {
      unsubscribeCreated();
      unsubscribeRead();
      unsubscribeMarkedAllRead();
      unsubscribeCleared();
    };
  }, [applyClearLocally, applyMarkAllReadLocally, applyReadLocally, refreshUnread, showLiveToast, subscribe]);

  useEffect(() => {
    const previous = previousRealtimeStatusRef.current;
    previousRealtimeStatusRef.current = realtimeStatus;
    if (realtimeStatus === 'connected' && previous !== 'connected' && initialized) {
      void refresh().catch(() => undefined);
    }
  }, [initialized, realtimeStatus, refresh]);

  useEffect(() => {
    const syncOnFocus = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    };
    const receiveServiceWorkerPush = (event: MessageEvent<{ type?: string; payload?: Record<string, unknown> }>) => {
      if (event.data?.type !== 'mdp.web-push' || !event.data.payload) return;
      const notification = pushPayloadToNotification(event.data.payload);
      if (!notification) return;
      const existed = knownIdsRef.current.has(notification.id);
      knownIdsRef.current.add(notification.id);
      setNotifications((current) => mergeNotifications(current, [notification], 6));
      if (!existed) setUnreadCount((current) => current + 1);
    };
    window.addEventListener('visibilitychange', syncOnFocus);
    navigator.serviceWorker?.addEventListener('message', receiveServiceWorkerPush);
    return () => {
      window.removeEventListener('visibilitychange', syncOnFocus);
      navigator.serviceWorker?.removeEventListener('message', receiveServiceWorkerPush);
    };
  }, [refresh]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const openToastNotification = useCallback((notification: MemberNotification) => {
    setLiveToast(null);
    void markRead(notification.id);
    const destination = safeNotificationUrl(notification.link_url);
    if (destination) router.push(destination);
  }, [markRead, router]);

  return (
    <NotificationCenterContext.Provider value={{
      notifications,
      unreadCount,
      initialized,
      realtimeStatus,
      pushStatus,
      pushError,
      lastChange,
      refresh,
      markRead,
      markAllRead,
      clearAll,
      enableBrowserPush,
    }}>
      {children}
      <NotificationLiveToast
        notification={liveToast}
        onDismiss={() => setLiveToast(null)}
        onOpen={openToastNotification}
      />
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error('useNotificationCenter must be used inside NotificationCenterProvider.');
  return context;
}

export { safeNotificationUrl, mergeNotifications };
