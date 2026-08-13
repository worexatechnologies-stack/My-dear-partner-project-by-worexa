'use client';

import {
  friendlyMessage,
  statusMessage,
  networkErrorMessage,
  formatFieldErrors,
} from '@/lib/error-messages';
import {
  applyRetryAfter,
  resetAllThrottles,
} from '@/lib/request-throttle';

export type AccountType = 'MEMBER' | 'SUPER_ADMIN' | 'ADMIN';

const API_NAMESPACE: Record<AccountType, string> = {
  MEMBER: 'member-auth',
  SUPER_ADMIN: 'super-admin-auth',
  ADMIN: 'admin-auth',
};


export const AUTH_STORAGE_KEYS = {
  access: 'mdp.auth.access',
  refresh: 'mdp.auth.refresh',
  accountType: 'mdp.auth.accountType',
  authenticated: 'mdp.auth.authenticated',
} as const;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: unknown = null,
    public data: unknown = null,
    public code?: string | null,
    public requestId?: string | null,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isBrowser = () => typeof window !== 'undefined';
let accessToken: string | null = null;
let accountTypeHint: AccountType | null = null;
let refreshInFlight: Promise<string> | null = null;

function getFriendlyStatusMessage(status: number, retryAfter?: number): string {
  return statusMessage(status, retryAfter);
}

function fieldErrorsMessage(errors: Record<string, unknown>) {
  const formatted = formatFieldErrors(errors);
  return Object.entries(formatted)
    .map(([label, text]) => (label && label !== 'General' ? `${label}: ${text}` : text))
    .join(' ');
}

export function extractErrorMessage(data: unknown, status: number, retryAfter?: number): string {
  if (!data) return getFriendlyStatusMessage(status, retryAfter);
  if (typeof data === 'string') {
    return /<\/?[a-z][\s\S]*>/i.test(data)
      ? getFriendlyStatusMessage(status, retryAfter)
      : friendlyMessage({ message: data, status, retryAfter });
  }
  if (typeof data !== 'object') return getFriendlyStatusMessage(status, retryAfter);
  const record = data as Record<string, unknown>;
  if (!('message' in record) && !('code' in record) && !('errors' in record) && !('data' in record)) {
    return fieldErrorsMessage(record) || getFriendlyStatusMessage(status, retryAfter);
  }
  return friendlyMessage({
    code: typeof record.code === 'string' ? record.code : null,
    message: typeof record.message === 'string' ? record.message : null,
    status,
    // Some Django validation responses use field names at the top level,
    // while standardized responses nest them under `errors`.
    errors: record.errors ?? record,
    retryAfter,
  });
}

function persistPortalHint(type: AccountType | null) {
  accountTypeHint = type;
  if (!isBrowser()) return;
  if (type) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.accountType, type);
    window.localStorage.setItem(AUTH_STORAGE_KEYS.authenticated, 'true');
    document.cookie = `mdp_portal=${type}; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.accountType);
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.authenticated);
    document.cookie = 'mdp_portal=; path=/; max-age=0; SameSite=Lax';
  }
}

export const authNamespace = (accountType: AccountType) => API_NAMESPACE[accountType];
export const getAccessToken = () => accessToken;
export const getRefreshToken = (): null => null;

export const getStoredAccountType = (): AccountType | null => {
  if (accountTypeHint) return accountTypeHint;
  if (!isBrowser()) return null;
  const value = window.localStorage.getItem(AUTH_STORAGE_KEYS.accountType);
  if (!value || !(value in API_NAMESPACE)) return null;
  accountTypeHint = value as AccountType;
  return accountTypeHint;
};

export const storeClientAuthState = (type: AccountType, access: string, _refresh?: string) => {
  // Access JWTs intentionally stay in memory. The refresh JWT is held only
  // by the secure, HttpOnly cookie set by the Next.js proxy.
  accessToken = access;
  persistPortalHint(type);
};

export const clearClientAuthState = () => {
  accessToken = null;
  accountTypeHint = null;
  refreshInFlight = null;
  resetAllThrottles();
  if (!isBrowser()) return;

  try {
    const keysToRemove = [
      AUTH_STORAGE_KEYS.access,
      AUTH_STORAGE_KEYS.refresh,
      AUTH_STORAGE_KEYS.accountType,
      AUTH_STORAGE_KEYS.authenticated,
      'accessToken',
      'refreshToken',
      'cachedUser',
      'mdp.auth.userId',
      'register_draft',
      'edit_profile_draft',
      'mdp.e2e.private_key',
      'mdp.e2e.public_key',
    ];
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('mdp.') || key.startsWith('user_') || key.includes('draft')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage errors */
  }

  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith('mdp.') || key.startsWith('account-cache.') || key.startsWith('user_') || key.includes('draft')) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage errors */
  }

  const cookiesToClear = ['mdp_portal', 'csrftoken', 'sessionid', 'mdp_photo_access'];
  for (const cookieName of cookiesToClear) {
    document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`;
  }
  window.dispatchEvent(new Event('auth:cache-clear'));
};

export const beginAuthTransition = () => {
  clearClientAuthState();
  return 1;
};

function unwrapPayload(payload: unknown) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as Record<string, unknown>).data;
  }
  return payload;
}

function proxyUrl(endpoint: string, params?: FetchOptions['params']) {
  const [path, existingQuery = ''] = endpoint.split('?', 2);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Django API routes are slash-terminated. Preserve that contract so unsafe
  // methods are never redirected by APPEND_SLASH (which can lose a request
  // body or authentication context through an intermediate redirect).
  const cleanPath = normalizedPath === '/' ? '/' : `${normalizedPath.replace(/\/+$/, '')}/`;
  const search = new URLSearchParams(existingQuery);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return `/api/proxy${cleanPath}${query ? `?${query}` : ''}`;
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
  skipAuthRefresh?: boolean;
  _retried?: boolean;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (!raw) return null;
  if (!contentType.includes('application/json')) return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

// Token refresh with retry logic for production reliability
const MAX_REFRESH_RETRIES = 2;
const REFRESH_RETRY_DELAY = 1000;

export function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const accountType = getStoredAccountType();
  if (!accountType) return Promise.reject(new ApiError('Please sign in again.', 401));

  let retries = 0;
  const attemptRefresh = (): Promise<string> => {
    return fetch(`/api/proxy/${authNamespace(accountType)}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: '{}',
    }).then(async (response) => {
      const payload = await parseResponse(response);
      const data = unwrapPayload(payload) as Record<string, unknown> | null;
      if (!response.ok || !data || typeof data.access !== 'string') {
        // Retry on server errors (5xx) only
        if (response.status >= 500 && retries < MAX_REFRESH_RETRIES) {
          retries += 1;
          return new Promise(resolve => setTimeout(resolve, REFRESH_RETRY_DELAY)).then(attemptRefresh);
        }
        throw new ApiError(extractErrorMessage(payload, response.status), response.status, payload);
      }
      accessToken = data.access;
      return data.access;
    });
  };

  refreshInFlight = attemptRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const getFreshAccessToken = () => accessToken ? Promise.resolve(accessToken) : refreshAccessToken();

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set('X-CSRFToken', csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(proxyUrl(endpoint, options.params), {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    const navigatorOffline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? !navigator.onLine
        : false;
    throw new ApiError(
      networkErrorMessage(navigatorOffline),
      0,
      null,
      null,
      'NETWORK_ERROR',
      null,
      undefined,
    );
  }
  const payload = await parseResponse(response);

  if (response.status === 401 && !options.skipAuthRefresh && !options._retried && getStoredAccountType()) {
    try {
      await refreshAccessToken();
      return fetchApi<T>(endpoint, { ...options, _retried: true });
    } catch {
      clearClientAuthState();
      window.dispatchEvent(new Event('auth:session-expired'));
    }
  }

  const envelope = payload as Record<string, unknown> | null;
  if (!response.ok || (envelope && envelope.success === false)) {
    const retryAfter = response.headers.get('Retry-After');
    const retryAfterNum = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;

    // Apply Retry-After cooldown for 429 responses
    if (response.status === 429 && retryAfterNum) {
      applyRetryAfter(endpoint, retryAfterNum);
    }

    const meta =
      envelope && typeof envelope.meta === 'object' && envelope.meta
        ? (envelope.meta as Record<string, unknown>)
        : null;
    const requestId =
      (typeof meta?.request_id === 'string' ? meta.request_id : null) ??
      response.headers.get('X-Request-ID') ??
      null;
    const code =
      envelope && typeof envelope.code === 'string' ? envelope.code : undefined;
    throw new ApiError(
      extractErrorMessage(payload, response.status, retryAfterNum),
      response.status,
      envelope?.errors ?? payload,
      envelope?.data ?? null,
      code,
      requestId,
      Number.isFinite(retryAfterNum) ? retryAfterNum : undefined,
    );
  }
  return unwrapPayload(payload) as T;
}
