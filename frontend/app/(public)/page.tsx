import type { Metadata } from 'next';
import HomePage from '@/legacy/pages/HomePage';

export const metadata: Metadata = {
  title: 'Meaningful Matrimony for Lasting Partnerships',
  description: 'Meet verified, compatible partners through privacy-first matchmaking and thoughtful introductions.',
  alternates: { canonical: '/' },
};

export default function Page() { return <HomePage />; }
