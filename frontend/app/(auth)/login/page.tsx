import type { Metadata } from 'next';
import LoginPage from '@/legacy/pages/LoginPage';
export const metadata: Metadata = { title: 'Member Login', robots: { index: false, follow: false } };
export default function Page() { return <LoginPage />; }
