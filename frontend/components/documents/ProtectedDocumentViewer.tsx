'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { getAccessToken } from '@/legacy/services/apiClient';
import {
  Loader2,
  XCircle,
  AlertCircle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
} from 'lucide-react';

interface ProtectedDocumentViewerProps {
  documentId: string;
  documentType: string;
  /** Backend proxy namespace, e.g. 'member-auth' or 'admin'. */
  namespace?: string;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error' | 'unsupported';

const DOCUMENT_ROUTE_PREFIX: Record<string, string> = {
  'member-auth': 'verification/documents',
  admin: 'documents',
};

export default function ProtectedDocumentViewer({
  documentId,
  documentType,
  namespace = 'member-auth',
  onClose,
}: ProtectedDocumentViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const routePrefix = DOCUMENT_ROUTE_PREFIX[namespace] ?? 'verification/documents';
  const downloadUrl = `/api/proxy/${namespace}/${routePrefix}/${documentId}/download/`;
  const isPdf = mimeType.includes('pdf');

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let currentObjectUrl: string | null = null;
    resetTransform();

    const load = async () => {
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {
          Accept: 'application/pdf,image/jpeg,image/png,image/webp,*/*',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(
          `/api/proxy/${namespace}/${routePrefix}/${documentId}/preview/`,
          { credentials: 'include', headers },
        );
        if (!response.ok) {
          let msg = 'We couldn’t load this document. Please try again.';
          if (response.status === 401) msg = 'Your session has expired. Please sign in again.';
          else if (response.status === 403) msg = 'You don’t have permission to view this document.';
          else if (response.status === 404) msg = 'This document is no longer available.';
          else {
            try {
              const json = await response.json();
              if (json.message) msg = json.message;
            } catch {}
          }
          throw new Error(msg);
        }
        const contentType = response.headers.get('content-type') || '';
        const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        const isSupported = supportedTypes.some((t) => contentType.includes(t));
        if (!isSupported) {
          setMimeType(contentType);
          setLoadState('unsupported');
          return;
        }
        const blob = await response.blob();
        if (!mountedRef.current) return;
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);
        setMimeType(contentType);
        setLoadState('ready');
      } catch (err) {
        if (!mountedRef.current) return;
        setErrorMessage(err instanceof Error ? err.message : 'We couldn’t load this document.');
        setLoadState('error');
      }
    };

    load();

    return () => {
      mountedRef.current = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [documentId, namespace, routePrefix, resetTransform]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(prev + 0.5, 3.5));
      } else if (e.key === '-') {
        setScale((prev) => {
          const next = Math.max(prev - 0.5, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        resetTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, resetTransform]);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.5, 3.5));
  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale === 1) {
      setScale(1.75);
    } else if (scale < 3) {
      setScale(scale + 0.75);
    } else {
      resetTransform();
    }
  };

  const rotateClockwise = () => setRotation((prev) => (prev + 90) % 360);

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
      setScale((prev) => Math.min(prev + 0.2, 3.5));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.2, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      style={{ margin: 0, padding: '1rem' }}
    >
      <div
        className="relative flex w-full max-w-3xl max-h-[88vh] flex-col rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ margin: 'auto' }}
      >
        {/* Header - Always pinned at the top */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-gray-900">
              {documentType ? documentType.replace(/_/g, ' ') : 'Document Preview'}
            </h3>
            <span className="text-[11px] font-medium text-gray-400">
              • Click image or use buttons below to zoom
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
              title="Download original file"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body - Constrained with proper screen ratio */}
        <div
          className="relative flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center p-4 bg-slate-50/60"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {loadState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-rose-500" />
              <p className="text-sm font-medium text-gray-600">Loading document…</p>
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm">
              <XCircle className="mb-3 h-10 w-10 text-rose-500" />
              <p className="text-sm font-medium text-gray-800 mb-1">{errorMessage}</p>
              <p className="text-xs text-gray-500 mb-4">You can download the original file instead.</p>
              <div className="flex gap-2">
                <a
                  href={downloadUrl}
                  download
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {loadState === 'unsupported' && (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm">
              <AlertCircle className="mb-3 h-10 w-10 text-amber-500" />
              <p className="text-sm font-medium text-gray-800 mb-1">This format cannot be previewed in the browser.</p>
              <p className="text-xs text-gray-500 mb-4">Please download the file to view it on your device.</p>
              <a
                href={downloadUrl}
                download
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                Download Document
              </a>
            </div>
          )}

          {loadState === 'ready' && objectUrl && (
            isPdf ? (
              <iframe
                src={objectUrl}
                className="h-[62vh] w-full rounded-xl border border-gray-200 bg-white"
                title="Document preview"
              />
            ) : (
              <div
                className="relative flex items-center justify-center w-full h-full min-h-[300px] max-h-[62vh] overflow-hidden rounded-xl bg-white/70 border border-gray-200/70 p-2 shadow-inner"
                onClick={handleImageClick}
                style={{
                  cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                }}
              >
                <motion.img
                  src={objectUrl}
                  alt={documentType}
                  draggable={false}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    scale,
                    rotate: rotation,
                    x: position.x,
                    y: position.y,
                  }}
                  transition={{
                    scale: { type: 'spring', damping: 25, stiffness: 320 },
                    rotate: { duration: 0.2 },
                    opacity: { duration: 0.2 },
                  }}
                  className="max-h-[58vh] max-w-full w-auto h-auto object-contain rounded-lg shadow-sm"
                />
              </div>
            )
          )}
        </div>

        {/* Clean Bottom Control Bar for Zoom & Rotate */}
        {loadState === 'ready' && !isPdf && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-2.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-gray-100/90 rounded-xl p-1 border border-gray-200/60">
              <button
                type="button"
                onClick={zoomOut}
                disabled={scale <= 1}
                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white transition disabled:opacity-35"
                title="Zoom Out (-)"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>

              <span className="min-w-[44px] text-center text-xs font-bold text-gray-700 select-none">
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                onClick={zoomIn}
                disabled={scale >= 3.5}
                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white transition disabled:opacity-35"
                title="Zoom In (+)"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>

              <div className="h-3.5 w-[1px] bg-gray-300 mx-1" />

              <button
                type="button"
                onClick={resetTransform}
                className="px-2 py-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white transition"
                title="Reset Fit (0)"
              >
                Fit
              </button>

              <button
                type="button"
                onClick={rotateClockwise}
                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white transition"
                title="Rotate 90°"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
