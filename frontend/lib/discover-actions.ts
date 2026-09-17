'use client';

import { fetchApi } from '@/legacy/services/apiClient';

export interface PassedProfileItem {
  id: string;
  name: string;
  photo?: string;
  age?: number;
  location?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  motherTongue?: string;
  maritalStatus?: string;
  passedAt: string;
}

const PASSED_PROFILES_KEY = 'mdp_discover_passed_profiles_v1';
const PASSED_IDS_KEY = 'mdp_discover_dismissed_v2';

export function getLocalPassedProfiles(): PassedProfileItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASSED_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPassedProfiles(): PassedProfileItem[] {
  return getLocalPassedProfiles();
}

export async function fetchPassedProfilesFromBackend(): Promise<PassedProfileItem[]> {
  try {
    const backendData = await fetchApi<any[]>('/passes/');
    if (Array.isArray(backendData)) {
      const items: PassedProfileItem[] = backendData.map((p) => {
        const profileId = p.id || p.user_id || p.member_id;
        const photo =
          p.photo ||
          p.photoFull ||
          p.image_url ||
          (Array.isArray(p.photos) && p.photos[0] ? (typeof p.photos[0] === 'string' ? p.photos[0] : p.photos[0].url) : '') ||
          '';
        return {
          id: String(profileId),
          name: p.full_name || p.first_name || (p.last_name ? `${p.first_name || ''} ${p.last_name}` : '') || 'Member',
          photo,
          age: p.age,
          location: p.work_location || p.location || p.city || '',
          occupation: p.occupation || '',
          education: p.highest_education || p.education || '',
          religion: p.religion || '',
          motherTongue: p.mother_tongue || p.motherTongue || '',
          maritalStatus: p.marital_status || p.maritalStatus || '',
          passedAt: p.created_at || new Date().toISOString(),
        };
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(PASSED_PROFILES_KEY, JSON.stringify(items.slice(0, 100)));
        const ids = new Set(items.map((i) => i.id));
        localStorage.setItem(PASSED_IDS_KEY, JSON.stringify([...ids]));
      }
      return items;
    }
  } catch {
    /* fallback to local cache */
  }
  return getLocalPassedProfiles();
}

export function savePassedProfile(profile: {
  id: string;
  name?: string;
  photo?: string;
  photoFull?: string;
  age?: number;
  location?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  motherTongue?: string;
  maritalStatus?: string;
}): void {
  if (typeof window === 'undefined' || !profile?.id) return;
  try {
    const list = getLocalPassedProfiles().filter((p) => p.id !== profile.id);
    const item: PassedProfileItem = {
      id: profile.id,
      name: profile.name || 'Member',
      photo: profile.photoFull || profile.photo || '',
      age: profile.age,
      location: profile.location,
      occupation: profile.occupation,
      education: profile.education,
      religion: profile.religion,
      motherTongue: profile.motherTongue,
      maritalStatus: profile.maritalStatus,
      passedAt: new Date().toISOString(),
    };
    list.unshift(item);
    localStorage.setItem(PASSED_PROFILES_KEY, JSON.stringify(list.slice(0, 100)));

    // Also update dismissed IDs set
    const idsRaw = localStorage.getItem(PASSED_IDS_KEY);
    const ids = idsRaw ? new Set(JSON.parse(idsRaw)) : new Set<string>();
    ids.add(profile.id);
    localStorage.setItem(PASSED_IDS_KEY, JSON.stringify([...ids]));

    // Persist to backend database & admin
    void fetchApi('/passes/', {
      method: 'POST',
      body: JSON.stringify({ profile_id: profile.id }),
    }).catch(() => {});
  } catch {
    /* ignore storage quota */
  }
}

export function removePassedProfile(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const list = getLocalPassedProfiles().filter((p) => p.id !== id);
    localStorage.setItem(PASSED_PROFILES_KEY, JSON.stringify(list));

    const idsRaw = localStorage.getItem(PASSED_IDS_KEY);
    if (idsRaw) {
      const ids = new Set(JSON.parse(idsRaw));
      ids.delete(id);
      localStorage.setItem(PASSED_IDS_KEY, JSON.stringify([...ids]));
    }

    // Persist removal (undo pass) to backend database
    void fetchApi(`/passes/${id}/`, {
      method: 'DELETE',
    }).catch(() => {
      void fetchApi('/passes/', {
        method: 'DELETE',
        body: JSON.stringify({ profile_id: id }),
      }).catch(() => {});
    });
  } catch {
    /* ignore */
  }
}

export function getPassedCount(): number {
  return getLocalPassedProfiles().length;
}
