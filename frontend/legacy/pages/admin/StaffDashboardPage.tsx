'use client';

import { useState, useEffect } from 'react';
import { useGetStaffDashboardQuery } from '../../services/staffApi';
import {
  ClipboardCheck, Clock, AlertTriangle, ShieldCheck, CheckCircle, Calendar, RefreshCw
} from 'lucide-react';
import {
  AdminPageHeader, AdminPanel, AdminEmptyState, AdminLoading, AdminErrorState, AdminSkeleton
} from '../../components/admin/AdminUI';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function StaffDashboardPage() {
  const { data, error, isLoading, refetch, isFetching } = useGetStaffDashboardQuery(undefined, {
    pollingInterval: 60000,
  });
  const [syncTime, setSyncTime] = useState<string>('');

  useRealtimeRefresh({
    eventTypes: [
      'verification.submitted',
      'verification.approved',
      'verification.rejected',
      'photo.uploaded',
      'photo.approved',
      'photo.rejected',
      'document.uploaded',
      'document.approved',
      'document.rejected',
      'support.ticket_created',
      'support.ticket_assigned',
    ],
    refresh: refetch,
    debounceMs: 400,
  });

  useEffect(() => {
    setSyncTime(new Date().toLocaleTimeString());
  }, [data]);

  if (isLoading) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Staff workspace"
          title="Dashboard Overview"
          description="Preparing secure staff operational queue metrics..."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} style={{ background: 'var(--admin-surface, #f9fafb)', border: '1px solid var(--admin-line, rgba(0,0,0,0.08))', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="admin-skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e5e7eb', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="admin-skeleton-shimmer" style={{ width: '50%', height: '22px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '0.25rem' }} />
                <div className="admin-skeleton-shimmer" style={{ width: '80%', height: '12px', background: '#f3f4f6', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
        <AdminSkeleton type="table" rows={4} />
      </>
    );
  }
  if (error) return <AdminErrorState message="Could not load your staff dashboard." onRetry={refetch} />;

  const summary = data?.summary || {
    assigned: 0,
    in_progress: 0,
    due_today: 0,
    overdue: 0,
    escalated: 0,
    completed_today: 0,
    completed_week: 0
  };

  const statCards = [
    { label: 'Assigned', value: summary.assigned, icon: ClipboardCheck, color: 'var(--color-primary, #6366f1)' },
    { label: 'In Progress', value: summary.in_progress, icon: Clock, color: 'var(--color-info, #e11d48)' },
    { label: 'Due Today', value: summary.due_today, icon: Calendar, color: 'var(--color-warning, #f59e0b)' },
    { label: 'Overdue', value: summary.overdue, icon: AlertTriangle, color: 'var(--color-danger, #ef4444)' },
    { label: 'Escalated', value: summary.escalated, icon: ShieldCheck, color: 'var(--color-warning, #d97706)' },
    { label: 'Completed Today', value: summary.completed_today, icon: CheckCircle, color: 'var(--color-success, #10b981)' },
    { label: 'Completed This Week', value: summary.completed_week, icon: CheckCircle, color: 'var(--color-success, #059669)' },
  ];

  // Group recent assignments by type
  const assignments = data?.recent_assignments || [];
  const groupedTasks = assignments.reduce((acc: Record<string, any[]>, item) => {
    const typeLabel = item.assignment_type_display || item.assignment_type.replaceAll('_', ' ');
    if (!acc[typeLabel]) acc[typeLabel] = [];
    acc[typeLabel].push(item);
    return acc;
  }, {});

  const hasWork = assignments.length > 0;

  return (
    <>
      <AdminPageHeader
        eyebrow="Staff workspace"
        title="Dashboard Overview"
        description="Daily operational queue metrics and assignments."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {syncTime && <small style={{ color: 'var(--color-muted, #9ca3af)' }}>Synced: {syncTime}</small>}
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={16} className={isFetching ? 'admin-spinner' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {data?.unread_notifications && data.unread_notifications > 0 ? (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          color: 'var(--color-warning-text, #d97706)',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          You have {data.unread_notifications} unread notification{data.unread_notifications !== 1 ? 's' : ''}. Check the notifications menu.
        </div>
      ) : null}

      {/* Grid count cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: 'var(--admin-surface, #f9fafb)',
            border: '1px solid var(--admin-line, rgba(0, 0, 0, 0.08))',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: 'var(--admin-shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
          }}>
            <div style={{ background: `${color}15`, padding: '0.5rem', borderRadius: '8px' }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--admin-text, #111827)' }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #6b7280)', fontWeight: '500' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Work grouped sections */}
      <AdminPanel title="Your Queue by Task Types" subtitle="Assigned operational verification/moderation items">
        {!hasWork ? (
          <AdminEmptyState
            title="No work assigned yet"
            description="Tasks assigned by an Admin will appear here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {Object.entries(groupedTasks).map(([type, tasks]) => (
              <div key={type} style={{
                border: '1px solid var(--admin-line, rgba(0,0,0,0.08))',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'var(--admin-surface-alt, #f3f4f6)',
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: 'var(--admin-text, #111827)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--admin-line, rgba(0,0,0,0.08))'
                }}>
                  {type} ({tasks.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tasks.map((task, idx) => (
                    <div key={task.id} style={{
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: idx < tasks.length - 1 ? '1px solid var(--admin-line, rgba(0,0,0,0.08))' : 'none',
                      background: 'var(--admin-surface, #fff)'
                    }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--admin-text, #111827)' }}>
                          {task.member_name || 'Verification request'}
                        </span>
                        {task.notes && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted, #6b7280)', marginTop: '0.2rem' }}>
                            Note: {task.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted, #6b7280)' }}>
                        Priority: <strong style={{ color: task.priority === 'URGENT' ? '#ef4444' : '#6b7280' }}>{task.priority}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      {/* Activity History */}
      {data?.recent_activity && data.recent_activity.length > 0 && (
        <AdminPanel title="Recent Activity History" className="mt-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.recent_activity.map((act) => (
              <div key={act.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px dashed var(--admin-line, rgba(0,0,0,0.05))',
                fontSize: '0.85rem'
              }}>
                <span style={{ color: 'var(--admin-text, #111827)' }}>{act.description || act.action}</span>
                <span style={{ color: 'var(--admin-text-muted, #9ca3af)' }}>
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}
    </>
  );
}
