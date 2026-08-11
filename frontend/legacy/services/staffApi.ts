import { baseApi } from './baseApi';
import { normalizeMemberPhoto, type MemberPhoto } from './photoApi';

export interface StaffDashboardSummary {
  assigned: number;
  in_progress: number;
  due_today: number;
  overdue: number;
  escalated: number;
  completed_today: number;
  completed_week: number;
}

export interface StaffDashboardData {
  summary: StaffDashboardSummary;
  recent_assignments: any[];
  recent_activity: any[];
  unread_notifications: number;
}

export interface StaffWorkQuery {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  assignment_type?: string;
  priority?: string;
  due_date?: string;
  ordering?: string;
}

export interface StaffWorkAssignment {
  id: string;
  assignment_type: string;
  assignment_type_display?: string;
  status: string;
  priority: string;
  member_name?: string;
  member_email?: string;
  assigned_by_name?: string;
  related_profile_verification?: string | null;
  notes?: string;
  due_at?: string | null;
  created_at: string;
  updated_at?: string;
  profile_photos: MemberPhoto[];
}

export interface StaffWorkResponse {
  count: number;
  results: StaffWorkAssignment[];
}

export function normalizeStaffWorkResponse(value: unknown): StaffWorkResponse {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const results = Array.isArray(record.results) ? record.results : [];

  return {
    count: typeof record.count === 'number' ? record.count : results.length,
    results: results
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        ...item,
        id: String(item.id ?? ''),
        assignment_type: String(item.assignment_type ?? ''),
        status: String(item.status ?? ''),
        priority: String(item.priority ?? ''),
        created_at: String(item.created_at ?? ''),
        profile_photos: (Array.isArray(item.profile_photos) ? item.profile_photos : [])
          .map(normalizeMemberPhoto)
          .filter((photo) => Boolean(photo.id)),
      })) as StaffWorkAssignment[],
  };
}

export const staffApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStaffDashboard: builder.query<StaffDashboardData, void>({
      query: () => ({ url: '/staff/dashboard/' }),
      providesTags: ['StaffDashboard'],
    }),
    getMyWork: builder.query<StaffWorkResponse, StaffWorkQuery>({
      query: (params) => ({
        url: '/staff/my-work/',
        params: params as Record<string, string>,
      }),
      transformResponse: normalizeStaffWorkResponse,
      providesTags: ['StaffWork'],
    }),
    startWork: builder.mutation<any, { assignmentId: string }>({
      query: ({ assignmentId }) => ({
        url: '/staff/work-action/',
        method: 'POST',
        body: { assignment_id: assignmentId, action: 'start' },
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard'],
    }),
    approveWork: builder.mutation<any, { assignmentId: string; notes?: string }>({
      query: ({ assignmentId, notes }) => ({
        url: '/staff/work-action/',
        method: 'POST',
        body: { assignment_id: assignmentId, action: 'complete', outcome: 'APPROVE', notes },
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard', 'AdminVerifications'],
    }),
    rejectWork: builder.mutation<any, { assignmentId: string; notes: string }>({
      query: ({ assignmentId, notes }) => ({
        url: '/staff/work-action/',
        method: 'POST',
        body: { assignment_id: assignmentId, action: 'complete', outcome: 'REJECT', notes },
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard', 'AdminVerifications'],
    }),
    escalateWork: builder.mutation<any, { assignmentId: string; notes: string }>({
      query: ({ assignmentId, notes }) => ({
        url: '/staff/work-action/',
        method: 'POST',
        body: { assignment_id: assignmentId, action: 'escalate', notes },
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard'],
    }),
    addWorkNote: builder.mutation<any, { assignmentId: string; notes: string }>({
      query: ({ assignmentId, notes }) => ({
        url: '/staff/work-action/',
        method: 'POST',
        body: { assignment_id: assignmentId, action: 'note', notes },
      }),
      invalidatesTags: ['StaffWork'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStaffDashboardQuery,
  useGetMyWorkQuery,
  useStartWorkMutation,
  useApproveWorkMutation,
  useRejectWorkMutation,
  useEscalateWorkMutation,
  useAddWorkNoteMutation,
} = staffApi;
