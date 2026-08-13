import type { Metadata } from 'next';
import FaqContentPage from '@/components/public/faq-page';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | MyDearPartner',
  description: 'Honest answers to the questions families ask us most about privacy, parents, membership, and matchmaking.',
  alternates: { canonical: '/faq' },
};

export default function Page() {
  return <FaqContentPage />;
}
