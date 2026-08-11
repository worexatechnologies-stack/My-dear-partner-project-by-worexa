'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, LayoutDashboard, MessageSquare, Search, User } from 'lucide-react';

const PRIMARY_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Matches', icon: Search, href: '/search' },
  { label: 'Messages', icon: MessageSquare, href: '/messages' },
  { label: 'Likes', icon: Heart, href: '/interests/received' },
  { label: 'Profile', icon: User, href: '/profile/me' },
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
    <nav className="mdp-mobile-bottom-nav" aria-label="Mobile navigation">
      {PRIMARY_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`mdp-mobile-nav-item ${active ? 'mdp-mobile-nav-active' : ''}`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
