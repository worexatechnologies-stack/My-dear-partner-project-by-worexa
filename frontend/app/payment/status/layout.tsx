import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Checkout/payment-confirmation pages must never appear in search results:
// they are thin, session-specific utility pages and indexing them only
// confuses users who land there without an active checkout.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PaymentStatusLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
