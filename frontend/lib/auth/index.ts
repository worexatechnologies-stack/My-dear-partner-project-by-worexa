export type AccountType = 'MEMBER' | 'SUPER_ADMIN' | 'ADMIN';

export interface AuthUser {
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
  admin_role: AccountType | null;
  admin_role_name?: string | null;
  admin_role_display?: string | null;
  admin_permissions: string[];
  is_active?: boolean;
  photo?: string;
  completion_percentage?: number;
  missing_fields?: string[];
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  accountType: AccountType | null;
  loading: boolean;
}

export const ROLE_HIERARCHY: Record<AccountType, number> = {
  MEMBER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

export const ROLE_LABELS: Record<AccountType, string> = {
  MEMBER: 'Member',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};

export const ROLE_DASHBOARD: Record<AccountType, string> = {
  MEMBER: '/dashboard',
  SUPER_ADMIN: '/super-admin/dashboard',
  ADMIN: '/admin/dashboard',
};

export const ROLE_LOGIN: Record<AccountType, string> = {
  MEMBER: '/login',
  SUPER_ADMIN: '/super-admin/login',
  ADMIN: '/admin/login',
};


export function hasRole(user: AuthUser | null, role: AccountType): boolean {
  if (!user) return false;
  return user.account_type === role;
}

export function hasAnyRole(user: AuthUser | null, roles: AccountType[]): boolean {
  if (!user) return false;
  return roles.includes(user.account_type);
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.account_type === 'SUPER_ADMIN' || user.is_superuser) return true;
  return user.admin_permissions.includes(permission);
}

export function hasAnyPermission(user: AuthUser | null, permissions: string[]): boolean {
  if (!permissions.length && user) return user.account_type !== 'MEMBER';
  return permissions.some((p) => hasPermission(user, p));
}

export function getDashboardPath(accountType: AccountType | null): string {
  if (!accountType) return '/login';
  return ROLE_DASHBOARD[accountType] || '/dashboard';
}

export function getLoginPath(accountType: AccountType | null): string {
  if (!accountType) return '/login';
  return ROLE_LOGIN[accountType] || '/login';
}

export function isValidReturnUrl(url: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, 'http://localhost');
    const { pathname } = parsed;
    if (pathname.startsWith('//')) return false;
    if (pathname.startsWith('/api/')) return false;
    if (pathname === '/login' || pathname === '/register') return false;
    return pathname.startsWith('/');
  } catch {
    return false;
  }
}
