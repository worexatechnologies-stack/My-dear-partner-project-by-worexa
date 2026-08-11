import { baseApi } from './baseApi';

export interface EligibleStaff {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  is_online: boolean;
  availability_status: string;
  is_suspended: boolean;
  last_active_at: string | null;
  workload: {
    assigned: number;
    capacity: number;
    current_score: number;
  };
}

export interface EligibleAgent {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  specialization: string;
  support_level: string;
  is_online: boolean;
  availability_status: string;
  is_suspended: boolean;
  last_active_at: string | null;
  workload: {
    assigned: number;
    capacity: number;
    current_score: number;
  };
}

export const adminAssignmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEligibleStaff: builder.query<EligibleStaff[], { verification_request_id?: string }>({
      query: (params) => ({
        url: '/admin/eligible-staff/',
        params,
      }),
      providesTags: ['EligibleStaff'],
    }),
    getEligibleSupportAgents: builder.query<EligibleAgent[], { ticket_id?: string }>({
      query: (params) => ({
        url: '/admin/eligible-agents/',
        params,
      }),
      providesTags: ['EligibleAgents'],
    }),
    assignWork: builder.mutation<any, {
      assigned_to_staff: string;
      assignment_type: string;
      priority: string;
      due_at?: string | null;
      notes?: string;
      related_id: string;
    }>({
      query: (body) => ({
        url: '/admin/assign-work/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StaffWork', 'StaffDashboard', 'EligibleStaff', 'AdminVerifications'],
    }),
    assignTicket: builder.mutation<any, {
      ticket_id: string;
      assigned_to_support: string;
      notes?: string;
    }>({
      query: (body) => ({
        url: '/admin/assign-ticket/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CSQueue', 'CSDashboard', 'EligibleAgents', 'AdminTickets'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEligibleStaffQuery,
  useGetEligibleSupportAgentsQuery,
  useAssignWorkMutation,
  useAssignTicketMutation,
} = adminAssignmentsApi;
