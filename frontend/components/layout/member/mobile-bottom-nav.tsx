'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Search, MessageCircle, Heart, User } from 'lucide-react';

const PRIMARY_NAV = [
  { label: 'Discover', icon: Compass, href: '/dashboard' },
  { label: 'Find Matches', icon: Search,  href: '/search' },
  { label: 'Messages', icon: MessageCircle, href: '/messages' },
  { label: 'Likes',    icon: Heart,   href: '/interests/received' },
  { label: 'Profile',  icon: User,    href: '/profile/me' },
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
          align-items: stretch;
          justify-content: space-around;
          flex-shrink: 0;
          background: rgba(255, 254, 253, 0.86);
          border-top: 1px solid rgba(240, 231, 234, 0.9);
          padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
          backdrop-filter: blur(22px) saturate(1.35);
          -webkit-backdrop-filter: blur(22px) saturate(1.35);
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
          gap: 0.2rem;
          flex: 1;
          padding: 0.55rem 0.25rem 0.3rem;
          font-size: 0.5625rem;
          font-weight: 600;
          color: #9a898f;
          text-decoration: none;
          transition: color 0.18s ease;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .mdp-bottom-nav-item:active { opacity: 0.75; }
        .mdp-bottom-nav-item.active {
          color: #8e3d58;
          font-weight: 700;
        }
        .mdp-bottom-nav-item.active svg {
          filter: drop-shadow(0 2px 4px rgba(142,61,88,0.3));
        }
        .mdp-nav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.125rem;
          border-radius: 9999px;
          transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .mdp-bottom-nav-item.active .mdp-nav-icon-wrap {
          background: linear-gradient(135deg, #fdf3f6 0%, #f9e4eb 100%);
          box-shadow: inset 0 0 0 1px rgba(182,74,104,0.18), 0 3px 10px rgba(142,61,88,0.14);
          transform: translateY(-1px);
        }
        .mdp-bottom-nav-item.active .mdp-nav-icon-wrap::before {
          content: '';
          position: absolute;
          top: -0.45rem;
          left: 50%;
          transform: translateX(-50%);
          width: 1.125rem;
          height: 3px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #e11d48, #8e3d58);
          box-shadow: 0 1px 4px rgba(225,29,72,0.4);
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
                    strokeWidth: active ? 2.5 : 1.75,
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
