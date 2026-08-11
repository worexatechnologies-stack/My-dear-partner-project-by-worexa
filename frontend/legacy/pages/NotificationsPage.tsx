'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  ShieldCheck,
  Heart,
  Crown,
  HelpCircle,
  ChevronRight,
  Inbox,
  AlertCircle,
  ArrowUpRight,
  Clock3,
  SlidersHorizontal,
  Trash2
} from 'lucide-react';
import { supportService, type Notification } from '../services/supportService';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../../providers/RealtimeProvider';
import { smartDecryptText } from '../utils/crypto';

// Partner id for a CHAT_MESSAGE notification (from its /messages?user=... link).
function chatPartnerId(row: Notification): string {
  const data = (row as any).data;
  const url = row.link_url || (data && typeof data?.link_url === 'string' ? data.link_url : '');
  const m = url && /[?&]user=([^&]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : '';
}


export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const userKey = String(user?.id || user?.email || 'member');
  const [rows, setRows] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important'>('all');
  const [clearBefore, setClearBefore] = useState<number | null>(null);
  const [browserAlerts, setBrowserAlerts] = useState<NotificationPermission | 'unsupported'>('default');
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});

  const visibilityStorageKey = `my-dear-partner:notifications-cleared-before:${userKey}`;

  useEffect(() => {
    const stored = window.localStorage.getItem(visibilityStorageKey);
    const timestamp = stored ? Number(stored) : 0;
    setClearBefore(Number.isFinite(timestamp) ? timestamp : 0);
  }, [visibilityStorageKey]);

  useEffect(() => {
    setBrowserAlerts('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  const enableBrowserAlerts = async () => {
    if (!('Notification' in window)) return setBrowserAlerts('unsupported');
    setBrowserAlerts(await Notification.requestPermission());
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await supportService.getNotifications(page);
      setRows(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Decrypt CHAT_MESSAGE notification bodies (end-to-end encrypted) for display.
  useEffect(() => {
    if (!user?.id || !rows.length) return;
    const chatRows = rows.filter((r) => String(r.notification_type || '').toUpperCase() === 'CHAT_MESSAGE');
    if (!chatRows.length) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const r of chatRows) {
        const msg = String(r.message || '');
        if (msg.startsWith('__E2EE__:')) {
          try {
            map[r.id] = (await smartDecryptText(msg, String(user.id), chatPartnerId(r))) || 'New message';
          } catch {
            map[r.id] = 'New message';
          }
        }
      }
      if (!cancelled && Object.keys(map).length) setDecrypted((prev) => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [rows, user?.id]);

  // WebSocket events update the page immediately. Polling is intentionally a
  // quiet fallback for brief Wi-Fi or server reconnects.
  useEffect(() => {
    const unsubscribe = subscribe('notification.created', () => { void load(); });
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    return () => {
      unsubscribe();
      window.clearInterval(refreshTimer);
    };
  }, [load, subscribe]);

  const markRead = async (row: Notification) => {
    if (!row.is_read) {
      try {
        await supportService.markNotificationRead(row.id);
        setRows((items) =>
          items.map((item) => (item.id === row.id ? { ...item, is_read: true } : item))
        );
        // Let the member sidebar bell/nav badge refresh its unread count immediately.
        window.dispatchEvent(new Event('notifications:read-changed'));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    if (row.link_url) {
      router.push(row.link_url);
    }
  };

  const markAll = async () => {
    try {
      await supportService.markAllNotificationsRead();
      setRows((items) => items.map((item) => ({ ...item, is_read: true })));
      // Let the member sidebar bell/nav badge refresh its unread count immediately.
      window.dispatchEvent(new Event('notifications:read-changed'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const clearAll = () => {
    const timestamp = Date.now();
    window.localStorage.setItem(visibilityStorageKey, String(timestamp));
    setClearBefore(timestamp);
  };

  // Helper to resolve icon configuration based on notification properties
  const getNotificationConfig = (type: string, title: string) => {
    const t = (type || '').toLowerCase();
    const text = (title || '').toLowerCase();

    if (
      t.includes('security') ||
      t.includes('auth') ||
      text.includes('security') ||
      text.includes('password') ||
      text.includes('verify') ||
      text.includes('verification')
    ) {
      return {
        icon: ShieldCheck,
        iconBg: 'bg-rose-100 text-rose-700',
        accentBorder: 'border-l-blue-500',
      };
    }
    if (
      t.includes('match') ||
      t.includes('interest') ||
      text.includes('match') ||
      text.includes('like') ||
      text.includes('partner') ||
      text.includes('request') ||
      text.includes('shortlist')
    ) {
      return {
        icon: Heart,
        iconBg: 'bg-rose-100 text-rose-700',
        accentBorder: 'border-l-rose-500',
      };
    }
    if (
      t.includes('membership') ||
      t.includes('payment') ||
      t.includes('billing') ||
      text.includes('premium') ||
      text.includes('membership') ||
      text.includes('payment') ||
      text.includes('subscribe') ||
      text.includes('invoice')
    ) {
      return {
        icon: Crown,
        iconBg: 'bg-amber-100 text-amber-700',
        accentBorder: 'border-l-amber-500',
      };
    }
    if (
      t.includes('support') ||
      t.includes('ticket') ||
      t.includes('help') ||
      text.includes('support') ||
      text.includes('ticket') ||
      text.includes('reply')
    ) {
      return {
        icon: HelpCircle,
        iconBg: 'bg-purple-100 text-purple-700',
        accentBorder: 'border-l-purple-500',
      };
    }

    return {
      icon: Bell,
      iconBg: 'bg-gray-100 text-gray-700',
      accentBorder: 'border-l-rose-500',
    };
  };

  // Filter notifications locally based on active tab
  const visibleRows = clearBefore === null
    ? []
    : rows.filter((row) => new Date(row.created_at).getTime() > clearBefore);
  const filteredRows = visibleRows.filter((row) => {
    if (activeTab === 'unread') return !row.is_read;
    if (activeTab === 'important') return row.priority === 'HIGH';
    return true;
  });

  const unreadCount = visibleRows.filter((row) => !row.is_read).length;
  const importantCount = visibleRows.filter((row) => row.priority === 'HIGH').length;
  const displayCount = clearBefore ? visibleRows.length : count;

  return (
    <main className="min-h-screen bg-[#f8f5f2] pt-24 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Block */}
        <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2b101d] via-[#743047] to-[#8e3d58] p-6 text-white shadow-[0_20px_55px_rgba(43,16,29,0.15)] md:p-8">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#f1d18f]/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                <Bell className="h-5 w-5 text-[#f1d18f]" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f1d18f]">Your activity centre</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Notifications</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">Stay close to new connections, account updates, and moments that need your attention.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><p className="text-2xl font-extrabold">{displayCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Total</p></div>
              <div className="rounded-2xl border border-[#f1d18f]/25 bg-[#f1d18f]/10 p-4 backdrop-blur-sm"><p className="text-2xl font-extrabold text-[#f5dca8]">{unreadCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Unread</p></div>
              <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:block"><p className="text-2xl font-extrabold">{importantCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Important</p></div>
            </div>
          </div>
          <div className="relative mt-7 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void enableBrowserAlerts()}
              disabled={browserAlerts === 'granted' || browserAlerts === 'unsupported'}
              title={browserAlerts === 'denied' ? 'Notifications are blocked. Enable them in your browser site settings.' : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-default disabled:opacity-70"
            >
              <Bell className="h-3.5 w-3.5" /> {browserAlerts === 'granted' ? 'Push alerts enabled' : browserAlerts === 'denied' ? 'Push alerts blocked' : browserAlerts === 'unsupported' ? 'Push alerts unavailable' : 'Enable push alerts'}
            </button>
            <button
              type="button"
              onClick={markAll}
              disabled={loading || unreadCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f1d18f] px-4 py-2.5 text-xs font-bold text-[#2b101d] shadow-sm transition hover:bg-[#f7dfaa] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={loading || clearBefore === null || visibleRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eadfd8] bg-white p-2 shadow-[0_8px_24px_rgba(43,16,29,0.04)]">
          <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#f8edf0] text-[#743047]'
                : 'text-[#77656d] hover:bg-[#f8f5f2] hover:text-[#24151c]'
            }`}
          >
            All
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === 'all' ? 'bg-white text-[#743047]' : 'bg-[#f8f5f2] text-[#77656d]'}`}>
              {displayCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'unread'
                ? 'bg-[#f8edf0] text-[#743047]'
                : 'text-[#77656d] hover:bg-[#f8f5f2] hover:text-[#24151c]'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === 'unread' ? 'bg-white text-[#743047]' : 'bg-[#f8f5f2] text-[#77656d]'}`}>
              {unreadCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('important')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'important'
                ? 'bg-[#f8edf0] text-[#743047]'
                : 'text-[#77656d] hover:bg-[#f8f5f2] hover:text-[#24151c]'
            }`}
          >
            Important
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === 'important' ? 'bg-white text-[#743047]' : 'bg-[#f8f5f2] text-[#77656d]'}`}>
              {importantCount}
            </span>
          </button>
          </div>
          <div className="hidden items-center gap-2 px-3 text-xs font-semibold text-[#a29198] sm:flex"><SlidersHorizontal className="h-3.5 w-3.5" /> Curated for you</div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#edcbd4] bg-[#fff4f5] p-4 text-[#743047]">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#8e3d58]" />
            <div>
              <p className="text-sm font-bold">Loading error</p>
              <p className="mt-0.5 text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {(loading && !rows.length) || clearBefore === null ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex gap-4 rounded-2xl border border-[#eadfd8] bg-white p-5 animate-pulse"
              >
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-[#f0e6df]" />
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-4 w-1/4 rounded bg-[#f0e6df]" />
                  <div className="h-3 w-3/4 rounded bg-[#f8f5f2]" />
                  <div className="mt-2 h-2.5 w-16 rounded bg-[#f8f5f2]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Notifications Feed List */
          <div className="space-y-4">
            {filteredRows.map((row) => {
              const config = getNotificationConfig(row.notification_type, row.title);
              const IconComp = config.icon;

              return (
                <div
                  key={row.id}
                  onClick={() => markRead(row)}
                  className={`group relative text-left rounded-2xl border p-5 flex gap-4 transition-all duration-300 cursor-pointer overflow-hidden ${
                    row.is_read
                    ? 'bg-white border-[#eadfd8] hover:border-[#d7c5be] hover:shadow-[0_12px_30px_rgba(43,16,29,0.07)]'
                      : `bg-[#fffdfa] border-[#eadfd8] border-l-4 ${config.accentBorder} hover:shadow-[0_12px_30px_rgba(43,16,29,0.07)]`
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!row.is_read && (
                    <span className="absolute top-5 right-5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}

                  {/* Icon Area */}
                  <div
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${config.iconBg}`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 min-w-0 pr-4">
                    <strong className="block text-sm font-bold text-[#24151c] group-hover:text-[#743047] transition-colors">
                      {row.title}
                    </strong>
                    <p className="mt-1 text-sm leading-relaxed text-[#77656d] break-words">
                      {decrypted[row.id] || row.message}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#a29198]">
                      <Clock3 className="h-3 w-3" />
                      {new Date(row.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Arrow Indicator if has link */}
                  {row.link_url && (
                    <div className="flex items-center shrink-0">
                      <ArrowUpRight className="h-4 w-4 text-[#c4b2b5] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#8e3d58]" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty State */}
            {filteredRows.length === 0 && (
              <div className="rounded-[1.75rem] border border-[#eadfd8] bg-white p-10 text-center shadow-[0_10px_30px_rgba(43,16,29,0.05)]">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f8edf0] text-[#8e3d58]">
                  <Inbox className="w-8 h-8" />
                </div>
                <h3 className="mb-1 text-lg font-extrabold text-[#24151c]">
                  {clearBefore ? 'Notifications cleared' : activeTab === 'unread' ? 'No unread notifications' : 'All caught up!'}
                </h3>
                <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-[#77656d]">
                  {clearBefore
                    ? 'New notifications will appear here as they arrive.'
                    : activeTab === 'unread'
                    ? "You don't have any unread notifications at the moment."
                    : "You don't have any notifications under this filter."}
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#743047] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(116,48,71,0.2)] transition-all hover:bg-[#541e37] active:scale-95"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagination Block */}
        {count > 15 && (
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-[#eadfd8] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(43,16,29,0.04)]">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#dfd2cb] bg-white px-4 py-2 text-xs font-bold text-[#58444d] transition-all hover:bg-[#f8f5f2] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-bold tracking-wider text-[#77656d]">
              Page {page} of {Math.ceil(count / 15)}
            </span>
            <button
              type="button"
              disabled={page * 15 >= count}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#dfd2cb] bg-white px-4 py-2 text-xs font-bold text-[#58444d] transition-all hover:bg-[#f8f5f2] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
