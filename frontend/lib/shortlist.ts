const prefix = 'mdp.shortlist.';

function key(memberId: string) { return `${prefix}${memberId}`; }

export function getShortlist(memberId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key(memberId)) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export function isShortlisted(memberId: string, profileId: string) {
  return getShortlist(memberId).includes(profileId);
}

export function toggleShortlist(memberId: string, profileId: string) {
  const ids = new Set(getShortlist(memberId));
  if (ids.has(profileId)) ids.delete(profileId); else ids.add(profileId);
  window.localStorage.setItem(key(memberId), JSON.stringify([...ids]));
  window.dispatchEvent(new Event('shortlist:changed'));
  return ids.has(profileId);
}
