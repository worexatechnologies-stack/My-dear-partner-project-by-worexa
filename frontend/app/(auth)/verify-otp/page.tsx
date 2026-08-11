import type { Metadata } from 'next';
import { VerifyOtpForm } from '@/components/auth/recovery-forms';
export const metadata: Metadata = { title: 'Verify One-Time Code', robots: { index: false, follow: false } };
export default function Page() { return <VerifyOtpForm />; }
