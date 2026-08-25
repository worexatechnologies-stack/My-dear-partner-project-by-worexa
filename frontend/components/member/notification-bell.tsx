'use client';

import Link from 'next/link';
import { Bell, CheckCheck, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  notificationTime,
  notificationVisual,
  safeNotificationUrl,
  useNotificationCenter,
} from '@/components/member/notification-center';

export function NotificationBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    initialized,
    realtimeStatus,
    markAllRead,
    markRead,
  } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = 'member-notification-popover';

  useEffect(() => {
    if (!open) return;
    const closeForOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeForEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeForOutsidePointer);
    document.addEventListener('keydown', closeForEscape);
    return () => {
      document.removeEventListener('pointerdown', closeForOutsidePointer);
      document.removeEventListener('keydown', closeForEscape);
    };
  }, [open]);

  const openNotification = async (notificationId: string, linkUrl?: string) => {
    const changed = await markRead(notificationId);
    if (!changed) setError('We could not update this notification. Please try again.');
    setOpen(false);
    const destination = safeNotificationUrl(linkUrl);
    if (destination) router.push(destination);
  };

  const handleMarkAllRead = async () => {
    if (busy || unreadCount === 0) return;
    setBusy(true);
    setError('');
    const changed = await markAllRead();
    if (!changed) setError('We could not mark all notifications as read.');
    setBusy(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative rounded-xl p-2 transition-colors focus-visible:outline-2 focus-visible:outline-[#b64a68] focus-visible:outline-offset-2 ${
          open ? 'bg-[#f8e9ee] text-[#8e3d58]' : 'text-[#8a747d] hover:bg-[#f8e9ee] hover:text-[#8e3d58]'
        }`}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b64a68] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          className="fixed left-2 right-2 top-16 z-[70] mx-auto w-auto max-w-[24rem] overflow-hidden rounded-2xl border border-[#e5d5d0] bg-white/95 shadow-[0_18px_46px_rgba(69,35,47,.16)] backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
          role="dialog"
          aria-label="Recent notifications"
        >
          <header className="flex items-center justify-between border-b border-[#efe3de] px-4 py-3">
            <div>
              <h2 className="font-display text-sm font-extrabold text-[#302328]">Notifications</h2>
              {realtimeStatus === 'reconnecting' && <p className="mt-0.5 text-[10px] font-semibold text-[#9a767f]">Reconnecting...</p>}
            </div>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={busy || unreadCount === 0}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          </header>

          {error && <p className="border-b border-[#efd8db] bg-[#fff5f6] px-4 py-2 text-xs font-semibold text-[#8e3d58]">{error}</p>}

          <div className="max-h-[min(29rem,calc(100vh-10rem))] overflow-y-auto">
            {!initialized ? (
              <div className="space-y-3 p-4" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => <div key={item} className="flex animate-pulse gap-3"><span className="h-9 w-9 rounded-xl bg-[#f5ece7]" /><span className="flex-1 space-y-2 pt-1"><span className="block h-3 w-2/5 rounded bg-[#f1e7e2]" /><span className="block h-2.5 w-4/5 rounded bg-[#f7f2ee]" /></span></div>)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8e9ee] text-[#8e3d58]" aria-hidden="true"><Bell className="h-4 w-4" /></span>
                <p className="mt-3 text-sm font-bold text-[#302328]">All caught up</p>
                <p className="mt-1 text-xs leading-5 text-[#827177]">New activity will appear here automatically.</p>
              </div>
            ) : notifications.map((notification) => {
              const visual = notificationVisual(notification);
              const Icon = visual.icon;
              const isChat = notification.notification_type.toUpperCase() === 'CHAT_MESSAGE';
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification.id, notification.link_url)}
                  className={`flex w-full gap-3 border-b border-[#f2e8e3] px-4 py-3 text-left transition hover:bg-[#fffaf7] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#b64a68] ${
                    notification.is_read ? '' : 'bg-[#fffafa]'
                  }`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.iconClassName}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <strong className="line-clamp-1 flex-1 text-xs font-bold text-[#302328]">{notification.title}</strong>
                      {!notification.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b64a68]" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs leading-5 text-[#78676d]">{isChat ? 'You have a new message.' : notification.message}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-[#a08c93]">{notificationTime(notification.created_at)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <footer className="bg-[#fffdfa] px-3 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center justify-center rounded-xl text-xs font-bold text-[#8e3d58] transition hover:bg-[#f8e9ee] focus-visible:outline-2 focus-visible:outline-[#b64a68]"
            >
              View all notifications <span aria-hidden="true" className="ml-1">&rarr;</span>
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
