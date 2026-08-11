import { fetchApi } from './apiClient';

export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
}

export interface TicketReply {
  id: string;
  author: UserSummary;
  sender?: UserSummary; // compatible with backend
  message: string;
  is_internal_note: boolean;
  created_at: string;
  attachment?: string | null;
  attachments?: Array<{ id: string; download_url: string; original_filename: string; mime_type?: string }> | null;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user?: UserSummary | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  assigned_to?: UserSummary | null;
  created_by?: UserSummary | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  last_reply_at?: string | null;
  created_at: string;
  updated_at: string;
  sla_deadline?: string | null;
  sla_escalated: boolean;
  replies?: TicketReply[];
  attachment?: string | null;
  attachments?: Array<{ id: string; download_url: string; original_filename: string; mime_type?: string }> | null;
}

export interface TicketFeedback {
  id: string;
  rating: number;
  feedback_text: string;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  link_url?: string;
  is_read: boolean;
  related_object_type?: string | null;
  related_object_id?: string | null;
  priority: string;
  created_at: string;
}

export interface PaginatedResult<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

export const supportService = {
  async listTickets(status?: string, page = 1): Promise<PaginatedResult<SupportTicket>> {
    const params: Record<string, string> = { page: String(page) };
    if (status) {
      params.status = status;
    }
    return fetchApi<PaginatedResult<SupportTicket>>('/support/tickets/', {
      method: 'GET',
      params
    });
  },

  async getTicketDetails(ticketId: string): Promise<SupportTicket> {
    return fetchApi<SupportTicket>(`/support/tickets/${ticketId}/`, {
      method: 'GET'
    });
  },

  async createTicket(
    subject: string,
    description: string,
    category: string,
    priority: string,
    attachment?: File
  ): Promise<SupportTicket> {
    if (!attachment) {
      return fetchApi<SupportTicket>('/support/tickets/', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          description,
          category: category || 'GENERAL',
          priority: priority || 'NORMAL',
        })
      });
    }

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('description', description);
    formData.append('category', category || 'GENERAL');
    formData.append('priority', priority || 'NORMAL');
    formData.append('attachment', attachment);

    return fetchApi<SupportTicket>('/support/tickets/', {
      method: 'POST',
      body: formData
    });
  },

  async replyTicket(ticketId: string, message: string, attachment?: File): Promise<TicketReply> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('action', 'reply');
    if (attachment) {
      formData.append('attachment', attachment);
    }

    return fetchApi<TicketReply>(`/support/tickets/${ticketId}/?action=reply`, {
      method: 'POST',
      body: formData
    });
  },

  async reopenTicket(ticketId: string): Promise<SupportTicket> {
    return fetchApi<SupportTicket>(`/support/tickets/${ticketId}/?action=reopen`, {
      method: 'POST'
    });
  },

  async confirmResolution(ticketId: string, rating: number, feedbackText: string): Promise<any> {
    return fetchApi<any>(`/support/tickets/${ticketId}/?action=confirm-resolution`, {
      method: 'POST',
      body: JSON.stringify({
        rating,
        feedback_text: feedbackText
      })
    });
  },

  async getNotifications(page = 1): Promise<PaginatedResult<Notification>> {
    return fetchApi<PaginatedResult<Notification>>('/notifications/', {
      method: 'GET',
      params: { page: String(page) }
    });
  },

  async getUnreadNotificationsCount(): Promise<{ unread_count: number }> {
    return fetchApi<{ unread_count: number }>('/notifications/unread-count/', {
      method: 'GET'
    });
  },

  async markNotificationRead(notificationId: string): Promise<any> {
    return fetchApi<any>(`/notifications/${notificationId}/read/`, {
      method: 'PATCH'
    });
  },

  async markAllNotificationsRead(): Promise<any> {
    return fetchApi<any>('/notifications/mark-all-read/', {
      method: 'POST'
    });
  }
};
