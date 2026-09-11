'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Check,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Shield,
  Clock,
  User,
} from 'lucide-react';
import { getAccessToken } from '../../services/apiClient';

export interface LightboxDocument {
  id: string;
  member_id?: string;
  member_name?: string;
  member_email?: string;
  document_type: string;
  custom_document_name?: string;
  display_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  status: string;
  rejection_reason?: string;
  uploaded_at: string;
  reviewer_name?: string | null;
}

interface AdminDocumentLightboxProps {
  isOpen: boolean;
  documents: LightboxDocument[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onApprove?: (docId: string) => Promise<void> | void;
  onReject?: (docId: string) => void;
  isActionBusy?: boolean;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// In-memory cache for blob preview URLs so we never refetch already loaded blobs
const blobUrlCache = new Map<string, string>();

export default function AdminDocumentLightbox({
  isOpen,
  documents,
  currentIndex,
  onClose,
  onIndexChange,
  onApprove,
  onReject,
  isActionBusy = false,
}: AdminDocumentLightboxProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const currentDoc = documents[currentIndex];
  const isPdf = currentDoc?.mime_type === 'application/pdf' || currentDoc?.original_file_name?.toLowerCase().endsWith('.pdf');

  // Reset zoom & pan
  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Fetch document preview as blob URL with auth headers
  useEffect(() => {
    if (!isOpen || !currentDoc) return;

    resetTransform();
    const docId = currentDoc.id;

    if (blobUrlCache.has(docId)) {
      setPreviewUrl(blobUrlCache.get(docId)!);
      setLoadingPreview(false);
      setPreviewError(null);
      return;
    }

    let isMounted = true;
    setLoadingPreview(true);
    setPreviewError(null);

    const token = getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/pdf,image/jpeg,image/png,image/webp,*/*',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/proxy/admin/documents/${docId}/preview/`, {
      credentials: 'include',
      headers,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status})`);
        }
        const blob = await res.blob();
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(docId, url);
        setPreviewUrl(url);
        setLoadingPreview(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setPreviewError(err instanceof Error ? err.message : 'Could not load document preview.');
        setLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentDoc, resetTransform]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (documents.length > 1 && onIndexChange) {
          onIndexChange((currentIndex + 1) % documents.length);
        }
      } else if (e.key === 'ArrowLeft') {
        if (documents.length > 1 && onIndexChange) {
          onIndexChange((currentIndex - 1 + documents.length) % documents.length);
        }
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(prev + 0.5, 4));
      } else if (e.key === '-') {
        setScale((prev) => {
          const next = Math.max(prev - 0.5, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        resetTransform();
      } else if (e.key.toLowerCase() === 'r') {
        setRotation((prev) => (prev + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, documents.length, onIndexChange, onClose, resetTransform]);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.5, 4));
  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Click image to cycle zoom: 1x -> 2x -> 3x -> 1x
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale === 1) {
      setScale(2);
    } else if (scale < 3) {
      setScale(scale + 1);
    } else {
      resetTransform();
    }
  };

  const rotateClockwise = () => setRotation((prev) => (prev + 90) % 360);
  const rotateCounterClockwise = () => setRotation((prev) => (prev - 90 + 360) % 360);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  if (!isOpen || !currentDoc) return null;

  const downloadUrl = `/api/proxy/admin/documents/${currentDoc.id}/download/`;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-md select-none"
        onClick={onClose}
      >
        {/* Top Header Bar */}
        <div
          className="relative z-20 flex items-center justify-between border-b border-white/10 bg-black/60 px-6 py-3.5 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Member & Document info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-md">
              {(currentDoc.member_name || 'M')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{currentDoc.member_name || 'Member'}</h3>
                <span className="rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                  {currentDoc.document_type || 'DOCUMENT'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    currentDoc.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : currentDoc.status === 'REJECTED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {currentDoc.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>{currentDoc.display_name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono text-[11px]">{currentDoc.original_file_name}</span>
                <span className="text-slate-500">•</span>
                <span>{formatFileSize(currentDoc.file_size)}</span>
                <span className="text-slate-500">•</span>
                <span>Uploaded {formatDate(currentDoc.uploaded_at)}</span>
              </p>
            </div>
          </div>

          {/* Right actions: Counter, Download, Close */}
          <div className="flex items-center gap-3">
            {documents.length > 1 && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                {currentIndex + 1} / {documents.length}
              </span>
            )}

            <a
              href={downloadUrl}
              download={currentDoc.original_file_name}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:scale-105"
              title="Download original document file"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Document Display Area */}
        <div
          className="relative flex-1 overflow-hidden flex items-center justify-center p-4"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Loading Indicator */}
          {loadingPreview && (
            <div className="flex flex-col items-center justify-center text-slate-300">
              <Loader2 className="h-10 w-10 animate-spin text-rose-500 mb-3" />
              <p className="text-sm font-medium">Loading high-resolution document...</p>
            </div>
          )}

          {/* Error State */}
          {previewError && !loadingPreview && (
            <div className="flex flex-col items-center justify-center text-rose-400 p-8 text-center max-w-md">
              <AlertCircle className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium mb-4">{previewError}</p>
              <a
                href={downloadUrl}
                download
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                <Download className="h-4 w-4" /> Download to View
              </a>
            </div>
          )}

          {/* PDF Viewer */}
          {!loadingPreview && !previewError && previewUrl && isPdf && (
            <div className="h-full w-full max-w-5xl rounded-2xl overflow-hidden bg-white shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
              <iframe
                src={previewUrl}
                title={currentDoc.display_name}
                className="h-full w-full border-none"
              />
            </div>
          )}

          {/* Image Viewer with Zoom & Pan */}
          {!loadingPreview && !previewError && previewUrl && !isPdf && (
            <div
              className="relative flex items-center justify-center max-h-full max-w-full"
              onClick={handleImageClick}
              style={{
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              }}
            >
              <motion.img
                key={currentDoc.id}
                src={previewUrl}
                alt={currentDoc.display_name}
                draggable={false}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale,
                  rotate: rotation,
                  x: position.x,
                  y: position.y,
                }}
                transition={{
                  scale: { type: 'spring', damping: 25, stiffness: 300 },
                  rotate: { duration: 0.2 },
                  opacity: { duration: 0.2 },
                }}
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
              />
            </div>
          )}

          {/* Navigation Arrows */}
          {documents.length > 1 && onIndexChange && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange((currentIndex - 1 + documents.length) % documents.length);
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/90 p-3 text-white backdrop-blur-md transition hover:scale-110 border border-white/15 shadow-xl"
                title="Previous Document (Left Arrow)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange((currentIndex + 1) % documents.length);
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/90 p-3 text-white backdrop-blur-md transition hover:scale-110 border border-white/15 shadow-xl"
                title="Next Document (Right Arrow)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Bottom Floating Control & Moderation Bar */}
        <div
          className="relative z-20 flex flex-wrap items-center justify-between border-t border-white/10 bg-black/70 px-6 py-3.5 backdrop-blur-md gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zoom controls (for images) */}
          {!isPdf ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 border border-white/15 p-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={zoomOut}
                disabled={scale <= 1}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 transition"
                title="Zoom Out (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              <span className="min-w-[56px] text-center text-xs font-bold text-white">
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                onClick={zoomIn}
                disabled={scale >= 4}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 transition"
                title="Zoom In (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              <div className="h-4 w-[1px] bg-white/20 mx-1" />

              <button
                type="button"
                onClick={resetTransform}
                className="rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/15 hover:text-white transition"
                title="Fit to Screen (0)"
              >
                Fit
              </button>

              <button
                type="button"
                onClick={rotateCounterClockwise}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/15 hover:text-white transition"
                title="Rotate Left"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={rotateClockwise}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/15 hover:text-white transition"
                title="Rotate Right (R)"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileText className="h-4 w-4 text-rose-400" />
              <span>Interactive PDF Document</span>
            </div>
          )}

          {/* Quick moderation buttons right inside lightbox */}
          <div className="flex items-center gap-3 ml-auto">
            {currentDoc.status === 'PENDING' ? (
              <>
                {onApprove && (
                  <button
                    type="button"
                    disabled={isActionBusy}
                    onClick={() => onApprove(currentDoc.id)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-bold shadow-lg shadow-emerald-900/40 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {isActionBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    )}
                    Approve Document
                  </button>
                )}

                {onReject && (
                  <button
                    type="button"
                    disabled={isActionBusy}
                    onClick={() => onReject(currentDoc.id)}
                    className="flex items-center gap-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 border border-rose-500/50 text-white px-5 py-2 text-xs font-bold shadow-lg shadow-rose-900/40 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <X className="h-4 w-4 stroke-[2.5]" />
                    Reject
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">
                This document is already {currentDoc.status.toLowerCase()}.
              </span>
            )}
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
