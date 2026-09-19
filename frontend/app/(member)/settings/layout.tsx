'use client';

import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-[#fafafa] pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#e11d48]">
            <Home className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link
            href="/settings"
            className={`transition-colors ${pathname === '/settings' ? 'font-semibold text-slate-900' : 'hover:text-[#e11d48]'}`}
          >
            Settings
          </Link>
          {pathname !== '/settings' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 capitalize">
                {pathname === '/settings/payments' || pathname === '/settings/membership'
                  ? 'Membership'
                  : pathname === '/settings/security'
                  ? 'Security & Password'
                  : pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ')}
              </span>
            </>
          )}
        </nav>

        {/* Main Content Workspace (No inner sidebar) */}
        <main className="w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
