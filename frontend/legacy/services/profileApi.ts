import { baseApi } from './baseApi';
import { normalizeMemberPhoto, type MemberPhoto } from './photoApi';

/**
 * Profile data from API
 */
export interface MemberProfile {
  id: string;
  user: {
    id: string;
    full_name: string;
    photo: string;
    primary_photo?: MemberPhoto | null;
    phone?: string;
    email?: string;
  };
  gender: string;
  date_of_birth: string | null;
  age: number;
  height: string;
  marital_status: string;
  family_type: string;
  profile_status: string;
  is_verified: boolean;
  location: {
    city: string;
    state: string;
    country: string;
  };
  education: string;
  occupation: string;
  annual_income: string;
  religion: string;
  caste: string;
  complexion: string;
  blood_group: string;
  hobbies: string[];
  about: string;
  compatibility_score?: number;
  contact_visible?: boolean;
  can_message?: boolean;
  can_view_contact?: boolean;
  photos?: MemberPhoto[];
}

/**
 * Daily unlock usage
 */
export interface UnlockUsage {
  daily_limit: number | null;
  used_today: number;
  remaining_today: number | null;
  resets_at: string;
  interest_limit?: number | null;
  interest_used_today?: number;
  interest_remaining_today?: number | null;
}

/**
 * Profile detail response
 */
export interface ProfileDetailResponse {
  profile: MemberProfile;
  usage: UnlockUsage;
}

/**
 * Unlock error response (403)
 */
export interface UnlockError {
  code: 'daily_profile_unlock_limit_reached';
  message: string;
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
}

/**
 * Profile API endpoints
 */
export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get profile detail with auto-unlock
    getProfileDetail: builder.query<ProfileDetailResponse, string>({
      query: (profileId) => ({
        url: `/profiles/${profileId}/`,
        method: 'GET',
      }),
      transformResponse: (response: any): ProfileDetailResponse => {
        const member = response.profile ?? {};
        const access = response.access ?? {};
        const photos = Array.isArray(member.photos)
          ? member.photos.map(normalizeMemberPhoto).filter((photo: MemberPhoto) => Boolean(photo.id))
          : [];
        const primaryPhoto = member.primary_photo
          ? normalizeMemberPhoto(member.primary_photo)
          : photos.find((photo: MemberPhoto) => photo.is_primary) ?? null;
        if (primaryPhoto?.id && !photos.some((photo: MemberPhoto) => photo.id === primaryPhoto.id)) {
          photos.unshift(primaryPhoto);
        }
        return {
          // The member API returns a flat public-member object.  The detail
          // page uses a nested view model, so adapt it once at the boundary.
          profile: {
            ...member,
            user: {
              id: member.id,
              full_name: member.full_name,
              photo: primaryPhoto?.thumbnail_url ?? member.photo ?? '',
              primary_photo: primaryPhoto?.id ? primaryPhoto : null,
              phone: member.mobile_number ?? member.phone,
              email: member.email,
              is_verified: member.is_verified,
              is_premium: member.is_premium,
            },
            location: {
              city: member.work_location ?? '',
              state: '',
              country: '',
            },
            education: member.highest_education,
            income: member.annual_income,
            photos,
            can_message: Boolean(access.can_message),
            can_view_contact: access.contact_access_mode !== 'none',
          } as MemberProfile,
          usage: {
            daily_limit: access.daily_unlock_limit,
            used_today: access.unlocks_used_today,
            remaining_today: access.unlocks_remaining_today,
            resets_at: access.resets_at,
          },
        };
      },
      providesTags: (result, error, profileId) => [
        { type: 'ProfileDetail', id: profileId },
      ],
    }),

    // Get daily unlock usage
    getUnlockUsage: builder.query<UnlockUsage, void>({
      query: () => ({
        url: '/profile-unlocks/daily-usage/',
        method: 'GET',
      }),
      transformResponse: (response: any) => response,
      providesTags: ['UnlockUsage'],
    }),

    // Send interest to profile
    sendInterest: builder.mutation<
      { success: boolean; message: string; data: any },
      string
    >({
      query: (targetProfileId) => ({
        url: '/interests/',
        method: 'POST',
        body: { receiver_id: targetProfileId },
      }),
      invalidatesTags: ['UnlockUsage'],
    }),

    // Get profile unlock history
    getUnlockHistory: builder.query<
      Array<{
        id: string;
        profile_id: string;
        profile_name: string;
        unlocked_at: string;
        source: string;
      }>,
      void
    >({
      query: () => ({
        url: '/profile-unlocks/history/',
        method: 'GET',
      }),
      transformResponse: (response: any) => response,
      providesTags: ['UnlockHistory'],
    }),

    // Report a profile
    reportProfile: builder.mutation<
      { success: boolean; message: string },
      { profileId: string; reason: string; description?: string }
    >({
      query: ({ profileId, reason, description }) => ({
        url: '/profile-reports/',
        method: 'POST',
        body: {
          reported_member: profileId,
          reason,
          details: description,
        },
      }),
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetProfileDetailQuery,
  useGetUnlockUsageQuery,
  useSendInterestMutation,
  useGetUnlockHistoryQuery,
  useReportProfileMutation,
} = profileApi;
