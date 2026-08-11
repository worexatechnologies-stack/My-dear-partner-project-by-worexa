import { baseApi } from './baseApi';

export interface MemberEntitlements {
  plan_id: string | null;
  plan_name: string;
  plan_slug: string;
  daily_profile_view_limit: number | null;
  can_send_interest: boolean;
  daily_interest_limit: number | null;
  can_chat: boolean;
  can_view_contact_details: boolean;
  profile_visibility_boost: boolean;
  can_see_who_viewed_profile: boolean;
  can_view_received_interests: boolean;
  priority_support: boolean;
  max_photos: number;
  contact_access_mode: string;
  photo_access_mode: string;
  can_use_advanced_search: boolean;
  is_trial?: boolean;
  trial_expires_at?: string | null;
  trial_days_remaining?: number | null;
}

export interface EntitlementSummary {
  entitlements: MemberEntitlements;
  usage: {
    profile_views_used_today: number;
    profile_views_remaining_today: number | null;
    interests_used_today: number;
    interests_remaining_today: number | null;
    resets_at: string;
  };
}

export const entitlementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMemberEntitlements: builder.query<EntitlementSummary, void>({
      query: () => ({ url: '/member/entitlements/', method: 'GET' }),
      providesTags: ['MembershipSummary'],
    }),
  }),
});

export const { useGetMemberEntitlementsQuery } = entitlementApi;
