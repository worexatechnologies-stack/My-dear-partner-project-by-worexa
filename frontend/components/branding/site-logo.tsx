'use client';

import { useEffect, useState } from 'react';

const FALLBACK = '/images/main-logo.png';

interface SiteLogoProps {
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders the platform logo configured by a super admin in
 * Settings -> Branding -> "Platform Logo URL" (stored in the public
 * PlatformSetting[GENERAL] record). Falls back to the bundled static logo
 * when no custom logo is configured or it cannot be loaded.
 */
export default function SiteLogo({ alt = 'MyDearPartner', className = '', style }: SiteLogoProps) {
  const [src, setSrc] = useState<string>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/public/settings/', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('no settings'))))
      .then((payload) => {
        const logo = payload?.data?.GENERAL?.logo_url;
        if (alive && typeof logo === 'string' && logo.trim()) {
          // Resolve relative branding URLs against the public origin. This
          // also prevents a stale localhost path from replacing the bundle.
          const resolved = new URL(logo.trim(), window.location.origin);
          setSrc(resolved.origin === window.location.origin
            ? `${resolved.pathname}${resolved.search}`
            : resolved.href);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        if (src !== FALLBACK) setSrc(FALLBACK);
      }}
    />
  );
}
