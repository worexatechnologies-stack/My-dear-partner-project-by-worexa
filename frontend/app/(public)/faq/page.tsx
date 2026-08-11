import type { Metadata } from 'next';
import { fetchPublicApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Frequently Asked Questions', description: 'Answers about profiles, verification, memberships, privacy, and support.', alternates: { canonical: '/faq' } };

export default async function FaqPage() {
  const faqs = await fetchPublicApi<Array<{ id: string; question: string; answer: string }>>('/faqs/').catch(() => []);
  return <main className="public-content-page"><div className="content-shell"><p>Help centre</p><h1>Questions, answered clearly.</h1><p>Find practical information about using My Dear Partner safely and confidently.</p>
    <div className="content-grid">{faqs.length ? faqs.map((faq) => <details className="content-card" key={faq.id}><summary><strong>{faq.question}</strong></summary><p>{faq.answer}</p></details>) : <div className="content-card"><h2>No FAQs published</h2><p>Please contact support and we will be happy to help.</p></div>}</div>
  </div></main>;
}
