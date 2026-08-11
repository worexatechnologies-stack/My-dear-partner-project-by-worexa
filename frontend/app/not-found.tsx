import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-utility-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: '1.5rem', fontFamily: "'Inter', sans-serif" }}>
      <section className="auth-utility-card" style={{ maxWidth: '440px', width: '100%', background: '#ffffff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', padding: '2.5rem', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: '#e11d48', lineHeight: 1 }}>404</span>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Page Not Found</h1>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          The address may be outdated, or the resource may no longer be available.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link href="/login" style={{ display: 'block', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', background: '#e11d48', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', transition: 'background 0.2s' }}>
            Return to Member Login
          </Link>
          <Link href="/register" style={{ display: 'block', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', transition: 'background 0.2s' }}>
            Create New Account
          </Link>
          <Link href="/" style={{ display: 'block', padding: '0.5rem 1rem', color: '#9ca3af', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none' }}>
            Back to Home Page
          </Link>
        </div>
      </section>
    </main>
  );
}
