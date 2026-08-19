import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Root-level /settings/* pages are member-account pages that sit outside the
// (member) route group, so they do not inherit its noindex robots metadata.
// Mark them explicitly to prevent member account data from ever being indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
