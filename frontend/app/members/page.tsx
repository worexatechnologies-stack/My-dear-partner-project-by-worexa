'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/legacy/contexts/AuthContext';

/**
 * Route guard for the bare top-level `/members` path.
 *
 * The app keeps each workspace under its own prefixed base:
 *   - Member home        -> /dashboard
 *   - Admin members list -> /admin/members
 *   - Super-admin list   -> /super-admin/members
 *
 * `/members` itself is not a real page, but legacy bookmarks, sidebar links and
 * cached client bundles can still land on it. Instead of showing the generic
 * 404 page, resolve it to the correct destination for the signed-in role so
 * admins never get stuck on "Page Not Found" inside the portal.
 */
export default function MembersRedirectPage() {
  const router = useRouter();
  const { loading, accountType } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (accountType === 'SUPER_ADMIN') router.replace('/super-admin/members');
    else if (accountType === 'ADMIN') router.replace('/admin/members');
    else if (accountType === 'MEMBER') router.replace('/dashboard');
    else router.replace('/login');
  }, [accountType, loading, router]);

  return (
    <div className="portal-loading" role="status">
      Redirecting…
    </div>
  );
}