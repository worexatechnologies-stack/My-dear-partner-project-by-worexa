'use client';

import dynamic from 'next/dynamic';
import { notFound, usePathname } from 'next/navigation';

const Dashboard = dynamic(() => import('@/legacy/pages/admin/StaffDashboardPage'), { loading: () => <div className="portal-loading">Loading dashboard…</div> });
const Work = dynamic(() => import('@/legacy/pages/admin/StaffWorkQueuePage'), { loading: () => <div className="portal-loading">Loading work queue…</div> });

export function StaffRouteResolver() {
  const path = usePathname().replace(/^\/staff\/?/, '').split('/')[0] || 'dashboard';
  if (path === 'dashboard') return <Dashboard />;
  if (['tasks', 'my-work', 'profiles', 'photos', 'documents'].includes(path)) return <Work />;
  notFound();
}
