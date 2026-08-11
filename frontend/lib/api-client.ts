'use client';

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
    public code?: string,
    public errors?: Record<string, string[]> | null,
    public requestId?: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email/mobile number or password is incorrect.',
  AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  RESOURCE_NOT_FOUND: 'The requested information could not be found.',
  METHOD_NOT_ALLOWED: 'This action is not supported.',
  PARSE_ERROR: 'The request could not be processed.',
  RATE_LIMITED: 'Too many attempts. Please try again shortly.',
  CONFLICT: 'This action conflicts with the current state.',
  DUPLICATE_EMAIL: 'This email address is already registered.',
  DUPLICATE_MOBILE: 'This mobile number is already registered.',
  DUPLICATE_PHOTO: 'This photo has already been uploaded.',
  DUPLICATE_RECORD: 'This record already exists.',
  DATA_ERROR: 'The provided data is invalid.',
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  SERVICE_UNAVAILABLE: 'Server is down. Please try again later.',
  BAD_GATEWAY: 'The server returned an invalid response. Please try again.',
  GATEWAY_TIMEOUT: 'The request took too long. Please try again.',
  INTERNAL_SERVER_ERROR: "We couldn't complete your request right now. Please try again.",
};

export function getErrorMessage(code: string | undefined, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return fallback || 'An unexpected error occurred. Please try again.';
}

export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    email: 'Email',
    mobile_number: 'Mobile Number',
    first_name: 'First Name',
    last_name: 'Last Name',
    password: 'Password',
    confirm_password: 'Confirm Password',
    gender: 'Gender',
    date_of_birth: 'Date of Birth',
    about: 'About Me',
    religion: 'Religion',
    mother_tongue: 'Mother Tongue',
    caste: 'Caste',
    highest_education: 'Highest Education',
    occupation: 'Occupation',
    annual_income: 'Annual Income',
    work_location: 'Work Location',
    marital_status: 'Marital Status',
    height: 'Height',
    weight: 'Weight',
    city: 'City',
    state: 'State',
    country: 'Country',
    photo: 'Photo',
    document: 'Document',
    otp: 'Verification Code',
    identifier: 'Email or Mobile Number',
    email_or_mobile: 'Email or Mobile Number',
    current_password: 'Current Password',
    new_password: 'New Password',
    non_field_errors: 'General',
  };
  return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFieldErrors(errors: Record<string, string[]> | null | undefined): Record<string, string> {
  if (!errors) return {};
  const formatted: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors)) {
    const label = getFieldLabel(field);
    formatted[field] = messages.filter((m) => typeof m === 'string').join('. ');
  }
  return formatted;
}

const isBrowser = () => typeof window !== 'undefined';
let accessToken: string | null = null;
let accountTypeHint: AccountType | null = null;
let refreshInFlight: Promise<string> | null = null;

export const authNamespace = (accountType: AccountType) => API_NAMESPACE[accountType];
export const getAccessToken = () => accessToken;

export const getStoredAccountType = (): AccountType | null => {
  if (accountTypeHint) return accountTypeHint;
  if (!isBrowser()) return null;
  const value = window.localStorage.getItem(AUTH_STORAGE_KEYS.accountType);
  if (!value || !(value in API_NAMESPACE)) return null;
  accountTypeHint = value as AccountType;
  return accountTypeHint;
};

export const storeClientAuthState = (type: AccountType, access: string) => {
  accessToken = access;
  accountTypeHint = type;
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_STORAGE_KEYS.accountType, type);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.authenticated, 'true');
  document.cookie = `mdp_portal=${type}; path=/; max-age=31536000; SameSite=Lax`;
};

export const clearClientAuthState = () => {
  accessToken = null;
  accountTypeHint = null;
  refreshInFlight = null;
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
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }

  const cookiesToClear = ['mdp_portal', 'csrftoken', 'sessionid', 'mdp_photo_access'];
  for (const cookieName of cookiesToClear) {
    document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`;
  }
  window.dispatchEvent(new Event('auth:cache-clear'));
};

function proxyUrl(endpoint: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const [path, existingQuery = ''] = endpoint.split('?', 2);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams(existingQuery);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const canonicalPath = normalizedPath === '/' ? '/' : `${normalizedPath.replace(/\/+$/, '')}/`;
  const query = search.toString();
  return `/api/proxy${canonicalPath}${query ? `?${query}` : ''}`;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (!raw) return { data: null, meta: null };
  if (!contentType.includes('application/json')) return { data: raw, meta: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      data: 'data' in parsed ? parsed.data : parsed,
      meta: 'meta' in parsed ? (parsed.meta as Record<string, unknown> ?? null) : null,
      code: 'code' in parsed ? parsed.code as string : undefined,
      errors: 'errors' in parsed ? parsed.errors as Record<string, string[]> : undefined,
      message: 'message' in parsed ? parsed.message as string : undefined,
      success: 'success' in parsed ? parsed.success as boolean : true,
    };
  } catch {
    return { data: raw, meta: null };
  }
}

export function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const accountType = getStoredAccountType();
  if (!accountType) return Promise.reject(new ApiError('Please sign in again.', 401, 'AUTHENTICATION_REQUIRED'));

  refreshInFlight = fetch(`/api/proxy/${authNamespace(accountType)}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: '{}',
  }).then(async (response) => {
    const parsed = await parseResponse(response);
    const data = parsed.data as Record<string, unknown> | null;
    if (!response.ok || !data || typeof data.access !== 'string') {
      throw new ApiError(
        parsed.message || 'Session expired.',
        response.status,
        parsed.code || 'TOKEN_EXPIRED',
        parsed.errors,
      );
    }
    accessToken = data.access as string;
    return data.access as string;
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const getFreshAccessToken = () => accessToken ? Promise.resolve(accessToken) : refreshAccessToken();

export async function fetchApi<T>(endpoint: string, options: {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string> | Headers;
  params?: Record<string, string | number | boolean | null | undefined>;
  skipAuthRefresh?: boolean;
  signal?: AbortSignal;
} = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(proxyUrl(endpoint, options.params), {
      method: options.method || 'GET',
      headers,
      body: options.body,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      "We couldn't connect to the server. Check your connection and try again.",
      0,
      'NETWORK_ERROR',
    );
  }

  const parsed = await parseResponse(response);

  if (response.status === 401 && !options.skipAuthRefresh && getStoredAccountType()) {
    try {
      await refreshAccessToken();
      return fetchApi<T>(endpoint, { ...options, skipAuthRefresh: true });
    } catch {
      clearClientAuthState();
      window.dispatchEvent(new Event('auth:session-expired'));
      throw new ApiError(
        'Your session has expired. Please sign in again.',
        401,
        'SESSION_EXPIRED',
      );
    }
  }

  if (!response.ok || parsed.success === false) {
    throw new ApiError(
      parsed.message || 'An error occurred.',
      response.status,
      parsed.code || 'UNKNOWN_ERROR',
      parsed.errors || null,
      (parsed.meta as { request_id?: string })?.request_id,
    );
  }

  return parsed.data as T;
}
