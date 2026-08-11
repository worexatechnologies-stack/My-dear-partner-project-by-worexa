'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, ShieldCheck, X, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import WelcomeSplash from '@/components/branding/welcome-splash';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/success-stories', label: 'Stories' },
  { href: '/membership', label: 'Membership' },
  { href: '/contact', label: 'Contact' },
];

export default function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const isHome = pathname === '/';

  // Check auth from localStorage directly (fastest, works on all pages)
  useEffect(() => {
    const check = () => {
      const stored = typeof window !== 'undefined' && window.localStorage.getItem('mdp.auth.authenticated') === 'true';
      setIsLoggedIn(stored);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);
  // The home hero uses a light editorial palette, so its navigation needs a
  // light surface instead of the former white-on-dark overlay treatment.
  const homeOverlay = isHome && !scrolled;

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 24);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  return <div className="min-h-screen bg-[#fcfbfa] text-[#20111a]">
    {isHome ? <WelcomeSplash /> : null}
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <div className={`mx-auto flex h-16 max-w-7xl items-center justify-between px-3 transition-all duration-300 sm:px-5 ${homeOverlay ? 'rounded-2xl border border-white/70 bg-[#fffaf7]/75 text-[#20111a] shadow-[0_10px_28px_rgba(43,16,29,.08)] backdrop-blur-xl' : 'rounded-2xl border border-[#3b1425]/10 bg-[#fffaf7]/95 text-[#20111a] shadow-[0_12px_34px_rgba(43,16,29,.10)] backdrop-blur-xl'}`}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="My Dear Partner home">
          <Image src="/images/main-logo.png" alt="My Dear Partner" width={36} height={36} className="h-9 w-9 object-contain" priority />
          <span className="font-display text-base font-extrabold tracking-tight sm:text-lg">My Dear <span className="text-[#b64a68]">Partner</span></span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href} className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${pathname === link.href ? 'bg-[#f8e9ee] text-[#8e3d58]' : 'text-slate-600 hover:bg-white hover:text-[#8e3d58]'}`}>{link.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          {isLoggedIn ? (
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-[#8e3d58] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45]">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-3.5 py-2 text-sm font-bold text-[#633447] transition hover:bg-[#f8e9ee]">Sign in</Link>
              <Link href="/register" className="rounded-xl bg-[#8e3d58] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45]">Create profile</Link>
            </>
          )}
        </div>
        <details className="group relative lg:hidden">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-[#8e3d58] hover:bg-[#f8e9ee] [&::-webkit-details-marker]:hidden" aria-label="Toggle navigation">
            <Menu className="h-6 w-6 group-open:hidden" />
            <X className="hidden h-6 w-6 group-open:block" />
          </summary>
          <nav id="mobile-main-navigation" className="absolute right-0 top-[calc(100%+0.7rem)] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#3b1425]/10 bg-[#fffaf7] p-2 shadow-xl" aria-label="Mobile navigation">
            {links.map((link) => <Link key={link.href} href={link.href} className={`block rounded-xl px-4 py-3 text-sm font-bold ${pathname === link.href ? 'bg-[#f8e9ee] text-[#8e3d58]' : 'text-slate-700 hover:bg-slate-50'}`}>{link.label}</Link>)}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:hidden">
              {isLoggedIn ? (
                <Link href="/dashboard" className="col-span-2 rounded-xl bg-[#8e3d58] px-3 py-3 text-center text-sm font-bold text-white">Go to Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-bold">Sign in</Link>
                  <Link href="/register" className="rounded-xl bg-[#8e3d58] px-3 py-3 text-center text-sm font-bold text-white">Create profile</Link>
                </>
              )}
            </div>
          </nav>
        </details>
      </div>
    </header>
    <main className="site-page-enter">{children}</main>
    <footer className="border-t border-white/10 bg-[#20111a] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-9 md:grid-cols-[1.4fr_1fr_1fr]">
        <div><div className="flex items-center gap-2"><Image src="/images/main-logo.png" alt="My Dear Partner" width={24} height={24} className="h-6 w-6 object-contain" /><span className="font-display text-lg font-extrabold">My Dear Partner</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">A thoughtful, privacy-first place to meet someone who shares your intentions for a lasting relationship.</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#e8bd7e]">Explore</p><div className="mt-4 grid gap-3">{links.slice(1).map((link) => <Link key={link.href} href={link.href} className="text-sm text-slate-300 transition hover:text-white">{link.label}</Link>)}</div></div>
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#e8bd7e]">Built for trust</p><div className="mt-4 space-y-3 text-sm text-slate-300"><p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-[#e8bd7e]" />Your privacy stays in your control.</p><p className="flex gap-2"><Image src="/images/main-logo.png" alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />Connections centred on real intent.</p></div></div>
      </div>
      <p className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-5 text-xs text-slate-500">© {new Date().getFullYear()} My Dear Partner. All rights reserved.</p>
    </footer>
  </div>;
}
