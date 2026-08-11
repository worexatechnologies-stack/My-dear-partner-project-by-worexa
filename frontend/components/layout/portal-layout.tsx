'use client';

import type { ReactNode } from 'react';
import AdminLayout from '@/legacy/components/admin/AdminLayout';

export function PortalLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
