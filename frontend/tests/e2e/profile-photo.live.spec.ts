import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Response as BrowserResponse,
} from '@playwright/test';

import { replacementPortraitPng, uploadPortraitPng } from './profile-photo-fixtures';

type AccountType = 'MEMBER' | 'SUPER_ADMIN' | 'ADMIN';
type Credentials = {
  accountType: AccountType;
  identifier: string;
  password: string;
  otp?: string;
};
type JsonRecord = Record<string, unknown>;

const LIVE_ENABLED = process.env.PROFILE_PHOTO_LIVE_E2E === '1';
const AUTH_NAMESPACE: Record<AccountType, string> = {
  MEMBER: 'member-auth',
  SUPER_ADMIN: 'super-admin-auth',
  ADMIN: 'admin-auth',
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`The live profile-photo E2E requires ${name}.`);
  return value;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

function responseData(value: unknown): JsonRecord {
  const envelope = record(value);
  return record(envelope.data ?? envelope);
}

type E2EResponse = APIResponse | BrowserResponse;

async function responseJson(response: E2EResponse): Promise<JsonRecord> {
  const text = await response.text();
  if (!text) return {};
  try {
    return record(JSON.parse(text));
  } catch {
    throw new Error(`${response.url()} returned non-JSON: ${text.slice(0, 300)}`);
  }
}

async function requireSuccess(response: E2EResponse, action: string): Promise<JsonRecord> {
  const payload = await responseJson(response);
  if (!response.ok() || payload.success === false) {
    throw new Error(`${action} failed (${response.status()}): ${JSON.stringify(payload).slice(0, 800)}`);
  }
  return responseData(payload);
}

function absoluteUrl(baseURL: string, path: string): string {
  return new URL(path, baseURL).toString();
}

async function loginThroughBff(
  context: BrowserContext,
  baseURL: string,
  credentials: Credentials,
): Promise<string> {
  const endpoint = absoluteUrl(baseURL, `/api/proxy/${AUTH_NAMESPACE[credentials.accountType]}/login/`);
  const loginBody = credentials.accountType === 'MEMBER'
    ? { identifier: credentials.identifier, password: credentials.password }
    : { email: credentials.identifier, password: credentials.password };
  let response = await context.request.post(endpoint, { data: loginBody });
  let data = responseData(await responseJson(response));

  if (data.requires_two_factor === true && typeof data.access !== 'string') {
    const otp = credentials.otp ?? (typeof data.developer_otp === 'string' ? data.developer_otp : undefined);
    if (!otp) {
      throw new Error(
        `${credentials.accountType} requires two-factor authentication; set PROFILE_PHOTO_E2E_ADMIN_OTP.`,
      );
    }
    response = await context.request.post(endpoint, { data: { ...loginBody, otp } });
    data = responseData(await responseJson(response));
  }

  if (!response.ok() || typeof data.access !== 'string') {
    throw new Error(
      `${credentials.accountType} live E2E login failed (${response.status()}): ${JSON.stringify(data).slice(0, 800)}`,
    );
  }

  await context.addInitScript((accountType: AccountType) => {
    window.localStorage.setItem('mdp.auth.accountType', accountType);
    window.localStorage.setItem('mdp.auth.authenticated', 'true');
  }, credentials.accountType);
  return data.access;
}

function authorization(access: string): Record<string, string> {
  return { Authorization: `Bearer ${access}` };
}

async function imageResponse(
  request: APIRequestContext,
  baseURL: string,
  photoId: string,
  variant: 'image' | 'thumbnail',
  access: string,
  extraHeaders: Record<string, string> = {},
): Promise<APIResponse> {
  return request.get(absoluteUrl(baseURL, `/api/proxy/profile-photos/${photoId}/${variant}/`), {
    headers: { ...authorization(access), ...extraHeaders },
  });
}

test.describe('live PostgreSQL profile-photo lifecycle', () => {
  test.skip(!LIVE_ENABLED, 'Set PROFILE_PHOTO_LIVE_E2E=1 to run against a real Next.js + Django + PostgreSQL stack.');

  test('upload, moderate, authorize, replace, make primary, and delete without API mocks', async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const baseURL = String(testInfo.project.use.baseURL ?? '');
    if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL (or the Playwright webServer base URL) is required.');

    const adminAccountType = (process.env.PROFILE_PHOTO_E2E_ADMIN_ACCOUNT_TYPE ?? 'SUPER_ADMIN') as AccountType;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(adminAccountType)) {
      throw new Error('PROFILE_PHOTO_E2E_ADMIN_ACCOUNT_TYPE must be SUPER_ADMIN or ADMIN.');
    }

    const member: Credentials = {
      accountType: 'MEMBER',
      identifier: requiredEnvironment('PROFILE_PHOTO_E2E_MEMBER_IDENTIFIER'),
      password: requiredEnvironment('PROFILE_PHOTO_E2E_MEMBER_PASSWORD'),
    };
    const viewer: Credentials = {
      accountType: 'MEMBER',
      identifier: requiredEnvironment('PROFILE_PHOTO_E2E_VIEWER_IDENTIFIER'),
      password: requiredEnvironment('PROFILE_PHOTO_E2E_VIEWER_PASSWORD'),
    };
    const admin: Credentials = {
      accountType: adminAccountType,
      identifier: requiredEnvironment('PROFILE_PHOTO_E2E_ADMIN_EMAIL'),
      password: requiredEnvironment('PROFILE_PHOTO_E2E_ADMIN_PASSWORD'),
      otp: process.env.PROFILE_PHOTO_E2E_ADMIN_OTP?.trim(),
    };

    const ownerContext = page.context();
    const viewerContext = await browser.newContext({ baseURL });
    const adminContext = await browser.newContext({ baseURL });
    let createdPhotoId: string | null = null;
    let ownerAccess = '';

    try {
      ownerAccess = await loginThroughBff(ownerContext, baseURL, member);
      const viewerAccess = await loginThroughBff(viewerContext, baseURL, viewer);
      const adminAccess = await loginThroughBff(adminContext, baseURL, admin);

      const beforeResponse = await ownerContext.request.get(
        absoluteUrl(baseURL, '/api/proxy/profile-photos/mine/'),
        { headers: authorization(ownerAccess) },
      );
      const before = await requireSuccess(beforeResponse, 'Loading the owner photo gallery');
      const initialPhotos = Array.isArray(before.photos) ? before.photos : [];
      if (initialPhotos.length >= 6) {
        throw new Error('The live E2E owner already has six photos. Remove one test-safe photo before running this suite.');
      }
      const newPhotoNumber = initialPhotos.length + 1;

      await page.goto('/profile/photos');
      await expect(page.getByRole('heading', { name: 'Profile Photos' })).toBeVisible();
      await page.getByLabel('Choose profile photo to upload').setInputFiles({
        name: `playwright-upload-${Date.now()}.png`,
        mimeType: 'image/png',
        buffer: uploadPortraitPng,
      });
      const preview = page.getByAltText(/Preview of playwright-upload-/);
      await expect(preview).toBeVisible();
      await expect.poll(() => preview.evaluate((image: HTMLImageElement) => (
        `${image.naturalWidth}x${image.naturalHeight}`
      ))).toBe('600x750');

      const uploadResponsePromise = page.waitForResponse((candidate) => {
        const url = new URL(candidate.url());
        return candidate.request().method() === 'POST' && url.pathname === '/api/proxy/profile-photos/';
      });
      await page.getByRole('button', { name: 'Upload photo' }).click();
      const uploadResponse = await uploadResponsePromise;
      const uploaded = await requireSuccess(uploadResponse, 'Uploading the profile photo');
      createdPhotoId = String(uploaded.id ?? '');
      if (!createdPhotoId) throw new Error('The upload response did not include a profile-photo id.');

      expect(uploaded.status).toBe('pending');
      expect(uploaded.width).toBe(1200);
      expect(uploaded.height).toBe(1500);
      expect(uploaded.thumbnail_width).toBe(240);
      expect(uploaded.thumbnail_height).toBe(300);
      expect(Number(uploaded.compressed_size_bytes)).toBeLessThanOrEqual(600 * 1024);
      expect(Number(uploaded.thumbnail_size_bytes)).toBeLessThanOrEqual(100 * 1024);

      const ownerThumbnail = await imageResponse(
        ownerContext.request,
        baseURL,
        createdPhotoId,
        'thumbnail',
        ownerAccess,
      );
      expect(ownerThumbnail.status()).toBe(200);
      expect(ownerThumbnail.headers()['content-type']).toContain('image/webp');
      expect(ownerThumbnail.headers()['cache-control']).toContain('private');
      expect((await ownerThumbnail.body()).byteLength).toBeLessThanOrEqual(100 * 1024);
      const thumbnailEtag = ownerThumbnail.headers().etag;
      expect(thumbnailEtag).toBeTruthy();
      const notModified = await imageResponse(
        ownerContext.request,
        baseURL,
        createdPhotoId,
        'thumbnail',
        ownerAccess,
        { 'If-None-Match': thumbnailEtag },
      );
      expect(notModified.status()).toBe(304);

      const galleryImage = page.getByAltText(`Profile photo ${newPhotoNumber}`);
      await expect(galleryImage).toBeVisible();
      await expect.poll(() => galleryImage.evaluate((image: HTMLImageElement) => (
        `${image.naturalWidth}x${image.naturalHeight}`
      ))).toBe('240x300');
      await expect(page.getByText('Under review', { exact: true }).last()).toBeVisible();

      expect((await imageResponse(
        viewerContext.request,
        baseURL,
        createdPhotoId,
        'image',
        viewerAccess,
      )).status()).toBe(403);

      await page.reload();
      await expect(galleryImage).toBeVisible();
      await expect.poll(() => galleryImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(240);

      const approvalResponse = await adminContext.request.post(
        absoluteUrl(baseURL, `/api/proxy/admin/profile-photos/${createdPhotoId}/approve/`),
        { headers: authorization(adminAccess) },
      );
      const approved = await requireSuccess(
        approvalResponse,
        'Approving the photo (check reviewer permission and branch scope)',
      );
      expect(approved.status).toBe('approved');

      const viewerApprovedImage = await imageResponse(
        viewerContext.request,
        baseURL,
        createdPhotoId,
        'image',
        viewerAccess,
      );
      expect(viewerApprovedImage.status()).toBe(200);
      expect(viewerApprovedImage.headers()['content-type']).toContain('image/webp');
      expect((await viewerApprovedImage.body()).byteLength).toBeLessThanOrEqual(600 * 1024);

      await page.reload();
      await expect(page.getByText('Approved', { exact: true }).last()).toBeVisible();
      const setPrimaryButton = page.getByRole('button', {
        name: `Set profile photo ${newPhotoNumber} as primary`,
      });
      if (await setPrimaryButton.count()) {
        const primaryResponsePromise = page.waitForResponse((candidate) => (
          candidate.request().method() === 'POST'
          && new URL(candidate.url()).pathname
            === `/api/proxy/profile-photos/${createdPhotoId}/set-primary/`
        ));
        await setPrimaryButton.click();
        await requireSuccess(await primaryResponsePromise, 'Setting the approved photo as primary through the UI');
      } else {
        const primaryResponse = await ownerContext.request.post(
          absoluteUrl(baseURL, `/api/proxy/profile-photos/${createdPhotoId}/set-primary/`),
          { headers: authorization(ownerAccess) },
        );
        await requireSuccess(primaryResponse, 'Confirming the already-primary approved photo');
        await page.reload();
      }
      await expect(page.getByText('Primary', { exact: true })).toHaveCount(1);

      const beforeReplacementUrl = page.url();
      const beforeReplacementSource = await galleryImage.getAttribute('src');
      const replacementResponsePromise = page.waitForResponse((candidate) => (
        candidate.request().method() === 'PATCH'
        && new URL(candidate.url()).pathname === `/api/proxy/profile-photos/${createdPhotoId}/`
      ));
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: `Replace profile photo ${newPhotoNumber}` }).click();
      await (await chooserPromise).setFiles({
        name: `playwright-replacement-${Date.now()}.png`,
        mimeType: 'image/png',
        buffer: replacementPortraitPng,
      });
      const replaced = await requireSuccess(await replacementResponsePromise, 'Replacing the profile photo');
      expect(page.url()).toBe(beforeReplacementUrl);
      expect(replaced.status).toBe('pending');
      expect(replaced.updated_at).not.toBe(uploaded.updated_at);
      await expect(page.getByText('Under review', { exact: true }).last()).toBeVisible();
      await expect.poll(() => galleryImage.getAttribute('src')).not.toBe(beforeReplacementSource);

      expect((await imageResponse(
        viewerContext.request,
        baseURL,
        createdPhotoId,
        'image',
        viewerAccess,
      )).status()).toBe(403);

      const rejectionReason = `Playwright replacement rejection ${Date.now()}`;
      const rejectionResponse = await adminContext.request.post(
        absoluteUrl(baseURL, `/api/proxy/admin/profile-photos/${createdPhotoId}/reject/`),
        {
          headers: authorization(adminAccess),
          data: { reason: rejectionReason },
        },
      );
      const rejected = await requireSuccess(rejectionResponse, 'Rejecting the replacement photo');
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejection_reason).toBe(rejectionReason);
      expect((await imageResponse(
        viewerContext.request,
        baseURL,
        createdPhotoId,
        'image',
        viewerAccess,
      )).status()).toBe(403);

      await page.reload();
      await expect(page.getByText('Rejected', { exact: true }).last()).toBeVisible();
      await expect(page.getByText(rejectionReason)).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      const deleteResponsePromise = page.waitForResponse((candidate) => (
        candidate.request().method() === 'DELETE'
        && new URL(candidate.url()).pathname === `/api/proxy/profile-photos/${createdPhotoId}/`
      ));
      await page.getByRole('button', { name: `Delete profile photo ${newPhotoNumber}` }).click();
      await requireSuccess(await deleteResponsePromise, 'Deleting the profile photo');
      const deletedPhotoId = createdPhotoId;
      createdPhotoId = null;
      await expect(galleryImage).toHaveCount(0);
      expect((await imageResponse(
        ownerContext.request,
        baseURL,
        deletedPhotoId,
        'image',
        ownerAccess,
      )).status()).toBe(404);
    } finally {
      if (createdPhotoId && ownerAccess) {
        await ownerContext.request.delete(
          absoluteUrl(baseURL, `/api/proxy/profile-photos/${createdPhotoId}/`),
          { headers: authorization(ownerAccess) },
        ).catch(() => undefined);
      }
      await viewerContext.close();
      await adminContext.close();
    }
  });
});
