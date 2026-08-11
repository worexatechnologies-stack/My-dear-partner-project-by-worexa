import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const dmSans = localFont({
  src: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
  variable: '--font-dm-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const manrope = localFont({
  src: '../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: 'My Dear Partner', template: '%s | My Dear Partner' },
  description: 'A privacy-first matrimony platform for verified, meaningful connections.',
  applicationName: 'My Dear Partner',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'My Dear Partner',
    title: 'My Dear Partner — Meaningful Matrimony',
    description: 'Meet verified partners through thoughtful, privacy-first matchmaking.',
    images: [{ url: '/images/matrimony-hero-couple.webp', width: 1200, height: 800, alt: 'My Dear Partner' }],
  },
  twitter: { card: 'summary_large_image', title: 'My Dear Partner', description: 'Meaningful matrimony, thoughtfully matched.' },
  icons: { icon: '/images/main-logo.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f172a' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${dmSans.variable} ${manrope.variable}`}>
    <body suppressHydrationWarning><Providers>{children}</Providers></body>
  </html>;
}
