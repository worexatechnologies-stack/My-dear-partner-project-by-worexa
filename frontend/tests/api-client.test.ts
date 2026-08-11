import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadClient() {
  vi.resetModules();
  return import('@/legacy/services/apiClient');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('browser auth state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('keeps JWTs in memory and persists only the non-sensitive portal hint', async () => {
    const client = await loadClient();
    client.storeClientAuthState('MEMBER', 'access-secret', 'refresh-secret');

    expect(client.getAccessToken()).toBe('access-secret');
    expect(client.getRefreshToken()).toBeNull();
    expect(window.localStorage.getItem(client.AUTH_STORAGE_KEYS.accountType)).toBe('MEMBER');
    expect(window.localStorage.getItem(client.AUTH_STORAGE_KEYS.authenticated)).toBe('true');
    expect(window.localStorage.getItem(client.AUTH_STORAGE_KEYS.access)).toBeNull();
    expect(window.localStorage.getItem(client.AUTH_STORAGE_KEYS.refresh)).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain('access-secret');
    expect(JSON.stringify(window.localStorage)).not.toContain('refresh-secret');
  });

  it('clears legacy credentials, cached session data, and notifies consumers', async () => {
    const client = await loadClient();
    const cacheClear = vi.fn();
    window.addEventListener('auth:cache-clear', cacheClear, { once: true });
    window.localStorage.setItem('accessToken', 'legacy-access');
    window.localStorage.setItem('refreshToken', 'legacy-refresh');
    window.localStorage.setItem('cachedUser', '{"id":1}');
    window.sessionStorage.setItem('mdp.auth.state', 'stale');
    window.sessionStorage.setItem('account-cache.member', 'stale');
    window.sessionStorage.setItem('unrelated', 'keep');
    client.storeClientAuthState('ADMIN', 'current-access');

    client.clearClientAuthState();

    expect(client.getAccessToken()).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem('mdp.auth.state')).toBeNull();
    expect(window.sessionStorage.getItem('account-cache.member')).toBeNull();
    expect(window.sessionStorage.getItem('unrelated')).toBe('keep');
    expect(cacheClear).toHaveBeenCalledOnce();
  });
});

describe('same-origin API client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('sends access credentials only to the same-origin proxy with safe fetch defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: 7 } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = await loadClient();
    client.storeClientAuthState('MEMBER', 'memory-only-token');

    await expect(client.fetchApi('/profiles/', {
      params: { page: 2, verified: true, empty: null },
    })).resolves.toEqual({ id: 7 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(url).toBe('/api/proxy/profiles/?page=2&verified=true');
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('coalesces simultaneous refreshes into one token rotation request', async () => {
    window.localStorage.setItem('mdp.auth.accountType', 'MEMBER');
    Object.defineProperty(window.navigator, 'locks', { configurable: true, value: undefined });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: { access: 'rotated-access' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = await loadClient();

    const tokens = await Promise.all([
      client.refreshAccessToken(),
      client.refreshAccessToken(),
      client.refreshAccessToken(),
    ]);

    expect(tokens).toEqual(['rotated-access', 'rotated-access', 'rotated-access']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/proxy/member-auth/token/refresh/',
      expect.objectContaining({ method: 'POST', credentials: 'include', cache: 'no-store' }),
    );
    expect(client.getAccessToken()).toBe('rotated-access');
  });

  it('sanitizes HTML/server failures and retains useful field validation', async () => {
    const { extractErrorMessage } = await loadClient();

    expect(extractErrorMessage('<html>debug traceback</html>', 500))
      .toBe("We couldn't complete your request right now. Please try again.");
    expect(extractErrorMessage({ email: ['Already registered.'], non_field_errors: ['Try again.'] }, 400))
      .toBe('Email: Already registered. Try again.');
  });
});
