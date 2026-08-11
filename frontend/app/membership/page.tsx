'use client';

import { Suspense } from 'react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import MemberMembershipPage from '@/components/membership/member-membership-page';
import PublicMembershipPage from '@/components/membership/public-membership-page';
import PublicSiteShell from '@/components/layout/public-site-shell';

export default function MembershipPage() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="mp-route-loading"><span /><p>Preparing membership options...</p></div>;
  }
  
  // If authenticated member, show member page; otherwise show public page
  if (isAuthenticated && user?.account_type === 'MEMBER') {
    return <MemberMembershipPage />;
  }
  
  // For public users or other account types, show the public landing page
  return <PublicSiteShell><Suspense fallback={<div style={{ height: 80 }} />}><PublicMembershipPage /></Suspense></PublicSiteShell>;
}
