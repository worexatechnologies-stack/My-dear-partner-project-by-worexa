'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Search, Heart, Bookmark, Eye,
  MessageSquareMore, Bell, ShieldCheck, CreditCard,
  Settings, LogOut, Menu, X, User,
  LifeBuoy, PanelLeftClose, PanelLeftOpen, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import { useRealtime } from '@/providers/RealtimeProvider';
import ProfileImage from '@/components/profile/ProfileImage';
import MobileBottomNav from './mobile-bottom-nav';

/* ─── Nav definitions ─── */

const mainNav = [
  { label: 'Discover',     icon: LayoutDashboard,  href: '/dashboard' },
  { label: 'Find Matches', icon: Search,            href: '/search' },
  { label: 'Messages',     icon: MessageSquareMore, href: '/messages' },
  { label: 'Likes',        icon: Heart,             href: '/interests/received' },
  { label: 'My Profile',   icon: User,              href: '/profile/me' },
];

const accountNav = [
  { label: 'Shortlist',    icon: Bookmark,          href: '/shortlist' },
  { label: 'Visitors',     icon: Eye,               href: '/visitors' },
  { label: 'Membership',   icon: CreditCard,        href: '/membership' },
  { label: 'Settings',     icon: Settings,          href: '/settings' },
  { label: 'Help & Support', icon: LifeBuoy,        href: '/support' },
];

/* ─── NavLink ─── */

function NavLink({
  item, isActive, badge, collapsed,
}: {
  item: { label: string; icon: React.ElementType; href: string };
  isActive: boolean;
  badge?: number;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 group ${
        collapsed ? 'justify-center px-2' : ''
      } ${
        isActive
          ? 'bg-[#f8e9ee] text-[#8e3d58]'
          : 'text-[#776a6f] hover:bg-[#fffefd] hover:text-[#8e3d58]'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-[#b64a68]' : 'group-hover:text-[#8e3d58]'}`} />

      {!collapsed && <span className="truncate">{item.label}</span>}

      {(badge ?? 0) > 0 && (
        <span className={`${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'} flex items-center justify-center rounded-full bg-[#b64a68] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white min-w-[1.1rem]`}>
          {(badge ?? 0) > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </Link>
  );
}

/* ─── Main component ─── */

export function MemberSidebar({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen]   = useState(false);
  const [collapsed,  setCollapsed]    = useState(false);
  const [portalSearch, setPortalSearch] = useState('');

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* ─── Unread notification count ─── */
  const { subscribe } = useRealtime();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchApi<{ unread_count: number }>('/notifications/unread-count/');
      setUnreadCount(Math.max(0, Number(res.unread_count) || 0));
    } catch { /* keep last count */ }
  }, []);

  useEffect(() => {
    const onReadChanged = () => void refreshUnread();
    window.addEventListener('notifications:read-changed', onReadChanged);
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 30_000);
    const unsub  = subscribe('notification.created', () => void refreshUnread());
    return () => { window.clearInterval(timer); unsub(); window.removeEventListener('notifications:read-changed', onReadChanged); };
  }, [refreshUnread, subscribe]);

  useEffect(() => { void refreshUnread(); }, [pathname, refreshUnread]);

  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Member';
  const sidebarWidth = collapsed ? 'lg:w-[4.5rem]' : 'lg:w-56';
  const mainPad      = collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-56';
  const currentPage = [
    ...mainNav,
    ...accountNav,
    { label: 'My Profile', href: '/profile' },
    { label: 'Matches', href: '/compare' },
    { label: 'Verification', href: '/verification' },
  ]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label || 'Member portal';

  /* ─── Sidebar panel (shared between desktop + mobile) ─── */

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">

      {/* ── Logo row ── */}
      <div className={`flex h-16 shrink-0 items-center border-b border-[#eaded8] ${collapsed && !isMobile ? 'justify-center px-3' : 'justify-between px-4'}`}>
        {(!collapsed || isMobile) && (
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="My Dear Partner">
            <img src="/images/main-logo.png" alt="My Dear Partner" className="w-8 h-8 object-contain shrink-0" />
            <span className="truncate font-display text-sm font-extrabold tracking-tight text-[#2c2928]">
              My Dear <em className="not-italic text-[#b64a68]">Partner</em>
            </span>
          </Link>
        )}
        {collapsed && !isMobile && (
          <Link href="/dashboard" aria-label="Home">
            <img src="/images/main-logo.png" alt="My Dear Partner" className="w-8 h-8 object-contain" />
          </Link>
        )}

        {/* Close on mobile, collapse on desktop */}
        {isMobile ? (
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#8a747d] hover:bg-[#f8e9ee] hover:text-[#8e3d58]" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(v => !v)}
            className="hidden rounded-xl p-2 text-[#a08c93] transition-colors hover:bg-[#f8e9ee] hover:text-[#8e3d58] lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto py-4 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`} aria-label="Member navigation">

        {/* Main group */}
        {(!collapsed || isMobile) && (
          <p className="mdp-sidebar-nav-group-label">Main</p>
        )}
        <div className="space-y-0.5 mb-2">
          {mainNav.map((item) => {
            const isActive = item.href === '/interests/received'
              ? pathname.startsWith('/interests')
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badge = item.href === '/notifications' ? unreadCount : 0;
            return (
              <NavLink
                key={item.label}
                item={item}
                isActive={isActive}
                badge={badge}
                collapsed={collapsed && !isMobile}
              />
            );
          })}
        </div>

        {/* Divider */}
        {(!collapsed || isMobile) && <div className="mdp-nav-divider" />}
        {collapsed && !isMobile && <div className="my-2 mx-auto w-6 h-px bg-slate-200" />}

        {/* Account group */}
        {(!collapsed || isMobile) && (
          <p className="mdp-sidebar-nav-group-label">Account</p>
        )}
        <div className="space-y-0.5">
          {accountNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavLink
                key={item.label}
                item={item}
                isActive={isActive}
                collapsed={collapsed && !isMobile}
              />
            );
          })}
        </div>
      </nav>

      {/* ── Footer: Sign Out ── */}
      <div className={`shrink-0 space-y-1 border-t border-[#eaded8] p-3 ${collapsed && !isMobile ? 'px-2' : ''}`}>
        <button
          type="button"
          onClick={async () => { await logout(); window.location.assign('/login'); }}
          title={collapsed && !isMobile ? 'Sign Out' : undefined}
          className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#776a6f] transition-all duration-200 hover:bg-red-50/70 hover:text-red-600 ${
            collapsed && !isMobile ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
          {collapsed && !isMobile && (
            <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Sign Out
            </span>
          )}
        </button>
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-[#aa959d]">
            <ShieldCheck className="w-3 h-3" />
            <span>Secure session</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="member-portal h-[100dvh] w-full overflow-hidden bg-[#faf8f6]">

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#20111a]/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden flex-col overflow-visible transition-[width] duration-300 ease-in-out lg:flex ${sidebarWidth}`}
        style={{ background: '#fffaf7', borderRight: '1px solid #eaded8' }}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(16rem,86vw)] flex-col lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#fffaf7', borderRight: '1px solid #eaded8', boxShadow: '12px 0 36px rgba(43,16,29,.12)' }}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* ── Main area ── */}
      <div className={`${mainPad} flex h-full min-h-0 min-w-0 flex-col transition-[padding] duration-300 ease-in-out`}>

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#eaded8] px-3 pt-[env(safe-area-inset-top)] sm:px-4 lg:px-5"
          style={{
            background: 'rgba(255,254,253,0.96)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Left: compact mobile brand / desktop page context */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:w-36 lg:shrink-0">
            <button
              type="button"
              className="rounded-xl p-2 text-[#8a747d] transition-colors hover:bg-[#f8e9ee] hover:text-[#8e3d58] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            {pathname === '/dashboard' ? (
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label="My Dear Partner home">
                <img src="/images/main-logo.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
                <span className="truncate font-display text-sm font-extrabold text-[#2c2928]">My Dear <em className="not-italic text-[#b64a68]">Partner</em></span>
              </Link>
            ) : (
              <div className="min-w-0 lg:hidden">
                <p className="truncate font-display text-sm font-extrabold text-[#2c2928]">{currentPage}</p>
              </div>
            )}
            <div className="hidden min-w-0 lg:block">
              <p className="hidden text-[9px] font-bold uppercase tracking-[.2em] text-[#b66068] sm:block">Member portal</p>
              <p className="truncate font-display text-sm font-extrabold text-[#2c2928]">{currentPage}</p>
            </div>
          </div>

          <div className="mx-5 hidden min-w-0 max-w-2xl flex-1 items-center gap-2 lg:flex">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const value = portalSearch.trim();
                router.push(value ? `/search?q=${encodeURIComponent(value)}` : '/search');
              }}
              className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#dfd3ce] bg-white px-3.5 shadow-[0_4px_15px_rgba(64,36,47,.04)] focus-within:border-[#b98291]"
            >
              <Search className="h-4 w-4 shrink-0 text-[#8c7a80]" />
              <input
                value={portalSearch}
                onChange={(event) => setPortalSearch(event.target.value)}
                placeholder="Search members"
                aria-label="Search members"
                className="min-w-0 flex-1 border-0 bg-transparent text-xs text-[#342c2f] outline-none placeholder:text-[#a99a9f]"
              />
            </form>
            <Link href="/settings/profile/preferences" aria-label="Match filters" title="Match filters" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2dde4] text-[#8e3d58] transition hover:bg-[#8e3d58] hover:text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </Link>
          </div>

          {/* Right: notifications bell + account button */}
          <div className="flex shrink-0 items-center gap-2">

            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative rounded-xl p-2 text-[#8a747d] transition-colors hover:bg-[#f8e9ee] hover:text-[#8e3d58]"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b64a68] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Account button — links directly to /profile/me (no dropdown needed — profile is in sidebar) */}
            <Link
              href="/profile/me"
              className="flex items-center rounded-full border border-[#eaded8] bg-white p-1 transition-colors hover:border-[#dcaebb] hover:bg-[#fffaf7]"
              aria-label="Open my profile"
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#f8e9ee]">
                <ProfileImage
                  photoId={undefined}
                  src={user?.photo}
                  variant="thumbnail"
                  alt={displayName}
                  size="sm"
                  aspectRatio="4:5"
                  shape="rounded"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="member-page-content site-page-enter min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav (hidden lg+) */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
