import type { Metadata } from 'next';
import PrivacyClient from './privacy-client';

export const metadata: Metadata = { 
  title: 'Privacy Policy - MyDearPartner', 
  alternates: { canonical: '/privacy' } 
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}

