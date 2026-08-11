import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/recovery-forms';
export const metadata: Metadata = { title: 'Reset Password', robots: { index: false, follow: false } };
export default function Page() { return <Suspense fallback={<div className="portal-loading">Loading secure form…</div>}><ResetPasswordForm /></Suspense>; }
