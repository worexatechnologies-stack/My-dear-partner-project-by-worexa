'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  authNamespace,
  beginAuthTransition,
  clearClientAuthState,
  fetchApi,
  getStoredAccountType,
  storeClientAuthState,
  type AccountType,
} from '../services/apiClient';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

export interface UserType {
  id: string;
  email: string;
  mobile_number?: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  account_type: AccountType;
  is_premium?: boolean;
  is_verified: boolean;
  is_staff: boolean;
  is_superuser?: boolean;
  admin_role: AdminRole | null;
  admin_role_name?: string | null;
  admin_role_display?: string | null;
  admin_permissions: string[];
  is_active?: boolean;
  photo?: string;
  completion_percentage?: number;
  missing_fields?: string[];
  [key: string]: unknown;
}

export interface MemberRegistrationInput {
  email: string;
  mobile_number: string;
  password: string;
  confirm_password?: string;
  accept_terms?: boolean;
  terms_accepted_at?: string;
  first_name: string;
  last_name?: string;
  gender?: string;
  date_of_birth?: string;
  profile_created_by?: string;
  religion?: string;
  mother_tongue?: string;
  caste?: string;
  highest_education?: string;
  work_location?: string;
}

interface LoginResponse {
  access?: string;
  user?: UserType;
  requires_two_factor?: boolean;
  developer_otp?: string;
}

export class TwoFactorRequiredError extends Error {
  developerOtp?: string;
  constructor(developerOtp?: string) {
    super('Two-factor verification is required.');
    this.name = 'TwoFactorRequiredError';
    this.developerOtp = developerOtp;
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserType | null;
  accountType: AccountType | null;
  loading: boolean;
  login: (identifier: string, password: string, accountType?: AccountType, otp?: string) => Promise<UserType>;
  registerMember: (input: MemberRegistrationInput) => Promise<UserType>;
  requestOtp: (identifier: string, purpose?: string) => Promise<{ expires_in: number; developer_otp?: string }>;
  loginWithOtp: (identifier: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateUser: (updatedUser: Partial<UserType>) => void;
  hasAdminPermission: (permission: string) => boolean;
  hasAnyAdminPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeUser = (user: UserType, accountType: AccountType): UserType => ({
  ...user,
  account_type: user.account_type || accountType,
  admin_role: user.admin_role || (accountType === 'MEMBER' ? null : accountType),
  admin_role_name: user.admin_role_name || user.admin_role_display || null,
  admin_permissions: user.admin_permissions || [],
  is_staff: Boolean(user.is_staff || accountType !== 'MEMBER'),
  is_verified: Boolean(user.is_verified),
});

// Track restore attempts to prevent infinite loops
const RESTORE_MAX_ATTEMPTS = 3;
const RESTORE_RETRY_DELAY = 2000;

// Session inactivity timeout (30 minutes)
const SESSION_INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);
  const restoreAttempts = useRef(0);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const clearSessionLocal = useCallback(() => {
    sessionVersion.current += 1;
    clearClientAuthState();
    if (mountedRef.current) {
      setUser(null);
      setAccountType(null);
      setIsAuthenticated(false);
    }
  }, []);

  const commitSession = useCallback(async (type: AccountType, version: number) => {
    storeClientAuthState(type, '');
    const freshUser = await fetchApi<UserType>(`/${authNamespace(type)}/me/`, { skipAuthRefresh: true });
    if (!mountedRef.current || version !== sessionVersion.current) {
      throw new DOMException('A newer session replaced this request.', 'AbortError');
    }
    const normalized = normalizeUser(freshUser, type);
    if (mountedRef.current) {
      setUser(normalized);
      setAccountType(type);
      setIsAuthenticated(true);
    }
    return normalized;
  }, []);

  // Session inactivity timeout
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (isAuthenticated) {
      inactivityTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          clearSessionLocal();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:session-expired'));
          }
        }
      }, SESSION_INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, clearSessionLocal]);

  // Reset inactivity timer on user activity
  useEffect(() => {
    if (!isAuthenticated) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  // Restore session on mount
  useEffect(() => {
    let active = true;
    const restore = async () => {
      const type = getStoredAccountType();
      const hasAuthHint = typeof window !== 'undefined' && window.localStorage.getItem('mdp.auth.authenticated') === 'true';
      if (!type || !hasAuthHint) {
        if (active && mountedRef.current) {
          clearSessionLocal();
          setLoading(false);
        }
        return;
      }
      const version = sessionVersion.current;
      try {
        const restored = await fetchApi<UserType>(`/${authNamespace(type)}/me/`);
        if (!active || !mountedRef.current || version !== sessionVersion.current) return;
        if (mountedRef.current) {
          setUser(normalizeUser(restored, type));
          setAccountType(type);
          setIsAuthenticated(true);
        }
        restoreAttempts.current = 0; // Reset on success
      } catch {
        if (active && version === sessionVersion.current && mountedRef.current) {
          // Retry logic for transient failures
          if (restoreAttempts.current < RESTORE_MAX_ATTEMPTS) {
            restoreAttempts.current += 1;
            await new Promise(resolve => setTimeout(resolve, RESTORE_RETRY_DELAY));
            if (active && mountedRef.current) {
              return restore(); // Retry
            }
          }
          clearSessionLocal();
        }
      } finally {
        if (active && mountedRef.current) setLoading(false);
      }
    };
    void restore();
    // Listen for cross-tab auth changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mdp.auth.authenticated' || e.key === 'mdp.auth.accountType') {
        if (e.newValue === null) {
          // Logged out in another tab
          clearSessionLocal();
        } else if (e.newValue === 'true' && !isAuthenticated) {
          // Logged in in another tab - restore session
          setLoading(true);
          void restore();
        }
      }
    };
    const handleSessionExpired = () => {
      if (mountedRef.current) {
        clearSessionLocal();
        setLoading(false);
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.assign('/login');
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('auth:session-expired', handleSessionExpired);
    }
    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('auth:session-expired', handleSessionExpired);
      }
    };
  }, [clearSessionLocal, isAuthenticated]);

  const startNewSession = () => {
    sessionVersion.current += 1;
    beginAuthTransition();
    if (mountedRef.current) {
      setUser(null);
      setAccountType(null);
      setIsAuthenticated(false);
    }
    return sessionVersion.current;
  };

  const login = async (identifier: string, password: string, type: AccountType = 'MEMBER', otp?: string) => {
    setLoading(true);
    const version = startNewSession();
    try {
      const body = type === 'MEMBER'
        ? { identifier, password }
        : { email: identifier, password, ...(otp ? { otp } : {}) };
      const data = await fetchApi<LoginResponse>(`/${authNamespace(type)}/login/`, {
        method: 'POST', body: JSON.stringify(body), skipAuthRefresh: true,
      });
      if (data.requires_two_factor) throw new TwoFactorRequiredError(data.developer_otp);
      return await commitSession(type, version);
    } catch (error) {
      if (mountedRef.current) clearSessionLocal();
      throw error;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const registerMember = async (input: MemberRegistrationInput) => {
    setLoading(true);
    const version = startNewSession();
    try {
      const data = await fetchApi<LoginResponse & { user?: { id: string } }>('/member-auth/register/', {
        method: 'POST', body: JSON.stringify(input), skipAuthRefresh: true,
      });
      const registered = await commitSession('MEMBER', version);
      if (data.user && String(data.user.id) !== String(registered.id)) {
        throw new Error('Registration returned a mismatching session.');
      }
      return registered;
    } catch (error) {
      if (mountedRef.current) clearSessionLocal();
      throw error;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const requestOtp = (identifier: string, purpose = 'PHONE_VERIFY') =>
    fetchApi<{ expires_in: number; developer_otp?: string }>('/member-auth/otp/request/', {
      method: 'POST', body: JSON.stringify({ identifier, purpose }), skipAuthRefresh: true,
    });

  const loginWithOtp = async (identifier: string, otp: string) => {
    setLoading(true);
    const version = startNewSession();
    try {
      await fetchApi<LoginResponse>('/member-auth/otp/verify/', {
        method: 'POST',
        body: JSON.stringify({ identifier, code: otp, purpose: 'PASSWORDLESS_LOGIN' }),
        skipAuthRefresh: true,
      });
      await commitSession('MEMBER', version);
    } catch (error) {
      if (mountedRef.current) clearSessionLocal();
      throw error;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const logout = async () => {
    const type = accountType || getStoredAccountType();
    try {
      if (type) await fetchApi(`/${authNamespace(type)}/logout/`, { method: 'POST', body: '{}', skipAuthRefresh: true });
    } catch {
      // Cookie deletion is unconditional; local cleanup remains safe.
    } finally {
      if (mountedRef.current) clearSessionLocal();
      setLoading(false);
    }
  };

  const logoutAll = async () => {
    const type = accountType || getStoredAccountType();
    try {
      if (type) await fetchApi(`/${authNamespace(type)}/logout-all/`, { method: 'POST', body: '{}' });
    } finally {
      if (mountedRef.current) clearSessionLocal();
      setLoading(false);
    }
  };

  const updateUser = useCallback((updatedUser: Partial<UserType>) => {
    setUser((previous) => previous ? { ...previous, ...updatedUser } : null);
  }, []);

  const hasAdminPermission = useCallback((permission: string) => {
    if (!user) return false;
    if (user.account_type === 'SUPER_ADMIN' || user.is_superuser) return true;
    return user.admin_permissions.includes(permission);
  }, [user]);

  const hasAnyAdminPermission = useCallback((...permissionCodes: string[]) => {
    if (!permissionCodes.length) return Boolean(user && user.account_type !== 'MEMBER');
    return permissionCodes.some(hasAdminPermission);
  }, [hasAdminPermission, user]);

  return <AuthContext.Provider value={{
    isAuthenticated, user, accountType, loading, login, registerMember, requestOtp,
    loginWithOtp, logout, logoutAll, updateUser, hasAdminPermission, hasAnyAdminPermission,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}