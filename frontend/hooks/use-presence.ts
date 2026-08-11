'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchApi } from '@/legacy/services/apiClient';
import { useWindowRealtimeEvent } from './useRealtimeRefresh';

export type PresenceMap = Map<string, boolean>;
export type LastSeenMap = Map<string, string | null>;

/**
 * Targeted presence for the currently visible users only.
 *
 * We never subscribe to a global online/offline firehose. Instead we ask the
 * backend for the status of exactly the profiles on screen (conversation
 * list, search results, matches) via POST /api/v1/presence/bulk/, and then
 * patch the local map when a `presence.changed` event arrives for one of them.
 *
 * The backend only emits `presence.changed` to a user's own personal group, so
 * a member only learns about their own transitions unless the UI explicitly
 * queries the peers it is showing.
 */
export function usePresence(userIds: string[]) {
  const userIdsKey = useMemo(() => userIds.join(','), [userIds]);
  const stableIds = useMemo(
    () => Array.from(new Set(userIds.filter(Boolean))).slice(0, 200).sort(),
    // Re-fetch only when the actual set of ids changes.
    [userIdsKey],
  );

  const [presence, setPresence] = useState<PresenceMap>(new Map());
  const presenceRef = useRef<PresenceMap>(presence);
  presenceRef.current = presence;
  const [lastSeen, setLastSeen] = useState<LastSeenMap>(new Map());
  const lastSeenRef = useRef<LastSeenMap>(lastSeen);
  lastSeenRef.current = lastSeen;

  const applyStatus = useCallback((id: string, online: boolean) => {
    setPresence((prev) => {
      if (prev.get(id) === online) return prev;
      const next = new Map(prev);
      next.set(id, online);
      return next;
    });
  }, []);

  // Initial & periodic bulk fetch for visible id set
  useEffect(() => {
    if (stableIds.length === 0) {
      setPresence(new Map());
      setLastSeen(new Map());
      return;
    }
    let cancelled = false;
    const fetchPresence = () => {
      fetchApi<any>('/presence/bulk/', {
        method: 'POST',
        body: JSON.stringify({ user_ids: stableIds }),
      })
        .then((res: any) => {
          if (cancelled) return;
          const statusMap = res?.data && typeof res.data === 'object' ? res.data : res;
          const next = new Map<string, boolean>();
          for (const id of stableIds) {
            next.set(id, statusMap?.[id] === 'ONLINE');
          }
          setPresence(next);

          // Durable "last seen" info for OFFLINE users (sibling key).
          const seenMap: Record<string, unknown> =
            statusMap?.last_seen_at && typeof statusMap.last_seen_at === 'object'
              ? (statusMap.last_seen_at as Record<string, unknown>)
              : {};
          const nextSeen = new Map<string, string | null>();
          for (const id of stableIds) {
            const value = seenMap[id];
            nextSeen.set(id, typeof value === 'string' ? value : null);
          }
          setLastSeen(nextSeen);
        })
        .catch(() => {});
    };

    fetchPresence();
    const timer = setInterval(fetchPresence, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stableIds]);

  // Live patches from WebSocket presence.changed events.
  useWindowRealtimeEvent((event) => {
    const detail = event.detail as { type?: string; user_id?: string; status?: string };
    if (detail?.type !== 'presence.changed') return;
    const id = detail.user_id;
    if (!id) return;
    applyStatus(id, detail.status === 'ONLINE');
    if (detail.status === 'ONLINE') {
      // Going back online invalidates the stale last-seen timestamp.
      setLastSeen((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.set(id, null);
        return next;
      });
    }
  });

  const isOnline = useCallback((id?: string) => (id ? presence.get(id) === true : false), [presence]);

  const getLastSeen = useCallback(
    (id?: string) => (id ? lastSeen.get(id) ?? null : null),
    [lastSeen],
  );

  return { presence, lastSeen, isOnline, getLastSeen };
}
