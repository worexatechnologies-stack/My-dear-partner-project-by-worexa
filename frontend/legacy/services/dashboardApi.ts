import { baseApi } from './baseApi';

export interface AnalyticsDashboardMetrics {
  unassigned_tickets: number;
  open_tickets: number;
  escalated_tickets: number;
  resolved_tickets_today: number;
  open_verifications: number;
  escalated_verifications: number;
  sla_violations: number;
  avg_response_time: number;
  avg_resolution_time: number;
}

export interface AgentWorkloadStat {
  id: string;
  name: string;
  email: string;
  open_tickets: number;
  urgent_tickets: number;
  capacity: number;
  avg_resolution_time: number;
}

export interface DepartmentPerformance {
  name: string;
  open_count: number;
}

export interface AnalyticsDashboardData {
  metrics: AnalyticsDashboardMetrics;
  agent_performance: AgentWorkloadStat[];
  department_performance: DepartmentPerformance[];
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminAnalyticsDashboard: builder.query<AnalyticsDashboardData, void>({
      query: () => ({ url: '/admin/analytics/dashboard/' }),
      providesTags: ['AnalyticsDashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAdminAnalyticsDashboardQuery,
} = dashboardApi;
