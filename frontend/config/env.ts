import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const isServer = typeof window === "undefined";

// Server-only variables fall back to the local dev endpoints when they are
// absent at build/run time (e.g. a bare `npm run build` outside Docker,
// which runs with NODE_ENV=production but has no INTERNAL_API_BASE_URL /
// NEXT_PUBLIC_APP_URL in the shell environment). A value that IS provided
// but malformed still fails fast so real production misconfiguration is
// caught rather than silently misrouted.
const serverSchema = z.object({
  INTERNAL_API_BASE_URL: z.string().url().default("http://localhost:8000/api/v1"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
});

const parsed = serverSchema.safeParse({
  INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
});

// This module is also imported by client components for `publicEnv`.
// Server-only variables (INTERNAL_API_BASE_URL) are intentionally NOT inlined
// into browser bundles by Next.js, so the strict server contract must only be
// enforced where those variables actually exist. The browser gets safe fallbacks.
if (!parsed.success && isServer) {
  throw new Error(`Invalid Next.js environment: ${z.prettifyError(parsed.error)}`);
}

const safe = parsed.success
  ? parsed.data
  : {
      INTERNAL_API_BASE_URL: "http://localhost:8000/api/v1",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AUTH_COOKIE_SECURE: "false" as const,
    };

export const serverEnv = {
  ...safe,
  authCookieSecure: isProduction || safe.AUTH_COOKIE_SECURE === "true",
};

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "My Dear Partner",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000",
  enableAdminPortal: process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL === "true",
};

/**
 * Return the browser-reachable WebSocket origin.
 *
 * Production is served behind the same Nginx host as the WebSocket endpoint,
 * so using the current origin prevents a stale localhost/build-time hostname
 * from breaking realtime connections after deployment.
 */
export function getClientWebSocketBaseUrl() {
  if (typeof window === 'undefined') return publicEnv.wsBaseUrl.replace(/\/$/, '');

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const currentOrigin = `${protocol}//${window.location.host}`;
  if (process.env.NODE_ENV === 'production') return currentOrigin;

  return publicEnv.wsBaseUrl.replace(/\/$/, '') || currentOrigin;
}
