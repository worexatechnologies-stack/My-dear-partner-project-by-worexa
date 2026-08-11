import { expect, test, type Page, type Route } from '@playwright/test';

import { replacementPortraitPng, uploadPortraitPng } from './profile-photo-fixtures';

type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type PhotoRecord = {
  id: string;
  status: PhotoStatus;
  is_primary: boolean;
  display_order: number;
  updated_at: string;
  rejection_reason: string | null;
};

function photoPayload(photo: PhotoRecord) {
  const version = Date.parse(photo.updated_at);
  return {
    ...photo,
    image_url: `/api/profile-photos/${photo.id}/image/?v=${version}`,
    thumbnail_url: `/api/profile-photos/${photo.id}/thumbnail/?v=${version}`,
    created_at: '2026-07-17T10:00:00Z',
    compressed_size_bytes: 245_000,
    thumbnail_size_bytes: 42_000,
  };
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

async function configureMemberSession(page: Page) {
  await page.context().addCookies(['127.0.0.1', 'localhost'].map((domain) => ({
    name: 'mdp_portal',
    value: 'MEMBER',
    domain,
    path: '/',
  })));
  await page.addInitScript(() => {
    window.localStorage.setItem('mdp.auth.accountType', 'MEMBER');
    window.localStorage.setItem('mdp.auth.authenticated', 'true');
  });
}

test('complete private profile-photo lifecycle with refresh, moderation, replacement, and deletion', async ({ page }) => {
  await configureMemberSession(page);

  const photos: PhotoRecord[] = [{
    id: 'existing-primary',
    status: 'APPROVED',
    is_primary: true,
    display_order: 0,
    updated_at: '2026-07-17T10:00:00Z',
    rejection_reason: null,
  }];
  const thumbnailRequests: string[] = [];
  let uploadWasMultipart = false;

  await page.route('**/api/proxy/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    console.log('[MOCK REQ]', method, path);

    if (path === '/api/proxy/member-auth/me/') {
      return json(route, {
        success: true,
        data: {
          id: 'owner-member',
          email: 'owner@example.test',
          first_name: 'Owner',
          last_name: 'Member',
          full_name: 'Owner Member',
          account_type: 'MEMBER',
          admin_role: null,
          admin_permissions: [],
          is_verified: true,
          is_staff: false,
          is_active: true,
          gender: 'Female',
        },
      });
    }
    if (path === '/api/proxy/member-auth/token/refresh/') {
      return json(route, { success: true, data: { access: 'owner-access-token' } });
    }
    if (path === '/api/proxy/profile-photos/mine/' && method === 'GET') {
      return json(route, {
        success: true,
        data: { photos: photos.map(photoPayload), count: photos.length, max_photos: 6 },
      });
    }
    if (path === '/api/proxy/profile-photos/' && method === 'POST') {
      uploadWasMultipart = request.headers()['content-type']?.startsWith('multipart/form-data; boundary=') ?? false;
      photos.push({
        id: 'uploaded-photo',
        status: 'PENDING',
        is_primary: false,
        display_order: 1,
        updated_at: '2026-07-17T10:01:00Z',
        rejection_reason: null,
      });
      return json(route, { success: true, data: photoPayload(photos[1]) }, 201);
    }

    const binaryMatch = path.match(/^\/api\/proxy\/profile-photos\/([^/]+)\/(image|thumbnail)\/$/);
    if (binaryMatch && method === 'GET') {
      const photo = photos.find((item) => item.id === binaryMatch[1]);
      if (!photo) return json(route, { detail: 'Not found.' }, 404);
      const authorization = request.headers().authorization ?? '';
      const isOwner = authorization.includes('owner-access-token');
      if (!isOwner && photo.status !== 'APPROVED') {
        return json(route, { detail: 'Forbidden.' }, 403);
      }
      if (binaryMatch[2] === 'thumbnail') thumbnailRequests.push(request.url());
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: {
          'Cache-Control': 'private, max-age=86400',
          ETag: `"${photo.id}-${photo.updated_at}"`,
        },
        body: uploadPortraitPng,
      });
    }

    const approveMatch = path.match(/^\/api\/proxy\/admin\/profile-photos\/([^/]+)\/approve\/$/);
    if (approveMatch && method === 'POST') {
      const photo = photos.find((item) => item.id === approveMatch[1]);
      if (!photo) return json(route, { detail: 'Not found.' }, 404);
      photo.status = 'APPROVED';
      photo.rejection_reason = null;
      photo.updated_at = '2026-07-17T10:02:00Z';
      return json(route, { success: true, data: photoPayload(photo) });
    }

    const rejectMatch = path.match(/^\/api\/proxy\/admin\/profile-photos\/([^/]+)\/reject\/$/);
    if (rejectMatch && method === 'POST') {
      const photo = photos.find((item) => item.id === rejectMatch[1]);
      if (!photo) return json(route, { detail: 'Not found.' }, 404);
      photo.status = 'REJECTED';
      photo.rejection_reason = 'Face is obscured';
      photo.updated_at = '2026-07-17T10:04:00Z';
      return json(route, { success: true, data: photoPayload(photo) });
    }

    const primaryMatch = path.match(/^\/api\/proxy\/profile-photos\/([^/]+)\/set-primary\/$/);
    if (primaryMatch && method === 'POST') {
      for (const photo of photos) photo.is_primary = photo.id === primaryMatch[1];
      const selected = photos.find((photo) => photo.id === primaryMatch[1]);
      return json(route, { success: true, data: selected ? photoPayload(selected) : null });
    }

    const detailMatch = path.match(/^\/api\/proxy\/profile-photos\/([^/]+)\/$/);
    if (detailMatch && method === 'PATCH') {
      const photo = photos.find((item) => item.id === detailMatch[1]);
      if (!photo) return json(route, { detail: 'Not found.' }, 404);
      photo.status = 'PENDING';
      photo.rejection_reason = null;
      photo.updated_at = '2026-07-17T10:03:00Z';
      return json(route, { success: true, data: photoPayload(photo) });
    }
    if (detailMatch && method === 'DELETE') {
      const index = photos.findIndex((item) => item.id === detailMatch[1]);
      if (index < 0) return json(route, { detail: 'Not found.' }, 404);
      photos.splice(index, 1);
      return json(route, { success: true, data: {} });
    }

    if (path === '/api/proxy/member-auth/membership/summary/') {
      return json(route, { success: true, data: { is_free: true, photo_access_mode: 'PRIMARY_ONLY' } });
    }
    if (path === '/api/proxy/notifications/unread-count/') {
      return json(route, { success: true, data: { unread_count: 0 } });
    }
    return json(route, { success: true, data: {} });
  });

  await page.goto('/profile/photos');
  await expect(page.getByRole('heading', { name: 'Profile Photos' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('1 / 6 photos uploaded')).toBeVisible();

  await page.getByLabel('Choose profile photo to upload').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: uploadPortraitPng,
  });
  await expect(page.getByAltText('Preview of portrait.png')).toBeVisible();
  await page.getByRole('button', { name: 'Upload photo' }).click();

  await expect(page.getByText('2 / 6 photos uploaded')).toBeVisible();
  await expect(page.getByAltText('Profile photo 2')).toBeVisible();
  await expect(page.getByText('Under review')).toBeVisible();
  expect(uploadWasMultipart).toBe(true);
  expect(thumbnailRequests.some((url) => url.includes('/uploaded-photo/thumbnail/'))).toBe(true);

  const pendingViewerStatus = await page.evaluate(async () => {
    const response = await fetch('/api/proxy/profile-photos/uploaded-photo/image/', {
      headers: { Authorization: 'Bearer permitted-viewer' },
    });
    return response.status;
  });
  expect(pendingViewerStatus).toBe(403);

  await page.reload();
  await expect(page.getByAltText('Profile photo 2')).toBeVisible();
  await expect(page.getByText('2 / 6 photos uploaded')).toBeVisible();

  const approveStatus = await page.evaluate(async () => (
    await fetch('/api/proxy/admin/profile-photos/uploaded-photo/approve/', { method: 'POST' })
  ).status);
  expect(approveStatus).toBe(200);
  await page.reload();
  await expect(page.getByText('Approved').last()).toBeVisible();

  const approvedViewerStatus = await page.evaluate(async () => {
    const response = await fetch('/api/proxy/profile-photos/uploaded-photo/image/', {
      headers: { Authorization: 'Bearer permitted-viewer' },
    });
    return response.status;
  });
  expect(approvedViewerStatus).toBe(200);

  await page.getByRole('button', { name: 'Set profile photo 2 as primary' }).click();
  await expect(page.getByText('Primary')).toHaveCount(1);
  expect(photos.find((photo) => photo.id === 'uploaded-photo')?.is_primary).toBe(true);

  const beforeReplacementUrl = page.url();
  const replacementChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Replace profile photo 2' }).click();
  await (await replacementChooser).setFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: replacementPortraitPng,
  });
  await expect(page.getByText('Under review')).toBeVisible();
  expect(page.url()).toBe(beforeReplacementUrl);
  await expect.poll(() => thumbnailRequests.some((url) => (
    url.includes('/uploaded-photo/thumbnail/')
      && url.includes(`v=${Date.parse('2026-07-17T10:03:00Z')}`)
  ))).toBe(true);

  const replacementPendingStatus = await page.evaluate(async () => (
    await fetch('/api/proxy/profile-photos/uploaded-photo/image/', {
      headers: { Authorization: 'Bearer permitted-viewer' },
    })
  ).status);
  expect(replacementPendingStatus).toBe(403);

  const rejectStatus = await page.evaluate(async () => (
    await fetch('/api/proxy/admin/profile-photos/uploaded-photo/reject/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Face is obscured' }),
    })
  ).status);
  expect(rejectStatus).toBe(200);
  const rejectedViewerStatus = await page.evaluate(async () => (
    await fetch('/api/proxy/profile-photos/uploaded-photo/image/', {
      headers: { Authorization: 'Bearer permitted-viewer' },
    })
  ).status);
  expect(rejectedViewerStatus).toBe(403);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete profile photo 2' }).click();
  await expect(page.getByText('1 / 6 photos uploaded')).toBeVisible();
  await expect(page.getByAltText('Profile photo 2')).toHaveCount(0);

  const deletedStatus = await page.evaluate(async () => (
    await fetch('/api/proxy/profile-photos/uploaded-photo/image/', {
      headers: { Authorization: 'Bearer owner-access-token' },
    })
  ).status);
  expect(deletedStatus).toBe(404);
});
