'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, ShieldCheck, X, LayoutDashboard, MapPin, Instagram } from 'lucide-react';
import { usePathname } from 'next/navigation';
import WelcomeSplash from '@/components/branding/welcome-splash';
import SiteLogo from '@/components/branding/site-logo';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/success-stories', label: 'Stories' },
  { href: '/membership', label: 'Membership' },
  { href: '/contact', label: 'Contact' },
];

const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/success-stories', label: 'Stories' },
  { href: '/membership', label: 'Membership' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

export default function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const isHome = pathname === '/';

  useEffect(() => {
    const check = () => {
      const stored =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('mdp.auth.authenticated') === 'true';
      setIsLoggedIn(stored);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const homeOverlay = isHome && !scrolled;

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 24);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#20111a]">
      {isHome ? <WelcomeSplash /> : null}

      {/* Header Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
        <div
          className={`mx-auto flex h-16 max-w-7xl items-center justify-between px-3 transition-all duration-300 sm:px-5 ${
            scrolled
              ? 'rounded-2xl border border-[#3b1425]/10 bg-[#fffaf7]/95 text-[#20111a] shadow-[0_12px_34px_rgba(43,16,29,.10)] backdrop-blur-xl'
              : 'rounded-2xl border border-white/80 bg-white/75 text-[#20111a] shadow-[0_10px_28px_rgba(43,16,29,.06)] backdrop-blur-xl'
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5" aria-label="MyDearPartner home">
            <SiteLogo alt="MyDearPartner" className="h-9 w-9 object-contain" />
            <span className="font-display text-base font-extrabold tracking-tight sm:text-lg">
              MyDear<span className="text-[#b64a68]">Partner</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  pathname === link.href
                    ? 'bg-[#f8e9ee] text-[#8e3d58]'
                    : 'text-slate-600 hover:bg-white hover:text-[#8e3d58]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#8e3d58] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45]"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-sm font-bold text-[#633447] transition hover:bg-[#f8e9ee]"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-[#8e3d58] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45]"
                >
                  Create profile
                </Link>
              </>
            )}
          </div>

          <details className="group relative lg:hidden">
            <summary
              className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-[#8e3d58] hover:bg-[#f8e9ee] [&::-webkit-details-marker]:hidden"
              aria-label="Toggle navigation"
            >
              <Menu className="h-6 w-6 group-open:hidden" />
              <X className="hidden h-6 w-6 group-open:block" />
            </summary>
            <nav
              id="mobile-main-navigation"
              className="absolute right-0 top-[calc(100%+0.7rem)] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#3b1425]/10 bg-[#fffaf7] p-2 shadow-xl"
              aria-label="Mobile navigation"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                    pathname === link.href ? 'bg-[#f8e9ee] text-[#8e3d58]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:hidden">
                {isLoggedIn ? (
                  <Link
                    href="/dashboard"
                    className="col-span-2 rounded-xl bg-[#8e3d58] px-3 py-3 text-center text-sm font-bold text-white"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-bold"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-xl bg-[#8e3d58] px-3 py-3 text-center text-sm font-bold text-white"
                    >
                      Create profile
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </details>
        </div>
      </header>

      <main className="site-page-enter">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#20111a] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-9 md:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/images/main-logo.png"
                alt="MyDearPartner"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
              <span className="font-display text-lg font-extrabold">MyDearPartner</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Behind every successful marriage is a meaningful connection. At MyDearPartner, we help transform introductions into lasting relationships by creating a trusted environment where genuine people, shared values, and lifelong aspirations come together naturally.
            </p>
            <p className="mt-3 text-xs font-semibold text-[#e8bd7e]">
              Where Meaningful Connections Become Lifelong Commitments.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://www.instagram.com/my_dearpartnermatrimony?igsh=ZGsxd243c3dzNWM4"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 transition-all hover:bg-[#e8bd7e] hover:text-[#20111a] hover:scale-110"
                aria-label="Follow MyDearPartner on Instagram"
              >
                <Instagram className="h-4.5 w-4.5" />
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#e8bd7e]">Explore</p>
            <div className="mt-4 grid gap-3">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#e8bd7e]">Built for trust</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#e8bd7e]" /> Your privacy stays in your control.
              </p>
              <p className="flex gap-2">
                <Image
                  src="/images/main-logo.png"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 shrink-0 object-contain"
                />{' '}
                Connections centred on real intent.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#e8bd7e]">Office Address</p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Worexa+Technologies+3rd+Phase+Banashankari+3rd+Stage+Banashankari+Bengaluru+Karnataka+560085"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-4 flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm transition-all hover:border-[#e8bd7e]/40 hover:bg-white/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8bd7e]/15 text-[#e8bd7e] transition-transform group-hover:scale-110">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#e8bd7e]">Workspace</p>
                <p className="mt-0.5 font-bold text-white text-sm transition-colors group-hover:text-[#e8bd7e]">
                  Worexa Technologies
                </p>
                <p className="mt-1 leading-tight text-slate-300">
                  3rd Phase, Banashankari 3rd Stage, Banashankari, Bengaluru, Karnataka 560085
                </p>
              </div>
            </a>
          </div>
        </div>

        <div className="mx-auto mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} MyDearPartner. All rights reserved. • Where Meaningful Connections Become Lifelong Commitments.</p>
          <p className="flex items-center gap-1.5 font-medium">
            <span>Designed by</span>
            <a
              href="https://worexatechnologies.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#e8bd7e] transition-colors hover:text-white hover:underline focus:outline-none focus:ring-1 focus:ring-[#e8bd7e]"
            >
              Worexa Technologies
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
