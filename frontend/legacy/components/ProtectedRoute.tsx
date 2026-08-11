'use client';

import { Navigate, Outlet, useLocation } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import type { AccountType } from '../services/apiClient';
import PageLoader from './PageLoader';
import { PermissionDenied } from './ui/Feedback';

interface ProtectedRouteProps {
  allowedAccountTypes?: AccountType[];
  loginPath?: string;
  fallbackPath?: string;
}

export default function ProtectedRoute({
  allowedAccountTypes = ['MEMBER'],
  loginPath = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading || (isAuthenticated && !user)) {
    return <PageLoader text="Checking your secure session..." />;
  }
  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  if (!user || !allowedAccountTypes.includes(user.account_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
        <PermissionDenied 
          reason="Your current account type does not have permission to access this administrative section."
          currentAccountType={user?.account_type}
          requiredAccess={allowedAccountTypes.join(', ')}
        />
      </div>
    );
  }
  return <Outlet />;
}

