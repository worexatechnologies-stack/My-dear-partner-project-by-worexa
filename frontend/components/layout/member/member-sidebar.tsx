'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass, Search, Heart, Bookmark, Eye,
  MessageCircle, ShieldCheck, CreditCard,
  Settings, LogOut, Menu, X, User,
  LifeBuoy, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import ProfileImage from '@/components/profile/ProfileImage';
import SiteLogo from '@/components/branding/site-logo';
import { NotificationBell } from '@/components/member/notification-bell';
import MobileBottomNav from './mobile-bottom-nav';

/* ─── Nav definitions ─── */

const mainNav = [
  { label: 'Discover',     icon: Compass,        href: '/dashboard' },
  { label: 'Find Matches', icon: Search,          href: '/search' },
  { label: 'Messages',     icon: MessageCircle,   href: '/messages' },
  { label: 'Likes',        icon: Heart,           href: '/interests/received' },
  { label: 'My Profile',   icon: User,            href: '/profile/me' },
];

const accountNav = [
  { label: 'Shortlist',      icon: Bookmark,   href: '/shortlist' },
  { label: 'Visitors',       icon: Eye,         href: '/visitors' },
  { label: 'Blocked',        icon: ShieldCheck, href: '/blocked' },
  { label: 'Membership',     icon: CreditCard,  href: '/membership' },
  { label: 'Settings',       icon: Settings,    href: '/settings' },
  { label: 'Help & Support', icon: LifeBuoy,    href: '/support' },
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
      className="group relative"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.625rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0.5rem' : '0.5rem 0.625rem',
        borderRadius: '0.75rem',
        fontSize: '0.8125rem',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'all 0.18s ease',
        position: 'relative',
        background: isActive ? 'linear-gradient(135deg,#fdf3f6 0%,#f9e4eb 100%)' : 'transparent',
        color: isActive ? '#8e3d58' : '#776a6f',
        boxShadow: isActive ? 'inset 0 0 0 1px rgba(182,74,104,0.16), 0 2px 8px rgba(142,61,88,0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = '#faf4f1';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '22%',
            bottom: '22%',
            width: '3.5px',
            borderRadius: '0 4px 4px 0',
            background: 'linear-gradient(180deg,#e11d48 0%,#8e3d58 100%)',
            boxShadow: '0 0 8px rgba(225,29,72,0.35)',
          }}
        />
      )}

      <Icon
        style={{
          width: '1.125rem',
          height: '1.125rem',
          flexShrink: 0,
          color: isActive ? '#8e3d58' : '#9a8990',
          strokeWidth: isActive ? 2.5 : 1.75,
          filter: isActive ? 'drop-shadow(0 1px 2px rgba(142,61,88,0.25))' : 'none',
        }}
      />

      {!collapsed && (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
      )}

      {/* Badge */}
      {(badge ?? 0) > 0 && (
        <span
          style={{
            ...(collapsed
              ? { position: 'absolute', top: '-0.125rem', right: '-0.125rem' }
              : { marginLeft: 'auto' }),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '1.125rem',
            height: '1.125rem',
            padding: '0 0.25rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg,#e11d48 0%,#b64a68 100%)',
            boxShadow: '0 2px 6px rgba(225,29,72,0.30)',
            color: 'white',
            fontSize: '0.5625rem',
            fontWeight: 700,
          }}
        >
          {(badge ?? 0) > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span
          className="pointer-events-none"
          style={{
            position: 'absolute',
            left: 'calc(100% + 0.75rem)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50,
            whiteSpace: 'nowrap',
            borderRadius: '0.5rem',
            background: '#2c2928',
            padding: '0.375rem 0.625rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'white',
            opacity: 0,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
          }}
          role="tooltip"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

/* ─── Section label ─── */

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        style={{
          margin: '0.5rem 0',
          height: '1px',
          background: '#E4E7EC',
          borderRadius: '1px',
        }}
      />
    );
  }
  return (
    <p
      style={{
        fontSize: '0.5625rem',
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#c0a8b0',
        padding: '0.75rem 0.625rem 0.25rem',
      }}
    >
      {label}
    </p>
  );
}

/* ─── Main component ─── */

export function MemberSidebar({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Member';

  const currentPage = [
    ...mainNav,
    ...accountNav,
    { label: 'Notifications', href: '/notifications' },
    { label: 'My Profile', href: '/profile' },
    { label: 'Matches', href: '/compare' },
    { label: 'Verification', href: '/verification' },
  ]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label || 'Member portal';

  /* ─── Sidebar panel content ─── */

  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Logo row */}
        <div
          style={{
            height: '3.75rem',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0 0.75rem' : '0 0.75rem 0 1rem',
            borderBottom: '1px solid #f0e7ea',
          }}
        >
          {(!isCollapsed) && (
            <Link
              href="/dashboard"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, textDecoration: 'none' }}
              aria-label="My Dear Partner"
            >
              <SiteLogo alt="My Dear Partner" className="w-7 h-7 object-contain shrink-0" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 800, color: '#2c2928', whiteSpace: 'nowrap' }}>
                My Dear <em style={{ fontStyle: 'normal', background: 'linear-gradient(135deg,#b64a68,#8e3d58)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Partner</em>
              </span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" aria-label="Home">
              <SiteLogo alt="My Dear Partner" className="w-7 h-7 object-contain" />
            </Link>
          )}

          {/* Collapse toggle / mobile close */}
          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#8a747d',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              aria-label="Close menu"
            >
              <X style={{ width: '1.125rem', height: '1.125rem' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#a08c93',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed
                ? <PanelLeftOpen style={{ width: '1rem', height: '1rem' }} />
                : <PanelLeftClose style={{ width: '1rem', height: '1rem' }} />
              }
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isCollapsed ? '0.5rem 0.5rem' : '0.5rem 0.625rem',
            scrollbarWidth: 'thin',
            scrollbarColor: '#d9c9c3 transparent',
          }}
          aria-label="Member navigation"
        >
          <SectionLabel label="Main" collapsed={isCollapsed} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', marginBottom: '0.25rem' }}>
            {mainNav.map((item) => {
              const active =
                item.href === '/interests/received'
                  ? pathname.startsWith('/interests')
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavLink
                  key={item.label}
                  item={item}
                  isActive={active}
                  collapsed={isCollapsed}
                />
              );
            })}
          </div>

          <SectionLabel label="Account" collapsed={isCollapsed} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            {accountNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavLink
                  key={item.label}
                  item={item}
                  isActive={active}
                  collapsed={isCollapsed}
                />
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid #f0e7ea',
            padding: isCollapsed ? '0.5rem' : '0.5rem 0.625rem',
          }}
        >
          <button
            type="button"
            onClick={async () => { await logout(); window.location.assign('/login'); }}
            title={isCollapsed ? 'Sign Out' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? 0 : '0.625rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%',
              padding: isCollapsed ? '0.5rem' : '0.5rem 0.625rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#776a6f',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0';
              (e.currentTarget as HTMLButtonElement).style.color = '#d73b3b';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#776a6f';
            }}
          >
            <LogOut style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, strokeWidth: 1.75 }} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>

          {!isCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.625rem',
                fontSize: '0.5625rem',
                color: '#b0a1a7',
              }}
            >
              <ShieldCheck style={{ width: '0.75rem', height: '0.75rem' }} />
              <span>Secure session</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="member-portal"
      style={{ height: '100dvh', width: '100%', overflow: 'hidden', background: '#faf8f6', display: 'flex', flexDirection: 'column' }}
    >
      {/* Keep the backdrop mounted so both opening and closing feel smooth. */}
      <div
        className={`member-sidebar-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* Desktop sidebar */}
      <aside
        className={`member-desktop-sidebar${collapsed ? ' is-collapsed' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          background: 'linear-gradient(180deg,#ffffff 0%,#fffdfc 70%,#fdf7f4 100%)',
          borderRight: '1px solid #f1e3e7',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`member-mobile-drawer${mobileOpen ? ' is-open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: 'min(15rem, 86vw)',
          background: '#FFFFFF',
          borderRight: '1px solid #f0e7ea',
          boxShadow: '12px 0 36px rgba(43,16,29,.12)',
          flexDirection: 'column',
        }}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main content area */}
      <div
        className={`member-shell-main${collapsed ? ' is-collapsed' : ''}`}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >

        {/* Top header */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            height: '3.75rem',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(240,231,234,0.85)',
            padding: '0 0.75rem',
            background: 'rgba(255,254,253,0.82)',
            backdropFilter: 'blur(20px) saturate(1.35)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.35)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <button
              type="button"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.625rem',
                border: 'none',
                background: 'transparent',
                color: '#8a747d',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              className="member-header-mobile-menu"
            >
              <Menu style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>

            {pathname === '/dashboard' ? (
              <Link
                href="/dashboard"
                style={{ alignItems: 'center', gap: '0.5rem', textDecoration: 'none', minWidth: 0 }}
                aria-label="My Dear Partner home"
                className="member-header-mobile-brand"
              >
                <img src="/images/main-logo.png" alt="" style={{ height: '1.75rem', width: '1.75rem', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 800, color: '#2c2928', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  My Dear <em style={{ fontStyle: 'normal', background: 'linear-gradient(135deg,#b64a68,#8e3d58)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Partner</em>
                </span>
              </Link>
            ) : (
              <div style={{ minWidth: 0 }} className="member-header-mobile-page">
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 800, color: '#2c2928', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentPage}
                </p>
              </div>
            )}

          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
            <NotificationBell />
            <Link
              href="/profile/me"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.1875rem',
                borderRadius: '9999px',
                border: '1.5px solid transparent',
                background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg,#e11d48,#b64a68,#d9b36c) border-box',
                boxShadow: '0 2px 10px rgba(142,61,88,0.14)',
                transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                textDecoration: 'none',
              }}
              aria-label="Open my profile"
            >
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: '#f8e9ee',
                  flexShrink: 0,
                }}
              >
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
        <main className="member-page-content site-page-enter" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'clip' }}>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
