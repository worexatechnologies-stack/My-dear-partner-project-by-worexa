import { fetchApi } from './apiClient';
import { type Profile, type MembershipPlan, type Conversation, type Message } from '../types/domain';

type UserWire = Record<string, any> & { id: string };
export interface ProfilePage {
  count: number;
  page: number;
  page_size: number;
  num_pages: number;
  next: number | null;
  previous: number | null;
  results: Profile[];
}
function extractWirePhoto(user: any): string {
  if (typeof user?.photo === 'string' && user.photo.trim()) return user.photo;
  if (typeof user?.image_url === 'string' && user.image_url.trim()) return user.image_url;
  if (typeof user?.thumbnail_url === 'string' && user.thumbnail_url.trim()) return user.thumbnail_url;
  if (typeof user?.profile_photo === 'string' && user.profile_photo.trim()) return user.profile_photo;
  if (user?.primary_photo) {
    const p = user.primary_photo;
    const url = p.url || p.download_url || p.image_url || p.thumbnail_url;
    if (typeof url === 'string' && url.trim()) return url;
  }
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    const p = user.photos.find((item: any) => item.is_primary) || user.photos[0];
    const url = typeof p === 'string' ? p : (p?.url || p?.download_url || p?.image_url || p?.thumbnail_url);
    if (typeof url === 'string' && url.trim()) return url;
  }
  if (Array.isArray(user?.profile_photos) && user.profile_photos.length > 0) {
    const p = user.profile_photos.find((item: any) => item.is_primary) || user.profile_photos[0];
    const url = typeof p === 'string' ? p : (p?.url || p?.download_url || p?.image_url || p?.thumbnail_url);
    if (typeof url === 'string' && url.trim()) return url;
  }
  return '';
}

function extractFullWirePhoto(user: any): string {
  const collections = [user?.photos, user?.profile_photos];
  for (const photos of collections) {
    if (!Array.isArray(photos) || photos.length === 0) continue;
    const photo = photos.find((item: any) => item?.is_primary) || photos[0];
    const url = typeof photo === 'string'
      ? photo
      : (photo?.image_url || photo?.url || photo?.download_url || photo?.thumbnail_url);
    if (typeof url === 'string' && url.trim()) return url;
  }
  return extractWirePhoto(user);
}

const profileFromWire = (user: UserWire): Profile => {
  const hasPhotoVisibility = typeof user.photo_visibility === 'string';
  const photoIsVisible = user.photo_visibility === 'visible';
  const photoUrl = hasPhotoVisibility
    ? (photoIsVisible && typeof user.photo === 'string' ? user.photo.trim() : '')
    : extractWirePhoto(user);
  const photoFull = hasPhotoVisibility
    ? (photoIsVisible && photoUrl ? extractFullWirePhoto(user) : '')
    : extractFullWirePhoto(user);
  return {
    id: user.id,
    name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Member',
    age: user.age || 0,
    height: user.height || 'Not specified',
    religion: user.religion || 'Not specified',
    caste: user.caste || 'Not specified',
    education: user.highest_education || 'Not specified',
    occupation: user.occupation || 'Not specified',
    income: user.annual_income || 'Not specified',
    location: user.work_location || 'Not specified',
    photo: photoUrl,
    photoFull,
    gender: user.gender,
    isDemo: Boolean(user.is_demo),
    photoVisibility: user.photo_visibility === 'pending_approval' ? 'pending_approval' : photoUrl ? 'visible' : 'unavailable',
    verified: Boolean(user.is_verified),
    premium: Boolean(user.is_premium),
    compatibility: Number(user.compatibility || 0),
    about: user.about || 'This member has not added an introduction yet.',
    familyType: user.family_type || 'Not specified',
    motherTongue: user.mother_tongue || 'Not specified',
    maritalStatus: user.marital_status || 'Not specified',
    hobbies: Array.isArray(user.hobbies) ? user.hobbies : [],
    partnerPrefs: user.pref_about || 'Not specified',
    chat_public_key: user.chat_public_key,
    is_unlocked: Boolean(user.is_unlocked),
  };
};

export const getProfiles = async (params?: Record<string, string>): Promise<ProfilePage> => {
  const page = await fetchApi<Omit<ProfilePage, 'results'> & { results: UserWire[] }>('/profiles/', { params });
  const results = (page.results ?? []).map(profileFromWire);
  return {
    count: page.count ?? results.length,
    page: page.page ?? 1,
    page_size: page.page_size ?? results.length,
    num_pages: page.num_pages ?? 1,
    next: page.next ?? null,
    previous: page.previous ?? null,
    results,
  };
};

export const getProfile = async (id: string): Promise<Profile> => {
  const res = await fetchApi<any>(`/profiles/${id}/`);
  if (res && res.profile) {
    const p = profileFromWire(res.profile);
    p.access = res.access;
    return p;
  }
  return profileFromWire(res);
};

export const getMembershipPlans = async (): Promise<MembershipPlan[]> => {
  return fetchApi<MembershipPlan[]>('/membership-plans/');
};


export const getFAQs = async (): Promise<any[]> => {
  return fetchApi<any[]>('/faqs/');
};

export const getConversations = async (): Promise<Conversation[]> => {
  const rows = await fetchApi<Array<Record<string, any>>>('/conversations/');
  return rows.map((row) => {
    const partnerSource = row.other_member ?? row.profile;
    const partnerId = row.id ?? partnerSource?.id ?? row.user_id;
    const rawLastMsg = String(row.lastMessage ?? row.last_message?.text ?? row.last_message ?? '');
    return { ...row, id: partnerId, lastMessage: rawLastMsg, profile: profileFromWire(partnerSource ?? {}) } as Conversation;
  });
};

export const getMessages = async (userId: string): Promise<Message[]> => {
  const response = await fetchApi<any>(`/conversations/${userId}/messages/`);
  if (Array.isArray(response)) return response;

  // The message endpoint is cursor-paginated, while older deployments return
  // a plain list. Normalize both response contracts for the chat screen.
  const messages = response?.results?.data?.messages
    ?? response?.data?.messages
    ?? response?.results
    ?? [];
  return Array.isArray(messages) ? messages : [];
};

export const sendMessage = async (userId: string, text: string): Promise<Message> => {
  return fetchApi<Message>(`/conversations/${userId}/messages/`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};

export const markMessagesRead = async (userId: string): Promise<{ marked_count?: number }> => {
  return fetchApi<{ marked_count?: number }>(`/conversations/${userId}/mark-read/`, {
    method: 'POST',
  });
};

export const getInterests = async (type: 'incoming' | 'outgoing' = 'incoming'): Promise<any[]> => {
  return fetchApi<any[]>(`/interests/?type=${type}`);
};

export const sendInterest = async (receiverId: string): Promise<any> => {
  return fetchApi<any>('/interests/', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId }),
  });
};

export const updateInterestStatus = async (interestId: string, status: 'ACCEPTED' | 'DECLINED'): Promise<any> => {
  return fetchApi<any>(`/interests/${interestId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

export const checkCompatibility = async (data: any): Promise<any> => {
  return fetchApi<any>('/matchmaking/compatibility/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getShortlists = async (): Promise<{ count: number; results: Profile[] }> => {
  const data = await fetchApi<{ count?: number; results?: any[] } | any[]>('/shortlists/');
  const rows = Array.isArray(data) ? data : data.results ?? [];
  return { count: Array.isArray(data) ? rows.length : data.count ?? rows.length, results: rows.map(profileFromWire) };
};

export const toggleShortlist = async (profileId: string): Promise<{ success: boolean; action: 'added' | 'removed'; shortlisted: boolean }> => {
  return fetchApi<any>('/shortlists/', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
  });
};

export const isProfileShortlisted = async (profileId: string): Promise<boolean> => {
  try {
    const data = await fetchApi<{ results?: any[] } | any[]>('/shortlists/');
    const rows = Array.isArray(data) ? data : data.results ?? [];
    return rows.some((u: any) => u.id === profileId);
  } catch {
    return false;
  }
};
