import { baseApi } from './baseApi';

export interface VerificationDetail {
  id: string;
  member_name: string;
  verification_type: string;
  status: string;
  priority: string;
  submitted_at: string;
  notes?: string;
}

export const verificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminVerificationDetails: builder.query<VerificationDetail, string>({
      query: (id) => ({ url: `/admin/verifications/${id}/` }),
      providesTags: ['AdminVerifications'],
    }),
    updateAdminVerificationStatus: builder.mutation<any, { id: string; status: string; rejection_reason?: string }>({
      query: ({ id, status, rejection_reason }) => ({
        url: `/admin/verifications/${id}/`,
        method: 'PATCH',
        body: { status, rejection_reason },
      }),
      invalidatesTags: ['AdminVerifications', 'StaffWork', 'QueuesList', 'AnalyticsDashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAdminVerificationDetailsQuery,
  useUpdateAdminVerificationStatusMutation,
} = verificationApi;
