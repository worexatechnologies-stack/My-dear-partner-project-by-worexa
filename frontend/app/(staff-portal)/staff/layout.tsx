import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ClientAuthGuard } from '@/components/auth/client-auth-guard';
import { PortalLayout } from '@/components/layout/portal-layout';

export const metadata: Metadata = { title: 'Staff portal', robots: { index: false, follow: false } };

export default function StaffPortalLayout({ children }: { children: ReactNode }) {
  return <ClientAuthGuard allowed={['SUPER_ADMIN', 'ADMIN']} loginPath="/admin/login">
    <PortalLayout><Suspense fallback={<div className="portal-loading">Loading work queue…</div>}>{children}</Suspense></PortalLayout>
  </ClientAuthGuard>;
}
