import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';

import { baseApi } from '@/legacy/services/baseApi';
import { photoApi } from '@/legacy/services/photoApi';
import { normalizeStaffWorkResponse } from '@/legacy/services/staffApi';

function testStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function photoResponse(status: string, rejectionReason: string | null = null) {
  return new Response(JSON.stringify({
    success: true,
    data: {
      id: 'photo-123',
      status,
      rejection_reason: rejectionReason,
      image_url: '/api/profile-photos/photo-123/image/',
      thumbnail_url: '/api/profile-photos/photo-123/thumbnail/',
      updated_at: '2026-07-17T10:00:00Z',
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('profile photo moderation API', () => {
  it('approves one ProfilePhoto through the canonical endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(photoResponse('APPROVED'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await testStore().dispatch(
      photoApi.endpoints.approveProfilePhoto.initiate('photo-123'),
    ).unwrap();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/proxy/admin/profile-photos/photo-123/approve/');
    expect(init.method).toBe('POST');
    expect(result.status).toBe('approved');
  });

  it('sends the required trimmed reason when rejecting one ProfilePhoto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(photoResponse('REJECTED', 'Face is obscured'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await testStore().dispatch(
      photoApi.endpoints.rejectProfilePhoto.initiate({
        photoId: 'photo/123',
        reason: '  Face is obscured  ',
      }),
    ).unwrap();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/proxy/admin/profile-photos/photo%2F123/reject/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Face is obscured' });
    expect(result).toMatchObject({ status: 'rejected', rejection_reason: 'Face is obscured' });
  });

  it('normalizes only assigned photo metadata on staff work records', () => {
    const response = normalizeStaffWorkResponse({
      count: 1,
      results: [{
        id: 'assignment-1',
        assignment_type: 'PHOTO_VERIFICATION',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        created_at: '2026-07-17T10:00:00Z',
        profile_photos: [{
          id: 'photo-123',
          status: 'PENDING',
          is_primary: true,
          display_order: 0,
          image_url: '/api/profile-photos/photo-123/image/',
          thumbnail_url: '/api/profile-photos/photo-123/thumbnail/',
        }],
      }],
    });

    expect(response.results[0].profile_photos).toEqual([
      expect.objectContaining({ id: 'photo-123', status: 'pending', is_primary: true }),
    ]);
  });
});
