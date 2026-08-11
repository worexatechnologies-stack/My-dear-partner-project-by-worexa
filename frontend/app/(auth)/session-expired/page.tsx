import type { Metadata } from 'next';
import SessionExpiredPage from '@/legacy/pages/SessionExpiredPage';
export const metadata: Metadata = { title: 'Session Expired', robots: { index: false, follow: false } };
export default function Page() { return <SessionExpiredPage />; }
