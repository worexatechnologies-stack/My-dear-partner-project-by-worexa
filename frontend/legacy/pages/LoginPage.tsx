'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router-compat';
import {
  Heart, ShieldCheck, Eye, EyeOff, ArrowRight, Mail, Lock,
  CheckCircle2, LockKeyhole, Users, Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('next');
  const destination =
    requested && requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : '/dashboard';

  const alreadySignedIn = isAuthenticated && user?.account_type === 'MEMBER';

  useEffect(() => {
    if (!alreadySignedIn) return;
    // The App Router can retain the login segment during a restored session
    // in development. A document navigation guarantees that middleware and
    // the member layout are evaluated from a clean request.
    document.cookie = 'mdp_portal=MEMBER; path=/; max-age=31536000; SameSite=Lax';
    window.location.replace(destination);
  }, [alreadySignedIn, destination]);

  // Do not render an empty navigation component here. If a client-side route
  // transition is delayed, that previously left the login page completely
  // blank even though the member session had restored successfully.
  if (alreadySignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf8f5] p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-[#230914]">Opening your dashboard…</h1>
          <p className="mt-2 text-sm text-slate-500">Your secure session is ready.</p>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your email or mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password, 'MEMBER');
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to sign in. Please check your credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-redesign"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
        background: '#fdf8f5',
        overflow: 'hidden',
      }}
    >
      {/* ─── LEFT HERO PANEL ─── */}
      <div
        style={{
          position: 'relative',
          width: '52%',
          minHeight: '100vh',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'none',
        }}
        className="login-hero-panel"
        aria-hidden="true"
      >
        <img
          src="/images/login-editorial-portrait.png"
          alt="Happy Indian couple"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        {/* Right-to-left dark gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(35,9,20,0.15) 0%, rgba(35,9,20,0.52) 55%, rgba(35,9,20,0.82) 100%)' }} />
        {/* Bottom fade */}
        <div style={{ position: 'absolute', inset: '0 0 0 0', background: 'linear-gradient(to top, rgba(35,9,20,0.75) 0%, transparent 50%)', bottom: 0 }} />

        {/* Logo */}
        <Link to="/" style={{ position: 'absolute', top: 40, left: 40, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10, textDecoration: 'none', cursor: 'pointer' }}>
          <img src="/images/main-logo.png" alt="My Dear Partner Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <span style={{ color: 'white', fontWeight: 900, fontSize: 20, letterSpacing: '-0.5px' }}>
            My Dear <span style={{ color: '#ec4899' }}>Partner</span>
          </span>
        </Link>

        {/* Floating stat cards — top right */}
        <div style={{ position: 'absolute', top: 40, right: 32, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { Icon: Users, val: '10K+', sub: 'Happy Couples' },
            { Icon: ShieldCheck, val: '100%', sub: 'ID Verified' },
          ].map(({ Icon, val, sub }) => (
            <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(244,114,182,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 14, height: 14, color: '#f9a8c4' }} />
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>{val}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom copy */}
        <div style={{ position: 'absolute', bottom: 48, left: 40, right: 40, zIndex: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {['100% Verified', 'Govt ID Checked', 'Secure Messaging'].map((tag) => (
              <span key={tag} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}>
                {tag}
              </span>
            ))}
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: 'white', lineHeight: 1.2, marginBottom: 12, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            Where Meaningful<br />
            <span style={{ color: '#f9a8c4' }}>Matches Begin.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, maxWidth: 320, marginBottom: 20 }}>
            Join thousands of families who have found their perfect match on India&apos;s most trusted matrimony platform.
          </p>
          {/* Stars strip */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1,2,3,4,5].map((s) => <Star key={s} style={{ width: 14, height: 14, fill: '#fbbf24', color: '#fbbf24' }} />)}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700 }}>Rated 4.9 by 8,000+ members</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT FORM PANEL ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>

        {/* Mobile top bar */}
        <div className="login-mobile-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 8px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/images/main-logo.png" alt="My Dear Partner Logo" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          
            <span style={{ fontWeight: 900, fontSize: 16, color: '#230914' }}>
              My Dear <span style={{ color: '#ec4899' }}>Partner</span>
            </span>
          </Link>
          <Link to="/register" style={{ fontSize: 12, fontWeight: 800, color: '#8e3d58', border: '1px solid #f3b8cb', borderRadius: 12, padding: '6px 14px', background: '#fdf1f5', textDecoration: 'none' }}>
            Register Free
          </Link>
        </div>

        {/* Centered form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#fce7ef', border: '1px solid #f3b8cb', color: '#8e3d58', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', width: 'fit-content', marginBottom: 4 }}>
                <Heart style={{ width: 12, height: 12, fill: 'currentColor' }} />
                Member Sign In
              </div>
              <h1 style={{ fontSize: 38, fontWeight: 900, color: '#230914', lineHeight: 1.15, letterSpacing: '-1px', margin: 0 }}>
                Welcome<br />back. 👋
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
                New to MyDearPartner?{' '}
                <Link to="/register" style={{ color: '#8e3d58', fontWeight: 800, textDecoration: 'none' }}>
                  Create free account →
                </Link>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 16, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>!</div>
                <span style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>

              {/* Email / phone field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="member-identifier" style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Email or Mobile Number
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 16, transition: 'all 0.18s', background: focused === 'id' ? '#fff' : '#f9f1f4', border: focused === 'id' ? '2px solid #8e3d58' : '1.5px solid #f3d5de', boxShadow: focused === 'id' ? '0 0 0 4px rgba(142,61,88,0.10)' : 'none' }}>
                  <Mail style={{ position: 'absolute', left: 14, width: 16, height: 16, color: focused === 'id' ? '#8e3d58' : '#c4a0ad', pointerEvents: 'none' }} />
                  <input
                    id="member-identifier"
                    autoFocus
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onFocus={() => setFocused('id')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com or 9876543210"
                    required
                    style={{ width: '100%', paddingLeft: 42, paddingRight: 14, paddingTop: 15, paddingBottom: 15, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, color: '#111827', borderRadius: 16 }}
                  />
                </div>
              </div>

              {/* Password field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="member-password" style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Password
                  </label>
                  <Link to="/forgot-password" style={{ fontSize: 11, fontWeight: 800, color: '#8e3d58', textDecoration: 'none' }}>
                    Forgot Password?
                  </Link>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 16, transition: 'all 0.18s', background: focused === 'pw' ? '#fff' : '#f9f1f4', border: focused === 'pw' ? '2px solid #8e3d58' : '1.5px solid #f3d5de', boxShadow: focused === 'pw' ? '0 0 0 4px rgba(142,61,88,0.10)' : 'none' }}>
                  <Lock style={{ position: 'absolute', left: 14, width: 16, height: 16, color: focused === 'pw' ? '#8e3d58' : '#c4a0ad', pointerEvents: 'none' }} />
                  <input
                    id="member-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('pw')}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter your password"
                    required
                    style={{ width: '100%', paddingLeft: 42, paddingRight: 48, paddingTop: 15, paddingBottom: 15, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, color: '#111827', borderRadius: 16 }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                id="login-submit"
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: 16,
                  background: submitting ? '#b0607a' : 'linear-gradient(135deg, #8e3d58 0%, #5c1f35 100%)',
                  boxShadow: submitting ? 'none' : '0 6px 24px rgba(142,61,88,0.32)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  opacity: submitting ? 0.75 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Signing you in…
                  </>
                ) : (
                  <>
                    Sign In to My Account
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            </form>

            <Link
              to="/verify-otp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8e3d58',
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Sign in with a one-time code <ArrowRight style={{ width: 14, height: 14, marginLeft: 4 }} />
            </Link>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#f0e0e8' }} />
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Secured Login</span>
              <div style={{ flex: 1, height: 1, background: '#f0e0e8' }} />
            </div>

            {/* Trust grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { Icon: ShieldCheck, label: '100% Verified' },
                { Icon: LockKeyhole, label: 'End-to-End Secure' },
                { Icon: CheckCircle2, label: 'Govt ID Checked' },
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', borderRadius: 16, background: '#fdf1f5', border: '1px solid #f3d5de', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fce7ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ width: 15, height: 15, color: '#8e3d58' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', lineHeight: 1.3 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', margin: 0 }}>
              © {new Date().getFullYear()} MyDearPartner · All data encrypted &amp; secure.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive styles via a style tag */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-redesign { background: #fffefd !important; font-family: var(--font-manrope), system-ui, sans-serif !important; }
        .login-redesign .login-hero-panel { width: 48% !important; }
        .login-redesign .login-hero-panel > div:nth-of-type(1) { background: linear-gradient(to top, rgba(44,41,40,.74), rgba(44,41,40,.08) 62%) !important; }
        .login-redesign .login-hero-panel > div:nth-of-type(2) { background: linear-gradient(to top, rgba(44,41,40,.45), transparent 55%) !important; }
        .login-redesign .login-hero-panel h2 { font-family: var(--font-display), Georgia, serif !important; font-weight: 400 !important; font-size: 46px !important; letter-spacing: -.05em !important; }
        .login-redesign .login-hero-panel h2 span { color: #f0c4c5 !important; font-family: Georgia, serif !important; font-style: italic; }
        .login-redesign .login-hero-panel > a span { font-family: var(--font-display), Georgia, serif !important; }
        .login-redesign .login-hero-panel > a span span { color: #f0c4c5 !important; }
        .login-redesign > div:last-of-type { background: #fffefd !important; }
        .login-redesign .login-mobile-topbar { border-bottom: 1px solid #eaded8; background: #fffefd !important; }
        .login-redesign input { border-radius: 0 !important; }
        .login-redesign button[type="submit"] { border-radius: 0 !important; background: #bd6970 !important; box-shadow: none !important; text-transform: uppercase; letter-spacing: .12em; font-size: 12px !important; }
        .login-redesign button[type="submit"]:hover { background: #a8525c !important; }
        .login-redesign [style*="borderRadius: 16"] { border-radius: 0 !important; }
        .login-redesign [style*="background: '#f9f1f4'"] { background: #fffaf7 !important; border-color: #eaded8 !important; }
        .login-redesign [style*="background: '#fdf1f5'"] { background: #fffaf7 !important; border-color: #eaded8 !important; }
        .login-redesign [style*="color: '#8e3d58'"] { color: #a8525c !important; }
        @media (min-width: 1024px) {
          .login-hero-panel { display: block !important; }
          .login-mobile-topbar { display: none !important; }
        }
        @media (max-width: 1023px) {
          .login-hero-panel { display: none !important; }
          .login-mobile-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
