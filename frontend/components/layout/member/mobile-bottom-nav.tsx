'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Search, MessageCircle, Heart, User } from 'lucide-react';

const PRIMARY_NAV = [
  { label: 'Discover',     icon: Compass,        href: '/dashboard' },
  { label: 'Find Matches', icon: Search,         href: '/search' },
  { label: 'Messages',     icon: MessageCircle,  href: '/messages' },
  { label: 'Likes',        icon: Heart,          href: '/interests/received' },
  { label: 'Profile',      icon: User,           href: '/profile/me' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

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
          height: 3.75rem;
          background: rgba(255, 255, 255, 0.94);
          border-top: 1px solid #f0e6eb;
          padding-bottom: env(safe-area-inset-bottom);
          box-sizing: content-box;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 -4px 20px rgba(45, 20, 30, 0.04);
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
          gap: 0.1875rem;
          flex: 1;
          height: 100%;
          color: #7e6c75;
          text-decoration: none;
          transition: color 0.16s ease, transform 0.12s ease;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .mdp-bottom-nav-item:active {
          transform: scale(0.95);
        }
        .mdp-bottom-nav-item.active {
          color: #e11d48;
        }
        .mdp-nav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 1.75rem;
          border-radius: 9999px;
          background: transparent;
          transition: all 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
        }
        .mdp-bottom-nav-item.active .mdp-nav-icon-wrap {
          background: #fff0f4;
          transform: translateY(-1px);
        }
        .mdp-bottom-nav-item span {
          font-size: 0.6875rem;
          font-weight: 500;
          line-height: 1.1;
          transition: font-weight 0.16s ease;
        }
        .mdp-bottom-nav-item.active span {
          font-weight: 700;
          color: #e11d48;
        }
      `}</style>
      <nav className="mdp-bottom-nav" aria-label="Mobile navigation">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`mdp-bottom-nav-item ${active ? 'active' : ''}`}
            >
              <div className="mdp-nav-icon-wrap">
                <Icon
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: active ? '#e11d48' : '#7e6c75',
                    strokeWidth: active ? 2.25 : 1.85,
                    transition: 'all 0.16s ease',
                  }}
                />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
