import { serverEnv } from '@/config/env';

type ApiEnvelope<T> = { success?: boolean; data?: T; message?: string };

export async function fetchPublicApi<T>(endpoint: string, revalidate = 300): Promise<T> {
  const base = serverEnv.INTERNAL_API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`Public API request failed with ${response.status}.`);
  const payload = await response.json() as ApiEnvelope<T> | T;
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const wrapped = payload as ApiEnvelope<T>;
    if (wrapped.success === false || wrapped.data === undefined) throw new Error(wrapped.message || 'Public API request failed.');
    return wrapped.data;
  }
  return payload as T;
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
