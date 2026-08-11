import type { Metadata } from 'next';
import ContactPage from '@/legacy/pages/ContactPage';

export const metadata: Metadata = { title: 'Contact', description: 'Contact the My Dear Partner trust and support team.', alternates: { canonical: '/contact' } };
export default function Page() { return <ContactPage />; }
