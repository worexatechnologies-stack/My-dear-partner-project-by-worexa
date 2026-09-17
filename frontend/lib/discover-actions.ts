'use client';

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

export function getPassedProfiles(): PassedProfileItem[] {
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
    const list = getPassedProfiles().filter((p) => p.id !== profile.id);
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
  } catch {
    /* ignore storage quota */
  }
}

export function removePassedProfile(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const list = getPassedProfiles().filter((p) => p.id !== id);
    localStorage.setItem(PASSED_PROFILES_KEY, JSON.stringify(list));

    const idsRaw = localStorage.getItem(PASSED_IDS_KEY);
    if (idsRaw) {
      const ids = new Set(JSON.parse(idsRaw));
      ids.delete(id);
      localStorage.setItem(PASSED_IDS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    /* ignore */
  }
}

export function getPassedCount(): number {
  return getPassedProfiles().length;
}
