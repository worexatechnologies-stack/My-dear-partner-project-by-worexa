import { baseApi } from './baseApi';

export interface SupportTicketDetail {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  category_name: string;
  member_name: string;
  created_at: string;
  replies: any[];
}

export const ticketApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminTicketDetails: builder.query<SupportTicketDetail, string>({
      query: (id) => ({ url: `/admin/tickets/${id}/` }),
      providesTags: ['AdminTickets'],
    }),
    updateAdminTicketStatus: builder.mutation<any, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/admin/tickets/${id}/`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['AdminTickets', 'CSQueue', 'QueuesList', 'AnalyticsDashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAdminTicketDetailsQuery,
  useUpdateAdminTicketStatusMutation,
} = ticketApi;
