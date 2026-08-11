import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ClientAuthGuard } from '@/components/auth/client-auth-guard';
import { PortalLayout } from '@/components/layout/portal-layout';

export const metadata: Metadata = { title: 'Admin portal', robots: { index: false, follow: false } };

export default function AdminPortalLayout({ children }: { children: ReactNode }) {
  return <ClientAuthGuard allowed={['SUPER_ADMIN', 'ADMIN']} loginPath="/admin/login">
    <PortalLayout><Suspense fallback={<div className="portal-loading">Loading workspace…</div>}>{children}</Suspense></PortalLayout>
  </ClientAuthGuard>;
}
