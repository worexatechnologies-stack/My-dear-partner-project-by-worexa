'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  Star,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Clock,
  Image as ImageIcon,
  RefreshCw,
  MoreVertical,
  Eye,
  RotateCcw,
} from 'lucide-react';

import ProfileImage from '@/components/profile/ProfileImage';
import { useAuth } from '@/legacy/contexts/AuthContext';
import {
  MAX_PROFILE_PHOTO_BYTES,
  type MemberPhoto,
  useDeletePhotoMutation,
  useGetMyPhotosQuery,
  useReplacePhotoMutation,
  useSetPrimaryPhotoMutation,
  useUploadPhotoMutation,
} from '@/legacy/services/photoApi';
import { friendlyMessage, ACTION_MESSAGES, SUCCESS_MESSAGES } from '@/lib/error-messages';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ACCEPTED_IMAGE_NAME = /\.(?:jpe?g|png|webp)$/i;

function selectedFileError(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase()) || !ACCEPTED_IMAGE_NAME.test(file.name)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) return 'Image size must be 10 MB or smaller.';
  return null;
}

const MIN_PHOTO_WIDTH = 600;
const MIN_PHOTO_HEIGHT = 750;

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

async function imageDimensionError(file: File): Promise<string | null> {
  try {
    const { width, height } = await readImageDimensions(file);
    if (width < MIN_PHOTO_WIDTH || height < MIN_PHOTO_HEIGHT) {
      return `Image must be at least ${MIN_PHOTO_WIDTH} × ${MIN_PHOTO_HEIGHT} px (your image is ${width} × ${height} px).`;
    }
    return null;
  } catch {
    return null;
  }
}

function uploadErrorMessage(error: unknown, action: keyof typeof ACTION_MESSAGES = 'photo_upload'): string {
  if (!error || typeof error !== 'object') return ACTION_MESSAGES[action] ?? ACTION_MESSAGES.photo_upload;
  const record = error as { status?: unknown; data?: unknown; message?: unknown };
  if (record.status === 'FETCH_ERROR' || record.status === 'TIMEOUT_ERROR') {
    return friendlyMessage({ code: 'NETWORK_ERROR' });
  }
  const data = (record.data && typeof record.data === 'object' ? record.data : null) as {
    code?: unknown;
    message?: unknown;
    errors?: unknown;
  } | null;
  const status = typeof record.status === 'number' ? record.status : undefined;
  return friendlyMessage({
    code: typeof data?.code === 'string' ? data.code : null,
    message:
      typeof data?.message === 'string'
        ? data.message
        : typeof record.message === 'string'
          ? record.message
          : null,
    status,
    errors: data?.errors ?? null,
  }) || ACTION_MESSAGES[action] || ACTION_MESSAGES.photo_upload;
}

export default function PhotosPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);

  const { data: photosData, isLoading, refetch } = useGetMyPhotosQuery();
  const [uploadPhoto] = useUploadPhotoMutation();
  const [replacePhoto] = useReplacePhotoMutation();
  const [deletePhoto] = useDeletePhotoMutation();
  const [setPrimary] = useSetPrimaryPhotoMutation();

  const displayPhotos = photosData?.photos ?? [];
  const maxPhotos = photosData?.max_photos ?? 6;
  const canUploadMore = displayPhotos.length < maxPhotos;
  const pendingCount = displayPhotos.filter((photo) => photo.status === 'pending').length;
  const userGender = typeof user?.gender === 'string' ? user.gender : undefined;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = selectedFileError(file);
    if (validationError) {
      setError(validationError);
      clearSelectedFile();
      return;
    }

    const dimError = await imageDimensionError(file);
    if (dimError) {
      setError(dimError);
      clearSelectedFile();
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const beginReplace = (photoId: string) => {
    setReplaceTargetId(photoId);
    setError('');
    setOpenMenuId(null);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleReplaceSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const photoId = replaceTargetId;
    event.target.value = '';
    if (!file || !photoId) {
      setReplaceTargetId(null);
      return;
    }

    const validationError = selectedFileError(file);
    if (validationError) {
      setError(validationError);
      setReplaceTargetId(null);
      return;
    }

    const dimError = await imageDimensionError(file);
    if (dimError) {
      setError(dimError);
      setReplaceTargetId(null);
      return;
    }

    setReplacingPhotoId(photoId);
    setError('');
    try {
      await replacePhoto({ photoId, photo: file }).unwrap();
      await refetch();
    } catch (replaceError) {
      setError(uploadErrorMessage(replaceError, 'photo_replace'));
    } finally {
      setReplacingPhotoId(null);
      setReplaceTargetId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(15);
    setError('');

    try {
      await uploadPhoto(selectedFile).unwrap();
      setUploadProgress(100);
      clearSelectedFile();
      await refetch();
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError, 'photo_upload'));
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    setOpenMenuId(null);
    try {
      await deletePhoto(photoId).unwrap();
      await refetch();
    } catch (deleteError) {
      setError(uploadErrorMessage(deleteError, 'photo_delete'));
    }
  };

  const handleSetPrimary = async (photo: MemberPhoto) => {
    if (photo.status !== 'approved') {
      setError('Only approved photos can be set as primary.');
      return;
    }
    setOpenMenuId(null);
    try {
      await setPrimary(photo.id).unwrap();
      await refetch();
    } catch (primaryError) {
      setError(uploadErrorMessage(primaryError, 'photo_set_primary'));
    }
  };

  const getStatusBadge = (status: MemberPhoto['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
            <Check className="h-3 w-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
            <X className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
            <Clock className="h-3 w-3" />
            Under review
          </span>
        );
    }
  };

  const toggleMenu = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === photoId ? null : photoId);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading profile photos">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleReplaceSelect}
          className="hidden"
          aria-label="Choose replacement profile photo"
        />
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Profile Photos</h1>
          <p className="text-lg text-gray-600">
            Upload up to {maxPhotos} photos. Only approved photos are visible to other members.
          </p>
        </motion.div>

        {pendingCount ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            <strong>{pendingCount} photo{pendingCount === 1 ? '' : 's'} pending approval.</strong> Your photos are saved securely and visible to you, but other members will see a placeholder until an Admin or Super Admin approves them.
          </div>
        ) : null}

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
              <p className="flex-1 font-medium text-red-800">{error}</p>
              <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-800" aria-label="Dismiss error">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {canUploadMore ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Choose profile photo to upload"
              />

              {!selectedFile ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-100">
                    <ImageIcon className="h-8 w-8 text-rose-600" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-lg font-bold text-gray-900">Upload a photo</h2>
                  <p className="mb-4 text-gray-600">JPEG, PNG, or WebP, up to 10 MB. It will be reviewed before other members can see it.</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-rose-600 hover:to-pink-600"
                  >
                    <Upload className="h-5 w-5" aria-hidden="true" />
                    Choose photo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  <div className="relative w-48 shrink-0">
                    <ProfileImage
                      src={previewUrl}
                      alt={`Preview of ${selectedFile.name}`}
                      size="full"
                      aspectRatio="4:5"
                      shape="rounded"
                      gender={userGender}
                    />
                  </div>

                  <div className="flex-1">
                    <h2 className="mb-2 text-lg font-bold text-gray-900">Ready to upload</h2>
                    <p className="mb-1 text-gray-600"><strong>File:</strong> {selectedFile.name}</p>
                    <p className="mb-4 text-gray-600"><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>

                    {uploading ? (
                      <div className="mb-4" aria-live="polite">
                        <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                          <span>Uploading and processing…</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : null}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="flex-1 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-2 font-bold text-white shadow-lg transition-all hover:from-rose-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Uploading…</span> : 'Upload photo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearSelectedFile();
                          setError('');
                        }}
                        disabled={uploading}
                        className="rounded-lg border-2 border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">{displayPhotos.length} / {maxPhotos} photos uploaded</p>
          </motion.div>
        ) : null}

        {displayPhotos.length ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Your photos</h2>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              {displayPhotos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group"
                >
                  <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 transition-colors hover:border-rose-300">
                    <ProfileImage
                      photoId={photo.id}
                      src={photo.thumbnail_url}
                      variant="thumbnail"
                      version={photo.updated_at}
                      alt={`Profile photo ${index + 1}`}
                      size="full"
                      aspectRatio="4:5"
                      shape="square"
                      gender={userGender}
                    />

                    {photo.is_primary ? (
                      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        Primary
                      </div>
                    ) : null}

                    <div className="absolute right-3 top-3">{getStatusBadge(photo.status)}</div>

                    {/* Quick delete button — always visible */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo.id);
                      }}
                      disabled={replacingPhotoId !== null}
                      className="absolute left-3 bottom-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {/* Three-dot menu */}
                    <div className="absolute right-3 bottom-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => toggleMenu(e, photo.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Photo actions"
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {openMenuId === photo.id ? (
                        <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-xl z-10">
                          {/* Preview */}
                          <button
                            type="button"
                            onClick={() => { setPreviewPhotoId(previewPhotoId === photo.id ? null : photo.id); setOpenMenuId(null); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 text-gray-400" />
                            Preview
                          </button>

                          {/* Set as primary — only for approved non-primary photos */}
                          {!photo.is_primary && photo.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(photo)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-amber-600 hover:bg-amber-50"
                            >
                              <Star className="h-4 w-4" />
                              Set as primary
                            </button>
                          ) : null}

                          {/* Replace — always available, useful for rejected photos */}
                          <button
                            type="button"
                            onClick={() => beginReplace(photo.id)}
                            disabled={replacingPhotoId !== null}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {replacingPhotoId === photo.id ? 'Replacing…' : 'Replace photo'}
                          </button>

                          {/* Delete — always available */}
                          <button
                            type="button"
                            onClick={() => handleDelete(photo.id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 border-t border-gray-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete photo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Rejection reason */}
                  {photo.status === 'rejected' && photo.rejection_reason ? (
                    <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <strong>Reason:</strong> {photo.rejection_reason}
                    </div>
                  ) : null}

                  {/* Full-size preview overlay */}
                  <AnimatePresence>
                    {previewPhotoId === photo.id ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setPreviewPhotoId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoId(null)}
                          className="absolute right-6 top-6 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                        >
                          <X className="h-6 w-6" />
                        </button>
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ProfileImage
                            photoId={photo.id}
                            src={photo.image_url || photo.thumbnail_url}
                            variant="image"
                            version={photo.updated_at}
                            alt="Profile photo preview"
                            size="full"
                            gender={userGender}
                            className="max-h-[85vh] w-auto rounded-xl shadow-2xl"
                          />
                        </motion.div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : !selectedFile ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200">
              <ImageIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">No photos yet</h2>
            <p className="mb-6 text-gray-600">Upload your first photo to complete your profile and start connecting with matches.</p>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 rounded-lg border border-rose-200 bg-rose-50 p-6"
        >
          <h2 className="mb-3 font-bold text-rose-900">Photo guidelines</h2>
          <ul className="space-y-2 text-sm text-rose-800">
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Upload clear, recent photos of yourself.</span></li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Photos must be at least 600 × 750 pixels.</span></li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>JPEG, PNG, and WebP are accepted up to 10 MB.</span></li>
            <li className="flex items-start gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /><span>No group photos, blurry images, or inappropriate content.</span></li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
