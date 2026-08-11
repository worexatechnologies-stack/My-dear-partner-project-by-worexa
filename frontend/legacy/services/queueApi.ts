import { baseApi } from './baseApi';

export interface QueueItem {
  id: string;
  member_name?: string;
  verification_type?: string;
  verification_type_display?: string;
  ticket_number?: string;
  subject?: string;
  status: string;
  priority: string;
  submitted_at?: string;
  created_at: string;
}

export interface QueueItemsResponse {
  count: number;
  results: QueueItem[];
}

export const queueApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getQueueItems: builder.query<QueueItemsResponse, { queue: string; status?: string; priority?: string; page?: number; page_size?: number }>({
      query: (params) => ({
        url: '/admin/queues/',
        params,
      }),
      providesTags: ['QueuesList'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetQueueItemsQuery,
} = queueApi;
