import { baseApi } from './baseApi';

export interface ActivityLog {
  id: string;
  admin_email: string;
  action: string;
  module: string;
  created_at: string;
  ip_address: string;
}

export const activityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminActivityLogs: builder.query<ActivityLog[], void>({
      query: () => ({ url: '/admin/activity/' }),
      providesTags: ['AssignmentAudit'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAdminActivityLogsQuery,
} = activityApi;
