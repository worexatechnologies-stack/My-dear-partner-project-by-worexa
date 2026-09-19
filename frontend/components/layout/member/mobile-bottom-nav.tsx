'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Search, MessageCircle, Heart, User } from 'lucide-react';
import { fetchInterestStats } from '@/lib/interest-stats';

const PRIMARY_NAV = [
  { label: 'Discover',     icon: Compass,        href: '/dashboard' },
  { label: 'Find Matches', icon: Search,         href: '/search' },
  { label: 'Messages',     icon: MessageCircle,  href: '/messages' },
  { label: 'Likes',        icon: Heart,          href: '/interests/received' },
  { label: 'Profile',      icon: User,           href: '/profile/me' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [receivedCount, setReceivedCount] = useState(0);

  useEffect(() => {
    fetchInterestStats().then((s) => setReceivedCount(s.received)).catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/interests/received') return pathname.startsWith('/interests');
    if (href === '/profile/me') return pathname === '/profile/me' || pathname.startsWith('/profile/edit');
    return pathname.startsWith(href);
  };

  return (
    <>
      <style>{`
        .mdp-bottom-nav {
          display: flex;
          align-items: center;
          justify-content: space-around;
          flex-shrink: 0;
          height: 3.5rem;
          background: rgba(255, 255, 255, 0.96);
          border-top: 1px solid #f0e6eb;
          padding-bottom: env(safe-area-inset-bottom);
          box-sizing: content-box;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 40;
        }
        @media (min-width: 1024px) {
          .mdp-bottom-nav { display: none; }
        }
        .mdp-bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.125rem;
          flex: 1;
          height: 100%;
          color: #737373;
          text-decoration: none;
          transition: transform 0.12s ease;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .mdp-bottom-nav-item:active {
          transform: scale(0.88);
        }
        .mdp-bottom-nav-item.active {
          color: #0f0f10;
        }
        .mdp-bottom-nav-item span {
          font-size: 0.625rem;
          font-weight: 500;
          line-height: 1;
          letter-spacing: -0.01em;
          transition: font-weight 0.15s ease, color 0.15s ease;
        }
        .mdp-bottom-nav-item.active span {
          font-weight: 750;
          color: #0f0f10;
        }
      `}</style>
      <nav className="mdp-bottom-nav" aria-label="Mobile navigation">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const isFilled = active && item.label === 'Likes';
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`mdp-bottom-nav-item ${active ? 'active' : ''}`}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon
                  style={{
                    width: '1.45rem',
                    height: '1.45rem',
                    color: active ? '#e11d48' : '#262626',
                    strokeWidth: active ? 2.75 : 1.85,
                    fill: isFilled ? '#e11d48' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
                {item.label === 'Likes' && receivedCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-0.25rem', right: '-0.4rem',
                    background: '#e11d48', color: 'white',
                    fontSize: '0.5rem', fontWeight: 700,
                    minWidth: '0.875rem', height: '0.875rem',
                    borderRadius: '9999px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '0 0.2rem', border: '1.5px solid white',
                    lineHeight: 1,
                  }}>
                    {receivedCount > 99 ? '99+' : receivedCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
