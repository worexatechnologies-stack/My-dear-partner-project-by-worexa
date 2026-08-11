import { baseApi } from './baseApi';

export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

export type ProfilePhotoStatus = 'pending' | 'approved' | 'rejected';

export interface MemberPhoto {
  id: string;
  image_url: string | null;
  thumbnail_url: string | null;
  is_primary: boolean;
  status: ProfilePhotoStatus;
  rejection_reason: string | null;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
  original_filename?: string | null;
  original_size_bytes?: number | null;
  compressed_size_bytes?: number | null;
  thumbnail_size_bytes?: number | null;
}

export interface MyPhotosResponse {
  photos: MemberPhoto[];
  count: number;
  max_photos: number;
}

export type ProfilePhotoUploadInput = File | FormData;
export interface ReplaceProfilePhotoInput {
  photoId: string;
  photo: ProfilePhotoUploadInput;
}

export interface RejectProfilePhotoInput {
  photoId: string;
  reason: string;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

/** Always creates the API's canonical `photo` multipart field. */
export function createProfilePhotoFormData(input: ProfilePhotoUploadInput): FormData {
  if (!isFormData(input)) {
    const formData = new FormData();
    formData.append('photo', input, input.name);
    return formData;
  }

  const file = input.get('photo') ?? input.get('image');
  if (!isBlob(file)) throw new Error('Choose a profile photo before uploading.');

  const formData = new FormData();
  const filename = typeof File !== 'undefined' && file instanceof File ? file.name : 'profile-photo';
  formData.append('photo', file, filename);
  return formData;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStatus(value: unknown): ProfilePhotoStatus {
  switch (String(value ?? '').toLowerCase()) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return 'pending';
  }
}

/**
 * Normalizes the new URL-and-metadata photo contract without ever accepting a
 * media path or inline image payload. If a response omits URLs, the component
 * can still use the id to construct its authenticated endpoint.
 */
export function normalizeMemberPhoto(value: unknown): MemberPhoto {
  const record = asRecord(value);
  let id = String(record.id ?? '');

  // Backend `get_photos` returns {url, is_primary} without an id key.
  // Also fall back to record.url when image_url is absent (same serializer quirk).
  const rawImageUrl =
    stringOrNull(record.image_url) ??
    stringOrNull(record.url) ??
    null;
  const rawThumbnailUrl =
    stringOrNull(record.thumbnail_url) ??
    stringOrNull(record.thumbnail) ??
    null;

  // If id is missing but we have a URL, extract the UUID from the path so
  // ProfileImage can still build a protectedEndpoint from it.
  if (!id && rawImageUrl) {
    const m = rawImageUrl.match(/profile-photos\/([\w-]+)\//);
    if (m) id = m[1];
  }

  const defaultImageUrl = id ? `/api/proxy/profile-photos/${encodeURIComponent(id)}/image/` : null;
  const defaultThumbnailUrl = id ? `/api/proxy/profile-photos/${encodeURIComponent(id)}/thumbnail/` : null;

  return {
    id,
    image_url: rawImageUrl ?? defaultImageUrl,
    thumbnail_url: rawThumbnailUrl ?? rawImageUrl ?? defaultThumbnailUrl,
    is_primary: Boolean(record.is_primary),
    status: normalizeStatus(record.status),
    rejection_reason: stringOrNull(record.rejection_reason),
    display_order: numberOr(record.display_order, 0),
    created_at: stringOrNull(record.created_at),
    updated_at: stringOrNull(record.updated_at) ?? stringOrNull(record.created_at),
    original_filename: stringOrNull(record.original_filename),
    original_size_bytes: typeof record.original_size_bytes === 'number' ? record.original_size_bytes : null,
    compressed_size_bytes: typeof record.compressed_size_bytes === 'number' ? record.compressed_size_bytes : null,
    thumbnail_size_bytes: typeof record.thumbnail_size_bytes === 'number' ? record.thumbnail_size_bytes : null,
  };
}

function photoPayload(response: unknown): Record<string, unknown> {
  const record = asRecord(response);
  if (record.data && typeof record.data === 'object') return asRecord(record.data);
  return record;
}

function normalizePhotosResponse(response: unknown): MyPhotosResponse {
  const payload = photoPayload(response);
  const rawPhotos = Array.isArray(payload) ? payload : payload.photos ?? payload.results ?? [];
  const photos = Array.isArray(rawPhotos)
    ? rawPhotos.map(normalizeMemberPhoto).filter((photo) => Boolean(photo.id))
    : [];

  return {
    photos,
    count: numberOr(payload.count, photos.length),
    max_photos: numberOr(payload.max_photos, 6),
  };
}

function normalizePhotoResponse(response: unknown): MemberPhoto {
  const payload = photoPayload(response);
  return normalizeMemberPhoto(payload.photo ?? payload);
}

export const photoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyPhotos: builder.query<MyPhotosResponse, void>({
      query: () => ({
        url: '/profile-photos/mine/',
        method: 'GET',
      }),
      transformResponse: normalizePhotosResponse,
      providesTags: ['MemberPhotos', 'UserProfile'],
    }),

    uploadPhoto: builder.mutation<MemberPhoto, ProfilePhotoUploadInput>({
      query: (photo) => ({
        url: '/profile-photos/',
        method: 'POST',
        body: createProfilePhotoFormData(photo),
      }),
      transformResponse: normalizePhotoResponse,
      invalidatesTags: ['MemberPhotos', 'UserProfile', 'VerificationStatus'],
    }),

    replacePhoto: builder.mutation<MemberPhoto, ReplaceProfilePhotoInput>({
      query: ({ photoId, photo }) => ({
        url: `/profile-photos/${encodeURIComponent(photoId)}/`,
        method: 'PATCH',
        body: createProfilePhotoFormData(photo),
      }),
      transformResponse: normalizePhotoResponse,
      invalidatesTags: ['MemberPhotos', 'UserProfile', 'VerificationStatus'],
    }),

    deletePhoto: builder.mutation<void, string>({
      query: (photoId) => ({
        url: `/profile-photos/${encodeURIComponent(photoId)}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MemberPhotos', 'UserProfile', 'VerificationStatus'],
    }),

    setPrimaryPhoto: builder.mutation<void, string>({
      query: (photoId) => ({
        url: `/profile-photos/${encodeURIComponent(photoId)}/set-primary/`,
        method: 'POST',
      }),
      invalidatesTags: ['MemberPhotos', 'UserProfile', 'VerificationStatus'],
    }),

    reorderPhotos: builder.mutation<void, string[]>({
      query: (photoIds) => ({
        url: '/profile-photos/reorder/',
        method: 'POST',
        body: { photo_ids: photoIds },
      }),
      invalidatesTags: ['MemberPhotos', 'UserProfile'],
    }),

    approveProfilePhoto: builder.mutation<MemberPhoto, string>({
      query: (photoId) => ({
        url: `/admin/profile-photos/${encodeURIComponent(photoId)}/approve/`,
        method: 'POST',
      }),
      transformResponse: normalizePhotoResponse,
      invalidatesTags: [
        'AdminVerifications',
        'StaffWork',
        'StaffDashboard',
        'MemberPhotos',
        'UserProfile',
      ],
    }),

    rejectProfilePhoto: builder.mutation<MemberPhoto, RejectProfilePhotoInput>({
      query: ({ photoId, reason }) => ({
        url: `/admin/profile-photos/${encodeURIComponent(photoId)}/reject/`,
        method: 'POST',
        body: { reason: reason.trim() },
      }),
      transformResponse: normalizePhotoResponse,
      invalidatesTags: [
        'AdminVerifications',
        'StaffWork',
        'StaffDashboard',
        'MemberPhotos',
        'UserProfile',
      ],
    }),
  }),
});

export const {
  useGetMyPhotosQuery,
  useUploadPhotoMutation,
  useReplacePhotoMutation,
  useDeletePhotoMutation,
  useSetPrimaryPhotoMutation,
  useReorderPhotosMutation,
  useApproveProfilePhotoMutation,
  useRejectProfilePhotoMutation,
} = photoApi;
