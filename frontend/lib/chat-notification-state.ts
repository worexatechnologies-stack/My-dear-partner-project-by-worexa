'use client';

// The chat page keeps the selected conversation in React state, not always in
// the URL. This shared state lets notification code see the open conversation.
const ACTIVE_CHAT_STORAGE_KEY = 'my-dear-partner:active-chat-partner';
export const ACTIVE_CHAT_CHANGED_EVENT = 'chat:active-conversation-changed';

function normalizePartnerId(value?: string | null): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function partnerFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const queryPartner = new URLSearchParams(window.location.search).get('user');
    if (queryPartner) return normalizePartnerId(queryPartner);
    const match = window.location.pathname.match(/^\/messages\/([^/?#]+)/i);
    return match ? normalizePartnerId(decodeURIComponent(match[1])) : null;
  } catch {
    return null;
  }
}

export function getActiveChatPartnerId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // A selected conversation in the current page wins over a stale ?user=
    // value after the member clicks another conversation in the list.
    const selectedConversation = normalizePartnerId(window.sessionStorage.getItem(ACTIVE_CHAT_STORAGE_KEY));
    if (selectedConversation) return selectedConversation;
  } catch {
    // Fall through to the URL when storage is unavailable.
  }
  return partnerFromLocation();
}

export function setActiveChatPartnerId(partnerId?: string | null) {
  if (typeof window === 'undefined') return;
  const normalized = normalizePartnerId(partnerId);
  try {
    if (normalized) window.sessionStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, normalized);
    else window.sessionStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
  } catch {
    // Storage can be disabled; the event still updates this browser tab.
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_CHAT_CHANGED_EVENT, { detail: normalized }));
}

export function clearActiveChatPartnerId(partnerId?: string | null) {
  const expected = normalizePartnerId(partnerId);
  if (!expected || getActiveChatPartnerId() === expected) setActiveChatPartnerId(null);
}

function partnerFromChatLink(link?: unknown): string | null {
  if (typeof link !== 'string' || !link || typeof window === 'undefined') return null;
  try {
    const url = new URL(link, window.location.origin);
    return normalizePartnerId(url.searchParams.get('user'))
      || normalizePartnerId(url.pathname.match(/^\/messages\/([^/?#]+)/i)?.[1]);
  } catch {
    return null;
  }
}

export function isActiveChatNotification(link?: unknown): boolean {
  const activePartnerId = getActiveChatPartnerId();
  const notificationPartnerId = partnerFromChatLink(link);
  return Boolean(activePartnerId && notificationPartnerId && activePartnerId === notificationPartnerId);
}
