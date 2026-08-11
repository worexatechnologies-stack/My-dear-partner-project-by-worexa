'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { publicEnv } from '@/config/env';
import { getFreshAccessToken } from '@/legacy/services/apiClient';

type RealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unauthorized';

export type RealtimeEvent = {
  type: string;
  entity: string;
  entity_id: string;
  title?: string;
  link_url?: string;
  notification_type?: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
};

type RealtimeContextValue = {
  status: RealtimeStatus;
  lastEvent: RealtimeEvent | null;
  subscribe: (eventType: string, handler: (event: RealtimeEvent) => void) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'disconnected',
  lastEvent: null,
  subscribe: () => () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manuallyClosedRef = useRef(false);
  const handlersRef = useRef<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map());
  const isAuthenticatedRef = useRef(true);
  const connectInstanceRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const clearPingTimer = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback((eventType: string, handler: (event: RealtimeEvent) => void) => {
    const handlers = handlersRef.current;
    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }
    handlers.get(eventType)!.add(handler);

    return () => {
      handlers.get(eventType)?.delete(handler);
      if (handlers.get(eventType)?.size === 0) {
        handlers.delete(eventType);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    const instanceId = ++connectInstanceRef.current;
    if (manuallyClosedRef.current) return;
    clearReconnectTimer();

    const token = await getFreshAccessToken().catch(() => null);
    if (!token) {
      setStatus('unauthorized');
      return;
    }

    const existing = socketRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

    const baseUrl = publicEnv.wsBaseUrl.replace(/\/$/, '');
    const wsBase = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');

    const socket = new WebSocket(`${wsBase}/ws/notifications/?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus('connected');
      clearPingTimer();
      pingTimerRef.current = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'presence.ping' }));
        }
      }, 20000);
    };

    socket.onmessage = (messageEvent) => {
      try {
        const rawEvent = JSON.parse(messageEvent.data) as Partial<RealtimeEvent> & Record<string, unknown>;
        // NotificationConsumer sends notification fields at the top level,
        // while other realtime producers place them in `data`. Give every
        // subscriber one consistent shape so chat updates are never ignored.
        const rawData = rawEvent.data && typeof rawEvent.data === 'object'
          ? rawEvent.data as Record<string, unknown>
          : {};
        const realtimeEvent: RealtimeEvent = {
          type: String(rawEvent.type || ''),
          entity: String(rawEvent.entity || ''),
          entity_id: String(rawEvent.entity_id || rawEvent.id || ''),
          title: typeof rawEvent.title === 'string' ? rawEvent.title : undefined,
          link_url: typeof rawEvent.link_url === 'string' ? rawEvent.link_url : undefined,
          notification_type: typeof rawEvent.notification_type === 'string' ? rawEvent.notification_type : undefined,
          message: String(rawEvent.message || ''),
          timestamp: String(rawEvent.timestamp || rawEvent.created_at || new Date().toISOString()),
          data: {
            ...rawData,
            notification_type: rawEvent.notification_type ?? rawData.notification_type,
            link_url: rawEvent.link_url ?? rawData.link_url,
            title: rawEvent.title ?? rawData.title,
            message: rawEvent.message ?? rawData.message,
          },
        };
        setLastEvent(realtimeEvent);

        window.dispatchEvent(
          new CustomEvent('realtime-event', { detail: realtimeEvent }),
        );

        if (
          realtimeEvent.type === 'notification.created'
          && 'Notification' in window
          && Notification.permission === 'granted'
          // Chat is E2EE — the raw body is ciphertext and chat notifications are
          // handled separately with decryption in ChatNotificationNotifier,
          // so skip the native alert here to avoid leaking the encrypted blob.
          && realtimeEvent.notification_type !== 'CHAT_MESSAGE'
        ) {
          const notification = new Notification(realtimeEvent.title || 'My Dear Partner', {
            body: realtimeEvent.message || 'You have a new update.',
            icon: '/favicon.png',
            tag: realtimeEvent.entity_id || realtimeEvent.timestamp,
            data: { url: realtimeEvent.data?.link_url },
          });
          notification.onclick = () => {
            window.focus();
            const url = realtimeEvent.link_url || realtimeEvent.data?.link_url;
            if (typeof url === 'string' && url.startsWith('/')) window.location.assign(url);
            notification.close();
          };
        }

        if (realtimeEvent.type === 'notification.created' && realtimeEvent.notification_type === 'CHAT_MESSAGE') {
          const audio = audioContextRef.current;
          if (audio?.state === 'running') {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.05, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
            oscillator.connect(gain).connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.16);
          }
        }

        const handlers = handlersRef.current;
        const wildcardHandlers = handlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => handler(realtimeEvent));
        }

        const typeHandlers = handlers.get(realtimeEvent.type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(realtimeEvent));
        }
      } catch {
        /* ignore malformed payloads */
      }
    };

    socket.onerror = () => {
      /* onclose will handle reconnection */
    };

    socket.onclose = (closeEvent) => {
      socketRef.current = null;
      clearPingTimer();

      if (instanceId !== connectInstanceRef.current) return;

      if (manuallyClosedRef.current) {
        setStatus('disconnected');
        return;
      }

      if (closeEvent.code === 4401 || closeEvent.code === 4403) {
        setStatus('unauthorized');
        return;
      }

      const attempt = reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);

      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    manuallyClosedRef.current = false;
    isAuthenticatedRef.current = true;
    connect();

    return () => {
      manuallyClosedRef.current = true;
      isAuthenticatedRef.current = false;
      clearReconnectTimer();
      clearPingTimer();

      const socket = socketRef.current;
      socketRef.current = null;

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'Provider unmounted');
        }
      }
    };
  }, [connect, clearReconnectTimer]);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current && 'AudioContext' in window) {
        audioContextRef.current = new AudioContext();
      }
      void audioContextRef.current?.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      void audioContextRef.current?.close();
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, lastEvent, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}
