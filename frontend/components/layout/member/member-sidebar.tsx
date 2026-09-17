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
        gap: collapsed ? 0 : '0.75rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0.625rem' : '0.5625rem 0.75rem',
        borderRadius: '0.625rem',
        fontSize: '0.84rem',
        fontWeight: isActive ? 600 : 500,
        textDecoration: 'none',
        transition: 'all 0.16s ease',
        position: 'relative',
        background: isActive ? '#fff1f5' : 'transparent',
        color: isActive ? '#e11d48' : '#5f5056',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.background = '#faf3f6';
          (e.currentTarget as HTMLAnchorElement).style.color = '#251b20';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
          (e.currentTarget as HTMLAnchorElement).style.color = '#5f5056';
        }
      }}
    >
      {/* Sleek Active Indicator Bar */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: '3.5px',
            borderRadius: '0 4px 4px 0',
            background: '#e11d48',
            boxShadow: '0 0 8px rgba(225,29,72,0.4)',
          }}
        />
      )}

      <Icon
        style={{
          width: '1.15rem',
          height: '1.15rem',
          flexShrink: 0,
          color: isActive ? '#e11d48' : '#8c7a82',
          strokeWidth: isActive ? 2.25 : 1.75,
          transition: 'color 0.16s ease, transform 0.16s ease',
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
            padding: '0 0.3rem',
            borderRadius: '9999px',
            background: '#e11d48',
            boxShadow: '0 2px 6px rgba(225,29,72,0.35)',
            color: 'white',
            fontSize: '0.6rem',
            fontWeight: 700,
          }}
        >
          {(badge ?? 0) > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span
          className="pointer-events-none opacity-0 group-hover:opacity-100"
          style={{
            position: 'absolute',
            left: 'calc(100% + 0.75rem)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50,
            whiteSpace: 'nowrap',
            borderRadius: '0.5rem',
            background: '#1f1a1d',
            padding: '0.375rem 0.625rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'white',
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
          margin: '0.625rem 0.25rem',
          height: '1px',
          background: '#f0e6ea',
        }}
      />
    );
  }
  return (
    <p
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#a5949c',
        padding: '0.875rem 0.75rem 0.35rem',
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>

        {/* Logo row */}
        <div
          style={{
            height: '4rem',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0 0.75rem' : '0 1rem',
            borderBottom: '1px solid #f0e6ea',
          }}
        >
          {(!isCollapsed) && (
            <Link
              href="/dashboard"
              style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, textDecoration: 'none' }}
              aria-label="My Dear Partner"
            >
              <SiteLogo alt="My Dear Partner" className="w-7 h-7 object-contain shrink-0" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 800, color: '#1f171b', whiteSpace: 'nowrap' }}>
                My Dear <em style={{ fontStyle: 'normal', color: '#e11d48' }}>Partner</em>
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
                width: '1.875rem',
                height: '1.875rem',
                borderRadius: '0.5rem',
                border: '1px solid #f0e6ea',
                background: '#faf6f8',
                color: '#8c7a82',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#fff0f4';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#f5ccd7';
                (e.currentTarget as HTMLButtonElement).style.color = '#e11d48';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#faf6f8';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#f0e6ea';
                (e.currentTarget as HTMLButtonElement).style.color = '#8c7a82';
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
            scrollbarColor: '#e8dbe0 transparent',
          }}
          aria-label="Member navigation"
        >
          <SectionLabel label="Main" collapsed={isCollapsed} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem', marginBottom: '0.375rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
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
            borderTop: '1px solid #f0e6ea',
            padding: isCollapsed ? '0.625rem 0.5rem' : '0.625rem 0.75rem',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={async () => { await logout(); window.location.assign('/login'); }}
            title={isCollapsed ? 'Sign Out' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? 0 : '0.75rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%',
              padding: isCollapsed ? '0.625rem' : '0.5625rem 0.75rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#6e5d65',
              cursor: 'pointer',
              transition: 'all 0.16s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff0f2';
              (e.currentTarget as HTMLButtonElement).style.color = '#e11d48';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#6e5d65';
            }}
          >
            <LogOut style={{ width: '1.15rem', height: '1.15rem', flexShrink: 0, strokeWidth: 1.75 }} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>

          {!isCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.35rem 0.75rem 0.125rem',
                fontSize: '0.625rem',
                color: '#b0a0a8',
                fontWeight: 500,
              }}
            >
              <ShieldCheck style={{ width: '0.8125rem', height: '0.8125rem', color: '#10b981' }} />
              <span>Secure verified session</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="member-portal"
      style={{ height: '100dvh', width: '100%', overflow: 'hidden', background: '#faf8f7', display: 'flex', flexDirection: 'column' }}
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
          background: '#ffffff',
          borderRight: '1px solid #f0e6ea',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '2px 0 12px rgba(45,20,30,0.02)',
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
          width: 'min(15.5rem, 86vw)',
          background: '#ffffff',
          borderRight: '1px solid #f0e6ea',
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

        {/* Top header / Navbar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            height: '4rem',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0e6ea',
            padding: '0 1.25rem',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          {/* Left: Mobile Menu or Page Title Context */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button
              type="button"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.625rem',
                border: '1px solid #f0e6ea',
                background: '#ffffff',
                color: '#6f5e66',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              className="member-header-mobile-menu"
            >
              <Menu style={{ width: '1.15rem', height: '1.15rem' }} />
            </button>

            {/* Mobile Brand */}
            <div className="member-header-mobile-brand">
              <Link
                href="/dashboard"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', minWidth: 0 }}
                aria-label="My Dear Partner home"
              >
                <img src="/images/main-logo.png" alt="" style={{ height: '1.75rem', width: '1.75rem', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.84rem', fontWeight: 800, color: '#2c2928', whiteSpace: 'nowrap' }}>
                  My Dear <em style={{ fontStyle: 'normal', color: '#e11d48' }}>Partner</em>
                </span>
              </Link>
            </div>

            {/* Desktop Context / Page Title */}
            <div className="member-header-desktop-context" style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9e8c95', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Member Portal
                </span>
                <span style={{ color: '#d5c7cc', fontSize: '0.75rem' }}>/</span>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 800, color: '#1f171b', margin: 0 }}>
                  {currentPage}
                </h1>
              </div>
            </div>
          </div>

          {/* Right actions: Notification & Profile Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <NotificationBell />

            <Link
              href="/profile/me"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.25rem 0.75rem 0.25rem 0.25rem',
                borderRadius: '9999px',
                border: '1px solid #f0e6ea',
                background: '#faf6f8',
                transition: 'all 0.16s ease',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#fff0f4';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#f7ccd7';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(225,29,72,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#faf6f8';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#f0e6ea';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
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
                  border: '1.5px solid #e11d48',
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

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#251b20', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '7.5rem' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#e11d48', lineHeight: 1.1 }}>
                  View Profile
                </span>
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
