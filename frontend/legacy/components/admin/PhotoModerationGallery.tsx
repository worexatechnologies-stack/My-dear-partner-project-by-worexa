'use client';

import { useId, useState } from 'react';

import ProfileImage from '@/components/profile/ProfileImage';
import type { MemberPhoto } from '../../services/photoApi';
import { AdminStatusBadge } from './AdminUI';
import AdminPhotoLightbox, { LightboxPhoto } from './AdminPhotoLightbox';
import { Maximize2 } from 'lucide-react';

interface PhotoModerationGalleryProps {
  photos: MemberPhoto[];
  canApprove: boolean;
  canReject: boolean;
  reviewEnabled?: boolean;
  busyPhotoId?: string | null;
  onApprove: (photoId: string) => Promise<void>;
  onReject: (photoId: string, reason: string) => Promise<void>;
  emptyMessage?: string;
}

export default function PhotoModerationGallery({
  photos,
  canApprove,
  canReject,
  reviewEnabled = true,
  busyPhotoId = null,
  onApprove,
  onReject,
  emptyMessage = 'No pending photo records are available for this review.',
}: PhotoModerationGalleryProps) {
  const reasonIdPrefix = useId();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxPhotos: LightboxPhoto[] = photos.map((p, idx) => ({
    id: p.id,
    src: `/api/proxy/profile-photos/${p.id}/image/`,
    alt: `Profile photo ${idx + 1}`,
    is_primary: p.is_primary,
    status: p.status,
    uploaded_at: p.updated_at,
  }));

  if (!photos.length) {
    return (
      <p className="photo-moderation-empty">{emptyMessage}</p>
    );
  }

  return (
    <div className="photo-moderation-grid" aria-label="Profile photos awaiting moderation">
      {photos.map((photo, index) => {
        const status = photo.status.toLowerCase();
        const pending = status === 'pending';
        const reason = reasons[photo.id] ?? '';
        const reasonId = `${reasonIdPrefix}-${photo.id}`;
        const busy = busyPhotoId === photo.id;
        const anotherPhotoIsBusy = Boolean(busyPhotoId) && !busy;

        return (
          <article key={photo.id} className="photo-moderation-card">
            <div
              className="relative cursor-zoom-in group/photo overflow-hidden rounded-xl"
              onClick={() => setLightboxIndex(index)}
              title="Click anywhere to zoom full resolution photo"
            >
              <ProfileImage
                photoId={photo.id}
                variant="image"
                updatedAt={photo.updated_at}
                alt={`Profile photo ${index + 1}`}
                size="full"
                aspectRatio="4:5"
                shape="rounded"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-md">
                  <Maximize2 className="h-3.5 w-3.5" /> Zoom
                </span>
              </div>
            </div>

            <div className="photo-moderation-meta">
              <AdminStatusBadge status={status} />
              {photo.is_primary ? (
                <span className="photo-moderation-primary">Primary</span>
              ) : null}
            </div>

            {status === 'rejected' && photo.rejection_reason ? (
              <p className="photo-moderation-reason">
                <strong>Reason:</strong> {photo.rejection_reason}
              </p>
            ) : null}

            {pending && reviewEnabled && (canApprove || canReject) ? (
              <div className="photo-moderation-actions">
                {canReject ? (
                  <>
                    <label htmlFor={reasonId} className="photo-moderation-label">
                      Rejection reason
                    </label>
                    <textarea
                      id={reasonId}
                      value={reason}
                      onChange={(event) => setReasons((current) => ({
                        ...current,
                        [photo.id]: event.target.value,
                      }))}
                      rows={2}
                      maxLength={1000}
                      placeholder="Required before rejecting"
                      disabled={Boolean(busyPhotoId)}
                      className="photo-moderation-textarea"
                    />
                  </>
                ) : null}

                <div className="photo-moderation-buttons">
                  {canApprove ? (
                    <button
                      type="button"
                      className="admin-btn photo-moderation-btn photo-moderation-approve"
                      onClick={() => void onApprove(photo.id)}
                      disabled={Boolean(busyPhotoId)}
                    >
                      {busy ? 'Saving…' : 'Approve photo'}
                    </button>
                  ) : null}
                  {canReject ? (
                    <button
                      type="button"
                      className="admin-btn photo-moderation-btn photo-moderation-reject"
                      onClick={() => void onReject(photo.id, reason.trim())}
                      disabled={Boolean(busyPhotoId) || !reason.trim()}
                    >
                      {busy ? 'Saving…' : 'Reject photo'}
                    </button>
                  ) : null}
                </div>
                {anotherPhotoIsBusy ? (
                  <span className="sr-only">Another photo decision is being saved.</span>
                ) : null}
              </div>
            ) : null}

            {pending && !reviewEnabled ? (
              <p className="photo-moderation-hint">
                Start this assigned review before making a decision.
              </p>
            ) : null}
          </article>
        );
      })}

      <AdminPhotoLightbox
        isOpen={lightboxIndex !== null}
        photos={lightboxPhotos}
        currentIndex={lightboxIndex ?? 0}
        memberName="Photo Moderation"
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(idx) => setLightboxIndex(idx)}
        onApprove={canApprove ? (photoId) => onApprove(photoId) : undefined}
        onReject={canReject ? (photoId) => {
          const reason = reasons[photoId] || 'Photo does not meet guidelines.';
          onReject(photoId, reason);
        } : undefined}
        isActionBusy={Boolean(busyPhotoId)}
      />
    </div>
  );
}
