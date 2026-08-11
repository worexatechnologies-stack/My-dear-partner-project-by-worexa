'use client';

import { useState } from 'react';
import { useGetEligibleStaffQuery, useGetEligibleSupportAgentsQuery, useAssignWorkMutation, useAssignTicketMutation } from '../../services/adminAssignmentsApi';
import { LoaderCircle, AlertTriangle } from 'lucide-react';

interface AdminAssignModalProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  assignmentType: 'PROFILE_VERIFICATION' | 'PHOTO_VERIFICATION' | 'DOCUMENT_VERIFICATION' | 'TICKET_ASSIGNMENT';
  onSuccess: () => void;
}

export default function AdminAssignModal({ open, onClose, targetId, assignmentType, onSuccess }: AdminAssignModalProps) {
  const isTicket = assignmentType === 'TICKET_ASSIGNMENT';

  // Load eligible workers
  const { data: eligibleStaff, error: staffError, isLoading: loadingStaff } = useGetEligibleStaffQuery(
    { verification_request_id: targetId },
    { skip: !open || isTicket }
  );

  const { data: eligibleAgents, error: agentsError, isLoading: loadingAgents } = useGetEligibleSupportAgentsQuery(
    { ticket_id: targetId },
    { skip: !open || !isTicket }
  );

  // Mutations
  const [assignWork, { isLoading: assigningWork }] = useAssignWorkMutation();
  const [assignTicket, { isLoading: assigningTicket }] = useAssignTicketMutation();

  // Form states
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      setActionError('Please select a team member.');
      return;
    }
    setActionError('');

    try {
      if (isTicket) {
        await assignTicket({
          ticket_id: targetId,
          assigned_to_support: selectedWorkerId,
          notes,
        }).unwrap();
      } else {
        await assignWork({
          assigned_to_staff: selectedWorkerId,
          assignment_type: assignmentType,
          priority,
          due_at: dueAt || null,
          notes,
          related_id: targetId,
        }).unwrap();
      }
      onSuccess();
      onClose();
      // Reset form states
      setSelectedWorkerId('');
      setNotes('');
      setDueAt('');
      setPriority('NORMAL');
    } catch (err: any) {
      setActionError(err.message || 'Assignment failed.');
    }
  };

  const loading = isTicket ? loadingAgents : loadingStaff;
  const fetchError = isTicket ? agentsError : staffError;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background: 'var(--admin-surface, #fff)',
        border: '1px solid var(--admin-line, rgba(0,0,0,0.15))',
        borderRadius: '12px',
        width: '480px',
        maxWidth: '90%',
        padding: '1.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        color: 'var(--admin-text, #111827)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>
            {isTicket ? 'Assign Support Ticket' : 'Assign Moderation Task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--admin-text-muted, #6b7280)' }}
          >
            Ã—
          </button>
        </div>

        {actionError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            {actionError}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2rem 0' }}>
            <LoaderCircle className="admin-spinner" size={24} />
            <small style={{ color: 'var(--admin-text-muted, #6b7280)' }}>Loading eligible team members...</small>
          </div>
        ) : fetchError ? (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '1.5rem 0' }}>
            <AlertTriangle style={{ marginBottom: '0.5rem' }} />
            <div>Could not fetch eligible workers list.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>
                  Select Assignee:
                </label>
                {isTicket ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {eligibleAgents?.map((agent) => {
                      const workloadPercent = Math.min(100, ((agent.workload?.assigned || 0) / (agent.workload?.capacity || 10)) * 100);
                      const isSelected = selectedWorkerId === agent.id;
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedWorkerId(agent.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #6366f1' : '1px solid var(--admin-line, rgba(0,0,0,0.15))',
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}>
                            {agent.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{agent.full_name}</span>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: agent.is_online ? '#d1fae5' : '#f3f4f6',
                                color: agent.is_online ? '#065f46' : '#374151',
                                fontWeight: '500'
                              }}>
                                {agent.is_online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #6b7280)' }}>
                                {agent.specialization}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #6b7280)' }}>â€¢</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #6b7280)' }}>
                                Workload: {agent.workload?.assigned || 0}/{agent.workload?.capacity || 10}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '0.35rem' }}>
                              <div style={{ width: `${workloadPercent}%`, height: '100%', background: workloadPercent > 80 ? '#ef4444' : '#10b981', borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {eligibleStaff?.map((staff) => {
                      const workloadPercent = Math.min(100, ((staff.workload?.assigned || 0) / (staff.workload?.capacity || 10)) * 100);
                      const isSelected = selectedWorkerId === staff.id;
                      return (
                        <div
                          key={staff.id}
                          onClick={() => setSelectedWorkerId(staff.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #6366f1' : '1px solid var(--admin-line, rgba(0,0,0,0.15))',
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#10b981',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}>
                            {staff.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{staff.full_name}</span>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: staff.is_online ? '#d1fae5' : '#f3f4f6',
                                color: staff.is_online ? '#065f46' : '#374151',
                                fontWeight: '500'
                              }}>
                                {staff.is_online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #6b7280)' }}>
                                Workload: {staff.workload?.assigned || 0}/{staff.workload?.capacity || 10}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '0.35rem' }}>
                              <div style={{ width: `${workloadPercent}%`, height: '100%', background: workloadPercent > 80 ? '#ef4444' : '#10b981', borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>

            {!isTicket && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: '600', fontSize: '0.85rem' }}>
                    Priority:
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-line, rgba(0,0,0,0.15))',
                      background: 'transparent',
                      color: 'var(--admin-text, #111827)'
                    }}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: '600', fontSize: '0.85rem' }}>
                    Due Date:
                  </label>
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-line, rgba(0,0,0,0.15))',
                      background: 'transparent',
                      color: 'var(--admin-text, #111827)'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: '600', fontSize: '0.85rem' }}>
                Assignment Note:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instructions or notes for the team member..."
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-line, rgba(0,0,0,0.15))',
                  background: 'transparent',
                  color: 'var(--admin-text, #111827)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={onClose}
                disabled={assigningWork || assigningTicket}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-btn"
                disabled={assigningWork || assigningTicket || !selectedWorkerId}
                style={{ background: 'var(--color-primary, #6366f1)', border: 'none', color: '#fff' }}
              >
                {assigningWork || assigningTicket ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
