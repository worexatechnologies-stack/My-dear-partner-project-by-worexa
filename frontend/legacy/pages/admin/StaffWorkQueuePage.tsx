'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import {
  useGetMyWorkQuery, useStartWorkMutation, useApproveWorkMutation,
  useRejectWorkMutation, useEscalateWorkMutation, useAddWorkNoteMutation,
  type StaffWorkAssignment, type StaffWorkQuery,
} from '../../services/staffApi';
import {
  useApproveProfilePhotoMutation,
  useRejectProfilePhotoMutation,
} from '../../services/photoApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Filter, RefreshCw, LoaderCircle, MoreHorizontal, UserCheck, ShieldAlert,
  ChevronDown, ChevronRight, ClipboardCheck, TriangleAlert
} from 'lucide-react';
import {
  AdminPageHeader, AdminPanel, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminStatusBadge, AdminPagination, formatAdminDate, AdminConfirmDialog
} from '../../components/admin/AdminUI';
import PhotoModerationGallery from '../../components/admin/PhotoModerationGallery';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default function StaffWorkQueuePage() {
  const { hasAdminPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [assignmentType, setAssignmentType] = useState(searchParams.get('assignment_type') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [dueDate, setDueDate] = useState(searchParams.get('due_date') || '');
  const [ordering, setOrdering] = useState(searchParams.get('ordering') || '-created_at');

  const [selectedTask, setSelectedTask] = useState<StaffWorkAssignment | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Mutations
  const [startWork] = useStartWorkMutation();
  const [approveWork] = useApproveWorkMutation();
  const [rejectWork] = useRejectWorkMutation();
  const [escalateWork] = useEscalateWorkMutation();
  const [addWorkNote] = useAddWorkNoteMutation();
  const [approveProfilePhoto] = useApproveProfilePhotoMutation();
  const [rejectProfilePhoto] = useRejectProfilePhotoMutation();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, assignmentType, priority, dueDate, ordering]);

  const queryParams: StaffWorkQuery = {
    page,
    page_size: 15,
    ordering,
  };
  if (search) queryParams.search = search;
  if (status) queryParams.status = status;
  if (assignmentType) queryParams.assignment_type = assignmentType;
  if (priority) queryParams.priority = priority;
  if (dueDate) queryParams.due_date = dueDate;

  const { data, error, isLoading, refetch, isFetching } = useGetMyWorkQuery(queryParams);

  useRealtimeRefresh({
    eventTypes: [
      'verification.submitted',
      'verification.updated',
      'photo.uploaded',
      'document.uploaded',
      'support.ticket_created',
      'support.ticket_assigned',
      'support.ticket_claimed',
    ],
    refresh: refetch,
    debounceMs: 350,
  });

  // Sync URL search params
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (status) next.set('status', status);
    if (assignmentType) next.set('assignment_type', assignmentType);
    if (priority) next.set('priority', priority);
    if (dueDate) next.set('due_date', dueDate);
    if (ordering !== '-created_at') next.set('ordering', ordering);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [search, status, assignmentType, priority, dueDate, ordering, page]);

  const handleStartReview = async (task: StaffWorkAssignment) => {
    setBusy(true);
    setActionError('');
    try {
      await startWork({ assignmentId: task.id }).unwrap();
      refetch();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Failed to start review.'));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (task: StaffWorkAssignment) => {
    const ok = window.confirm('Approve this verification request?');
    if (!ok) return;
    setBusy(true);
    setActionError('');
    try {
      await approveWork({ assignmentId: task.id, notes: noteInput }).unwrap();
      setSelectedTask(null);
      setNoteInput('');
      refetch();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Failed to approve task.'));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (task: StaffWorkAssignment) => {
    const reason = window.prompt('Specify the required rejection reason:');
    if (!reason) return;
    setBusy(true);
    setActionError('');
    try {
      await rejectWork({ assignmentId: task.id, notes: reason }).unwrap();
      setSelectedTask(null);
      setNoteInput('');
      refetch();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Failed to reject task.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async (task: StaffWorkAssignment) => {
    const reason = window.prompt('Explain the reason for escalation:');
    if (!reason) return;
    setBusy(true);
    setActionError('');
    try {
      await escalateWork({ assignmentId: task.id, notes: reason }).unwrap();
      setSelectedTask(null);
      setNoteInput('');
      refetch();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Failed to escalate task.'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedTask || !noteInput.trim()) return;
    setBusy(true);
    setActionError('');
    try {
      await addWorkNote({ assignmentId: selectedTask.id, notes: noteInput }).unwrap();
      setNoteInput('');
      refetch();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Failed to add internal note.'));
    } finally {
      setBusy(false);
    }
  };

  const refreshSelectedTask = async (taskId: string, reviewedPhotoId: string) => {
    const refreshed = await refetch();
    if (refreshed.data) {
      setSelectedTask(refreshed.data.results.find((task) => task.id === taskId) ?? null);
      return;
    }
    setSelectedTask((current) => current?.id === taskId
      ? { ...current, profile_photos: current.profile_photos.filter((photo) => photo.id !== reviewedPhotoId) }
      : current);
  };

  const handleApprovePhoto = async (photoId: string) => {
    if (!selectedTask || selectedTask.assignment_type !== 'PHOTO_VERIFICATION') return;
    const taskId = selectedTask.id;
    setBusyPhotoId(photoId);
    setActionError('');
    try {
      await approveProfilePhoto(photoId).unwrap();
      await refreshSelectedTask(taskId, photoId);
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be approved.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleRejectPhoto = async (photoId: string, reason: string) => {
    if (!selectedTask || selectedTask.assignment_type !== 'PHOTO_VERIFICATION') return;
    if (!reason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }
    const taskId = selectedTask.id;
    setBusyPhotoId(photoId);
    setActionError('');
    try {
      await rejectProfilePhoto({ photoId, reason }).unwrap();
      await refreshSelectedTask(taskId, photoId);
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be rejected.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  if (isLoading) return <AdminLoading label="Loading your work queue..." />;
  if (error) return <AdminErrorState message="Could not load your work queue." onRetry={refetch} />;

  const results = data?.results || [];
  const canApprovePhotos = hasAdminPermission('verification.approve');
  const canRejectPhotos = hasAdminPermission('verification.reject');

  return (
    <>
      <AdminPageHeader
        eyebrow="Staff workspace"
        title="My Assigned Queue"
        description="Search, filter and resolve your assigned verifications and tasks."
        actions={
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={16} className={isFetching ? 'admin-spinner' : ''} /> Refresh
          </button>
        }
      />

      <AdminPanel className="admin-table-panel">
        {/* Toolbar */}
        <div className="admin-table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="admin-search-field" style={{ flexGrow: 1, minWidth: '240px' }}>
            <Search />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search member name or email..."
            />
          </div>

          <div className="admin-filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label><Filter />
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="">All Statuses</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ESCALATED">Escalated</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>

            <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} aria-label="Assignment Type">
              <option value="">All Tasks</option>
              <option value="PROFILE_VERIFICATION">Profile Verification</option>
              <option value="PHOTO_VERIFICATION">Photo Verification</option>
              <option value="DOCUMENT_VERIFICATION">Document Verification</option>
              <option value="COMPLAINT_REVIEW">Complaint Review</option>
              <option value="PROFILE_REPORT_REVIEW">Profile Report Review</option>
              <option value="MODERATION_TASK">Moderation Task</option>
            </select>

            <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>

            <select value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due Date">
              <option value="">All Due Dates</option>
              <option value="today">Due Today</option>
              <option value="overdue">Overdue Only</option>
            </select>

            <select value={ordering} onChange={(e) => setOrdering(e.target.value)} aria-label="Sorting">
              <option value="-created_at">Newest First</option>
              <option value="priority">Priority: Urgent First</option>
              <option value="due_date">Due Date: Soonest First</option>
            </select>
          </div>
        </div>

        {actionError && <div className="admin-inline-error">{actionError}</div>}
        {isFetching && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Syncing queue...</div>}

        {!results.length ? (
          <AdminEmptyState
            title="No work assigned yet"
            description="Tasks assigned by an Admin will appear here."
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Task Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  <th>Assigned By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((task) => (
                  <tr key={task.id}>
                    <td data-label="Member">
                      <div style={{ fontWeight: '600', color: 'var(--admin-text, #111827)' }}>{task.member_name}</div>
                      {task.member_email && <small style={{ color: 'var(--admin-text-muted, #6b7280)' }}>{task.member_email}</small>}
                    </td>
                    <td data-label="Task Type">
                      <span style={{ fontSize: '0.85rem' }}>{task.assignment_type_display || task.assignment_type.replaceAll('_', ' ')}</span>
                    </td>
                    <td data-label="Priority">
                      <span style={{
                        fontSize: '0.80rem',
                        fontWeight: '700',
                        color: task.priority === 'URGENT' ? '#ef4444' : task.priority === 'HIGH' ? '#f59e0b' : 'inherit'
                      }}>{task.priority}</span>
                    </td>
                    <td data-label="Status">
                      <AdminStatusBadge status={task.status} />
                    </td>
                    <td data-label="Assigned">{formatAdminDate(task.created_at)}</td>
                    <td data-label="Due">{task.due_at ? formatAdminDate(task.due_at) : 'N/A'}</td>
                    <td data-label="Assigned By">{task.assigned_by_name}</td>
                    <td className="admin-row-actions" data-label="Actions">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {task.status === 'ASSIGNED' && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => handleStartReview(task)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            disabled={busy}
                          >
                            Start Review
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => setSelectedTask(task)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#e11d48', border: 'none' }}
                        >
                          Open Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination page={page} count={data?.count || 0} pageSize={15} onPageChange={setPage} />
      </AdminPanel>

      {/* Side-out details drawer */}
      {selectedTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '560px',
          maxWidth: '100%',
          height: '100vh',
          background: 'var(--admin-dark-modal-bg, #fff)',
          borderLeft: '1px solid var(--admin-line, rgba(0,0,0,0.15))',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }} className="admin-dark-modal">
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--admin-line, rgba(0,0,0,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--admin-text, #111827)' }}>Task details file</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted, #6b7280)' }}>ID: {selectedTask.id}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTask(null)}
              style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--admin-text-muted, #6b7280)' }}
            >
              Ã—
            </button>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <small style={{ color: 'var(--admin-text-muted, #6b7280)', fontWeight: '500' }}>MEMBER DETAILS</small>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--admin-text, #111827)' }}>{selectedTask.member_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted, #6b7280)' }}>{selectedTask.member_email}</div>
              </div>

              <div>
                <small style={{ color: 'var(--admin-text-muted, #6b7280)', fontWeight: '500' }}>ASSIGNMENT SPECIFICS</small>
                <div>Type: <strong>{selectedTask.assignment_type_display || selectedTask.assignment_type.replaceAll('_', ' ')}</strong></div>
                <div>Priority: <strong>{selectedTask.priority}</strong></div>
                <div>Status: <AdminStatusBadge status={selectedTask.status} /></div>
                <div>Assigned: {formatAdminDate(selectedTask.created_at)}</div>
                {selectedTask.due_at && <div>Due Date: {formatAdminDate(selectedTask.due_at)}</div>}
                <div>Assigned By: {selectedTask.assigned_by_name}</div>
              </div>

              {selectedTask.notes && (
                <div>
                  <small style={{ color: 'var(--admin-text-muted, #6b7280)', fontWeight: '500' }}>ADMIN ASSIGNMENT NOTE</small>
                  <p style={{ margin: '0.2rem 0', background: 'var(--admin-surface-alt, #f3f4f6)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                    {selectedTask.notes}
                  </p>
                </div>
              )}

              {selectedTask.assignment_type === 'PHOTO_VERIFICATION' ? (
                <section aria-labelledby="assigned-photo-review-heading">
                  <h4 id="assigned-photo-review-heading" style={{ margin: '0 0 0.75rem', color: 'var(--admin-text, #111827)' }}>
                    Assigned photo review
                  </h4>
                  <PhotoModerationGallery
                    photos={selectedTask.profile_photos}
                    canApprove={canApprovePhotos}
                    canReject={canRejectPhotos}
                    reviewEnabled={selectedTask.status === 'IN_PROGRESS'}
                    busyPhotoId={busyPhotoId}
                    onApprove={handleApprovePhoto}
                    onReject={handleRejectPhoto}
                    emptyMessage={selectedTask.status === 'COMPLETED'
                      ? 'This photo review has been completed.'
                      : 'No pending photo is available. Refresh or escalate this task; bulk photo decisions are disabled.'}
                  />
                </section>
              ) : null}
            </div>

            {selectedTask.status !== 'COMPLETED' && (
              <div style={{ borderTop: '1px solid var(--admin-line, rgba(0,0,0,0.08))', paddingTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Internal processing notes:</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Provide notes or verification reasoning..."
                  style={{ width: '100%', height: '100px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--admin-line, rgba(0,0,0,0.15))', background: 'transparent', color: 'var(--admin-text, #111827)' }}
                />

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  {selectedTask.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handleStartReview(selectedTask)}
                      disabled={busy}
                    >
                      Start Review
                    </button>
                  )}
                  {selectedTask.status === 'IN_PROGRESS' && selectedTask.assignment_type !== 'PHOTO_VERIFICATION' && (
                    <>
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ background: '#059669', border: 'none' }}
                        onClick={() => handleApprove(selectedTask)}
                        disabled={busy}
                      >
                        Approve Request
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ background: '#dc2626', border: 'none' }}
                        onClick={() => handleReject(selectedTask)}
                        disabled={busy}
                      >
                        Reject Request
                      </button>
                    </>
                  )}
                  {selectedTask.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ background: '#d97706', border: 'none' }}
                      onClick={() => handleEscalate(selectedTask)}
                      disabled={busy || Boolean(busyPhotoId)}
                    >
                      Escalate
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={handleAddNote}
                    disabled={busy || !noteInput.trim()}
                  >
                    Add note only
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
