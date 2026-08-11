'use client';

import { useRealtime } from '@/providers/RealtimeProvider';

const statusColors: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  reconnecting: '#f97316',
  disconnected: '#6b7280',
  unauthorized: '#ef4444',
};

const statusLabels: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  unauthorized: 'Unauthorized',
};

export function ConnectionStatus() {
  const { status } = useRealtime();

  return (
    <span
      title={`WebSocket: ${statusLabels[status] || status}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: statusColors[status] || '#6b7280',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: statusColors[status] || '#6b7280',
          display: 'inline-block',
        }}
      />
      {statusLabels[status] || status}
    </span>
  );
}
