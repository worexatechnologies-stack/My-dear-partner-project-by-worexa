import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { fetchApi, ApiError } from './apiClient';

function sanitizeMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred.';
  const clean = msg.trim().toLowerCase();
  const isHtml = clean.startsWith('<!doctype') || clean.startsWith('<html') || clean.includes('</html>') || clean.includes('</body>');
  if (isHtml || msg.length > 500 || clean.includes('traceback') || clean.includes('stack trace') || clean.includes('exception')) {
    return 'An unexpected error occurred. Please contact support if the issue persists.';
  }
  return msg;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function requestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  // Do not set a JSON body for multipart uploads. The browser supplies the
  // boundary only when it receives the original FormData object.
  if (isFormData(body)) return body;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

const customBaseQuery: BaseQueryFn<
  { url: string; method?: string; body?: any; params?: Record<string, any> },
  unknown,
  { message: string; status: number; code?: string | null; errors?: any }
> = async ({ url, method = 'GET', body, params }, api) => {
  try {
    const data = await fetchApi<any>(url, {
      method,
      body: requestBody(body),
      params,
      signal: api.signal,
    });
    return { data };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: {
          status: error.status,
          code: error.code ?? null,
          message: sanitizeMessage(error.message),
          errors: error.errors,
        },
      };
    }
    const genericMsg = error instanceof Error ? error.message : 'Unknown network error';
    return {
      error: {
        status: 500,
        code: 'UNKNOWN_ERROR',
        message: sanitizeMessage(genericMsg),
      },
    };
  }
};

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: customBaseQuery,
  // Verification status can change out-of-band (e.g. an admin approves a
  // document while the member keeps the app open), so always re-fetch the
  // latest data when a cached query is (re)mounted or the tab regains focus
  // rather than serving a stale snapshot that hides an approval.
  refetchOnMountOrArgChange: true,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  tagTypes: [
    'StaffDashboard',
    'CSDashboard',
    'StaffWork',
    'CSQueue',
    'EligibleStaff',
    'EligibleAgents',
    'AdminVerifications',
    'AdminTickets',
    'Specialization',
    'Queue',
    'AssignmentStrategy',
    'EmployeeAvailability',
    'Workload',
    'AssignmentRule',
    'AssignmentAudit',
    'QueuesList',
    'AnalyticsDashboard',
    'MembershipPlans',
    'MembershipSummary',
    'ProfileDetail',
    'UnlockUsage',
    'UnlockHistory',
    'VerificationStatus',
    'MemberPhotos',
    'UserProfile',
  ],
  endpoints: () => ({}),
});
