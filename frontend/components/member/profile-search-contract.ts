import type { Profile } from '@/legacy/types/domain';

export interface ProfileSearchFilters {
  search: string;
  religion: string;
  location: string;
  min_age: string;
  max_age: string;
  marital_status: string;
  mother_tongue: string;
  education: string;
  caste: string;
}

export const EMPTY_PROFILE_SEARCH_FILTERS: ProfileSearchFilters = {
  search: '',
  religion: '',
  location: '',
  min_age: '',
  max_age: '',
  marital_status: '',
  mother_tongue: '',
  education: '',
  caste: '',
};

const FILTER_KEYS = Object.keys(EMPTY_PROFILE_SEARCH_FILTERS) as Array<keyof ProfileSearchFilters>;

export function cleanProfileSearchFilters(filters: ProfileSearchFilters): ProfileSearchFilters {
  return FILTER_KEYS.reduce<ProfileSearchFilters>((cleaned, key) => {
    cleaned[key] = filters[key].trim();
    return cleaned;
  }, { ...EMPTY_PROFILE_SEARCH_FILTERS });
}

export function profileSearchApiParams(filters: ProfileSearchFilters, page: number, pageSize: number) {
  const cleaned = cleanProfileSearchFilters(filters);
  const values: Record<string, string> = {
    ...cleaned,
    page: String(page),
    page_size: String(pageSize),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
}

export function profileSearchFiltersFromParams(params: { forEach: (callback: (value: string, key: string) => void) => void }) {
  const filters = { ...EMPTY_PROFILE_SEARCH_FILTERS };
  const aliases: Record<string, keyof ProfileSearchFilters> = {
    q: 'search',
    search: 'search',
    religion: 'religion',
    location: 'location',
    work_location: 'location',
    min_age: 'min_age',
    age_min: 'min_age',
    max_age: 'max_age',
    age_max: 'max_age',
    marital_status: 'marital_status',
    mother_tongue: 'mother_tongue',
    education: 'education',
    highest_education: 'education',
    caste: 'caste',
  };
  params.forEach((value, key) => {
    const filterKey = aliases[key];
    if (filterKey) filters[filterKey] = value;
  });
  return cleanProfileSearchFilters(filters);
}

export function profileSearchQuery(filters: ProfileSearchFilters) {
  const search = new URLSearchParams();
  const cleaned = cleanProfileSearchFilters(filters);
  for (const key of FILTER_KEYS) {
    if (cleaned[key]) search.set(key, cleaned[key]);
  }
  return search.toString();
}

export function activeProfileFilterCount(filters: ProfileSearchFilters) {
  return FILTER_KEYS.filter((key) => filters[key].trim() !== '').length;
}

export function profileSearchValidation(filters: ProfileSearchFilters): string | null {
  const min = filters.min_age ? Number(filters.min_age) : null;
  const max = filters.max_age ? Number(filters.max_age) : null;
  if (min !== null && (!Number.isInteger(min) || min < 18 || min > 100)) return 'Minimum age must be between 18 and 100.';
  if (max !== null && (!Number.isInteger(max) || max < 18 || max > 100)) return 'Maximum age must be between 18 and 100.';
  if (min !== null && max !== null && min > max) return 'Minimum age cannot be greater than maximum age.';
  return null;
}

export function mergeUniqueProfiles(current: Profile[], incoming: Profile[]) {
  const profiles = new Map<string, Profile>();
  for (const profile of [...current, ...incoming]) {
    if (profile?.id) profiles.set(profile.id, profile);
  }
  return [...profiles.values()];
}
