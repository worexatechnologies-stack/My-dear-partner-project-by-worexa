'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRealtime, type RealtimeEvent } from '@/providers/RealtimeProvider';

type RefreshFn = () => any;

interface UseRealtimeRefreshOptions {
  eventTypes: string[];
  refresh: RefreshFn;
  debounceMs?: number;
  enabled?: boolean;
}

export function useRealtimeRefresh({
  eventTypes,
  refresh,
  debounceMs = 300,
  enabled = true,
}: UseRealtimeRefreshOptions) {
  const { subscribe } = useRealtime();
  const refreshRef = useRef<RefreshFn>(refresh);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const debouncedRefresh = useCallback(
    (_event: RealtimeEvent) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        refreshRef.current();
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    if (!enabled) return;

    const eventSet = new Set(eventTypes);
    const unsubAll: (() => void)[] = [];

    for (const eventType of eventSet) {
      const unsub = subscribe(eventType, debouncedRefresh);
      unsubAll.push(unsub);
    }

    return () => {
      for (const unsub of unsubAll) {
        unsub();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [eventTypes.join(','), subscribe, debouncedRefresh, enabled]);
}

export function useWindowRealtimeEvent(handler: (event: CustomEvent<RealtimeEvent>) => void, deps: unknown[] = []) {
  useEffect(() => {
    const listener = (event: Event) => {
      handler(event as CustomEvent<RealtimeEvent>);
    };
    window.addEventListener('realtime-event', listener);
    return () => window.removeEventListener('realtime-event', listener);
  }, deps);
}
