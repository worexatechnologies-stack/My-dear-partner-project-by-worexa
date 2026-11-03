'use client';

function GooglePlayIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.609 1.814C3.253 2.196 3 2.784 3 3.515v16.97c0 .73.253 1.319.609 1.701l.088.082 9.542-9.543v-.225L3.697 1.732l-.088.082z"
        fill="url(#gp_blue_shell)"
      />
      <path
        d="M16.42 15.932l-3.181-3.182v-.225l3.181-3.182.072.041 3.774 2.144c1.077.612 1.077 1.614 0 2.226l-3.774 2.144-.072.034z"
        fill="url(#gp_yellow_shell)"
      />
      <path
        d="M16.492 15.898L13.239 12.645 3.609 22.266c.356.377.949.421 1.62.041l11.263-6.409z"
        fill="url(#gp_red_shell)"
      />
      <path
        d="M16.492 8.102L5.229 1.693c-.671-.38-1.264-.336-1.62.041l9.63 9.621 3.253-3.253z"
        fill="url(#gp_green_shell)"
      />
      <defs>
        <linearGradient id="gp_blue_shell" x1="12.083" y1="2.748" x2="-2.015" y2="16.845" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A0FF" />
          <stop offset="0.007" stopColor="#00A1FF" />
          <stop offset="0.26" stopColor="#00BEFF" />
          <stop offset="0.512" stopColor="#00D2FF" />
          <stop offset="0.76" stopColor="#00DFFF" />
          <stop offset="1" stopColor="#00E3FF" />
        </linearGradient>
        <linearGradient id="gp_yellow_shell" x1="21.838" y1="12" x2="2.742" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE000" />
          <stop offset="0.409" stopColor="#FFBD00" />
          <stop offset="0.775" stopColor="#FFA500" />
          <stop offset="1" stopColor="#FF9C00" />
        </linearGradient>
        <linearGradient id="gp_red_shell" x1="14.383" y1="14.508" x2=".119" y2="28.772" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF3A44" />
          <stop offset="1" stopColor="#C31162" />
        </linearGradient>
        <linearGradient id="gp_green_shell" x1=".119" y1="-4.772" x2="14.383" y2="9.492" gradientUnits="userSpaceOnUse">
          <stop stopColor="#32A071" />
          <stop offset="0.069" stopColor="#2DA771" />
          <stop offset="0.476" stopColor="#15CF74" />
          <stop offset="0.801" stopColor="#06E775" />
          <stop offset="1" stopColor="#00F076" />
        </linearGradient>
      </defs>
    </svg>
  );
}


import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, ShieldCheck, X, LayoutDashboard, MapPin, Instagram } from 'lucide-react';
import { usePathname } from 'next/navigation';
import WelcomeSplash from '@/components/branding/welcome-splash';
import SiteLogo from '@/components/branding/site-logo';
import NavbarDiwaliEffects from '@/components/festive/navbar-diwali-effects';
import NavbarDeepam from '@/components/festive/navbar-deepam';

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
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/child-safety', label: 'Child Safety Standards' },
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
          className={`relative mx-auto flex h-16 max-w-7xl items-center justify-between px-3 transition-all duration-300 sm:px-5 ${scrolled
              ? 'rounded-2xl border border-amber-500/25 bg-[#fffaf7]/95 text-[#20111a] shadow-[0_12px_34px_rgba(43,16,29,.10)] backdrop-blur-xl'
              : 'rounded-2xl border border-amber-300/40 bg-white/85 text-[#20111a] shadow-[0_10px_28px_rgba(217,119,6,.08)] backdrop-blur-xl'
            }`}
        >
          <NavbarDiwaliEffects />

          {/* Left End: Deepam + Brand Logo */}
          <div className="relative z-10 flex items-center gap-1.5 sm:gap-2.5">
            <NavbarDeepam side="left" />
            <Link href="/" className="group flex items-center gap-2 sm:gap-2.5" aria-label="MyDearPartner home">
              <SiteLogo alt="MyDearPartner" className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105" />
              <div className="flex flex-col">
                <span className="font-display text-base font-extrabold tracking-tight leading-none sm:text-lg">
                  MyDear<span className="text-[#b64a68]">Partner</span>
                </span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-600 via-orange-500 to-rose-600 bg-clip-text text-transparent">
                  <span className="text-xs leading-none">🪔</span>
                  <span>Happy Diwali</span>
                </span>
              </div>
            </Link>
          </div>

          <nav className="relative z-10 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${pathname === link.href
                    ? 'bg-[#f8e9ee] text-[#8e3d58]'
                    : 'text-slate-600 hover:bg-white hover:text-[#8e3d58]'
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right End: Actions + Right Deepam */}
          <div className="relative z-10 flex items-center gap-2 sm:gap-2.5">
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

          <details className="group relative z-10 lg:hidden">
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
                  className={`block rounded-xl px-4 py-3 text-sm font-bold ${pathname === link.href ? 'bg-[#f8e9ee] text-[#8e3d58]' : 'text-slate-700 hover:bg-slate-50'
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

            <NavbarDeepam side="right" />
          </div>
        </div>
      </header>

      <main className="site-page-enter">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#20111a] px-5 py-12 text-white sm:px-8">
        {/* App Install Banner */}
        <div className="mx-auto mb-14 max-w-7xl overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#2d1223] via-[#3a162d] to-[#1f0b18] p-6 shadow-2xl sm:p-8 lg:p-10 relative">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#e8bd7e]/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />

          <div className="relative flex flex-col items-center justify-between gap-8 lg:flex-row">
            <div className="max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e8bd7e]/30 bg-[#e8bd7e]/10 px-3.5 py-1 text-xs font-bold text-[#e8bd7e]">
                <span>📱 Official Android App</span>
                <span className="h-1 w-1 rounded-full bg-[#e8bd7e]" />
                <span className="text-[11px] font-semibold text-slate-300">Google Play Store</span>
              </div>

              <h3 className="mt-3 font-display text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                Find Your Life Partner <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e8bd7e] via-[#f7d7a4] to-[#e8bd7e]">On The Go</span>
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                Download the official MyDearPartner mobile app for instant match alerts, verified profiles, and secure direct conversations wherever you are.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-300 lg:justify-start">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#e8bd7e]" /> 100% Verified Profiles
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-400">⚡</span> Real-Time Push Alerts
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-400">🔒</span> End-to-End Privacy
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row lg:flex-col lg:items-end">
              <a
                href="https://play.google.com/store/apps/details?id=com.mydearpartner&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-white/20 bg-black/85 px-5 py-3 shadow-lg shadow-black/40 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-[#e8bd7e]/60 hover:bg-black hover:shadow-[#e8bd7e]/20"
                aria-label="Download MyDearPartner App on Google Play"
              >
                <GooglePlayIcon className="h-8 w-8 shrink-0 transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GET IT ON</p>
                  <p className="font-display text-lg font-black leading-tight text-white tracking-tight">Google Play</p>
                </div>
              </a>

              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <div className="flex items-center text-amber-400">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
                <span className="text-slate-300">4.8 Rating</span>
                <span>•</span>
                <span>Free on Play Store</span>
              </div>
            </div>
          </div>
        </div>

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

            {/* Google Play Store Badge */}
            <div className="mt-5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#e8bd7e]">Download App</p>
              <a
                href="https://play.google.com/store/apps/details?id=com.mydearpartner&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-2.5 inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 transition-all hover:border-[#e8bd7e]/50 hover:bg-white/10"
              >
                <GooglePlayIcon className="h-6 w-6 shrink-0 transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">GET IT ON</p>
                  <p className="text-xs font-bold leading-none text-white">Google Play</p>
                </div>
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
