'use client';

import { UserRound } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import {
  getAccessToken,
  getFreshAccessToken,
  refreshAccessToken,
} from '@/legacy/services/apiClient';

export type ProfilePhotoVariant = 'image' | 'thumbnail';
export type ProfileImageSize = 'auto' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ProfileImageAspectRatio = '1:1' | '4:5';
export type ProfileImageShape = 'circle' | 'rounded' | 'square';
export type ProfileImageFallback = 'neutral' | 'brand';

export interface ProfileImageProps {
  /** Optional user ID to fetch user avatar from GET /api/users/:id/avatar */
  userId?: string | null;
  /** The ProfilePhoto UUID. This is the preferred way to load a protected photo. */
  photoId?: string | null;
  /** A photo endpoint returned by the API, or a local object URL for an upload preview. */
  src?: string | null;
  /** Selects the binary endpoint when photoId is supplied. */
  variant?: ProfilePhotoVariant;
  /** Changes the request URL after a replacement or moderation update. */
  version?: string | number | Date | null;
  /** Alias for API `updated_at` values. */
  updatedAt?: string | number | Date | null;
  alt?: string;
  size?: ProfileImageSize;
  aspectRatio?: ProfileImageAspectRatio;
  shape?: ProfileImageShape;
  gender?: 'Male' | 'Female' | 'Other' | string | null;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  fallback?: ProfileImageFallback;
  fallbackMessage?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

const SIZE_CLASS: Record<ProfileImageSize, string> = {
  auto: '',
  xs: 'w-8',
  sm: 'w-12',
  md: 'w-24',
  lg: 'w-32',
  xl: 'w-48',
  full: 'w-full',
};

function versionValue(version: ProfileImageProps['version']): string | null {
  if (version === null || version === undefined || version === '') return null;
  if (version instanceof Date) return String(version.getTime());

  if (typeof version === 'string') {
    const timestamp = Date.parse(version);
    return Number.isNaN(timestamp) ? version : String(timestamp);
  }

  return String(version);
}

function withVersion(url: string, version: ProfileImageProps['version']): string {
  const value = versionValue(version);
  if (!value) return url;

  const [path, query = ''] = url.split('?', 2);
  const search = new URLSearchParams(query);
  search.set('v', value);
  return `${path}?${search.toString()}`;
}

/**
 * Builds a same-origin URL so protected image requests can carry the current
 * HttpOnly access token cookie through the BFF proxy.
 */
export function profilePhotoEndpoint(
  photoId: string,
  variant: ProfilePhotoVariant = 'image',
  version?: ProfileImageProps['version'],
): string {
  return withVersion(
    `/api/proxy/profile-photos/${encodeURIComponent(photoId)}/${variant}/`,
    version,
  );
}

function protectedEndpointFromSource(source: string, version?: ProfileImageProps['version']): string | null {
  if (source.startsWith('data:')) return null;

  try {
    const parsed = new URL(source, 'https://profile-image.local');
    
    const avatarMatch = parsed.pathname.match(/(?:^|\/)users\/([^/]+)\/avatar\/?$/);
    if (avatarMatch) {
      return withVersion(`/api/proxy/users/${avatarMatch[1]}/avatar/`, version ?? parsed.searchParams.get('v'));
    }

    const match = parsed.pathname.match(/(?:^|\/)profile-photos\/([^/]+)\/(image|thumbnail)\/?$/);
    if (!match) return null;

    return profilePhotoEndpoint(
      decodeURIComponent(match[1]),
      match[2] as ProfilePhotoVariant,
      version ?? parsed.searchParams.get('v'),
    );
  } catch {
    return null;
  }
}

function localImageSource(source: string | null | undefined): string | null {
  if (!source || source.startsWith('data:')) return null;
  if (source.startsWith('blob:') || source.startsWith('/images/') || source.startsWith('/favicon')) return source;
  return null;
}

function placeholderClasses(gender: ProfileImageProps['gender']) {
  switch (gender?.toLowerCase()) {
    case 'female':
      return 'from-pink-100 to-pink-200 text-pink-400';
    case 'male':
      return 'from-blue-100 to-blue-200 text-rose-400';
    default:
      return 'from-slate-100 to-slate-200 text-slate-400';
  }
}

/**
 * Renders a portrait or avatar safely from the authenticated ProfilePhoto endpoints.
 * Native browser <img> tags automatically attach HttpOnly cookies to requests to the Next.js proxy.
 */
export default function ProfileImage({
  userId,
  photoId,
  src,
  variant = 'image',
  version,
  updatedAt,
  alt = 'Profile photo',
  size = 'md',
  aspectRatio = '1:1',
  shape = 'rounded',
  gender,
  className = '',
  style,
  priority: _priority,
  fallback = 'neutral',
  fallbackMessage = 'Photo not yet approved',
  onLoad,
  onError,
}: ProfileImageProps) {
  const onErrorRef = useRef(onError);
  const onLoadRef = useRef(onLoad);
  const effectiveVersion = version ?? updatedAt;

  const protectedEndpoint = useMemo(() => {
    if (userId) return `/api/proxy/users/${userId}/avatar/`;
    if (photoId) return profilePhotoEndpoint(photoId, variant, effectiveVersion);
    return src ? protectedEndpointFromSource(src, effectiveVersion) : null;
  }, [userId, effectiveVersion, photoId, src, variant]);

  const directSource = useMemo(() => localImageSource(src), [src]);
  const initialSource = protectedEndpoint || directSource;

  const [displaySource, setDisplaySource] = useState<string | null>(initialSource);
  const [retryAttempted, setRetryAttempted] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialSource));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onLoadRef.current = onLoad;
  }, [onError, onLoad]);

  useEffect(() => {
    setDisplaySource(initialSource);
    setFailed(false);
    setRetryAttempted(false);
    setLoading(Boolean(initialSource));
  }, [initialSource]);

  const handleImageError = async () => {
    if (!retryAttempted && protectedEndpoint) {
      setRetryAttempted(true);
      try {
        // Trigger a silent token refresh (reissues cookie)
        await refreshAccessToken();

        // Append retry query param to bust browser image cache for this retry request
        const separator = protectedEndpoint.includes('?') ? '&' : '?';
        const retryUrl = `${protectedEndpoint}${separator}retry=${Date.now()}`;
        setDisplaySource(retryUrl);
      } catch (error: unknown) {
        setFailed(true);
        setLoading(false);
        const loadError = error instanceof Error ? error : new Error('Token refresh failed');
        onErrorRef.current?.(loadError);
      }
    } else {
      setFailed(true);
      setLoading(false);
      onErrorRef.current?.(new Error('Image failed to load.'));
    }
  };

  const isCircle = shape === 'circle';
  const ratioClass = isCircle || aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[4/5]';
  const shapeClass = isCircle ? 'rounded-full' : shape === 'square' ? 'rounded-none' : 'rounded-lg';
  const placeholderClass = placeholderClasses(gender);
  const showFallback = !displaySource || failed;

  return (
    <div
      className={`member-photo-protected relative overflow-hidden select-none ${SIZE_CLASS[size]} ${ratioClass} ${shapeClass} ${className}`}
      style={style}
      aria-busy={loading || undefined}
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {/* Loading animation placeholder rendered behind the actual image to prevent visual blinking */}
      {loading && !failed ? (
        <div
          className="absolute inset-0 animate-pulse bg-transparent z-0"
          aria-hidden="true"
        />
      ) : null}

      {!showFallback && displaySource ? (
        <img
          src={displaySource}
          alt={alt}
          className="relative h-full w-full object-cover object-top z-10"
          draggable={false}
          onLoad={() => {
            setLoading(false);
            onLoadRef.current?.();
          }}
          onError={handleImageError}
        />
      ) : fallback === 'brand' ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white px-4 text-center"
          role="img"
          aria-label={`${alt}. ${fallbackMessage}`}
        >
          <span className="absolute inset-3 rounded-[inherit] border border-[#eaded8]" aria-hidden="true" />
          <img
            src="/images/main-logo.png"
            alt=""
            aria-hidden="true"
            className="relative h-auto w-[clamp(3rem,18%,5rem)] object-contain opacity-90"
          />
          <span className="relative max-w-[13rem] text-[clamp(.625rem,1.5vw,.78rem)] font-bold leading-5 text-[#8e3d58]">
            {fallbackMessage}
          </span>
        </div>
      ) : (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br ${placeholderClass}`}
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
        >
          <UserRound aria-hidden="true" className={size === 'xs' || size === 'sm' ? 'h-4 w-4' : 'h-12 w-12'} />
          {failed && alt ? <span className="sr-only">{alt} is unavailable.</span> : null}
        </div>
      )}
      {!showFallback ? (
        <span className="member-photo-watermark" aria-hidden="true">
          Protected &bull; My Dear Partner
        </span>
      ) : null}
    </div>
  );
}
