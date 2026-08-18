import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { forwardToDjango } from '@/lib/django-proxy';


describe('Django proxy private image caching', () => {
  it('does not forward a stale bearer token to Super Admin login', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', upstreamFetch);
    const request = new NextRequest(
      'http://localhost/api/proxy/super-admin-auth/login',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer stale-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'owner@example.com', password: 'example-password' }),
      },
    );

    const response = await forwardToDjango(request, ['super-admin-auth', 'login']);
    const upstreamHeaders = new Headers(upstreamFetch.mock.calls[0][1].headers);

    expect(response.status).toBe(200);
    expect(upstreamHeaders.get('authorization')).toBeNull();
  });

  it('preserves private validators for a protected image response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=86400',
        ETag: '"photo-checksum"',
      },
    })));
    const request = new NextRequest(
      'http://localhost/api/proxy/profile-photos/00000000-0000-0000-0000-000000000001/image/',
      { headers: { Authorization: 'Bearer test-token' } },
    );

    const response = await forwardToDjango(request, [
      'profile-photos',
      '00000000-0000-0000-0000-000000000001',
      'image',
    ]);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(response.headers.get('etag')).toBe('"photo-checksum"');
  });

  it('keeps the same private cache policy on a conditional 304', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 304,
      headers: {
        'Cache-Control': 'private, max-age=86400',
        ETag: '"photo-checksum"',
      },
    })));
    const request = new NextRequest(
      'http://localhost/api/proxy/profile-photos/00000000-0000-0000-0000-000000000001/thumbnail/',
      { headers: { 'If-None-Match': '"photo-checksum"' } },
    );

    const response = await forwardToDjango(request, [
      'profile-photos',
      '00000000-0000-0000-0000-000000000001',
      'thumbnail',
    ]);

    expect(response.status).toBe(304);
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(response.headers.get('etag')).toBe('"photo-checksum"');
  });
});
