'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import { Filter, LoaderCircle, RefreshCw, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchApi } from '../../services/apiClient';
import {
  normalizeMemberPhoto,
  type MemberPhoto,
  useApproveProfilePhotoMutation,
  useRejectProfilePhotoMutation,
} from '../../services/photoApi';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader,
  AdminPagination, AdminPanel, AdminStatusBadge, formatAdminDate
} from '../../components/admin/AdminUI';
import AdminAssignModal from '../../components/admin/AdminAssignModal';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import PhotoModerationGallery from '../../components/admin/PhotoModerationGallery';
import '../../pages/AdminPage.css';

interface PhotoVerification {
  id: string;
  member?: {
    id: string;
    full_name?: string;
    email?: string;
  } | null;
  verification_type: string;
  status: string;
  priority: string;
  submitted_at: string;
  rejection_reason?: string | null;
  current_assignment?: {
    assigned_to_staff?: {
      full_name?: string;
    } | null;
  } | null;
  profile_photos: MemberPhoto[];
}

interface PhotoVerificationWire extends Omit<PhotoVerification, 'profile_photos'> {
  profile_photos?: unknown[];
}

interface PhotoVerificationPage {
  count: number;
  results: PhotoVerificationWire[];
}

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default function AdminPhotoApprovalsPage() {
  const { hasAdminPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [verifications, setVerifications] = useState<PhotoVerification[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [status, setStatus] = useState(searchParams.get('status') || 'pending_review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [approveProfilePhoto] = useApproveProfilePhotoMutation();
  const [rejectProfilePhoto] = useRejectProfilePhotoMutation();
  
  // Assign modal state
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '20',
        verification_type: 'PROFILE_PHOTO'
      };
      if (status) params.status = status;
      
      const data = await fetchApi<PhotoVerificationPage>('/admin/verifications/', { params });
      setVerifications((data.results ?? [])
        .filter((verification) => verification.verification_type === 'PROFILE_PHOTO')
        .map((verification) => ({
          ...verification,
          profile_photos: (verification.profile_photos ?? [])
            .map(normalizeMemberPhoto)
            .filter((photo) => Boolean(photo.id)),
        })));
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo verifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  useRealtimeRefresh({
    eventTypes: [
      'photo.uploaded',
      'photo.approved',
      'photo.rejected',
      'photo.deleted',
    ],
    refresh: load,
    debounceMs: 300,
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [status, page]);

  const canAssign = hasAdminPermission('verification.assign');
  const canApprove = hasAdminPermission('verification.approve');
  const canReject = hasAdminPermission('verification.reject');

  const handleApprovePhoto = async (photoId: string) => {
    setBusyPhotoId(photoId);
    setActionError('');
    try {
      await approveProfilePhoto(photoId).unwrap();
      await load();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be approved.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleRejectPhoto = async (photoId: string, reason: string) => {
    if (!reason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }
    setBusyPhotoId(photoId);
    setActionError('');
    try {
      await rejectProfilePhoto({ photoId, reason }).unwrap();
      await load();
    } catch (err) {
      setActionError(actionErrorMessage(err, 'The profile photo could not be rejected.'));
    } finally {
      setBusyPhotoId(null);
    }
  };

  if (loading && !verifications.length) return <AdminLoading label="Loading photo verifications queueâ€¦" />;
  if (error && !verifications.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & Safety"
        title="Photo approvals"
        description="Verify submitted profile pictures. Route photo verifications to Staff specialists."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />

      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-filter-row">
            <label><Filter />Status:
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending_review">Pending Review</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="">All statuses</option>
              </select>
            </label>
          </div>
        </div>

        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updatingâ€¦</div>}
        {actionError && <div className="admin-inline-error" role="alert">{actionError}</div>}

        {verifications.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Pending Photos</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Current Assignee</th>
                  <th>Submitted At</th>
                  {canAssign && <th className="admin-table-actions-heading">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {verifications.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Member">
                      <div className="admin-member-cell">
                        <span className="admin-list-avatar">
                          {(v.member?.full_name || v.member?.email || 'M')[0].toUpperCase()}
                        </span>
                        <p>
                          <strong>{v.member?.full_name || 'Unnamed member'}</strong>
                          <small>{v.member?.email}</small>
                        </p>
                      </div>
                    </td>
                    <td data-label="Pending Photos" style={{ minWidth: 0 }}>
                      <PhotoModerationGallery
                        photos={v.profile_photos}
                        canApprove={canApprove}
                        canReject={canReject}
                        busyPhotoId={busyPhotoId}
                        onApprove={handleApprovePhoto}
                        onReject={handleRejectPhoto}
                      />
                    </td>
                    <td data-label="Priority">{v.priority}</td>
                    <td data-label="Status">
                      <AdminStatusBadge status={v.status} />
                      {v.status === 'REJECTED' && v.rejection_reason ? (
                        <small style={{ display: 'block', marginTop: '0.35rem', color: '#b91c1c' }}>
                          {v.rejection_reason}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Current Assignee">
                      {v.current_assignment?.assigned_to_staff?.full_name || (
                        <span style={{ color: 'var(--admin-text-muted, #9ca3af)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td data-label="Submitted">{formatAdminDate(v.submitted_at)}</td>
                    {canAssign && (
                      <td className="admin-row-actions" data-label="Actions">
                        {v.status === 'PENDING' && (
                          <button
                            type="button"
                            className="admin-btn"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'var(--color-primary, #6366f1)', border: 'none' }}
                            onClick={() => setAssignTargetId(v.id)}
                          >
                            <ClipboardCheck size={14} /> Assign Task
                          </button>
                        )}
                        {v.status !== 'PENDING' && (
                          <span style={{ color: 'var(--admin-text-muted, #9ca3af)', fontSize: '0.85rem' }}>Assigned</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No photo reviews pending"
            description="The queue is clear. New submissions will appear here automatically."
          />
        )}

        <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
      </AdminPanel>

      <AdminAssignModal
        open={Boolean(assignTargetId)}
        onClose={() => setAssignTargetId(null)}
        targetId={assignTargetId || ''}
        assignmentType="PHOTO_VERIFICATION"
        onSuccess={load}
      />
    </>
  );
}
