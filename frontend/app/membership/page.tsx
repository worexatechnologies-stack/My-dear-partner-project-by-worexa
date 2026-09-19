'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { storeClientAuthState, fetchApi } from '@/legacy/services/apiClient';
import MemberMembershipPage from '@/components/membership/member-membership-page';
import PublicMembershipPage from '@/components/membership/public-membership-page';
import PublicSiteShell from '@/components/layout/public-site-shell';

function MembershipContent() {
  const { isAuthenticated, user, loading, updateUser } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [tokenAuthAttempted, setTokenAuthAttempted] = useState(false);
  const [isTokenLoading, setIsTokenLoading] = useState(Boolean(token && !isAuthenticated));

  useEffect(() => {
    if (token && !isAuthenticated && !tokenAuthAttempted) {
      setTokenAuthAttempted(true);
      setIsTokenLoading(true);
      storeClientAuthState('MEMBER', token);
      fetchApi<any>('/member-auth/me/')
        .then((userData) => {
          if (userData) {
            updateUser(userData);
          }
        })
        .catch((err) => {
          console.warn('[Membership] Failed to authenticate with URL token:', err);
        })
        .finally(() => {
          setIsTokenLoading(false);
        });
    }
  }, [token, isAuthenticated, tokenAuthAttempted, updateUser]);

  if (loading || isTokenLoading) {
    return (
      <div className="mp-route-loading">
        <span />
        <p>Preparing membership options...</p>
      </div>
    );
  }

  // If authenticated member, show member page; otherwise show public page
  if ((isAuthenticated || tokenAuthAttempted) && user?.account_type === 'MEMBER') {
    return <MemberMembershipPage />;
  }

  // For public users or other account types, show the public landing page
  return (
    <PublicSiteShell>
      <Suspense fallback={<div style={{ height: 80 }} />}>
        <PublicMembershipPage />
      </Suspense>
    </PublicSiteShell>
  );
}

export default function MembershipPage() {
  return (
    <Suspense fallback={<div className="mp-route-loading"><span /><p>Preparing membership options...</p></div>}>
      <MembershipContent />
    </Suspense>
  );
}
