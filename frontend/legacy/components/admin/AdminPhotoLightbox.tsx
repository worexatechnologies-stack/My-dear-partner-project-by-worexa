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
} from 'lucide-react';

export interface LightboxPhoto {
  id?: string;
  src: string;
  alt?: string;
  is_primary?: boolean;
  status?: string;
  uploaded_at?: string | null;
}

interface AdminPhotoLightboxProps {
  isOpen: boolean;
  photos: LightboxPhoto[];
  currentIndex: number;
  memberName?: string;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onApprove?: (photoId: string) => Promise<void> | void;
  onReject?: (photoId: string) => Promise<void> | void;
  isActionBusy?: boolean;
}

export default function AdminPhotoLightbox({
  isOpen,
  photos,
  currentIndex,
  memberName = 'Member',
  onClose,
  onIndexChange,
  onApprove,
  onReject,
  isActionBusy = false,
}: AdminPhotoLightboxProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPhoto = photos[currentIndex];

  // Reset zoom & pan when photo changes or modal opens
  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetTransform();
    }
  }, [isOpen, currentIndex, resetTransform]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (photos.length > 1 && onIndexChange) {
          onIndexChange((currentIndex + 1) % photos.length);
        }
      } else if (e.key === 'ArrowLeft') {
        if (photos.length > 1 && onIndexChange) {
          onIndexChange((currentIndex - 1 + photos.length) % photos.length);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onIndexChange, onClose, resetTransform]);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Click on image cycles zoom: 1x -> 2x -> 3x -> 1x
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

  const rotateClockwise = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Mouse pan handlers when zoomed in
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || !currentPhoto) return null;

  const isPending = currentPhoto.status?.toUpperCase() === 'PENDING';
  const isApproved = currentPhoto.status?.toUpperCase() === 'APPROVED';
  const isRejected = currentPhoto.status?.toUpperCase() === 'REJECTED';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/92 backdrop-blur-md select-none"
        onClick={onClose}
        onMouseUp={handleMouseUp}
      >
        {/* Top Header Bar */}
        <div
          className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Member Name and Photo Meta */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-base sm:text-lg">
                  {memberName}
                </span>
                {currentPhoto.is_primary && (
                  <span className="bg-amber-500 text-white font-bold text-xs px-2 py-0.5 rounded-full">
                    Primary
                  </span>
                )}
                {currentPhoto.status && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isRejected
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {currentPhoto.status.toUpperCase()}
                  </span>
                )}
              </div>
              {photos.length > 1 && (
                <span className="text-xs text-slate-400 mt-0.5">
                  Photo {currentIndex + 1} of {photos.length}
                </span>
              )}
            </div>
          </div>

          {/* Zoom and Transform Controls */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 1}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="text-xs text-white font-mono min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 4}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <div className="h-4 w-[1px] bg-white/20 mx-1" />

            <button
              type="button"
              onClick={rotateClockwise}
              className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition"
              title="Rotate 90°"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={resetTransform}
              className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition"
              title="Reset Zoom & Orientation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Center Canvas Area with Image */}
        <div
          ref={containerRef}
          className="relative flex-1 w-full flex items-center justify-center overflow-hidden p-4"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          {/* Previous photo button */}
          {photos.length > 1 && onIndexChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((currentIndex - 1 + photos.length) % photos.length);
              }}
              className="absolute left-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all hover:scale-110 shadow-xl"
              title="Previous Photo (Left Arrow)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image Container with Zoom and Drag */}
          <div
            className={`relative flex items-center justify-center transition-transform ${
              isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
            }`}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
            }}
            onClick={handleImageClick}
          >
            <img
              src={currentPhoto.src}
              alt={currentPhoto.alt || memberName}
              draggable={false}
              className="max-h-[78vh] max-w-[86vw] rounded-lg shadow-2xl object-contain pointer-events-none ring-1 ring-white/10"
            />
          </div>

          {/* Next photo button */}
          {photos.length > 1 && onIndexChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((currentIndex + 1) % photos.length);
              }}
              className="absolute right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all hover:scale-110 shadow-xl"
              title="Next Photo (Right Arrow)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Bottom Bar: Quick Admin Actions & Hints */}
        <div
          className="w-full flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-gradient-to-t from-black/90 to-transparent z-20 gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="bg-white/10 px-2 py-1 rounded text-slate-300 font-mono">
              Click image
            </span>
            <span>to zoom in &bull; Drag to pan &bull; Esc to close</span>
          </div>

          {/* Direct Approval Actions inside Zoom */}
          {isPending && currentPhoto.id && (onApprove || onReject) && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-300 font-medium mr-1">
                Moderation:
              </span>
              {onApprove && (
                <button
                  type="button"
                  disabled={isActionBusy}
                  onClick={() => onApprove(currentPhoto.id!)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Approve Photo
                </button>
              )}
              {onReject && (
                <button
                  type="button"
                  disabled={isActionBusy}
                  onClick={() => onReject(currentPhoto.id!)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Reject Photo
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
