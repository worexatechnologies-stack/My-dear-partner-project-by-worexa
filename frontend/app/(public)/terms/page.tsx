import type { Metadata } from 'next';
import TermsClient from './terms-client';

export const metadata: Metadata = { 
  title: 'Terms & Conditions - MyDearPartner', 
  alternates: { canonical: '/terms' } 
};

export default function TermsPage() {
  return <TermsClient />;
}


