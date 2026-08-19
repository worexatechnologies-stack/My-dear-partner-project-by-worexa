'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import {
  mergeNotifications,
  notificationTime,
  notificationVisual,
  safeNotificationUrl,
  useNotificationCenter,
} from '@/components/member/notification-center';
import {
  supportService,
  type Notification as MemberNotification,
  type NotificationFilter,
} from '../services/supportService';

type NotificationGroup = {
  label: string;
  rows: MemberNotification[];
};

function isImportant(notification: MemberNotification) {
  const priority = notification.priority.toUpperCase();
  return priority === 'HIGH' || priority === 'URGENT';
}

function matchesFilter(notification: MemberNotification, filter: NotificationFilter) {
  if (filter === 'unread') return !notification.is_read;
  if (filter === 'important') return isImportant(notification);
  return true;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((startOfToday - startOfDate) / 86400000);

  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function groupNotifications(rows: MemberNotification[]): NotificationGroup[] {
  const groups = new Map<string, MemberNotification[]>();
  for (const row of rows) {
    const label = dateLabel(row.created_at);
    groups.set(label, [...(groups.get(label) || []), row]);
  }
  return Array.from(groups, ([label, groupedRows]) => ({ label, rows: groupedRows }));
}

function visibleMessage(notification: MemberNotification) {
  // Notification previews must never render an encrypted chat payload or expose
  // message contents outside the private conversation screen.
  if (notification.notification_type.toUpperCase() === 'CHAT_MESSAGE') return 'You have a new message.';
  return notification.message;
}

function pushButtonLabel(status: ReturnType<typeof useNotificationCenter>['pushStatus']) {
  if (status === 'enabled') return 'Browser alerts on';
  if (status === 'granted') return 'Finish enabling alerts';
  if (status === 'denied') return 'Browser alerts blocked';
  if (status === 'unsupported') return 'Browser alerts unavailable';
  if (status === 'unavailable') return 'Browser alerts unavailable';
  if (status === 'checking') return 'Checking browser alerts';
  return 'Enable browser alerts';
}

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications: recentNotifications,
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
  } = useNotificationCenter();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [rows, setRows] = useState<MemberNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestVersionRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError('');
    try {
      const feed = await supportService.getNotifications({ filter, limit: 20 });
      if (requestVersion !== requestVersionRef.current) return;
      setRows(feed.results);
      setNextCursor(feed.next_cursor);
      setHasMore(Boolean(feed.next_cursor || feed.has_more));
      setLoadMoreError(false);
    } catch {
      if (requestVersion !== requestVersionRef.current) return;
      setError('Notifications could not be loaded. Please check your connection and try again.');
      setRows([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return;
    const requestVersion = requestVersionRef.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const feed = await supportService.getNotifications({ cursor: nextCursor, filter, limit: 20 });
      if (requestVersion !== requestVersionRef.current) return;
      setRows((current) => mergeNotifications(current, feed.results));
      setNextCursor(feed.next_cursor);
      setHasMore(Boolean(feed.next_cursor || feed.has_more));
    } catch {
      if (requestVersion === requestVersionRef.current) {
        setError('Older notifications could not be loaded. Please try again.');
        setLoadMoreError(true);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) setLoadingMore(false);
    }
  }, [filter, loading, loadingMore, nextCursor]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    if (!initialized || recentNotifications.length === 0) return;
    const matchingRows = recentNotifications.filter((row) => matchesFilter(row, filter));
    if (matchingRows.length) setRows((current) => mergeNotifications(current, matchingRows));
  }, [filter, initialized, recentNotifications]);

  useEffect(() => {
    if (!lastChange) return;
    if (lastChange.type === 'cleared') {
      requestVersionRef.current += 1;
      setRows([]);
      setNextCursor(null);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (lastChange.type === 'marked-all-read') {
      setRows((current) => (
        filter === 'unread' ? [] : current.map((row) => ({ ...row, is_read: true }))
      ));
      if (filter === 'unread') {
        setNextCursor(null);
        setHasMore(false);
      }
      return;
    }
    if (lastChange.type === 'read' && lastChange.notificationId) {
      setRows((current) => current
        .map((row) => (
          row.id === lastChange.notificationId ? { ...row, is_read: true } : row
        ))
        .filter((row) => filter !== 'unread' || !row.is_read));
    }
  }, [filter, lastChange]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loadMoreError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: '260px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadMoreError]);

  const handleOpen = async (notification: MemberNotification) => {
    setError('');
    if (!notification.is_read) {
      const changed = await markRead(notification.id);
      if (!changed) {
        setError('We could not update this notification. Please try again.');
        return;
      }
      setRows((current) => current
        .map((row) => (row.id === notification.id ? { ...row, is_read: true } : row))
        .filter((row) => filter !== 'unread' || !row.is_read));
    }
    const destination = safeNotificationUrl(notification.link_url);
    if (destination) router.push(destination);
  };

  const handleMarkAllRead = async () => {
    if (actionBusy || unreadCount === 0) return;
    setActionBusy(true);
    setError('');
    const changed = await markAllRead();
    if (!changed) {
      setError('We could not mark all notifications as read. Please try again.');
      await loadFirstPage();
    }
    setActionBusy(false);
  };

  const handleClearAll = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setError('');
    const cleared = await clearAll();
    setActionBusy(false);
    setClearDialogOpen(false);
    if (!cleared) {
      setError('We could not clear notifications. Please try again.');
      await loadFirstPage();
    }
  };

  const handleRefresh = async () => {
    await Promise.allSettled([loadFirstPage(), refresh()]);
  };

  const handleEnablePush = async () => {
    setError('');
    const result = await enableBrowserPush();
    if (result === 'denied') setError('Browser alerts are blocked. You can enable them later in your browser site settings.');
  };

  const canEnablePush = pushStatus === 'default' || pushStatus === 'granted';
  const notificationGroups = groupNotifications(rows);

  return (
    <main className="min-h-full bg-[#fbf7f4] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[#eadfd9] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#aa687d]">Member portal</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#302328]">Notifications</h1>
            <p className="mt-1 text-sm text-[#78676d]">Connection updates, account activity, and messages in one private place.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {realtimeStatus !== 'connected' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ead9d4] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#8a737a]">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                {realtimeStatus === 'reconnecting' ? 'Reconnecting' : 'Syncing'}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e3d4cd] bg-white px-3 text-xs font-bold text-[#6d545d] transition hover:border-[#d4b8c0] hover:bg-[#fffaf8] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#eadfd9] bg-white/90 p-2.5 shadow-[0_8px_26px_rgba(69,35,47,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center gap-1 rounded-xl bg-[#f9f3f0] p-1" role="tablist" aria-label="Notification filters">
            {(['all', 'unread', 'important'] as NotificationFilter[]).map((item) => {
              const active = filter === item;
              const label = item === 'all' ? 'All' : item === 'unread' ? 'Unread' : 'Important';
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item)}
                  className={`min-h-8 rounded-lg px-3 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-[#b64a68] ${
                    active ? 'bg-white text-[#8e3d58] shadow-sm' : 'text-[#88747b] hover:text-[#5f454e]'
                  }`}
                >
                  {label}
                  {item === 'unread' && unreadCount > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#f8e9ee]' : 'bg-white'}`}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => void handleEnablePush()}
              disabled={!canEnablePush}
              title={pushStatus === 'denied' ? 'Enable alerts from your browser site settings.' : undefined}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              {pushStatus === 'checking' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              {pushButtonLabel(pushStatus)}
            </button>
            <span className="h-4 w-px bg-[#eadfd9]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={actionBusy || unreadCount === 0}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              {actionBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => setClearDialogOpen(true)}
              disabled={actionBusy || (rows.length === 0 && !loading)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {(error || pushError) && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[#ecd5d8] bg-[#fff7f7] px-4 py-3 text-sm text-[#7f4355]" role="alert">
            <p>{error || pushError}</p>
            {error && (
              <button type="button" onClick={() => void handleRefresh()} className="shrink-0 text-xs font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#b64a68]">Try again</button>
            )}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfd9] bg-white shadow-[0_10px_30px_rgba(69,35,47,0.05)]">
          {loading && rows.length === 0 ? (
            <div className="divide-y divide-[#f1e7e2]" aria-label="Loading notifications">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse items-start gap-3 px-4 py-4 sm:px-5">
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-[#f4e8e4]" />
                  <span className="min-w-0 flex-1 space-y-2 pt-1"><span className="block h-3 w-2/5 rounded bg-[#f1e6e1]" /><span className="block h-2.5 w-4/5 rounded bg-[#f8f3f0]" /></span>
                </div>
              ))}
            </div>
          ) : notificationGroups.length === 0 ? (
            <div className="px-5 py-14 text-center sm:py-16">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8e9ee] text-[#8e3d58]">
                {filter === 'all' ? <Inbox className="h-6 w-6" aria-hidden="true" /> : <BellRing className="h-6 w-6" aria-hidden="true" />}
              </span>
              <h2 className="mt-4 font-display text-lg font-extrabold text-[#302328]">
                {filter === 'unread' ? 'No unread notifications' : filter === 'important' ? 'No important notifications' : 'Notifications cleared'}
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#78676d]">
                {filter === 'all'
                  ? 'New connection and account updates will appear here as they arrive.'
                  : 'There is nothing under this filter right now.'}
              </p>
              {filter !== 'all' && (
                <button type="button" onClick={() => setFilter('all')} className="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] focus-visible:outline-2 focus-visible:outline-[#b64a68]">
                  View all notifications
                </button>
              )}
            </div>
          ) : (
            <div>
              {notificationGroups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="border-b border-[#f1e7e2] bg-[#fffdfa] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9b858b] sm:px-5">{group.label}</h2>
                  <div className="divide-y divide-[#f1e7e2]">
                    {group.rows.map((notification) => {
                      const visual = notificationVisual(notification);
                      const Icon = visual.icon;
                      const hasDestination = Boolean(safeNotificationUrl(notification.link_url));
                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => void handleOpen(notification)}
                          className={`group flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[#fffaf8] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#b64a68] sm:px-5 ${
                            notification.is_read ? '' : 'bg-[#fffafa]'
                          }`}
                          aria-label={`${notification.title}${notification.is_read ? '' : ', unread'}`}
                        >
                          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.iconClassName}`}>
                            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <strong className="line-clamp-1 flex-1 text-sm font-bold text-[#302328] group-hover:text-[#8e3d58]">{notification.title}</strong>
                              {!notification.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b64a68]" aria-label="Unread" />}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-[#78676d]">{visibleMessage(notification)}</span>
                            <span className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[#a08c93]">
                              {notificationTime(notification.created_at)}
                              {isImportant(notification) && <span className="rounded-full bg-[#f8e9ee] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#8e3d58]">Important</span>}
                            </span>
                          </span>
                          {hasDestination && <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-[#b5a1a7] transition group-hover:translate-x-0.5 group-hover:text-[#8e3d58]" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div ref={sentinelRef} aria-hidden="true" />
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e3d4cd] bg-white px-4 text-xs font-bold text-[#765c65] transition hover:bg-[#fffaf8] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              {loadingMore ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {loadingMore ? 'Loading older notifications' : loadMoreError ? 'Retry loading older notifications' : 'Load older notifications'}
            </button>
          </div>
        )}
      </section>

      <Modal open={clearDialogOpen} onClose={() => !actionBusy && setClearDialogOpen(false)} title="Clear notifications" size="sm">
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8e9ee] text-[#8e3d58]"><Trash2 className="h-4 w-4" /></span>
            <p className="text-sm leading-6 text-[#78676d]">This removes every notification from your inbox on all of your signed-in devices. It does not affect your matches, messages, or account activity.</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setClearDialogOpen(false)} disabled={actionBusy} className="min-h-10 rounded-xl border border-[#e3d4cd] px-4 text-xs font-bold text-[#6d545d] transition hover:bg-[#fffaf8] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#b64a68]">Cancel</button>
            <button type="button" onClick={() => void handleClearAll()} disabled={actionBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#8e3d58] px-4 text-xs font-bold text-white transition hover:bg-[#743047] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#b64a68]">
              {actionBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Clear notifications
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
