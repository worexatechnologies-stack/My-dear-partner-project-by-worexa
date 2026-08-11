import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The mobile shell loads the running Next.js application.  Set
 * CAPACITOR_SERVER_URL to the HTTPS production address for release builds;
 * the LAN address is deliberately only the development fallback.
 */
const mobileServerUrl = process.env.CAPACITOR_SERVER_URL || 'http://192.168.1.29:3000';

const config: CapacitorConfig = {
  appId: 'com.mydearpartner.app',
  appName: 'My Dear Partner',
  // The Next.js app is server-rendered, so the native shell loads it through
  // `server.url`. Keep a tiny fallback bundle rather than copying `.next`
  // (which contains development-only TypeScript files).
  webDir: 'mobile-web',
  server: {
    url: mobileServerUrl,
    // HTTP is only appropriate while developing against the LAN server.
    cleartext: mobileServerUrl.startsWith('http://'),
  },
};

export default config;
