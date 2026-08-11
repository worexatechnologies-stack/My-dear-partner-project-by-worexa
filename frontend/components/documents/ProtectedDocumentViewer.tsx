'use client';

import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/legacy/services/apiClient';
import { Loader2, XCircle, AlertCircle, X } from 'lucide-react';

interface ProtectedDocumentViewerProps {
  documentId: string;
  documentType: string;
  /** Backend proxy namespace, e.g. 'member-auth' or 'admin'. */
  namespace?: string;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error' | 'unsupported';

// Backend document route prefixes differ by namespace:
//   member-auth -> /verification/documents/<id>/
//   admin       -> /documents/<id>/
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
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  const routePrefix = DOCUMENT_ROUTE_PREFIX[namespace] ?? 'verification/documents';

  useEffect(() => {
    mountedRef.current = true;
    let currentObjectUrl: string | null = null;

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
  }, [documentId, namespace]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-bold text-gray-800">{documentType}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loadState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="mb-3 h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading document&hellip;</p>
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <XCircle className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">{errorMessage}</p>
              <button type="button" onClick={onClose} className="mt-4 cursor-pointer rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">
                Close
              </button>
            </div>
          )}

          {loadState === 'unsupported' && (
            <div className="flex flex-col items-center justify-center py-20 text-amber-500">
              <AlertCircle className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">This document cannot be previewed here.</p>
              <p className="mt-1 text-xs text-gray-400">You can download it securely instead.</p>
              <a
                href={`/api/proxy/${namespace}/${routePrefix}/${documentId}/download/`}
                download
                className="mt-4 cursor-pointer rounded-xl bg-rose-500 px-5 py-2 text-xs font-bold text-white hover:bg-rose-600"
              >
                Download
              </a>
            </div>
          )}

          {loadState === 'ready' && objectUrl && (
            mimeType.includes('pdf') ? (
              <iframe src={objectUrl} className="h-[70vh] w-full rounded-lg border" title="Document preview" />
            ) : (
              <img src={objectUrl} alt="Document" className="mx-auto max-h-[70vh] rounded-lg" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
