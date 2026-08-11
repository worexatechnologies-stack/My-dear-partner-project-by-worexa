import { expect, test } from '@playwright/test';

test.describe('public and authentication routes', () => {
  test('renders public content without Django', async ({ request }) => {
    const response = await request.get('/about', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    await expect(response.text()).resolves.toContain('We Help');
  });

  for (const [path, copy] of [
    ['/login', 'Sign in to your member profile'],
    ['/admin/login', 'Sign in to your workspace'],
    ['/support/login', 'Sign in to your workspace'],
  ] as const) {
    test(`renders ${path}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(200);
      await expect(response.text()).resolves.toContain(copy);
    });
  }
});

test.describe('role-protected routing', () => {
  for (const [path, login] of [
    ['/dashboard', '/login'],
    ['/admin/dashboard', '/admin/login'],
    ['/super-admin/dashboard', '/super-admin/login'],
    ['/staff/tasks', '/staff/login'],
    ['/support/tickets', '/support/login'],
  ] as const) {
    test(`redirects unauthenticated ${path} requests`, async ({ request, baseURL }) => {
      const response = await request.get(`${path}?smoke=1`, { maxRedirects: 0 });
      const location = new URL(response.headers().location || '', baseURL || 'http://localhost:3000');

      expect(response.status()).toBe(307);
      expect(location.pathname).toBe(login);
      expect(location.searchParams.get('next')).toBe(`${path}?smoke=1`);
    });
  }

  test('rejects a portal cookie from the wrong account type', async ({ request, baseURL }) => {
    const response = await request.get('/admin/dashboard', {
      headers: { cookie: 'mdp_portal=MEMBER' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location || '', baseURL || 'http://localhost:3000').pathname).toBe('/403');
  });

  test('allows the matching account type through the middleware boundary', async ({ request }) => {
    const response = await request.get('/support/tickets', {
      headers: { cookie: 'mdp_portal=CUSTOMER_SUPPORT' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
  });
});
