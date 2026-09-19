'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass, Search, Heart, Bookmark, Eye,
  MessageCircle, ShieldCheck, Crown,
  Settings, LogOut, Menu, X, User,
  Headphones, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import ProfileImage from '@/components/profile/ProfileImage';
import SiteLogo from '@/components/branding/site-logo';
import { NotificationBell } from '@/components/member/notification-bell';
import MobileBottomNav from './mobile-bottom-nav';

/* ─── Nav definitions (Instagram Style) ─── */

interface NavItemDef {
  label: string;
  icon: React.ElementType;
  href: string;
}

const mainNav: NavItemDef[] = [
  { label: 'Discover',     icon: Compass,        href: '/dashboard' },
  { label: 'Find Matches', icon: Search,         href: '/search' },
  { label: 'Messages',     icon: MessageCircle,  href: '/messages' },
  { label: 'Likes',        icon: Heart,          href: '/interests/received' },
  { label: 'My Profile',   icon: User,           href: '/profile/me' },
];

const accountNav: NavItemDef[] = [
  { label: 'Shortlist',      icon: Bookmark,    href: '/shortlist' },
  { label: 'Visitors',       icon: Eye,         href: '/visitors' },
  { label: 'Blocked',        icon: ShieldCheck, href: '/blocked' },
  { label: 'Membership',     icon: Crown,       href: '/membership' },
  { label: 'Settings',       icon: Settings,    href: '/settings' },
  { label: 'Help & Support', icon: Headphones,  href: '/support' },
];

/* ─── NavLink (Instagram Style 1) ─── */

function NavLink({
  item, isActive, badge, collapsed,
}: {
  item: NavItemDef;
  isActive: boolean;
  badge?: number;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className="group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '1rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0.75rem' : '0.6875rem 0.875rem',
        borderRadius: '0.75rem',
        fontSize: '0.9375rem',
        fontWeight: isActive ? 750 : 500,
        textDecoration: 'none',
        transition: 'all 0.16s cubic-bezier(0.2, 0.9, 0.3, 1)',
        position: 'relative',
        background: 'transparent',
        color: isActive ? '#0f0f10' : '#443c40',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = '#f7f4f5';
        (e.currentTarget as HTMLAnchorElement).style.color = '#000000';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
        (e.currentTarget as HTMLAnchorElement).style.color = isActive ? '#0f0f10' : '#443c40';
      }}
    >
      {/* Icon with Instagram-style scaling on hover and bold active stroke */}
      <Icon
        className="transition-transform duration-200 ease-out group-hover:scale-110"
        style={{
          width: '1.4rem',
          height: '1.4rem',
          flexShrink: 0,
          color: isActive ? '#e11d48' : '#262626',
          strokeWidth: isActive ? 2.75 : 1.85,
          fill: (isActive && (item.label === 'Likes' || item.label === 'Shortlist')) ? '#e11d48' : 'none',
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
              ? { position: 'absolute', top: '0.25rem', right: '0.25rem' }
              : { marginLeft: 'auto' }),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '1.125rem',
            height: '1.125rem',
            padding: '0 0.3rem',
            borderRadius: '9999px',
            background: '#e11d48',
            color: 'white',
            fontSize: '0.625rem',
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
          margin: '0.75rem 0.5rem',
          height: '1px',
          background: '#f0e8eb',
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
        color: '#a8989f',
        padding: '0.875rem 0.875rem 0.35rem',
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

  /* ─── Sidebar panel content ─── */

  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>

        {/* Logo row */}
        <div
          style={{
            height: '4.5rem',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0 0.75rem' : '0 1rem 0 1.25rem',
            borderBottom: '1px solid #f2e8eb',
          }}
        >
          {(!isCollapsed) && (
            <Link
              href="/dashboard"
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, textDecoration: 'none' }}
              aria-label="My Dear Partner"
            >
              <SiteLogo alt="My Dear Partner" className="w-8 h-8 object-contain shrink-0" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 800, color: '#1a1417', whiteSpace: 'nowrap' }}>
                My Dear <em style={{ fontStyle: 'normal', color: '#e11d48' }}>Partner</em>
              </span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" aria-label="Home">
              <SiteLogo alt="My Dear Partner" className="w-8 h-8 object-contain" />
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
              <X style={{ width: '1.2rem', height: '1.2rem' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#8c7a82',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f7f4f5';
                (e.currentTarget as HTMLButtonElement).style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = '#8c7a82';
              }}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed
                ? <PanelLeftOpen style={{ width: '1.15rem', height: '1.15rem' }} />
                : <PanelLeftClose style={{ width: '1.15rem', height: '1.15rem' }} />
              }
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isCollapsed ? '0.75rem 0.5rem' : '0.75rem 0.75rem',
            scrollbarWidth: 'thin',
            scrollbarColor: '#e8dbe0 transparent',
          }}
          aria-label="Member navigation"
        >
          <SectionLabel label="Main" collapsed={isCollapsed} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {mainNav.map((item) => {
              const active =
                item.href === '/interests/received'
                  ? pathname.startsWith('/interests')
                  : item.href === '/profile/me'
                  ? pathname.startsWith('/profile')
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
            borderTop: '1px solid #f2e8eb',
            padding: isCollapsed ? '0.75rem 0.5rem' : '0.75rem 0.75rem',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={async () => { await logout(); window.location.assign('/login'); }}
            title={isCollapsed ? 'Sign Out' : undefined}
            className="group"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? 0 : '1rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%',
              padding: isCollapsed ? '0.75rem' : '0.6875rem 0.875rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: '#443c40',
              cursor: 'pointer',
              transition: 'all 0.16s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff0f2';
              (e.currentTarget as HTMLButtonElement).style.color = '#e11d48';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#443c40';
            }}
          >
            <LogOut
              className="transition-transform duration-200 ease-out group-hover:scale-110"
              style={{ width: '1.35rem', height: '1.35rem', flexShrink: 0, strokeWidth: 1.85 }}
            />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
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
          boxShadow: '1px 0 10px rgba(0,0,0,0.02)',
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
          {/* Left: Mobile Menu toggle and mobile brand */}
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
          </div>

          {/* Right actions: Notification & Profile Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginLeft: 'auto' }}>
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
