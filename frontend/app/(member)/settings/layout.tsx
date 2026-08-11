'use client';

import { usePathname } from 'next/navigation';
import {
  User, Shield, CreditCard, Bell, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const settingsNav = [
  { group: 'Profile', items: [
    { href: '/settings/profile', label: 'Edit Profile', icon: User },
  ]},
  { group: 'Account', items: [
    { href: '/settings/security', label: 'Security', icon: Shield },
    { href: '/settings/notifications', label: 'Notifications', icon: Bell },
    { href: '/settings/membership', label: 'Membership', icon: CreditCard },
    { href: '/settings/payments', label: 'Payments & refunds', icon: CreditCard },
  ]},
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProfileEditor = pathname === '/settings/profile';

  return (
    <div className="min-h-screen bg-[#f8f5f2]">
      <div className={`${isProfileEditor ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6`}>
        <div className="mb-5 flex items-center gap-2 text-sm text-[#8a747d]">
          <Link href="/dashboard" className="font-medium transition hover:text-[#8e3d58]">Dashboard</Link>
          <ChevronRight className="w-4 h-4" />
          <span>Settings</span>
        </div>
        <div className={isProfileEditor ? 'block' : 'flex flex-col lg:flex-row gap-8'}>
          {!isProfileEditor && <aside className="lg:w-64 shrink-0">
            <nav className="overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-sm">
              {settingsNav.map((group) => (
                <div key={group.group}>
                  <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.group}</p>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-r-2 border-[#bd6970] bg-[#f8e9ee] text-[#8e3d58]'
                            : 'text-[#77656d] hover:bg-[#fffaf7] hover:text-[#8e3d58]'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
