import { baseApi } from './baseApi';
import { normalizeMemberPhoto, type MemberPhoto } from './photoApi';

export interface CompatibilityInsight {
  compatibility_score: number;
  confidence: 'high' | 'medium' | 'low';
  data_completeness: number;
  shared_strengths: string[];
  considerations: string[];
  summary: string;
  explanation: string;
  factors?: Record<string, {
    weight: number;
    score: number;
    candidate_val?: any;
    preference_val?: any;
    match_type?: string;
  }>;
}

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
  education_detail?: string;
  occupation: string;
  employed_in?: string;
  company?: string;
  annual_income: string;
  income?: string;
  religion: string;
  caste: string;
  sub_caste?: string;
  gothra?: string;
  star_nakshatra?: string;
  manglik_status?: string;
  family_status?: string;
  father_status?: string;
  mother_status?: string;
  num_brothers?: number;
  num_sisters?: number;
  family_location?: string;
  mother_tongue?: string;
  weight?: string | number;
  complexion?: string;
  blood_group?: string;
  profile_created_by?: string;
  hobbies: string[];
  about: string;
  compatibility_score?: number;
  compatibility?: CompatibilityInsight;
  contact_visible?: boolean;
  can_message?: boolean;
  can_view_contact?: boolean;
  can_view_full_profile?: boolean;
  full_bio_locked?: boolean;
  partner_preferences?: {
    preferred_age_min?: number;
    preferred_age_max?: number;
    preferred_height_min?: string;
    preferred_height_max?: string;
    preferred_religion?: string;
    preferred_caste?: string;
    preferred_location?: string;
    preferred_education?: string;
    preferred_occupation?: string;
    preferred_marital_status?: string;
    additional_expectations?: string;
  } | null;
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
  compatibility?: CompatibilityInsight;
  interest?: {
    state: 'SENT' | 'RECEIVED' | 'ACCEPTED' | 'DECLINED' | null;
    id: string | null;
    interestId: string | null;
    direction: 'sent' | 'received' | null;
  } | null;
}

interface InterestResponse {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
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
        const rawCompat = response.compatibility ?? member.compatibility;
        let compatData: CompatibilityInsight | undefined = undefined;
        if (typeof rawCompat === 'object' && rawCompat !== null) {
          compatData = {
            compatibility_score: Number(rawCompat.compatibility_score ?? member.compatibility_score ?? 0),
            confidence: (rawCompat.confidence as 'high' | 'medium' | 'low') ?? 'medium',
            data_completeness: Number(rawCompat.data_completeness ?? 100),
            shared_strengths: Array.isArray(rawCompat.shared_strengths) ? rawCompat.shared_strengths : [],
            considerations: Array.isArray(rawCompat.considerations) ? rawCompat.considerations : [],
            summary: rawCompat.summary ?? '',
            explanation: rawCompat.explanation ?? '',
            factors: rawCompat.factors ?? {},
          };
        } else if (typeof rawCompat === 'number' || typeof member.compatibility_score === 'number') {
          const score = Number(rawCompat ?? member.compatibility_score ?? 0);
          compatData = {
            compatibility_score: score,
            confidence: 'medium',
            data_completeness: 100,
            shared_strengths: [],
            considerations: [],
            summary: '',
            explanation: '',
          };
        }

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
            compatibility: compatData,
            compatibility_score: compatData?.compatibility_score ?? member.compatibility_score,
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
            can_view_full_profile: member.can_view_full_profile !== undefined ? Boolean(member.can_view_full_profile) : Boolean(access.can_view_full_profile ?? true),
            full_bio_locked: Boolean(member.full_bio_locked),
          } as MemberProfile,
          compatibility: compatData,
          usage: {
            daily_limit: access.daily_unlock_limit,
            used_today: access.unlocks_used_today,
            remaining_today: access.unlocks_remaining_today,
            resets_at: access.resets_at,
          },
          interest: (() => {
            const raw = response.interest || access.interest;
            if (!raw || !raw.state) return null;
            return {
              state: raw.state,
              id: raw.id || raw.interestId || null,
              interestId: raw.interestId || raw.id || null,
              direction: raw.direction || null,
            };
          })(),
        };
      },
      providesTags: (result, error, profileId) => [
        { type: 'ProfileDetail', id: profileId },
      ],
    }),

    // Get real-time dynamic compatibility analysis
    getCompatibilityDetail: builder.query<CompatibilityInsight, string>({
      query: (candidateId) => ({
        url: `/matches/${candidateId}/compatibility/`,
        method: 'GET',
      }),
      transformResponse: (response: any): CompatibilityInsight => response.data ?? response,
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
      InterestResponse,
      string
    >({
      query: (targetProfileId) => ({
        url: '/interests/',
        method: 'POST',
        body: { receiver_id: targetProfileId },
      }),
      invalidatesTags: (_result, _error, targetProfileId) => [
        'UnlockUsage',
        { type: 'ProfileDetail', id: targetProfileId },
      ],
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
  useGetCompatibilityDetailQuery,
  useGetUnlockUsageQuery,
  useSendInterestMutation,
  useGetUnlockHistoryQuery,
  useReportProfileMutation,
} = profileApi;
