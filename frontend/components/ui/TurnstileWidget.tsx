'use client';

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error?: any) => void;
  onExpire?: () => void;
  siteKey?: string;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
  className = 'my-3',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => onVerify(token),
            'error-callback': (err: any) => onError?.(err),
            'expired-callback': () => onExpire?.(),
          });
        } catch {
          /* ignore duplicate render */
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const scriptId = 'cf-turnstile-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        window.onloadTurnstileCallback = () => {
          renderWidget();
        };
      }
    }

    return () => {
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {
          /* cleanup fail silent */
        }
      }
    };
  }, [siteKey, onVerify, onError, onExpire]);

  return <div ref={containerRef} className={className} />;
}
