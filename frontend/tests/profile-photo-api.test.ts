import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';

import {
  createProfilePhotoFormData,
  normalizeMemberPhoto,
  photoApi,
} from '@/legacy/services/photoApi';
import { profilePhotoEndpoint } from '@/components/profile/ProfileImage';
import { baseApi } from '@/legacy/services/baseApi';

describe('profile photo API contract', () => {
  it('uses the canonical photo multipart field', () => {
    const file = new File(['image-bytes'], 'portrait.jpg', { type: 'image/jpeg' });
    const formData = createProfilePhotoFormData(file);

    const uploaded = formData.get('photo');
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe('portrait.jpg');
    expect((uploaded as File).type).toBe('image/jpeg');
    expect(formData.get('image')).toBeNull();
  });

  it('preserves endpoint URLs and normalizes moderation metadata', () => {
    const photo = normalizeMemberPhoto({
      id: 'photo-123',
      image_url: '/api/profile-photos/photo-123/image/',
      thumbnail_url: '/api/profile-photos/photo-123/thumbnail/',
      status: 'APPROVED',
      is_primary: true,
      display_order: 2,
      rejection_reason: null,
      updated_at: '2026-07-17T10:00:00Z',
    });

    expect(photo).toMatchObject({
      id: 'photo-123',
      image_url: '/api/profile-photos/photo-123/image/',
      thumbnail_url: '/api/profile-photos/photo-123/thumbnail/',
      status: 'approved',
      is_primary: true,
      display_order: 2,
      updated_at: '2026-07-17T10:00:00Z',
    });
  });

  it('uses an ID-based proxy URL with a replacement version', () => {
    expect(profilePhotoEndpoint('photo/123', 'thumbnail', '2026-07-17T10:00:00Z')).toBe(
      `/api/proxy/profile-photos/photo%2F123/thumbnail/?v=${Date.parse('2026-07-17T10:00:00Z')}`,
    );
  });

  it('keeps a multipart upload as FormData through the base API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { id: 'new-photo', status: 'PENDING' },
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    });
    const file = new File(['image-bytes'], 'portrait.webp', { type: 'image/webp' });

    await store.dispatch(photoApi.endpoints.uploadPhoto.initiate(file)).unwrap();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/proxy/profile-photos/');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Headers).has('Content-Type')).toBe(false);
  });

  it('replaces a photo with multipart PATCH while preserving its endpoint id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        id: 'photo-to-replace',
        status: 'PENDING',
        updated_at: '2026-07-17T12:00:01Z',
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    });
    const replacement = new File(['replacement-bytes'], 'replacement.png', { type: 'image/png' });

    const result = await store.dispatch(photoApi.endpoints.replacePhoto.initiate({
      photoId: 'photo-to-replace',
      photo: replacement,
    })).unwrap();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/proxy/profile-photos/photo-to-replace/');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Headers).has('Content-Type')).toBe(false);
    expect(result.updated_at).toBe('2026-07-17T12:00:01Z');
  });
});
