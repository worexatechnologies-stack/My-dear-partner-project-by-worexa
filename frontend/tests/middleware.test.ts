import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy, routePolicy } from '@/proxy';

describe('routePolicy', () => {
  it.each([
    ['/dashboard', ['MEMBER'], '/login'],
    ['/profile/photos', ['MEMBER'], '/login'],
    ['/membership/status', ['MEMBER'], '/login'],
    ['/admin/dashboard', ['SUPER_ADMIN', 'ADMIN'], '/admin/login'],
    ['/super-admin/audit-logs', ['SUPER_ADMIN'], '/super-admin/login'],
  ])('maps %s to its role boundary', (pathname, roles, login) => {
    expect(routePolicy(pathname)).toEqual({ roles, login });
  });

  it.each([
    '/',
    '/about',
    '/membership',
    '/login',
    '/admin/login',
    '/super-admin/login',
    '/administrator',
  ])('leaves the public/auth route %s unrestricted', (pathname) => {
    expect(routePolicy(pathname)).toBeNull();
  });
});

describe('proxy', () => {
  it('redirects an unauthenticated member request and preserves its full return URL', () => {
    const request = new NextRequest('http://localhost:3000/messages/abc?view=unread');
    const response = proxy(request);
    const location = new URL(response.headers.get('location')!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/messages/abc?view=unread');
  });

  it('redirects paused back-office routes before checking portal role', () => {
    const request = new NextRequest('http://localhost:3000/admin/dashboard', {
      headers: { cookie: 'mdp_portal=MEMBER' },
    });
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/');
  });

  it('rejects a member-only support route when the portal cookie has the wrong role', () => {
    const request = new NextRequest('http://localhost:3000/support/tickets', {
      headers: { cookie: 'mdp_portal=CUSTOMER_SUPPORT' },
    });
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/403');
  });
});
