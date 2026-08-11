import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ClientAuthGuard } from '@/components/auth/client-auth-guard';
import { PortalLayout } from '@/components/layout/portal-layout';

export const metadata: Metadata = { title: 'Super Admin portal', robots: { index: false, follow: false } };

export default function SuperAdminPortalLayout({ children }: { children: ReactNode }) {
  return <ClientAuthGuard allowed={['SUPER_ADMIN']} loginPath="/super-admin/login">
    <PortalLayout><Suspense fallback={<div className="portal-loading">Loading workspace…</div>}>{children}</Suspense></PortalLayout>
  </ClientAuthGuard>;
}
