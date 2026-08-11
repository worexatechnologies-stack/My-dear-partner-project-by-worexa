'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { isValidReturnUrl, getDashboardPath, getLoginPath } from '@/lib/auth';
import type { AccountType } from '@/lib/auth';

interface GuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children }: GuardProps) {
  const { loading, isAuthenticated, accountType } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const returnUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const dest = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
      router.replace(dest);
    }
  }, [loading, isAuthenticated, pathname, searchParams, router]);

  if (loading) {
    return (
      <div className="route-skeleton" role="status">
        <div className="route-skeleton-inner">
          <div className="skeleton-line" style={{ width: '40%' }} />
          <div className="skeleton-line" style={{ width: '60%' }} />
          <div className="skeleton-card" />
          <div className="skeleton-line" style={{ width: '45%' }} />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="route-skeleton" role="status">
        <div className="route-skeleton-inner">
          <div className="skeleton-line" style={{ width: '30%' }} />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: GuardProps) {
  const { loading, isAuthenticated, accountType } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && accountType) {
      const dest = getDashboardPath(accountType);
      router.replace(dest);
    }
  }, [loading, isAuthenticated, accountType, pathname, router]);

  if (loading) {
    return (
      <div className="route-skeleton" role="status">
        <div className="route-skeleton-inner">
          <div className="skeleton-line" style={{ width: '30%' }} />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return <>{children}</>;
}

export function RoleGuard({
  children,
  allowedRoles,
  loginPath: customLoginPath,
}: {
  children: ReactNode;
  allowedRoles: AccountType[];
  loginPath?: string;
}) {
  const { loading, isAuthenticated, accountType } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !accountType) {
      const loginUrl = customLoginPath || getLoginPath(accountType);
      const returnUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      router.replace(`${loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (!allowedRoles.includes(accountType)) {
      router.replace('/403');
    }
  }, [loading, isAuthenticated, accountType, allowedRoles, pathname, searchParams, router, customLoginPath]);

  if (loading || !isAuthenticated || !accountType || !allowedRoles.includes(accountType)) {
    return (
      <div className="route-skeleton" role="status">
        <div className="route-skeleton-inner">
          <div className="skeleton-line" style={{ width: '30%' }} />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PermissionGuard({
  children,
  permission,
  fallback = null,
}: {
  children: ReactNode;
  permission: string;
  fallback?: ReactNode;
}) {
  const { hasAdminPermission } = useAuth();
  return hasAdminPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
