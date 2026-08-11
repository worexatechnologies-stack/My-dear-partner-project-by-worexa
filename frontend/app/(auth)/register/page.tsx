import type { Metadata } from 'next';
import RegisterPage from '@/legacy/pages/RegisterPage';

export const metadata: Metadata = { title: 'Create Your Profile', robots: { index: false, follow: false } };
export default function Page() { return <RegisterPage />; }
