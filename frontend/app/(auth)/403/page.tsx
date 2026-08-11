import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Access Denied', robots: { index: false, follow: false } };
export default function ForbiddenPage() { return <main className="auth-utility-page"><section className="auth-utility-card"><p>403</p><h1>You do not have access to this page.</h1><p>Your account is signed in, but its role or permissions do not allow this action.</p><Link className="lc-btn-signup" href="/">Return safely</Link></section></main>; }
