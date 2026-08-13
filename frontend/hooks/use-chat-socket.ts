'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { publicEnv } from '@/config/public-env';
import { clearClientAuthState, getFreshAccessToken } from '@/legacy/services/apiClient';

type SocketState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

function websocketOrigin(baseUrl: string) {
  return baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/$/, '');
}

export function useChatSocket({ partnerId, enabled, onMessage, onClose }: {
  partnerId?: string | null;
  enabled: boolean;
  onMessage: (payload: any) => void | Promise<void>;
  onClose?: (code: number) => void;
}) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageHandlerRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);
  const [state, setState] = useState<SocketState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    messageHandlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled || !partnerId) {
      socketRef.current?.close();
      socketRef.current = null;
      setState('idle');
      setError('');
      return;
    }

    let disposed = false;
    let socket: WebSocket | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = async () => {
      setState('connecting');
      setError('');
      try {
        const accessToken = await getFreshAccessToken();
        if (disposed) return;

        const url = `${websocketOrigin(publicEnv.wsBaseUrl)}/ws/chat/${encodeURIComponent(partnerId)}/?token=${encodeURIComponent(accessToken)}`;
        socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!disposed) {
            reconnectAttemptsRef.current = 0;
            setState('open');
          }
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            void messageHandlerRef.current(payload);
          } catch {
            // Ignore malformed real-time events. HTTP history remains the
            // source of truth and is used as a fallback by the messages page.
          }
        };
        socket.onerror = () => {
          if (!disposed) {
            setState('error');
            setError('Real-time chat is unavailable; using message sync instead.');
          }
        };
        socket.onclose = (event) => {
          if (!disposed) {
            socketRef.current = null;
            const permanentClose = [1000, 4001, 4003, 4004, 4005, 4006].includes(event.code);
            if (event.code && event.code !== 1000) {
              const messages: Record<number, string> = {
                4001: 'Your session has expired. Please sign in again.',
                4003: 'This member account is no longer available for chat.',
                4004: 'Real-time chat is not included in your current membership plan.',
                4005: 'Real-time chat is available after both members accept the interest.',
                4006: 'Real-time chat is unavailable for this conversation.',
              };
              setError(messages[event.code] || 'Real-time chat disconnected; using message sync instead.');
              if (event.code === 4001) {
                clearClientAuthState();
                window.dispatchEvent(new Event('auth:session-expired'));
              }
              onCloseRef.current?.(event.code);
            }
            if (permanentClose) {
              setState('closed');
              return;
            }

            // Keep a conversation live across Wi-Fi changes, temporary
            // backend restarts, and load-balancer reconnects. HTTP message
            // sync remains available until the socket is restored.
            const attempt = reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * 2 ** attempt, 30000);
            setState('connecting');
            reconnectTimerRef.current = setTimeout(() => void connect(), delay);
          }
        };
      } catch {
        if (!disposed) {
          const attempt = reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * 2 ** attempt, 30000);
          setState('connecting');
          setError('Real-time chat is unavailable; using message sync instead.');
          reconnectTimerRef.current = setTimeout(() => void connect(), delay);
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      clearReconnectTimer();
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Conversation changed');
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [enabled, partnerId]);

  const send = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return {
    state,
    error,
    connected: state === 'open',
    send,
    clearError,
  };
}
