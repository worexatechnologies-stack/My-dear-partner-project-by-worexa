'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User, Settings, SlidersHorizontal,
  ShieldCheck, Headphones, LogOut, Crown, UserX
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { useMembership } from '@/components/member/membership-provider';
import ProfileImage from '@/components/profile/ProfileImage';

export function MemberHeaderProfileMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { membershipSummary } = useMembership();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Profile'
    : 'Profile';

  const isPremium = membershipSummary?.has_active_plan && !membershipSummary?.is_free;
  const planName = membershipSummary?.plan_name || 'Free';

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/login');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Instagram-style Avatar Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className={`flex items-center justify-center p-0.5 rounded-full transition-all cursor-pointer ${
          open ? 'ring-2 ring-[#262626]' : 'hover:opacity-85'
        }`}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-[#efefef] border border-[#dbdbdb] shrink-0">
          <ProfileImage
            photoId={undefined}
            src={user?.photo}
            variant="thumbnail"
            alt={displayName}
            size="sm"
            aspectRatio="4:5"
            shape="rounded"
            className="w-full h-full object-cover"
          />
        </div>
      </button>

      {/* Instagram-style Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-60 rounded-xl bg-white border border-[#dbdbdb] shadow-[0_4px_24px_rgba(0,0,0,0.12)] py-1.5 z-50 animate-in fade-in-50 duration-100">
          {/* User Name Preview */}
          <div className="px-4 py-2.5 border-b border-[#efefef]">
            <p className="text-xs font-bold text-[#262626] truncate">{displayName}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-[#8e8e8e] flex items-center gap-1">
                <Crown className={`w-3 h-3 ${isPremium ? 'text-amber-500' : 'text-[#8e8e8e]'}`} />
                <span>{planName} Plan</span>
              </p>
              <Link
                href="/membership"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-[#e11d48] hover:underline"
              >
                {isPremium ? 'Manage' : 'Upgrade'}
              </Link>
            </div>
          </div>

          {/* Section 1: Profile & Matching Preferences */}
          <div className="py-1 text-[13px] text-[#262626]">
            <Link
              href="/profile/me"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] transition-colors"
            >
              <User className="w-4 h-4 text-[#262626]" strokeWidth={1.8} />
              <span>My Profile</span>
            </Link>
          </div>

          {/* Section 2: Account, Safety & Support */}
          <div className="border-t border-[#efefef] py-1 text-[13px] text-[#262626]">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] transition-colors"
            >
              <Settings className="w-4 h-4 text-[#262626]" strokeWidth={1.8} />
              <span>Account Settings</span>
            </Link>

            <Link
              href="/blocked"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] transition-colors"
            >
              <UserX className="w-4 h-4 text-[#262626]" strokeWidth={1.8} />
              <span>Blocked Profiles</span>
            </Link>

            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] transition-colors"
            >
              <Headphones className="w-4 h-4 text-[#262626]" strokeWidth={1.8} />
              <span>Help &amp; Support</span>
            </Link>
          </div>

          {/* Section 3: Logout */}
          <div className="border-t border-[#efefef] pt-1 mt-0.5">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-[#ed4956] hover:bg-[#fff5f5] transition-colors text-left font-medium"
            >
              <LogOut className="w-4 h-4 text-[#ed4956]" strokeWidth={1.8} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
