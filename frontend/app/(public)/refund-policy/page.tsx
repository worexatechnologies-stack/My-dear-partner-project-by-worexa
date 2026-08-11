import type { Metadata } from 'next';
import RefundPolicyClient from './refund-policy-client';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy - MyDearPartner',
  description: 'Understand the refund and cancellation terms for paid membership plans on My Dear Partner, operated by Worexa Technologies.',
  alternates: { canonical: '/refund-policy' }
};

export default function RefundPolicyPage() {
  return <RefundPolicyClient />;
}