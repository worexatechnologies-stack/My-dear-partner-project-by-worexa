'use client';

import ProtectedRoute from './ProtectedRoute';

export default function AdminRoute() {
  return (
    <ProtectedRoute
      allowedAccountTypes={['SUPER_ADMIN', 'ADMIN']}
      loginPath="/admin/login"
    />
  );
}
