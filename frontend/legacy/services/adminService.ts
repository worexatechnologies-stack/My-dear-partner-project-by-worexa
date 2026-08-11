import { fetchApi } from './apiClient';

export type AdminRoleCode = 'SUPER_ADMIN' | 'ADMIN';


export type QueryValue = string | number | boolean | null | undefined;

export interface AdminListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  status?: string;
  role?: AdminRoleCode;
  category?: string;
  priority?: string;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: QueryValue;
}

export interface PaginatedResult<T> {
  count: number;
  page: number;
  page_size: number;
  num_pages: number;
  results: T[];
  next?: string | null;
  previous?: string | null;
}

// Kept as aliases because both names are used by older and newer admin screens.
export type PagedResult<T> = PaginatedResult<T>;
export type AdminPage<T> = PaginatedResult<T>;

export interface AdminIdentity {
  id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
  admin_id?: string;
  bio?: string;
  photo?: string;
  role?: AdminRoleCode;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_number: string;
  photo?: string | null;
  gender?: string;
  work_location?: string;
  is_verified: boolean;
  is_premium: boolean;
  is_active: boolean;
  is_staff: boolean;
  is_superuser?: boolean;
  role?: AdminRoleCode | null;
  role_display?: string;
  profile_status?: string;
  photo_status?: string;
  document_status?: string;
  suspension_reason?: string;
  date_joined: string;
  created_at?: string;
  updated_at?: string;
  about?: string;
  age?: number;
  city?: string;
  country?: string;
  state?: string;
  completion_percentage?: number;
  missing_fields?: string[];
  marital_status?: string;
  height?: string;
  religion?: string;
  mother_tongue?: string;
  caste?: string;
  highest_education?: string;
  occupation?: string;
  annual_income?: string;
  active_membership?: {
    plan_name: string;
    is_active: boolean;
    start_date?: string;
    end_date?: string;
  };
}

export type AdminUserAction =
  | 'verify'
  | 'unverify'
  | 'approve_profile'
  | 'reject_profile'
  | 'approve_photo'
  | 'reject_photo'
  | 'verify_document'
  | 'reject_document'
  | 'activate'
  | 'deactivate'
  | 'soft_delete'
  | 'restore'
  | 'grant_membership'
  | 'permanent_delete';

export interface AdminUserActionInput {
  action: AdminUserAction;
  reason?: string;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export interface AdminDashboardCharts {
  registrations: DashboardChartPoint[];
  revenue: DashboardChartPoint[];
  memberships: DashboardChartPoint[];
}

export interface AdminDashboardStats extends Record<string, number | string | undefined> {
  total_users?: number;
  active_users?: number;
  new_today?: number;
  new_this_month?: number;
  verified_users?: number;
  pending_verification?: number;
  pending_profile_approvals?: number;
  pending_photo_approvals?: number;
  pending_document_verification?: number;
  suspended_users?: number;
  male_profiles?: number;
  female_profiles?: number;
  premium_users?: number;
  active_memberships?: number;
  expired_memberships?: number;
  matches_made?: number;
  revenue?: string;
  total_revenue?: string;
  revenue_this_month?: string;
  pending_payments?: number;
  successful_payments?: number;
  failed_payments?: number;
  pending_tickets?: number;
  assigned_tickets?: number;
  open_tickets?: number;
  pending_enquiries?: number;
  resolved_enquiries?: number;
  open_complaints?: number;
  reported_profiles?: number;
  escalated_complaints?: number;
  follow_ups_due_today?: number;
}

export interface AdminDashboardContent {
  faqs: number;
}

export interface AdminDashboard {
  role: AdminRoleCode;
  role_display: string;
  permissions: string[];
  stats: AdminDashboardStats;
  charts: AdminDashboardCharts;
  recent_users: AdminUser[];
  recent_tickets: SupportTicket[];
  recent_payments: AdminTransaction[];
  recent_activity: ActivityLog[];

  // Legacy dashboard fields remain normalized while the old /admin page exists.
  monthly_signups: { month: string; count: number }[];
  membership_distribution: { name: string; count: number }[];
  content: AdminDashboardContent;
}

interface AdminDashboardWire extends Partial<Omit<AdminDashboard, 'charts'>> {
  stats?: AdminDashboardStats;
  charts?: Partial<AdminDashboardCharts>;
}

export interface AdminTransaction {
  id: string;
  user: string;
  email: string;
  plan: string;
  amount: string;
  status: string;
  date: string;
  gateway?: string | null;
  reference?: string | null;
}

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | (string & {});
export type TicketStatus =
  | 'OPEN'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | (string & {});

export interface SupportTicketReply {
  id: string;
  message: string;
  is_internal_note: boolean;
  author?: AdminIdentity | null;
  sender?: AdminIdentity | null; // backend compatibility
  created_at: string;
  attachment?: string | null;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user: AdminIdentity | null;
  subject: string;
  message: string;
  description?: string; // backend compatibility
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  source?: string;
  assigned_to: AdminIdentity | null;
  created_by?: AdminIdentity | null;
  resolved_at?: string | null;
  follow_up_at?: string | null;
  sla_deadline?: string | null;
  sla_escalated?: boolean;
  reply_count: number;
  replies?: SupportTicketReply[];
  created_at: string;
  updated_at: string;
  attachment?: string | null;
}

export type AdminTicket = SupportTicket;

export interface CreateSupportTicketInput {
  user_id?: string;
  subject: string;
  message: string;
  category: string;
  priority: TicketPriority;
  assigned_to?: string | null;
}

export type CreateAdminTicketInput = CreateSupportTicketInput;

export interface UpdateSupportTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string | null;
  follow_up_at?: string | null;
}

export type UpdateAdminTicketInput = UpdateSupportTicketInput;

export interface ReplyToTicketInput {
  message: string;
  is_internal_note?: boolean;
}

export type ReplyToAdminTicketInput = ReplyToTicketInput;

export type EnquiryStatus = 'NEW' | 'PENDING' | 'CONTACTED' | 'RESOLVED' | 'CLOSED' | (string & {});

export interface ContactEnquiry {
  id: string;
  user?: AdminIdentity | null;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: EnquiryStatus;
  assigned_to?: AdminIdentity | null;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export type AdminEnquiry = ContactEnquiry;

export interface UpdateEnquiryInput {
  status?: EnquiryStatus;
  assigned_to?: string | null;
  internal_notes?: string;
}

export type UpdateAdminEnquiryInput = UpdateEnquiryInput;

export interface AdminAccount {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: AdminRoleCode;
  role_display: string;
  photo?: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login?: string | null;
  created_at: string;
  created_by?: AdminIdentity | string | null;
  completed_actions?: number;
  employee_code?: string;
  admin_id?: string;
  bio?: string | null;
  support_level?: string;
  specialization?: string;
  manager_admin?: { id: string; email: string; full_name: string } | null;
  workload?: { assigned: number; in_progress: number; completed: number; overdue: number } | null;
}

export interface CreateAdminAccountInput {
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  role?: AdminRoleCode;
  employee_code?: string;
  photo?: string;
  bio?: string;
}

export type AdminAccountAction = 'activate' | 'deactivate' | 'reset_password';

export interface UpdateAdminAccountInput {
  full_name?: string;
  phone?: string;
  employee_code?: string;
  photo?: string;
  bio?: string;
  role?: AdminRoleCode;
  is_active?: boolean;
  action?: AdminAccountAction;
  new_password?: string;
}

export interface AdminPermission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}

export interface AdminRoleDefinition {
  id: string;
  code: AdminRoleCode;
  name: string;
  description?: string;
  is_system_role: boolean;
  permissions: string[];
}

export interface AdminRolesResponse {
  roles: AdminRoleDefinition[];
  permissions: AdminPermission[];
}

export type RolePermissionsResponse = AdminRolesResponse;

export interface UpdateAdminRoleInput {
  permissions: string[];
}

interface AdminAccountWire {
  id: string;
  email: string;
  mobile_number?: string | null;
  full_name: string;
  account_type: AdminRoleCode;
  admin_role?: AdminRoleCode;
  admin_role_display?: string;
  is_active: boolean;
  is_email_verified?: boolean;
  is_verified?: boolean;
  last_login?: string | null;
  created_at: string;
}

const normalizeAdminAccount = (account: any): AdminAccount => ({
  id: account.id,
  full_name: account.full_name,
  email: account.email,
  phone: account.mobile_number || account.phone || '',
  photo: account.photo || '',
  role: account.admin_role || account.account_type || account.role,
  role_display: account.admin_role_display || account.role_display
    || (account.admin_role || account.account_type || account.role || '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
  is_active: account.is_active,
  is_verified: account.is_verified ?? account.is_email_verified ?? false,
  last_login: account.last_login,
  created_at: account.created_at,
  employee_code: account.employee_code,
  support_level: account.support_level,
  specialization: account.specialization,
  manager_admin: account.manager_admin,
  workload: account.workload,
});

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts.shift() || '',
    last_name: parts.join(' '),
  };
};

export interface ActivityLog {
  id: string;
  actor_name: string;
  actor_role: string;
  admin_name: string;
  admin_email?: string;
  role: AdminRoleCode | string;
  action: string;
  module: string;
  record_id?: string | null;
  description?: string;
  target_account?: {
    full_name?: string;
    email?: string;
    ticket_number?: string;
    type?: string;
  } | null;
  ip_address?: string | null;
  user_agent?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  country?: string;
  was_successful: boolean;
  created_at: string;
}

export type AdminActivityLog = ActivityLog;

const toQueryParams = (params: AdminListParams = {}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
      .map(([key, value]) => [key, String(value)]),
  );

const normalizePage = <T>(data: PaginatedResult<T> | T[]): PaginatedResult<T> => {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      page: 1,
      page_size: data.length,
      num_pages: data.length ? 1 : 0,
      results: data,
    };
  }

  const pageSize = data.page_size ?? data.results.length;
  return {
    ...data,
    count: data.count ?? data.results.length,
    page: data.page ?? 1,
    page_size: pageSize,
    num_pages: data.num_pages ?? (pageSize ? Math.ceil(data.count / pageSize) : 0),
    results: data.results ?? [],
  };
};

const getPaged = async <T>(endpoint: string, params: AdminListParams = {}): Promise<PaginatedResult<T>> => {
  const data = await fetchApi<PaginatedResult<T> | T[]>(endpoint, { params: toQueryParams(params) });
  return normalizePage(data);
};

export const getAdminDashboard = async (params: AdminListParams = {}): Promise<AdminDashboard> => {
  const data = await fetchApi<AdminDashboardWire>('/admin/dashboard/', { params: toQueryParams(params) });
  const registrations = data.charts?.registrations
    ?? data.monthly_signups?.map(({ month, count }) => ({ label: month, value: count }))
    ?? [];
  const memberships = data.charts?.memberships
    ?? data.membership_distribution?.map(({ name, count }) => ({ label: name, value: count }))
    ?? [];

  return {
    ...data,
    role: data.role ?? 'ADMIN',
    role_display: data.role_display ?? 'Admin',
    permissions: data.permissions ?? [],
    stats: data.stats ?? {},
    charts: {
      registrations,
      revenue: data.charts?.revenue ?? [],
      memberships,
    },
    recent_users: data.recent_users ?? [],
    recent_tickets: data.recent_tickets ?? [],
    recent_payments: data.recent_payments ?? [],
    recent_activity: data.recent_activity ?? [],
    monthly_signups: data.monthly_signups
      ?? registrations.map(({ label, value }) => ({ month: label, count: value })),
    membership_distribution: data.membership_distribution
      ?? memberships.map(({ label, value }) => ({ name: label, count: value })),
    content: data.content ?? { faqs: 0 },
  };
};

export const getAdminUsers = (params: AdminListParams = {}) =>
  getPaged<AdminUser>('/admin/users/', params);

export function updateAdminUser(userId: string, action: AdminUserAction, reason?: string): Promise<AdminUser>;
export function updateAdminUser(userId: string, input: AdminUserActionInput): Promise<AdminUser>;
export function updateAdminUser(
  userId: string,
  input: AdminUserAction | AdminUserActionInput,
  reason?: string,
): Promise<AdminUser> {
  const body = typeof input === 'string' ? { action: input, ...(reason ? { reason } : {}) } : input;
  return fetchApi<AdminUser>(`/admin/users/${userId}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export const getAdminTransactions = async (params: AdminListParams = {}): Promise<AdminTransaction[]> => {
  const data = await fetchApi<AdminTransaction[] | PaginatedResult<AdminTransaction>>('/admin/payments/', {
    params: toQueryParams(params),
  });
  return Array.isArray(data) ? data : data.results;
};

export const getAdminTransactionsPage = (params: AdminListParams = {}) =>
  getPaged<AdminTransaction>('/admin/payments/', params);

export const getAdminTickets = (params: AdminListParams = {}) =>
  getPaged<SupportTicket>('/admin/tickets/', params);

export const getAdminTicketDetail = (ticketId: string) =>
  fetchApi<SupportTicket>(`/admin/tickets/${ticketId}/`, { method: 'GET' });



export const getAdminAssignees = () =>
  fetchApi<AdminIdentity[]>('/admin/assignees/');

export const createAdminTicket = (input: CreateSupportTicketInput) =>
  fetchApi<SupportTicket>('/admin/tickets/', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAdminTicket = (ticketId: string, input: UpdateSupportTicketInput) =>
  fetchApi<SupportTicket>(`/admin/tickets/${ticketId}/`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteAdminTicket = (ticketId: string) =>
  fetchApi<void>(`/admin/tickets/${ticketId}/`, { method: 'DELETE' });

export interface ReplyToTicketInput {
  message: string;
  is_internal_note?: boolean;
  attachment?: File;
}

export const replyToAdminTicket = (
  ticketId: string,
  input: ReplyToTicketInput,
): Promise<SupportTicketReply> => {
  const isNote = Boolean(input.is_internal_note);
  const actionStr = isNote ? 'note' : 'reply';

  if (!input.attachment) {
    return fetchApi<SupportTicketReply>(`/admin/tickets/${ticketId}/?action=${actionStr}`, {
      method: 'POST',
      body: JSON.stringify(
        isNote
          ? { note: input.message, action: 'note' }
          : { message: input.message, action: 'reply' }
      ),
    });
  }

  const formData = new FormData();
  formData.append('action', actionStr);
  if (isNote) {
    formData.append('note', input.message);
  } else {
    formData.append('message', input.message);
    formData.append('attachment', input.attachment);
  }
  return fetchApi<SupportTicketReply>(`/admin/tickets/${ticketId}/?action=${actionStr}`, {
    method: 'POST',
    body: formData,
  });
};

export const replyToTicket = replyToAdminTicket;

export const getAdminEnquiries = (params: AdminListParams = {}) =>
  getPaged<ContactEnquiry>('/admin/enquiries/', params);

export const updateAdminEnquiry = (enquiryId: string, input: UpdateEnquiryInput) =>
  fetchApi<ContactEnquiry>(`/admin/enquiries/${enquiryId}/`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const getAdminAccounts = async (params: AdminListParams = {}) => {
  const page = await getPaged<AdminAccountWire>('/admin/accounts/', params);
  return { ...page, results: page.results.map(normalizeAdminAccount) };
};

export const createAdminAccount = async (input: CreateAdminAccountInput) => {
  const account = await fetchApi<AdminAccountWire>('/super-admin/admins/', {
    method: 'POST',
    body: JSON.stringify({
      ...splitFullName(input.full_name),
      email: input.email,
      mobile_number: input.phone || null,
      password: input.password,
      role: input.role,
      employee_code: input.employee_code || null,
      photo: input.photo || '',
      bio: input.bio || '',
    }),
  });
  return normalizeAdminAccount(account);
};

export const updateAdminAccount = async (accountId: string, input: UpdateAdminAccountInput) => {
  const account = await fetchApi<AdminAccountWire>(`/admin/accounts/${accountId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.full_name === undefined ? {} : splitFullName(input.full_name)),
      ...(input.phone === undefined ? {} : { mobile_number: input.phone || null }),
      ...(input.employee_code === undefined ? {} : { employee_code: input.employee_code || null }),
      ...(input.photo === undefined ? {} : { photo: input.photo || '' }),
      ...(input.bio === undefined ? {} : { bio: input.bio || '' }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
      ...(input.action === undefined ? {} : { action: input.action }),
      ...(input.new_password === undefined ? {} : { new_password: input.new_password }),
    }),
  });
  return normalizeAdminAccount(account);
};

export const deleteAdminAccount = (accountId: string) =>
  fetchApi<void>(`/admin/accounts/${accountId}/`, { method: 'DELETE' });

export const getAdminRoles = () =>
  fetchApi<AdminRolesResponse>('/admin/roles/');

export const updateAdminRole = (roleId: string, input: UpdateAdminRoleInput | string[]) =>
  fetchApi<AdminRoleDefinition>(`/admin/roles/${roleId}/`, {
    method: 'PUT',
    body: JSON.stringify(Array.isArray(input) ? { permissions: input } : input),
  });

export interface UserPermissionItem {
  code: string;
  name: string;
  module: string;
  description: string;
  is_inherited: boolean;
  is_overridden: boolean;
  is_allowed: boolean;
  can_grant: boolean;
}

export interface UserPermissionsResponse {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    role: string;
    role_display: string;
    is_active: boolean;
  };
  permissions: UserPermissionItem[];
}

export interface PermissionOverrideInput {
  code: string;
  is_allowed: boolean | null;
}

export interface PermissionAuditLogItem {
  id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  actor_name: string;
  previous_permissions: Record<string, boolean>;
  new_permissions: Record<string, boolean>;
  ip_address?: string | null;
  created_at: string;
}

export const getUserPermissions = (userId: string) =>
  fetchApi<UserPermissionsResponse>(`/admin/user-permissions/${userId}/`);

export const updateUserPermissions = (userId: string, permissions: PermissionOverrideInput[]) =>
  fetchApi<{ message: string }>(`/admin/user-permissions/${userId}/`, {
    method: 'POST',
    body: JSON.stringify({ permissions }),
  });

export const getPermissionAuditLogs = (params: AdminListParams = {}) =>
  getPaged<PermissionAuditLogItem>('/admin/user-permissions/logs/', params);

export const getAdminActivity = (params: AdminListParams = {}) =>
  getPaged<ActivityLog>('/admin/activity/', params);

// Admin Support specific endpoints
export interface AdminSupportDashboardData {
  new_tickets: number;
  unassigned_tickets: number;
  in_progress_tickets: number;
  waiting_for_user: number;
  overdue_tickets: number;
  resolved_today: number;
  closed_today: number;
  urgent_tickets: number;
}

export interface AdminSupportReportsData {
  avg_first_response_minutes: number;
  avg_resolution_hours: number;
  ratings_distribution: Record<number, number>;
  categories_breakdown: Record<string, number>;
}

export const getAdminSupportDashboard = () =>
  fetchApi<AdminSupportDashboardData>('/admin/support/dashboard/');

export const getAdminSupportReports = () =>
  fetchApi<AdminSupportReportsData>('/admin/support/reports/');

export const createPhoneTicket = (input: {
  phone?: string;
  email?: string;
  user_id?: string;
  subject: string;
  call_summary: string;
  category: string;
  priority: string;
  internal_note?: string;
}) =>
  fetchApi<SupportTicket>('/admin/support/tickets/phone/', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface WorkAssignment {
  id: string;
  assignment_type: 'PROFILE_VERIFICATION' | 'PHOTO_VERIFICATION' | 'DOCUMENT_VERIFICATION' | 'COMPLAINT_REVIEW' | 'PROFILE_REPORT_REVIEW' | 'MODERATION_TASK';
  assigned_to_staff: string;
  assigned_to_staff_details?: AdminAccount;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'ESCALATED' | 'COMPLETED' | 'CANCELLED';
  due_at?: string;
  notes: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// Super Admin generic accounts list (Admin, Staff, Support list with dynamic parameters)
export const getSuperAdminAccounts = async (params: AdminListParams = {}) => {
  const page = await getPaged<any>('/super-admin/accounts/', params);
  return { ...page, results: page.results.map(normalizeAdminAccount) };
};

export const createSuperAdminAccount = async (input: any) => {
  const account = await fetchApi<any>('/super-admin/accounts/', {
    method: 'POST',
    body: JSON.stringify({
      ...splitFullName(input.full_name),
      email: input.email,
      mobile_number: input.phone || null,
      password: input.password,
      role: input.role,
      employee_code: input.employee_code || null,
      support_level: input.support_level || 'L1',
      specialization: input.specialization || 'GENERAL',
      manager_admin: input.manager_admin || null,
    }),
  });
  return normalizeAdminAccount(account);
};

export const updateSuperAdminAccount = async (accountType: string, accountId: string, input: any) => {
  const account = await fetchApi<any>(`/super-admin/accounts/${accountType}/${accountId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.full_name === undefined ? {} : splitFullName(input.full_name)),
      ...(input.phone === undefined ? {} : { mobile_number: input.phone || null }),
      ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
      ...(input.action === undefined ? {} : { action: input.action }),
      ...(input.new_password === undefined ? {} : { new_password: input.new_password }),
      ...(input.employee_code === undefined ? {} : { employee_code: input.employee_code }),
      ...(input.support_level === undefined ? {} : { support_level: input.support_level }),
      ...(input.specialization === undefined ? {} : { specialization: input.specialization }),
      ...(input.manager_admin === undefined ? {} : { manager_admin: input.manager_admin }),
    }),
  });
  return normalizeAdminAccount(account);
};

export const actionSuperAdminAccount = (accountType: string, accountId: string, action: string, body: any = {}) =>
  fetchApi<any>(`/super-admin/accounts/${accountType}/${accountId}/${action}/`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getSuperAdminAccountActivity = (accountType: string, accountId: string) =>
  fetchApi<any[]>(`/super-admin/accounts/${accountType}/${accountId}/activity/`);

export const deleteSuperAdminAccount = (accountType: string, accountId: string) =>
  fetchApi<void>(`/super-admin/accounts/${accountType}/${accountId}/`, {
    method: 'DELETE',
  });

// Admin specific staff CRUD
export const getAdminStaffList = async (params: AdminListParams = {}) => {
  const page = await getPaged<any>('/admin/staff/', params);
  return { ...page, results: page.results.map(normalizeAdminAccount) };
};

export const createAdminStaff = async (input: any) => {
  const account = await fetchApi<any>('/admin/staff/', {
    method: 'POST',
    body: JSON.stringify({
      ...splitFullName(input.full_name),
      email: input.email,
      mobile_number: input.phone || null,
      password: input.password,
      employee_code: input.employee_code || null,
      manager_admin: input.manager_admin || null,
    }),
  });
  return normalizeAdminAccount(account);
};

export const updateAdminStaff = async (id: string, input: any) => {
  const account = await fetchApi<any>(`/admin/staff/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.full_name === undefined ? {} : splitFullName(input.full_name)),
      ...(input.phone === undefined ? {} : { mobile_number: input.phone || null }),
      ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
      ...(input.employee_code === undefined ? {} : { employee_code: input.employee_code }),
    }),
  });
  return normalizeAdminAccount(account);
};

export const actionAdminStaff = (id: string, action: string, body: any = {}) =>
  fetchApi<any>(`/admin/staff/${id}/${action}/`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getAdminStaffActivity = (id: string) =>
  fetchApi<any[]>(`/admin/staff/${id}/activity/`);

// Work Assignments & Ticket Assignments
export const assignWork = (input: {
  assigned_to_staff: string;
  assignment_type: string;
  priority?: string;
  due_at?: string;
  notes?: string;
  related_id: string;
}) =>
  fetchApi<WorkAssignment>('/admin/assign-work/', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const assignTicket = (input: {
  ticket_id: string;
  assigned_to_support: string;
  notes?: string;
}) =>
  fetchApi<void>('/admin/assign-ticket/', {
    method: 'POST',
    body: JSON.stringify(input),
  });

// Staff Dashboard Work actions
export const getStaffWork = (params: { status?: string } = {}) => {
  const query = params.status ? `?status=${params.status}` : '';
  return fetchApi<WorkAssignment[]>(`/staff/my-work/${query}`);
};

export const submitStaffWorkAction = (input: {
  assignment_id: string;
  action: 'start' | 'complete' | 'escalate';
  notes?: string;
  outcome?: 'approve' | 'reject';
}) =>
  fetchApi<void>('/staff/work-action/', {
    method: 'POST',
    body: JSON.stringify(input),
  });

// ═══════════════════════════════════════════════════════════════════════
// Support Ticket v2 API (refactored, production-grade)
// ═══════════════════════════════════════════════════════════════════════

export interface SupportTicketV2 {
  id: string;
  ticket_number: string;
  user: AdminIdentity | null;
  category: string;
  category_name: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  source?: string;
  assigned_to: AdminIdentity | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_reply_at: string | null;
  sla_deadline: string | null;
  reopened_count: number;
  resolution_summary: string;
  version: number;
  reply_count: number;
  last_message_preview?: string;
  has_attachments?: boolean;
  is_overdue?: boolean;
  claimed_by?: AdminIdentity | null;
  resolved_by?: AdminIdentity | null;
  closed_by?: AdminIdentity | null;
  replies?: SupportTicketReply[];
  internal_notes?: TicketInternalNote[];
  status_history?: TicketStatusHistoryItem[];
  attachments?: SupportAttachment[];
  audit_logs?: TicketAuditLogItem[];
  created_at: string;
  updated_at: string;
}

export interface TicketInternalNote {
  id: string;
  author: AdminIdentity | null;
  note: string;
  created_at: string;
}

export interface TicketStatusHistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  changed_by?: AdminIdentity | null;
  reason: string;
  created_at: string;
}

export interface TicketAuditLogItem {
  id: string;
  actor_id?: string;
  actor_name: string;
  action: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  reason: string;
  ip_address?: string | null;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  download_url: string;
  created_at: string;
}

export interface QueueCounts {
  all: number;
  unassigned: number;
  open: number;
  in_progress: number;
  waiting_for_member: number;
  waiting_for_internal: number;
  resolved: number;
  closed: number;
  reopened: number;
  urgent: number;
  overdue: number;
}

export interface UnreadCounts {
  total_unread_messages: number;
  unread_tickets: number;
}

export interface DashboardData {
  all: number;
  unassigned: number;
  open: number;
  in_progress: number;
  waiting_for_member: number;
  waiting_for_internal: number;
  resolved: number;
  closed: number;
  reopened: number;
  urgent: number;
  overdue: number;
  avg_first_response_hours: number;
  avg_resolution_hours: number;
  sla_breach_count: number;
}

export interface TimelineEvent {
  type: 'reply' | 'note' | 'internal_note' | 'status_change';
  id: string;
  message?: string;
  sender?: { id: string; name: string; type: string } | null;
  attachments?: any[];
  created_at: string;
  is_public?: boolean;
  old_status?: string;
  new_status?: string;
  reason?: string;
}

// v2 API functions
const API_V2_BASE = '' as const;  // paths are absolute

export const getTicketsV2 = (params: AdminListParams = {}): Promise<PaginatedResult<SupportTicketV2>> => {
  const qp = toQueryParams(params);
  return fetchApi<PaginatedResult<SupportTicketV2>>('/admin/support/tickets/', { params: qp });
};

export const getTicketDetailV2 = (ticketId: string): Promise<SupportTicketV2> =>
  fetchApi<SupportTicketV2>(`/admin/support/tickets/${ticketId}/`);

export const ticketActionV2 = (ticketId: string, action: string, extra: Record<string, string> = {}): Promise<{ id: string; status: string }> =>
  fetchApi<{ id: string; status: string }>(`/admin/support/tickets/${ticketId}/action/`, {
    method: 'POST',
    body: JSON.stringify({ action, ...extra }),
  });

export const replyToTicketV2 = (ticketId: string, message: string, isNote = false, attachment?: File): Promise<{ id: string; message: string; is_public: boolean; created_at: string }> => {
  if (attachment) {
    const fd = new FormData();
    fd.append('message', message);
    fd.append('is_note', String(isNote));
    fd.append('attachment', attachment);
    return fetchApi(`/admin/support/tickets/${ticketId}/reply/`, { method: 'POST', body: fd });
  }
  return fetchApi(`/admin/support/tickets/${ticketId}/reply/`, {
    method: 'POST',
    body: JSON.stringify({ message, is_note: isNote }),
  });
};

export const getTicketMessagesV2 = (ticketId: string): Promise<TimelineEvent[]> =>
  fetchApi<TimelineEvent[]>(`/admin/support/tickets/${ticketId}/messages/`);

export const markTicketReadV2 = (ticketId: string, messageId?: string): Promise<{ unread_count: number }> =>
  fetchApi<{ unread_count: number }>(`/admin/support/tickets/${ticketId}/read/`, {
    method: 'POST',
    body: messageId ? JSON.stringify({ message_id: messageId }) : '{}',
  });

export const getQueueCountsV2 = (): Promise<QueueCounts> =>
  fetchApi<QueueCounts>('/admin/support/queue-counts/');

export const getUnreadCountsV2 = (): Promise<UnreadCounts> =>
  fetchApi<UnreadCounts>('/admin/support/unread-counts/');

export const getAuditLogsV2 = (params: AdminListParams = {}): Promise<PaginatedResult<TicketAuditLogItem>> => {
  const qp = toQueryParams(params);
  return fetchApi<PaginatedResult<TicketAuditLogItem>>('/admin/support/audit-logs/', { params: qp });
};

export const getDashboardV2 = (): Promise<DashboardData> =>
  fetchApi<DashboardData>('/admin/support/dashboard/');

export const getCategoriesV2 = (): Promise<Array<{ id: number; code: string; name: string; description: string }>> =>
  fetchApi<Array<{ id: number; code: string; name: string; description: string }>>('/support/categories/');
