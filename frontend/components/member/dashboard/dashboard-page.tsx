'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Crown, Settings,
  UserPlus, MapPin, BadgeCheck, CheckCircle2,
  ArrowRight, Check, X, Eye, Lock,
  ShieldCheck, Compass, ChevronRight, Star,
  Bookmark, Activity, Clock,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { getInterests, getConversations, getProfiles, updateInterestStatus } from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';
import { DashboardSkeleton } from '@/legacy/components/SkeletonLoader';
import { useGetUnlockUsageQuery } from '@/legacy/services/profileApi';

/* ─────────────────────────── types & helpers ─────────────────────── */

const fieldLabels: Record<string, string> = {
  mobile_number: 'Mobile Number',
  gender: 'Gender',
  profile_created_by: 'Profile Created For',
  date_of_birth: 'Date of Birth',
  marital_status: 'Marital Status',
  height: 'Height',
  weight: 'Weight',
  religion: 'Religion',
  mother_tongue: 'Mother Tongue',
  highest_education: 'Education',
  occupation: 'Occupation',
  annual_income: 'Annual Income',
  work_location: 'Current City',
  photo: 'Profile Photo',
  about: 'About Me',
};

interface ProfileVisitor {
  id: string;
  viewed_at: string;
  profile: {
    id?: string;
    user_id?: string;
    full_name?: string;
    first_name?: string;
    age?: number;
    photo?: string;
    work_location?: string;
  };
}

interface ProfileVisitorsResponse {
  can_view_visitors: boolean;
  total_unique_visitors: number;
  results: ProfileVisitor[];
}

function relativeTime(value: string) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* ─────────────────────────── sub-components ─────────────────────────── */

/**
 * Decorative mandala/floral SVG pattern for the hero banner.
 * Renders concentric petal rings — Indian-matrimony motif at low opacity.
 */
function FloralPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer petal ring (12 petals) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const cx = 200 + 120 * Math.cos(angle);
        const cy = 200 + 120 * Math.sin(angle);
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx="18"
            ry="36"
            transform={`rotate(${i * 30} ${cx} ${cy})`}
            fill="currentColor"
            opacity="0.5"
          />
        );
      })}
      {/* Middle petal ring (8 petals) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const cx = 200 + 72 * Math.cos(angle);
        const cy = 200 + 72 * Math.sin(angle);
        return (
          <ellipse
            key={`m${i}`}
            cx={cx}
            cy={cy}
            rx="10"
            ry="22"
            transform={`rotate(${i * 45} ${cx} ${cy})`}
            fill="currentColor"
            opacity="0.6"
          />
        );
      })}
      <circle cx="200" cy="200" r="22" fill="currentColor" opacity="0.5" />
      <circle cx="200" cy="200" r="10" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/** Animated circular SVG arc with outer glow ring */
function ProfileArc({ percentage }: { percentage: number }) {
  const R = 56;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - percentage / 100);

  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Glow halo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: '0 0 36px 10px rgba(244,63,94,0.20)' }}
      />
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
        {/* Track */}
        <circle cx="64" cy="64" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
        {/* Soft glow behind the arc */}
        <circle
          cx="64" cy="64" r={R}
          stroke="rgba(244,63,94,0.18)"
          strokeWidth="15"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        {/* Main progress arc */}
        <circle
          cx="64" cy="64" r={R}
          stroke="url(#dashArcGrad)"
          strokeWidth="9"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <defs>
          <linearGradient id="dashArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white tracking-tight">{percentage}%</span>
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">complete</span>
      </div>
    </div>
  );
}

/** Dark glass Daily Usage panel — inlined for design cohesion */
function DailyUsagePanel() {
  const { data: usage, refetch, isLoading } = useGetUnlockUsageQuery();

  useEffect(() => {
    refetch();
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  if (isLoading || !usage) {
    return (
      <div className="bg-slate-900 rounded-[2rem] p-6 h-52 flex items-center justify-center shadow-xl shadow-slate-900/30">
        <div className="w-8 h-8 border-4 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" aria-label="Loading daily usage" />
      </div>
    );
  }

  const unlockPct = usage.daily_limit && usage.daily_limit > 0
    ? Math.min((usage.used_today / usage.daily_limit) * 100, 100) : 0;
  const interestPct = usage.interest_limit && usage.interest_limit > 0
    ? Math.min(((usage.interest_used_today ?? 0) / usage.interest_limit) * 100, 100) : 0;
  const resetTime = new Date(usage.resets_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const lowUnlocks = usage.remaining_today !== null && usage.remaining_today !== undefined && usage.remaining_today <= 2;
  const lowInterests = usage.interest_remaining_today !== null && usage.interest_remaining_today !== undefined && usage.interest_remaining_today <= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 border border-white/5"
      style={{ boxShadow: '0 8px 40px rgba(15,23,42,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}
    >
      {/* Ambient glows */}
      <div aria-hidden="true" className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/15 blur-[50px] rounded-full pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-8 -left-8 w-32 h-32 bg-rose-500/10 blur-[40px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
          <Activity className="w-5 h-5 text-rose-300" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Daily Usage</h3>
          <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> Resets at {resetTime} IST
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-4">
        {/* Unlocks */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Unlocks</span>
            {lowUnlocks && <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full">Low</span>}
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-xl font-black text-rose-300">{usage.remaining_today ?? '∞'}</span>
            <span className="text-xs text-white/30">/{usage.daily_limit ?? '∞'}</span>
          </div>
          {usage.daily_limit && usage.daily_limit > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${unlockPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
              />
            </div>
          )}
        </div>

        {/* Interests */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Interests</span>
            {lowInterests && <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full">Low</span>}
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-xl font-black text-rose-300">{usage.interest_remaining_today ?? '∞'}</span>
            <span className="text-xs text-white/30">/{usage.interest_limit ?? '∞'}</span>
          </div>
          {usage.interest_limit && usage.interest_limit > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${interestPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Upgrade CTA */}
      {lowUnlocks && usage.daily_limit && (
        <Link
          to="/membership"
          className="relative z-10 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-900/40 hover:brightness-110 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          <Crown className="w-3.5 h-3.5" /> Upgrade for More
        </Link>
      )}
    </motion.div>

  );
}

/** A single Curated Picks card with CSS 3D tilt on hover */
function MatchCard({
  profile,
  onInterest,
  onPass,
  shortlisted,
  onShortlist,
}: {
  profile: any;
  onInterest: (id: string) => void;
  onPass: (id: string) => void;
  shortlisted: boolean;
  onShortlist: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative overflow-hidden rounded-3xl bg-slate-100 border border-slate-100/50"
      style={{
        transformStyle: 'preserve-3d',
        transform: hovered
          ? 'perspective(800px) rotateY(2.5deg) rotateX(-1.5deg) translateY(-5px)'
          : 'perspective(800px) rotateY(0) rotateX(0) translateY(0)',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.18)' : '0 4px 12px rgba(0,0,0,0.07)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo */}
      <Link to={`/profile/${profile.id}`} className="block aspect-[3/4] overflow-hidden" tabIndex={-1} aria-hidden="true">
        <SmartImage
          src={profile.photo}
          alt={profile.name || 'Match'}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      </Link>

      {/* Gradient overlay */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent pointer-events-none" />

      {/* Compatibility badge */}
      {profile.compatibility > 0 && (
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/15 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/25 shadow-sm">
          <ShieldCheck className="w-3 h-3 text-amber-300" />
          {profile.compatibility}% match
        </div>
      )}

      {/* Shortlist button */}
      <button
        type="button"
        aria-label={shortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
        onClick={() => onShortlist(profile.id)}
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          shortlisted
            ? 'bg-rose-500 border-rose-400 text-white shadow-md shadow-rose-500/40'
            : 'bg-white/15 backdrop-blur-md border-white/25 text-white hover:bg-rose-500/80'
        }`}
      >
        <Bookmark className="w-3.5 h-3.5" fill={shortlisted ? 'currentColor' : 'none'} />
      </button>

      {/* Verified indicator */}
      {profile.is_verified && (
        <div className="absolute top-3 right-12 w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center border-2 border-white shadow-md" title="Verified profile">
          <BadgeCheck className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      {/* Info + actions strip */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
        <Link
          to={`/profile/${profile.id}`}
          aria-label={`View ${profile.name}${profile.age ? `, age ${profile.age}` : ''}'s profile`}
        >
          <p className="font-black text-sm text-white truncate">
            {profile.name}{profile.age ? `, ${profile.age}` : ''}
          </p>
          <p className="text-[11px] font-medium text-white/60 mt-0.5 truncate flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />{profile.location || 'India'}
          </p>
        </Link>

        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            aria-label={`Pass on ${profile.name}`}
            onClick={() => onPass(profile.id)}
            className="flex-1 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white/80 font-bold text-xs border border-white/15 hover:bg-white/20 hover:text-white transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 flex items-center justify-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Pass
          </button>
          <button
            type="button"
            aria-label={`Send interest to ${profile.name}`}
            onClick={() => onInterest(profile.id)}
            className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 flex items-center justify-center gap-1"
          >
            <Heart className="w-3.5 h-3.5" fill="currentColor" /> Interest
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── main page ─────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [stats, setStats] = useState({ receivedCount: 0, sentCount: 0, acceptedCount: 0, chatsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [incoming, outgoing, conversations, profiles, visitorData] = await Promise.all([
        getInterests('incoming').catch(() => []),
        getInterests('outgoing').catch(() => []),
        getConversations().catch(() => []),
        getProfiles().catch(() => ({ results: [] })),
        fetchApi<ProfileVisitorsResponse>('/profile-visitors/', { params: { limit: 5 } })
          .catch(() => ({ can_view_visitors: false, total_unique_visitors: 0, results: [] })),
      ]);

      const pendingIncoming = incoming.filter((i: any) => i.status === 'PENDING');
      setIncomingInterests(pendingIncoming);
      setSuggestedProfiles(profiles.results.slice(0, 6));
      setVisitors(visitorData.results || []);
      setCanViewVisitors(visitorData.can_view_visitors);
      setVisitorCount(visitorData.total_unique_visitors);

      const allInterests = [...incoming, ...outgoing];
      setStats({
        receivedCount: incoming.length,
        sentCount: outgoing.length,
        acceptedCount: allInterests.filter((i: any) => i.status === 'ACCEPTED').length,
        chatsCount: conversations.length,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadData().finally(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [loadData]);

  const handleInterestAction = async (interestId: string, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      await updateInterestStatus(interestId, status);
      await loadData();
    } catch (err) {
      console.error('Interest action failed:', err);
    }
  };

  const toggleShortlist = useCallback((profileId: string) => {
    setShortlisted(prev => {
      const next = new Set(prev);
      const added = !next.has(profileId);
      if (added) next.add(profileId); else next.delete(profileId);
      console.log('Shortlist toggled:', profileId, added);
      return next;
    });
  }, []);

  const handleInterest = useCallback((profileId: string) => {
    console.log('Interest sent to profile:', profileId);
  }, []);

  const handlePass = useCallback((profileId: string) => {
    console.log('Passed profile:', profileId);
  }, []);

  const completionPercentage = user?.completion_percentage ?? 0;
  const missingFields = user?.missing_fields ?? [];
  const profilePhoto = user?.photo || '/favicon.svg';
  const isPremium = user?.is_premium ?? false;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-app-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: UserPlus, label: 'Received', value: stats.receivedCount, href: '/interests',
      gradient: 'linear-gradient(135deg,#fb7185 0%,#f43f5e 100%)',
      shadow: '0 6px 20px rgba(244,63,94,0.30)',
    },
    {
      icon: Heart, label: 'Sent', value: stats.sentCount, href: '/interests',
      gradient: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)',
      shadow: '0 6px 20px rgba(124,58,237,0.25)',
    },
    {
      icon: CheckCircle2, label: 'Accepted', value: stats.acceptedCount, href: '/interests',
      gradient: 'linear-gradient(135deg,#34d399 0%,#059669 100%)',
      shadow: '0 6px 20px rgba(5,150,105,0.25)',
    },
    {
      icon: MessageCircle, label: 'Chats', value: stats.chatsCount, href: '/messages',
      gradient: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)',
      shadow: '0 6px 20px rgba(245,158,11,0.30)',
    },
  ];

  return (
    <div className="min-h-screen pb-20 bg-app-bg overflow-x-hidden font-sans">
      {/* Conic-gradient spin for avatar ring */}
      <style>{`
        @keyframes mdp-spin { to { transform: rotate(360deg); } }
        .mdp-ring-spin { animation: mdp-spin 6s linear infinite; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pt-6">

        {/* ══════════════════════════════════
            HERO BANNER
        ══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[2.5rem] border border-rose-100/60"
          style={{
            background: 'linear-gradient(135deg, #fff1f5 0%, #fff8f1 45%, #fffdf9 75%, #f3f0ff 100%)',
            boxShadow: '0 4px 32px rgba(244,63,94,0.09), 0 1px 0 rgba(255,255,255,0.9) inset',
          }}
        >
          {/* Decorative floral patterns */}
          <FloralPattern className="absolute -right-10 -top-10 w-72 h-72 text-rose-300/10 pointer-events-none select-none" />
          <FloralPattern className="absolute -left-6 -bottom-8 w-48 h-48 text-amber-300/10 pointer-events-none select-none rotate-45" />

          {/* Ambient glows */}
          <div aria-hidden="true" className="absolute top-0 right-1/3 w-72 h-28 bg-rose-200/20 blur-[70px] rounded-full pointer-events-none" />
          <div aria-hidden="true" className="absolute bottom-0 left-0 w-52 h-28 bg-amber-200/20 blur-[60px] rounded-full pointer-events-none" />

          <div className="relative z-10 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Avatar + greeting */}
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">

              {/* Animated glowing avatar ring */}
              <div className="relative shrink-0 group">
                {/* Rotating conic gradient ring */}
                <div
                  aria-hidden="true"
                  className="mdp-ring-spin absolute inset-[-5px] rounded-[2.2rem] pointer-events-none"
                  style={{
                    background: 'conic-gradient(from 0deg, #f43f5e, #fb923c, #f43f5e, #c026d3, #f43f5e)',
                    filter: 'blur(3px)',
                    opacity: 0.65,
                  }}
                />
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-white border-4 border-white overflow-hidden shadow-xl group-hover:scale-105 transition-transform duration-300">
                  <SmartImage src={profilePhoto} alt="Your profile photo" className="w-full h-full object-cover" />
                </div>
                {/* Membership badge */}
                <div
                  aria-label={isPremium ? 'Premium Partner' : 'Standard Member'}
                  className={`absolute -bottom-2 -right-2 rounded-xl p-2 border-2 border-white shadow-lg text-white ${
                    isPremium
                      ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-500'
                  }`}
                >
                  {isPremium ? <Crown className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5 fill-white/30" />}
                </div>
              </div>

              {/* Text block */}
              <div className="space-y-3">
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                      isPremium
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isPremium ? <Crown className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                    {isPremium ? 'Premium Partner' : 'Standard Member'}
                  </span>
                  {user?.is_verified && (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                </div>
                <h1
                  className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight"
                  style={{ fontFamily: '"Manrope", Georgia, serif' }}
                >
                  Welcome back, {user?.first_name || 'Member'} <span aria-hidden="true">✨</span>
                </h1>
                <p className="text-slate-500 text-sm max-w-md leading-relaxed">
                  Discover new matches curated just for you. Complete your profile to maximise your visibility.
                </p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Link
                to="/search"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  boxShadow: '0 6px 24px rgba(15,23,42,0.22)',
                }}
              >
                <Compass className="w-4 h-4 text-rose-300" />
                Discover Matches
              </Link>
              <Link
                to="/settings"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Edit Profile
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════
            STAT CARDS — gradient + hover lift
        ══════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.07 }}
            >
              <Link
                to={stat.href}
                aria-label={`${stat.label}: ${stat.value}`}
                className="group block p-5 rounded-[2rem] transition-all duration-300 hover:-translate-y-1.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={{ background: stat.gradient, boxShadow: stat.shadow }}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner border border-white/20 group-hover:scale-110 transition-transform duration-300">
                    <stat.icon className="w-5 h-5 text-white/90" />
                  </div>
                  <span className="text-3xl font-black text-white tracking-tight">{stat.value}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">{stat.label}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ══════════════════════════════════
            BENTO GRID
        ══════════════════════════════════ */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ── Main column ── */}
          <div className="space-y-6">

            {/* Pending Interests */}
            <motion.section
              aria-labelledby="pending-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 sm:p-8"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 id="pending-heading" className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0" aria-hidden="true">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                  </span>
                  Pending Interests
                </h2>
                {incomingInterests.length > 0 && (
                  <span
                    aria-live="polite"
                    className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-wider border border-rose-100 animate-pulse"
                  >
                    {incomingInterests.length} New
                  </span>
                )}
              </div>

              {incomingInterests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <div className="w-14 h-14 bg-white text-slate-300 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-700 mb-1">No pending requests yet</h3>
                  <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                    Add more photos and complete your profile to attract more connections.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {incomingInterests.slice(0, 4).map((interest) => {
                      const sender = interest.sender || {};
                      const senderId = sender.id || sender.user_id || interest.sender_id;
                      const senderName = sender.first_name || sender.full_name || 'Member';
                      return (
                        <motion.article
                          key={interest.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.90 }}
                          className="group bg-slate-50 rounded-[2rem] p-3 flex flex-col gap-3 border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-slate-100/80 hover:border-slate-200 transition-all duration-300"
                          aria-label={`Interest from ${senderName}`}
                        >
                          <div className="flex gap-3.5">
                            <Link to={`/profile/${senderId}`} className="relative shrink-0 overflow-hidden rounded-2xl w-[72px] h-[72px] shadow-sm">
                              <SmartImage src={sender.photo || ''} alt={senderName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            </Link>
                            <div className="py-1 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Link to={`/profile/${senderId}`} className="text-sm font-bold text-slate-800 hover:text-rose-600 truncate transition-colors">
                                  {senderName}{sender.age ? `, ${sender.age}` : ''}
                                </Link>
                                {sender.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Verified" />}
                              </div>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />{sender.work_location || 'India'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              aria-label={`Decline interest from ${senderName}`}
                              onClick={() => handleInterestAction(interest.id, 'DECLINED')}
                              className="flex-1 py-2.5 rounded-xl bg-white text-slate-500 font-bold text-xs hover:bg-red-50 hover:text-red-500 border border-slate-200 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                            >
                              <X className="w-3.5 h-3.5" /> Decline
                            </button>
                            <button
                              type="button"
                              aria-label={`Accept interest from ${senderName}`}
                              onClick={() => handleInterestAction(interest.id, 'ACCEPTED')}
                              className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-rose-600 shadow-md shadow-slate-200 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.section>

            {/* Curated Picks */}
            <motion.section
              aria-labelledby="picks-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 sm:p-8"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 id="picks-heading" className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0" aria-hidden="true">
                    <Star className="w-4 h-4 text-violet-500 fill-violet-500/20" />
                  </span>
                  Curated Picks
                </h2>
                <Link
                  to="/search"
                  className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {suggestedProfiles.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {suggestedProfiles.map((profile) => (
                    <MatchCard
                      key={profile.id}
                      profile={profile}
                      onInterest={handleInterest}
                      onPass={handlePass}
                      shortlisted={shortlisted.has(profile.id)}
                      onShortlist={toggleShortlist}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50 p-10 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                    <Compass className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No curated matches yet</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">Update your preferences to see personalised matches here.</p>
                  <Link
                    to="/search"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  >
                    <Compass className="w-3.5 h-3.5" /> Browse Matches
                  </Link>
                </div>
              )}
            </motion.section>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Daily Usage — dark glass */}
            <DailyUsagePanel />

            {/* Profile Visitors */}
            <motion.section
              aria-labelledby="visitors-heading"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22 }}
              className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] border border-slate-100"
              style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 id="visitors-heading" className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0" aria-hidden="true">
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  </span>
                  Recent Visitors
                </h3>
                {canViewVisitors && visitors.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">
                    {visitorCount} total
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {canViewVisitors && visitors.map((v) => {
                  const pid  = v.profile?.id || v.profile?.user_id || v.id;
                  const name = v.profile?.full_name || v.profile?.first_name || 'Member';
                  const age  = v.profile?.age ? `, ${v.profile.age}` : '';
                  return (
                    <Link
                      key={v.id}
                      to={`/profile/${pid}`}
                      className="group flex items-center gap-3 p-2.5 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <SmartImage
                        src={v.profile?.photo}
                        alt={name}
                        className="w-11 h-11 rounded-[0.875rem] object-cover border border-slate-100 group-hover:scale-105 transition-transform shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">{name}{age}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{relativeTime(v.viewed_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </Link>
                  );
                })}

                {canViewVisitors && visitors.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400 font-medium">No visitors yet.</p>
                )}

                {!canViewVisitors && visitorCount > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 text-center">
                    <Lock className="w-5 h-5 text-amber-500 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-xs text-amber-900 font-bold mb-1">{visitorCount} members viewed your profile</p>
                    <p className="text-[10px] text-amber-700/80 mb-3 leading-relaxed">Upgrade to Premium to see who is interested in you.</p>
                    <Link
                      to="/membership"
                      className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-200 hover:bg-amber-600 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <Crown className="w-3.5 h-3.5 mr-1.5" /> Unlock Premium
                    </Link>
                  </div>
                )}
              </div>
            </motion.section>

            {/* Profile Score — dark glass */}
            <motion.section
              aria-labelledby="score-heading"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 }}
              className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6"
              style={{ boxShadow: '0 8px 40px rgba(15,23,42,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
              {/* Ambient glows */}
              <div aria-hidden="true" className="absolute -top-12 -right-12 w-44 h-44 bg-rose-500/20 blur-[60px] rounded-full pointer-events-none" />
              <div aria-hidden="true" className="absolute -bottom-10 -left-10 w-36 h-36 bg-violet-500/10 blur-[50px] rounded-full pointer-events-none" />

              <h3 id="score-heading" className="font-black text-white mb-5 relative z-10 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-rose-400" aria-hidden="true" /> Profile Score
              </h3>

              <div className="relative z-10">
                <ProfileArc percentage={completionPercentage} />
              </div>

              {missingFields.length > 0 && (
                <div className="relative z-10 mt-5">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2.5 text-center">Missing Details</p>
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {missingFields.slice(0, 4).map((field: string) => (
                      <span key={field} className="px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-[10px] font-semibold border border-white/10">
                        {fieldLabels[field] || field}
                      </span>
                    ))}
                    {missingFields.length > 4 && (
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-semibold border border-white/5">
                        +{missingFields.length - 4} more
                      </span>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    className="block w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/10 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    Complete Profile →
                  </Link>
                </div>
              )}

              {missingFields.length === 0 && (
                <div className="relative z-10 mt-4 text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Profile complete!
                  </span>
                </div>
              )}
            </motion.section>

          </div>
        </div>
      </div>
    </div>
  );
}
