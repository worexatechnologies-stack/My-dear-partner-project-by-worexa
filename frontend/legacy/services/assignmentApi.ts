import { baseApi } from './baseApi';

export interface AssignmentRule {
  id: string;
  name: string;
  category: string | null;
  verification_type: string | null;
  priority: string | null;
  strategy: string;
  queue: string | null;
  priority_order: number;
  is_active: boolean;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  employee_email: string;
  is_online: boolean;
  is_suspended: boolean;
  availability_status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'LEAVE';
  timezone: string;
  last_active_at: string;
}

export const assignmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssignmentRules: builder.query<AssignmentRule[], void>({
      query: () => ({ url: '/admin/config/assignment-rules/' }),
      providesTags: ['AssignmentRule'],
    }),
    createAssignmentRule: builder.mutation<AssignmentRule, Partial<AssignmentRule>>({
      query: (body) => ({
        url: '/admin/config/assignment-rules/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AssignmentRule'],
    }),
    updateAssignmentRule: builder.mutation<AssignmentRule, { id: string; body: Partial<AssignmentRule> }>({
      query: ({ id, body }) => ({
        url: `/admin/config/assignment-rules/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['AssignmentRule'],
    }),
    deleteAssignmentRule: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/config/assignment-rules/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AssignmentRule'],
    }),
    getAssignmentStrategies: builder.query<any[], void>({
      query: () => ({ url: '/admin/config/assignment-strategies/' }),
      providesTags: ['AssignmentStrategy'],
    }),
    getEmployeeAvailabilities: builder.query<EmployeeAvailability[], void>({
      query: () => ({ url: '/admin/config/employee-availabilities/' }),
      providesTags: ['EmployeeAvailability'],
    }),
    updateEmployeeAvailability: builder.mutation<EmployeeAvailability, { id: string; body: Partial<EmployeeAvailability> }>({
      query: ({ id, body }) => ({
        url: `/admin/config/employee-availabilities/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['EmployeeAvailability', 'EligibleStaff', 'EligibleAgents'],
    }),
    bulkReassignTickets: builder.mutation<any, { ticket_ids: string[]; assigned_to_support: string; notes?: string }>({
      query: (body) => ({
        url: '/admin/assignments/bulk-reassign-tickets/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminTickets', 'CSQueue', 'CSDashboard', 'EligibleAgents', 'QueuesList', 'AnalyticsDashboard'],
    }),
    bulkReassignWork: builder.mutation<any, { verification_ids: string[]; assigned_to_staff: string; notes?: string }>({
      query: (body) => ({
        url: '/admin/assignments/bulk-reassign-work/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard', 'EligibleStaff', 'AdminVerifications', 'QueuesList', 'AnalyticsDashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAssignmentRulesQuery,
  useCreateAssignmentRuleMutation,
  useUpdateAssignmentRuleMutation,
  useDeleteAssignmentRuleMutation,
  useGetAssignmentStrategiesQuery,
  useGetEmployeeAvailabilitiesQuery,
  useUpdateEmployeeAvailabilityMutation,
  useBulkReassignTicketsMutation,
  useBulkReassignWorkMutation,
} = assignmentApi;
