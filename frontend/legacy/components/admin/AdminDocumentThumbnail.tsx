'use client';

import { useState, useEffect } from 'react';
import { FileText, Maximize2, Loader2, FileCode } from 'lucide-react';
import { getAccessToken } from '../../services/apiClient';

interface AdminDocumentThumbnailProps {
  documentId: string;
  mimeType?: string;
  originalFileName?: string;
  displayName?: string;
  className?: string;
  onClick?: () => void;
}

const thumbnailCache = new Map<string, string>();

export default function AdminDocumentThumbnail({
  documentId,
  mimeType = '',
  originalFileName = '',
  displayName = 'Document',
  className = '',
  onClick,
}: AdminDocumentThumbnailProps) {
  const [src, setSrc] = useState<string | null>(thumbnailCache.get(documentId) || null);
  const [loading, setLoading] = useState<boolean>(!thumbnailCache.has(documentId));
  const [hasError, setHasError] = useState<boolean>(false);

  const isPdf = mimeType === 'application/pdf' || originalFileName?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    if (thumbnailCache.has(documentId)) {
      setSrc(thumbnailCache.get(documentId)!);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const token = getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'image/webp,image/png,image/jpeg,*/*',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/proxy/admin/documents/${documentId}/preview/?as_image=1`, {
      credentials: 'include',
      headers,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Preview not available');
        const blob = await res.blob();
        if (!isMounted) return;
        const objectUrl = URL.createObjectURL(blob);
        thumbnailCache.set(documentId, objectUrl);
        setSrc(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-100 border border-slate-200 group/thumb cursor-pointer ${className}`}
      onClick={onClick}
      title="Click to zoom document preview"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      )}

      {src && !hasError ? (
        <>
          <img
            src={src}
            alt={displayName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            onError={() => setHasError(true)}
          />
          {isPdf && (
            <span className="absolute bottom-2 left-2 z-10 rounded-md bg-rose-600/90 text-white font-extrabold text-[9px] px-2 py-0.5 shadow-md uppercase tracking-wider backdrop-blur-sm pointer-events-none">
              PDF
            </span>
          )}
        </>
      ) : hasError ? (
        <div className="h-full w-full flex flex-col items-center justify-center p-2 text-slate-400 bg-rose-50/60 text-center">
          <FileText className="h-7 w-7 text-rose-500 mb-1" />
          <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider bg-rose-100/80 px-2 py-0.5 rounded-md mb-1">
            {isPdf ? 'PDF' : 'DOC'}
          </span>
          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[85%]">
            {originalFileName || displayName}
          </span>
        </div>
      ) : null}

      {/* Hover Zoom Hint Overlay */}
      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity duration-200 backdrop-blur-[1px]">
        <span className="flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1 text-[11px] font-bold text-white shadow-xl">
          <Maximize2 className="h-3 w-3 text-indigo-300" /> Zoom
        </span>
      </div>
    </div>
  );
}
