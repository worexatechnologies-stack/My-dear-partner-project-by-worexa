'use client';

import SmartImage from '@/components/shared/smart-image';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from '@/lib/router-compat';
import {
  Bell, ChevronDown, ChevronLeft, ChevronRight,
  HeartHandshake, LogOut, Menu, Search, ShieldCheck, UserRound, X,
} from 'lucide-react';
import {
  adminNavigation, adminNavSections, canAccessAdminItem, findAdminNavItem, normalizeAdminPath,
} from '../../admin/navigation';
import { useAuth, type AdminRole } from '../../contexts/AuthContext';
import { AdminToast } from '../../components/admin/AdminUI';
import { RealtimeProvider, useRealtime, type RealtimeEvent } from '@/providers/RealtimeProvider';

const roleLabels: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};

function AdminLayoutInner({ children }: { children?: ReactNode }) {
  const { user, logout, hasAdminPermission } = useAuth();
  const { status, lastEvent } = useRealtime();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    const { type, data } = lastEvent;

    let message = '';
    let tone: 'success' | 'error' = 'success';

    if (type === 'verification.submitted') {
      const friendlyType = (data.verification_type as string || '').replace(/_/g, ' ').toLowerCase();
      message = `New: ${(data.member_name as string) || 'A member'} submitted ${friendlyType} for review.`;
    } else if (type === 'verification.approved') {
      const friendlyType = (data.verification_type as string || '').replace(/_/g, ' ').toLowerCase();
      message = `${(data.member_name as string) || 'A member'}'s ${friendlyType} was approved.`;
    } else if (type === 'verification.rejected') {
      const friendlyType = (data.verification_type as string || '').replace(/_/g, ' ').toLowerCase();
      message = `${(data.member_name as string) || 'A member'}'s ${friendlyType} was rejected.`;
      tone = 'error';
    } else if (type === 'verification.changes_requested') {
      const friendlyType = (data.verification_type as string || '').replace(/_/g, ' ').toLowerCase();
      message = `Changes requested for ${(data.member_name as string) || 'a member'}'s ${friendlyType}.`;
      tone = 'error';
    } else if (type === 'support.ticket_created') {
      message = `New support ticket: ${(data.subject as string) || 'No subject'}`;
    } else if (type === 'support.ticket_assigned') {
      message = `Ticket assigned to ${(data.assigned_to as string) || 'an agent'}`;
    } else if (type === 'photo.uploaded') {
      message = `New photo uploaded for review by ${(data.member_name as string) || 'a member'}`;
    } else if (type === 'document.uploaded') {
      message = `New document uploaded for verification by ${(data.member_name as string) || 'a member'}`;
    } else if (type === 'membership.purchased') {
      message = `Membership purchased by ${(data.member_name as string) || 'a member'}`;
    } else if (type === 'payment.success') {
      message = `Payment completed: ${(data.amount as string) || ''}`;
    } else if (type === 'payment.failed') {
      message = `Payment failed: ${(data.amount as string) || ''}`;
      tone = 'error';
    } else if (type === 'complaint.created') {
      message = `New complaint filed by ${(data.member_name as string) || 'a member'}`;
      tone = 'error';
    } else if (type === 'contact.created') {
      message = `New contact enquiry from ${(data.name as string) || 'someone'}`;
    }

    if (message) {
      setToast({ message, tone });
    }

    window.dispatchEvent(new CustomEvent('admin-update', { detail: lastEvent }));
  }, [lastEvent]);

  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);

  const role = (user?.admin_role || (user?.is_superuser ? 'SUPER_ADMIN' : 'ADMIN')) as AdminRole;
  const portalPaths = {
    SUPER_ADMIN: { dashboard: '/super-admin/dashboard', login: '/super-admin/login' },
    ADMIN: { dashboard: '/admin/dashboard', login: '/admin/login' },
  } as const;
  const currentPortal = portalPaths[user?.account_type as keyof typeof portalPaths] || portalPaths.ADMIN;
  const dashboardPath = currentPortal.dashboard;
  const loginPath = currentPortal.login;
  
  const getSidebarPath = useCallback((itemPath: string) => {
    if (user?.account_type === 'SUPER_ADMIN') {
      if (itemPath === '/admin/admin-management') return '/super-admin/accounts';
      if (itemPath.startsWith('/admin/')) return itemPath.replace('/admin/', '/super-admin/');
      return itemPath;
    }
    return itemPath;
  }, [user]);

  const navigation = useMemo(() => {
    const list = adminNavigation.filter((item) => canAccessAdminItem(item, role, user?.admin_permissions || []));
    return list;
  }, [role, user?.admin_permissions, user?.account_type]);

  useEffect(() => {
    setCollapsed(localStorage.getItem('mdp.admin.sidebar_collapsed') === 'true');
  }, []);

  const activeItem = findAdminNavItem(location.pathname);

  useEffect(() => {
    const restoreScroll = () => {
      const savedScroll = sessionStorage.getItem('mdp.admin.sidebar_scroll');
      if (savedScroll && sidebarNavRef.current) {
        sidebarNavRef.current.scrollTop = parseInt(savedScroll, 10);
      }
    };
    restoreScroll();
    const timer = setTimeout(restoreScroll, 50);
    return () => clearTimeout(timer);
  }, [location.pathname, navigation]);

  const handleSidebarScroll = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem('mdp.admin.sidebar_scroll', String(sidebarNavRef.current.scrollTop));
    }
  };

  useEffect(() => {
    localStorage.setItem('mdp.admin.sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('admin-drawer-open', mobileOpen);
    return () => document.body.classList.remove('admin-drawer-open');
  }, [mobileOpen]);



  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    if (user?.account_type === 'SUPER_ADMIN') navigate(`/super-admin/members?search=${encodeURIComponent(term)}`);
    else navigate(`/admin/members?search=${encodeURIComponent(term)}`);
    setQuery('');
  };

  const handleLogout = async () => {
    await logout();
    navigate(loginPath, { replace: true });
  };

  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Administrator';
  const initials = displayName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <div className={`admin-app ${collapsed ? 'admin-sidebar-collapsed' : ''}`}>
      <button type="button" className={`admin-drawer-backdrop ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      <aside className={`admin-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="admin-brand-row">
          <Link to={dashboardPath} className="admin-brand flex items-center gap-2.5" aria-label="My Dear Partner admin dashboard">
            <img src="/images/main-logo.png" alt="My Dear Partner Logo" className="w-8 h-8 object-contain" />
            <div><strong>My Dear <span className="text-pink-500">Partner</span></strong><small>Control centre</small></div>
          </Link>
          <button type="button" className="admin-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <div className="admin-role-card">
          <span><ShieldCheck /></span>
          <div><small>Signed in as</small><strong>{user?.admin_role_display || user?.admin_role_name || roleLabels[role]}</strong></div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation" ref={sidebarNavRef} onScroll={handleSidebarScroll}>
          {adminNavSections.map((section) => {
            const items = navigation.filter((item) => item.section === section);
            if (!items.length) return null;
            return (
              <div className="admin-nav-section" key={section}>
                <p>{section}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const targetPath = getSidebarPath(item.path);
                  // Use an exact match so Payments and Refunds do not also
                  // highlight the parent Memberships entry.
                  const active = normalizeAdminPath(location.pathname) === normalizeAdminPath(targetPath);
                  return (
                    <Link key={item.path} to={targetPath} className={`admin-nav-link ${active ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
                      <Icon />
                      <span>{item.shortLabel || item.label}</span>
                      {active && <i />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-security-note"><ShieldCheck /><span><strong>Secure session</strong><small>Permission checks active</small></span></div>
          <button type="button" className="admin-collapse-btn" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
      </aside>

      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button type="button" className="admin-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
            <div className="admin-breadcrumb"><small>{roleLabels[role]} workspace</small><strong>{activeItem?.label || 'Dashboard'}</strong></div>
          </div>

          <form className="admin-global-search" onSubmit={handleSearch}>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users…" aria-label="Search admin workspace" />
            <kbd>Enter</kbd>
          </form>

          <div className="admin-topbar-actions">
            {hasAdminPermission('notifications.manage') && <Link to={user?.account_type === 'SUPER_ADMIN' ? '/super-admin/notifications' : '/admin/notifications'} className="admin-icon-btn admin-notification-btn" aria-label="Notifications"><Bell /><i /></Link>}
            <div className="admin-profile-menu" ref={profileRef}>
              <button type="button" className="admin-profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span className="admin-avatar">{user?.id ? <img src={`/api/proxy/users/${user.id}/avatar/`} alt="" /> : initials}</span>
                <span className="admin-profile-copy"><strong>{displayName}</strong><small>{user?.admin_role_display || user?.admin_role_name || roleLabels[role]}</small></span>
                <ChevronDown />
              </button>
              {profileOpen && (
                <div className="admin-profile-dropdown">
                  <div><strong>{displayName}</strong><span>{user?.email}</span></div>
                  <Link to="/"><UserRound /> Public website</Link>
                  <button type="button" onClick={handleLogout}><LogOut /> Sign out securely</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="admin-main-content">{children || <Outlet />}</main>
      </div>
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function AdminLayout({ children }: { children?: ReactNode } = {}) {
  const { user } = useAuth();
  return (
    <RealtimeProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </RealtimeProvider>
  );
}
