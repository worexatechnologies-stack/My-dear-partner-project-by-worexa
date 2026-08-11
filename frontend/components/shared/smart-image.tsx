'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

import ProfileImage from '@/components/profile/ProfileImage';
import type { ProfileImageFallback } from '@/components/profile/ProfileImage';

type SmartImageProps = Omit<ImageProps, 'src' | 'width' | 'height'> & {
  userId?: string | null;
  src?: unknown;
  width?: number;
  height?: number;
  fallbackSrc?: string;
  fallback?: ProfileImageFallback;
  fallbackMessage?: string;
};

function isPrivateProfilePhotoUrl(source: string): boolean {
  try {
    const parsed = new URL(source, 'https://profile-image.local');
    return /(?:^|\/)profile-photos\/[^/]+\/(?:image|thumbnail)\/?$/.test(parsed.pathname) ||
           /(?:^|\/)users\/[^/]+\/avatar\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export default function SmartImage({
  userId,
  src,
  alt,
  width = 800,
  height = 800,
  fallbackSrc,
  fallback = 'neutral',
  fallbackMessage,
  unoptimized,
  onError,
  className,
  priority,
  style,
  ...props
}: SmartImageProps) {
  const initial = typeof src === 'string' && src.trim() ? src : fallbackSrc || null;
  const [current, setCurrent] = useState(initial);
  useEffect(() => setCurrent(initial), [initial]);

  const hasLayoutClasses = Boolean(className?.match(/(?:^|\s)[wh]-/));

  if (userId) {
    return (
      <ProfileImage
        userId={userId}
        alt={alt || 'Profile photo'}
        size="auto"
        aspectRatio={className?.includes('aspect-[4/5]') ? '4:5' : '1:1'}
        shape={className?.includes('rounded-full') ? 'circle' : 'rounded'}
        className={className}
        style={style ?? (hasLayoutClasses ? undefined : { width, height })}
        priority={priority}
        fallback={fallback}
        fallbackMessage={fallbackMessage}
      />
    );
  }

  // Do not substitute a stock portrait for an absent or unapproved member
  // photo. A neutral placeholder makes the moderation state unambiguous.
  if (!current) {
    return (
      <ProfileImage
        alt={alt || 'Profile photo'}
        size="auto"
        aspectRatio={className?.includes('aspect-[4/5]') ? '4:5' : '1:1'}
        shape={className?.includes('rounded-full') ? 'circle' : 'rounded'}
        className={className}
        style={style ?? (hasLayoutClasses ? undefined : { width, height })}
        priority={priority}
        fallback={fallback}
        fallbackMessage={fallbackMessage}
      />
    );
  }

  // Profile images are protected Django BYTEA endpoints. Next's Image loader
  // cannot attach the in-memory bearer token, so route every existing card,
  // dashboard, shortlist, and chat use through the authenticated Blob loader.
  if (isPrivateProfilePhotoUrl(current)) {
    const hasLayoutClasses = Boolean(className?.match(/(?:^|\s)[wh]-/));
    return (
      <ProfileImage
        src={current}
        alt={alt || 'Profile photo'}
        size="auto"
        aspectRatio={className?.includes('aspect-[4/5]') ? '4:5' : '1:1'}
        shape={className?.includes('rounded-full') ? 'circle' : 'rounded'}
        className={className}
        style={style ?? (hasLayoutClasses ? undefined : { width, height })}
        priority={priority}
        fallback={fallback}
        fallbackMessage={fallbackMessage}
      />
    );
  }

  const authorizedOrRemote = current.startsWith('http://') || current.startsWith('https://');
  return <Image
    {...props}
    src={current}
    alt={alt || ''}
    width={width}
    height={height}
    className={className}
    style={style}
    unoptimized={unoptimized ?? authorizedOrRemote}
    onError={(event) => {
      if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc);
      else setCurrent(null);
      onError?.(event);
    }}
  />;
}
