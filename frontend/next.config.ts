import type { NextConfig } from "next";

const publicApi = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const publicWs = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";

function remotePattern(value: string) {
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const allowedImageOrigins = [publicApi, process.env.NEXT_PUBLIC_MEDIA_BASE_URL]
  .filter((value): value is string => Boolean(value))
  .map(remotePattern)
  .filter((value): value is NonNullable<ReturnType<typeof remotePattern>> => Boolean(value));

const connectOrigins = [publicApi, publicWs]
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  })
  .filter(Boolean)
  .join(" ");

const isDev = process.env.NODE_ENV !== "production";
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const razorpayScriptOrigins = "https://checkout.razorpay.com https://cdn.razorpay.com";
const razorpayConnectOrigins = "https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://cdn.razorpay.com";
const razorpayFrameOrigins = "https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${razorpayScriptOrigins}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: http://localhost:8000 https:",
  `connect-src 'self' ${connectOrigins} ${razorpayConnectOrigins}`,
  `frame-src 'self' blob: ${razorpayFrameOrigins}`,
  "media-src 'self' blob:",
  ...(isDev || process.env.SECURE_SSL_REDIRECT !== "true" ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next blocks dev assets requested through a LAN address unless that origin
  // is explicitly allowed.  Keeping the list in a local environment variable
  // avoids hard-coding a machine-specific IP address in source control.
  allowedDevOrigins,
  output: "standalone",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: allowedImageOrigins,
    formats: ["image/avif", "image/webp"],
    // Some Windows deployments do not ship the native Sharp binary inside
    // Next's standalone output. Enable this per environment to serve the
    // original image URLs instead of returning a 500 from /_next/image.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
    // Remote profile images can be fetched repeatedly during browsing.  Cache
    // optimized variants for a day while preserving application-level access
    // controls for protected images (which bypass this loader).
    minimumCacheTTL: 86_400,
    contentDispositionType: "attachment",
    dangerouslyAllowSVG: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/profile-photos/:path*",
        destination: "/api/proxy/profile-photos/:path*",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/membership-plans", destination: "/membership", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/search-profiles", destination: "/search", permanent: true },
      { source: "/matchmaking", destination: "/matches", permanent: true },
      { source: "/admin-login", destination: "/admin/login", permanent: true },
      { source: "/unauthorized", destination: "/403", permanent: true },
      { source: "/admin/users", destination: "/admin/members", permanent: true },
      { source: "/admin/profile-verifications", destination: "/admin/profiles", permanent: true },
      { source: "/admin/profile-approvals", destination: "/admin/profiles", permanent: true },
      { source: "/admin/photo-verifications", destination: "/admin/photos", permanent: true },
      { source: "/admin/photo-approvals", destination: "/admin/photos", permanent: true },
      { source: "/admin/document-verifications", destination: "/admin/documents", permanent: true },
      { source: "/admin/document-verification", destination: "/admin/documents", permanent: true },
      { source: "/admin/support-tickets/:path*", destination: "/admin/tickets/:path*", permanent: true },
      { source: "/admin/admin-management", destination: "/admin/admins", permanent: true },
      { source: "/admin/activity", destination: "/admin/audit-logs", permanent: true },
      { source: "/admin/activity-logs", destination: "/admin/audit-logs", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private" }],
      },
      {
        // Files in public/ are not fingerprinted by Next.  A modest cache
        // lifetime prevents repeat downloads without making deployments stale.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
