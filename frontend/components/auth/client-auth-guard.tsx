'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth, type AdminRole } from '@/legacy/contexts/AuthContext';
import type { AccountType } from '@/legacy/services/apiClient';

export function ClientAuthGuard({
  children,
  allowed,
  loginPath,
}: {
  children: ReactNode;
  allowed: AccountType[];
  loginPath: string;
}) {
  const { loading, isAuthenticated, accountType } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !accountType) {
      const next = encodeURIComponent(`${pathname}${query ? `?${query}` : ''}`);
      router.replace(`${loginPath}?next=${next}`);
      return;
    }
    if (!allowed.includes(accountType)) router.replace('/403');
  }, [accountType, allowed, isAuthenticated, loading, loginPath, pathname, query, router]);

  if (loading || !isAuthenticated || !accountType || !allowed.includes(accountType)) {
    return <div className="portal-loading" role="status">Verifying your secure session…</div>;
  }
  return <>{children}</>;
}

export function PermissionGuard({ permission, children, fallback = null }: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasAdminPermission } = useAuth();
  return hasAdminPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

export function usePermission(permission: string) {
  return useAuth().hasAdminPermission(permission);
}

export type PortalRole = AdminRole | 'MEMBER';
