import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const serverSchema = z.object({
  INTERNAL_API_BASE_URL: isProduction
    ? z.string().url()
    : z.string().url().default("http://localhost:8000/api/v1"),
  NEXT_PUBLIC_APP_URL: isProduction
    ? z.string().url()
    : z.string().url().default("http://localhost:3000"),
  AUTH_COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
});

const parsed = serverSchema.safeParse({
  INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
});

if (!parsed.success) {
  throw new Error(`Invalid Next.js environment: ${z.prettifyError(parsed.error)}`);
}

export const serverEnv = {
  ...parsed.data,
  authCookieSecure: parsed.data.AUTH_COOKIE_SECURE === "true" || isProduction,
};

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "My Dear Partner",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000",
  enableAdminPortal: process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL === "true",
};
