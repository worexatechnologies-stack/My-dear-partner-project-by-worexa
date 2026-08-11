'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useGetMembershipSummaryQuery, type MembershipSummary } from '@/legacy/services/membershipApi';
import { useAuth } from '@/legacy/contexts/AuthContext';

interface MembershipContextType {
  membershipSummary: MembershipSummary | null;
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

const MembershipContext = createContext<MembershipContextType | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accountType } = useAuth();

  const { 
    data: membershipSummary = null, 
    isLoading, 
    error, 
    refetch 
  } = useGetMembershipSummaryQuery(undefined, {
    skip: !isAuthenticated || accountType !== 'MEMBER',
    refetchOnMountOrArgChange: true,
    refetchOnFocus: false,
  });

  const value: MembershipContextType = {
    membershipSummary: isAuthenticated ? membershipSummary : null,
    isLoading: isAuthenticated ? isLoading : false,
    error: isAuthenticated ? error : null,
    refetch,
  };

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context) {
    throw new Error('useMembership must be used within a MembershipProvider');
  }
  return context;
}