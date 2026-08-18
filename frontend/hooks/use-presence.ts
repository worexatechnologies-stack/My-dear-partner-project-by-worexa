'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchApi } from '@/legacy/services/apiClient';
import { useRealtime } from '@/providers/RealtimeProvider';

export type PresenceMap = Map<string, boolean>;
export type LastSeenMap = Map<string, string | null>;

/**
 * Targeted presence for members currently visible on screen. The server
 * authorizes each ID against accepted, unblocked matches and then delivers
 * changes through a private WebSocket subscription.
 */
export function usePresence(userIds: string[]) {
  const userIdsKey = useMemo(() => userIds.join(','), [userIds]);
  const stableIds = useMemo(
    () => Array.from(new Set(userIds.filter(Boolean))).slice(0, 200).sort(),
    [userIdsKey],
  );
  const { status, subscribe, send } = useRealtime();
  const [presence, setPresence] = useState<PresenceMap>(new Map());
  const [lastSeen, setLastSeen] = useState<LastSeenMap>(new Map());

  const applyStatus = useCallback((id: string, online: boolean) => {
    setPresence((previous) => {
      if (previous.get(id) === online) return previous;
      const next = new Map(previous);
      next.set(id, online);
      return next;
    });
  }, []);

  const applySnapshot = useCallback((statusMap: Record<string, unknown>, seenMap: Record<string, unknown>) => {
    const nextPresence = new Map<string, boolean>();
    const nextLastSeen = new Map<string, string | null>();
    for (const id of stableIds) {
      nextPresence.set(id, statusMap[id] === 'ONLINE');
      const value = seenMap[id];
      nextLastSeen.set(id, typeof value === 'string' ? value : null);
    }
    setPresence(nextPresence);
    setLastSeen(nextLastSeen);
  }, [stableIds]);

  // HTTP establishes the initial state. It is not used as an interval-based
  // substitute for realtime presence.
  useEffect(() => {
    if (stableIds.length === 0) {
      setPresence(new Map());
      setLastSeen(new Map());
      return;
    }

    let cancelled = false;
    void fetchApi<any>('/presence/bulk/', {
      method: 'POST',
      body: JSON.stringify({ user_ids: stableIds }),
    }).then((response) => {
      if (cancelled) return;
      const statusMap = response?.data && typeof response.data === 'object'
        ? response.data as Record<string, unknown>
        : response as Record<string, unknown>;
      const seenMap = statusMap?.last_seen_at && typeof statusMap.last_seen_at === 'object'
        ? statusMap.last_seen_at as Record<string, unknown>
        : {};
      applySnapshot(statusMap, seenMap);
    }).catch(() => {
      // The existing snapshot remains usable until the socket reconnects.
    });

    return () => { cancelled = true; };
  }, [applySnapshot, stableIds]);

  useEffect(() => {
    if (status !== 'connected' || stableIds.length === 0) return;
    send({ type: 'presence.subscribe', user_ids: stableIds });
  }, [send, stableIds, status]);

  useEffect(() => subscribe('presence.snapshot', (event) => {
    const statuses = event.data.statuses;
    const lastSeenAt = event.data.last_seen_at;
    applySnapshot(
      statuses && typeof statuses === 'object' ? statuses as Record<string, unknown> : {},
      lastSeenAt && typeof lastSeenAt === 'object' ? lastSeenAt as Record<string, unknown> : {},
    );
  }), [applySnapshot, subscribe]);

  useEffect(() => subscribe('presence.changed', (event) => {
    const id = typeof event.data.user_id === 'string' ? event.data.user_id : '';
    const statusValue = typeof event.data.status === 'string' ? event.data.status : '';
    if (!id || !stableIds.includes(id)) return;

    applyStatus(id, statusValue === 'ONLINE');
    setLastSeen((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.set(id, statusValue === 'ONLINE' ? null : event.timestamp || next.get(id) || null);
      return next;
    });
  }), [applyStatus, stableIds, subscribe]);

  const isOnline = useCallback((id?: string) => (id ? presence.get(id) === true : false), [presence]);
  const getLastSeen = useCallback((id?: string) => (id ? lastSeen.get(id) ?? null : null), [lastSeen]);

  return { presence, lastSeen, isOnline, getLastSeen };
}
