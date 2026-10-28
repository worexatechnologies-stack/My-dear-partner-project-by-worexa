import type { Metadata } from 'next';
import ChildSafetyClient from './child-safety-client';

export const metadata: Metadata = {
  title: 'Child Safety Standards & CSAE Policy - My Dear Partner',
  description:
    'Child Safety Standards and zero-tolerance policy against Child Sexual Abuse and Exploitation (CSAE) for My Dear Partner, developed by Worexa Technologies.',
  alternates: { canonical: '/child-safety' },
};

export default function ChildSafetyPage() {
  return <ChildSafetyClient />;
}

