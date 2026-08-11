'use client';

import type { ReactNode } from 'react';
import { useLocation } from '@/lib/router-compat';
import { ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { canAccessAdminItem, findAdminNavItem, type AdminNavItem } from '../../admin/navigation';
import { useAuth, type AdminRole } from '../../contexts/AuthContext';
import {
  AdminAccessDenied, AdminEmptyState, AdminPageHeader, AdminPanel,
} from '../../components/admin/AdminUI';

export function AdminPermissionRoute({ item, children }: { item: AdminNavItem; children: ReactNode }) {
  const { user } = useAuth();
  const role = (user?.admin_role || (user?.is_superuser ? 'SUPER_ADMIN' : 'ADMIN')) as AdminRole;
  if (!canAccessAdminItem(item, role, user?.admin_permissions || [])) return <AdminAccessDenied />;
  return <>{children}</>;
}

export default function AdminModulePage() {
  const location = useLocation();
  const { user } = useAuth();
  const item = findAdminNavItem(location.pathname);

  if (!item) return <AdminAccessDenied />;

  return (
    <AdminPermissionRoute item={item}>
      <AdminPageHeader
        eyebrow={item.section}
        title={item.label}
        description={item.description}
      />
      <div className="admin-module-summary-grid">
        <AdminPanel className="admin-module-empty-panel">
          <AdminEmptyState
            title={`No ${item.label.toLowerCase()} need attention`}
            description="This workspace is ready. New records will appear here as soon as they are available to your role."
          />
        </AdminPanel>
        <AdminPanel title="Access scope" subtitle="Controls applied to this view">
          <div className="admin-scope-list">
            <div><span><ShieldCheck /></span><p><strong>{user?.admin_role_display || user?.admin_role_name || user?.admin_role || 'Administrative'} access</strong><small>Only records permitted for this role are requested.</small></p></div>
            <div><span><CheckCircle2 /></span><p><strong>Backend authorization</strong><small>Every action is revalidated by the API.</small></p></div>
            <div><span><ArrowUpRight /></span><p><strong>Audit ready</strong><small>Sensitive actions are designed to be logged.</small></p></div>
          </div>
        </AdminPanel>
      </div>
    </AdminPermissionRoute>
  );
}
