'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Crown, Settings,
  MapPin, BadgeCheck, CheckCircle2,
  ArrowRight, Check, X, Eye, Lock,
  ShieldCheck, Compass, Star,
  Bookmark, Activity, Clock, Scale, MessageSquare, ChevronRight, User
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { getInterests, getConversations, getProfiles, updateInterestStatus, getShortlists, toggleShortlist } from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';
import { DashboardSkeleton } from '@/legacy/components/SkeletonLoader';
import { useGetUnlockUsageQuery } from '@/legacy/services/profileApi';

/* ─────────────────────────── helpers & types ─────────────────────────── */

const fieldLabels: Record<string, string> = {
  mobile_number: 'Mobile Number',
  gender: 'Gender',
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

function relativeTime(value: string | undefined | null) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* ─────────────────────────── Sub-Components ─────────────────────────── */

function FloralPattern({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={i} cx={200 + 120 * Math.cos((i * 30 * Math.PI) / 180)} cy={200 + 120 * Math.sin((i * 30 * Math.PI) / 180)} rx="18" ry="36" transform={`rotate(${i * 30} ${200 + 120 * Math.cos((i * 30 * Math.PI) / 180)} ${200 + 120 * Math.sin((i * 30 * Math.PI) / 180)})`} fill="currentColor" opacity="0.5" />
      ))}
      <circle cx="200" cy="200" r="22" fill="currentColor" opacity="0.5" />
      <circle cx="200" cy="200" r="10" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function ProfileArc({ percentage }: { percentage: number }) {
  const R = 56;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - percentage / 100);

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div aria-hidden="true" className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: '0 0 36px 10px rgba(244,63,94,0.20)' }} />
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
        <circle cx="64" cy="64" r={R} stroke="rgba(244,63,94,0.18)" strokeWidth="15" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        <circle cx="64" cy="64" r={R} stroke="url(#dashArcGrad)" strokeWidth="9" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
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
        <div className="w-8 h-8 border-4 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
      </div>
    );
  }

  const unlockPct = usage.daily_limit && usage.daily_limit > 0 ? Math.min((usage.used_today / usage.daily_limit) * 100, 100) : 0;
  const interestPct = usage.interest_limit && usage.interest_limit > 0 ? Math.min(((usage.interest_used_today ?? 0) / usage.interest_limit) * 100, 100) : 0;
  const resetTime = new Date(usage.resets_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const lowUnlocks = usage.remaining_today !== null && usage.remaining_today !== undefined && usage.remaining_today <= 2;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 border border-white/5 shadow-2xl shadow-slate-900/40">
      <div aria-hidden="true" className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/15 blur-[50px] rounded-full pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-8 -left-8 w-32 h-32 bg-rose-500/10 blur-[40px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
          <Activity className="w-5 h-5 text-rose-300" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Daily Usage</h3>
          <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> Resets at {resetTime} IST</p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3 mb-4">
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
              <motion.div initial={{ width: 0 }} animate={{ width: `${unlockPct}%` }} className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500" />
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-3 border border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Interests</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-xl font-black text-rose-300">{usage.interest_remaining_today ?? '∞'}</span>
            <span className="text-xs text-white/30">/{usage.interest_limit ?? '∞'}</span>
          </div>
          {usage.interest_limit && usage.interest_limit > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${interestPct}%` }} className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500" />
            </div>
          )}
        </div>
      </div>

      {lowUnlocks && usage.daily_limit && (
        <Link to="/membership" className="relative z-10 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-xs shadow-lg hover:brightness-110 transition-all active:scale-[0.98]">
          <Crown className="w-3.5 h-3.5" /> Upgrade for More
        </Link>
      )}
    </motion.div>

  );
}

function MatchCard({ profile, onInterest, onPass, shortlisted, onShortlist }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="group relative overflow-hidden rounded-3xl bg-slate-100 border border-slate-100/50"
      style={{
        transformStyle: 'preserve-3d',
        transform: hovered ? 'perspective(800px) rotateY(2.5deg) rotateX(-1.5deg) translateY(-5px)' : 'perspective(800px) rotateY(0) rotateX(0) translateY(0)',
        transition: 'transform 0.35s ease, box-shadow 0.35s ease',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.18)' : '0 4px 12px rgba(0,0,0,0.07)',
      }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <Link to={`/profile/${profile.id}`} className="block aspect-[3/4] overflow-hidden" tabIndex={-1}>
        <SmartImage src={profile.photo} alt={profile.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      </Link>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent pointer-events-none" />
      {profile.compatibility > 0 && (
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/15 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/25">
          <ShieldCheck className="w-3 h-3 text-amber-300" />{profile.compatibility}% match
        </div>
      )}
      <button type="button" onClick={() => onShortlist(profile.id)} className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-90 ${shortlisted ? 'bg-rose-500 border-rose-400 text-white shadow-md' : 'bg-white/15 backdrop-blur-md border-white/25 text-white hover:bg-rose-500/80'}`}>
        <Bookmark className="w-3.5 h-3.5" fill={shortlisted ? 'currentColor' : 'none'} />
      </button>
      {profile.is_verified && (
        <div className="absolute top-3 right-12 w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center border-2 border-white shadow-md"><BadgeCheck className="w-3.5 h-3.5 text-white" /></div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
        <Link to={`/profile/${profile.id}`}>
          <p className="font-black text-sm text-white truncate">{profile.name}{profile.age ? `, ${profile.age}` : ''}</p>
          <p className="text-[11px] font-medium text-white/60 mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{profile.location || 'India'}</p>
        </Link>
        <div className="flex gap-2 mt-2.5">
          <button type="button" onClick={() => onPass(profile.id)} className="flex-1 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white/80 font-bold text-xs border border-white/15 hover:bg-white/20 hover:text-white transition-all active:scale-[0.97] flex items-center justify-center gap-1">
            <X className="w-3.5 h-3.5" /> Pass
          </button>
          <button type="button" onClick={() => onInterest(profile.id)} className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-[0.97] flex items-center justify-center gap-1">
            <Heart className="w-3.5 h-3.5" fill="currentColor" /> Interest
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Hub Component ─────────────────────────── */

type TabType = 'OVERVIEW' | 'MATCHES' | 'COMPARE' | 'MESSAGES';

export default function DashboardHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [loading, setLoading] = useState(true);

  // Data state
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [conversations, setConversations] = useState<any[]>([]);
  const [shortlistedProfiles, setShortlistedProfiles] = useState<any[]>([]);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [incoming, convos, profiles, visitorData, shortData] = await Promise.all([
        getInterests('incoming').catch(() => []),
        getConversations().catch(() => []),
        getProfiles().catch(() => ({ results: [] })),
        fetchApi<any>('/profile-visitors/', { params: { limit: 5 } }).catch(() => ({ can_view_visitors: false, total_unique_visitors: 0, results: [] })),
        getShortlists().catch(() => ({ results: [] })),
      ]);

      setIncomingInterests(incoming.filter((i: any) => i.status === 'PENDING'));
      setConversations(convos);
      setSuggestedProfiles(profiles.results.slice(0, 8));
      setVisitors(visitorData.results || []);
      setCanViewVisitors(visitorData.can_view_visitors);
      setVisitorCount(visitorData.total_unique_visitors);

      const slist = shortData.results || [];
      setShortlistedProfiles(slist);
      setShortlistIds(new Set(slist.map((p: any) => p.id)));
    } catch (err) {
      console.error('Failed to load hub data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInterestAction = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    await updateInterestStatus(id, status);
    loadData();
  };

  const handleShortlistToggle = async (profileId: string) => {
    try {
      const res = await toggleShortlist(profileId);
      if (res.success) {
        setShortlistIds(prev => {
          const next = new Set(prev);
          if (res.action === 'added') next.add(profileId); else next.delete(profileId);
          return next;
        });
        loadData(); // refresh list
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-12 pb-16 bg-app-bg">
        <div className="max-w-6xl mx-auto px-4"><DashboardSkeleton /></div>
      </div>
    );
  }

  const tabs: Array<{ id: TabType; label: string; icon: any; count?: number }> = [
    { id: 'OVERVIEW', label: 'Overview', icon: Activity },
    { id: 'MATCHES', label: 'Matches', icon: Heart, count: incomingInterests.length },
    { id: 'COMPARE', label: 'Compare', icon: Scale },
    { id: 'MESSAGES', label: 'Messages', icon: MessageSquare, count: conversations.filter(c => c.unread_count > 0).length },
  ];

  return (
    <div className="min-h-screen pb-20 bg-app-bg overflow-x-hidden font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-6">

        {/* ── Hub Navigation ── */}
        <div className="flex items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-2 rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto hide-scrollbar sticky top-[72px] z-20">
          <div className="flex gap-2">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all focus:outline-none ${active ? 'text-rose-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                  {active && <motion.div layoutId="hub-tab-bg" className="absolute inset-0 bg-rose-50 border border-rose-100 rounded-xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />}
                  <span className="relative z-10 flex items-center gap-2">
                    <tab.icon className={`w-4 h-4 ${active ? 'text-rose-500' : 'text-slate-400'}`} />
                    {tab.label}
                    {tab.count ? (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${active ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{tab.count}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden sm:flex items-center pr-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Session
            </span>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === 'OVERVIEW' && <OverviewZone user={user} visitors={visitors} canViewVisitors={canViewVisitors} visitorCount={visitorCount} />}
            {activeTab === 'MATCHES' && <MatchesZone incomingInterests={incomingInterests} suggestedProfiles={suggestedProfiles} shortlistIds={shortlistIds} onShortlist={handleShortlistToggle} onAction={handleInterestAction} />}
            {activeTab === 'COMPARE' && <CompareZone shortlisted={shortlistedProfiles} />}
            {activeTab === 'MESSAGES' && <MessagesZone conversations={conversations} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}

/* ─────────────────────────── Zone Content Components ─────────────────────────── */

function OverviewZone({ user, visitors, canViewVisitors, visitorCount }: any) {
  const isPremium = user?.is_premium;
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-[2.5rem] border border-rose-100/60 p-8 sm:p-12 shadow-sm" style={{ background: 'linear-gradient(135deg, #fff1f5 0%, #fff8f1 45%, #fffdf9 75%, #f3f0ff 100%)' }}>
          <FloralPattern className="absolute -right-10 -top-10 w-72 h-72 text-rose-300/10 pointer-events-none" />
          <div className="absolute top-0 right-1/3 w-72 h-28 bg-rose-200/20 blur-[70px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            <div className="relative shrink-0 group">
              <div className="absolute inset-[-5px] rounded-[2.2rem] pointer-events-none opacity-60" style={{ background: 'conic-gradient(from 0deg, #f43f5e, #fb923c, #f43f5e, #c026d3, #f43f5e)', filter: 'blur(3px)', animation: 'spin 6s linear infinite' }} />
              <div className="relative w-28 h-28 rounded-[2rem] bg-white border-4 border-white overflow-hidden shadow-xl group-hover:scale-105 transition-transform"><SmartImage src={user?.photo || '/favicon.svg'} alt="Profile" className="w-full h-full object-cover" /></div>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight" style={{ fontFamily: '"Manrope", Georgia, serif' }}>
                Welcome back, {user?.first_name || 'Member'} ✨
              </h1>
              <p className="text-slate-500 text-sm max-w-md leading-relaxed">Discover new matches, view your profile visitors, and continue your journey to find your perfect partner.</p>
              <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-2">
                <Link to="/settings" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-sm"><Settings className="w-3.5 h-3.5" /> Edit Profile</Link>
                <Link to="/membership" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-700 font-bold text-xs border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"><Crown className="w-3.5 h-3.5 text-amber-500" /> View Plans</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Visitors */}
        <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0"><Eye className="w-4 h-4 text-emerald-500" /></span>
              Recent Visitors
            </h2>
            {canViewVisitors && visitors.length > 0 && <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-100">{visitorCount} total views</span>}
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {canViewVisitors && visitors.map((v: any) => {
              const pid = v.profile?.id || v.profile?.user_id || v.id;
              const name = v.profile?.full_name || v.profile?.first_name || 'Member';
              return (
                <Link key={v.id} to={`/profile/${pid}`} className="group flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all">
                  <SmartImage src={v.profile?.photo} alt={name} className="w-12 h-12 rounded-[1rem] object-cover group-hover:scale-105 transition-transform shrink-0 shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">{name}{v.profile?.age ? `, ${v.profile.age}` : ''}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{relativeTime(v.viewed_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 shrink-0" />
                </Link>
              );
            })}
            
            {canViewVisitors && visitors.length === 0 && <div className="col-span-2 py-8 text-center text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">No one has viewed your profile yet.</div>}
            
            {!canViewVisitors && visitorCount > 0 && (
              <div className="col-span-2 p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-amber-600" /></div>
                  <div>
                    <p className="text-base font-bold text-amber-900 mb-1">{visitorCount} members viewed your profile</p>
                    <p className="text-xs text-amber-700/80">Upgrade to Premium to see who is interested in you.</p>
                  </div>
                </div>
                <Link to="/membership" className="shrink-0 px-6 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-95"><Crown className="w-4 h-4 inline-block mr-1.5" /> Unlock Premium</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <DailyUsagePanel />
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 shadow-2xl shadow-slate-900/40 border border-white/5">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-rose-500/20 blur-[60px] rounded-full pointer-events-none" />
          <h3 className="font-black text-white mb-5 relative z-10 flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-rose-400" /> Profile Score</h3>
          <div className="relative z-10"><ProfileArc percentage={user?.completion_percentage ?? 0} /></div>
          {(user?.missing_fields?.length ?? 0) > 0 ? (
            <div className="relative z-10 mt-6 text-center">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Missing Details</p>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {user.missing_fields.slice(0, 3).map((f: string) => <span key={f} className="px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-[10px] font-semibold border border-white/10">{fieldLabels[f] || f}</span>)}
                {user.missing_fields.length > 3 && <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-semibold">+{user.missing_fields.length - 3}</span>}
              </div>
              <Link to="/settings" className="block w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center transition-colors">Complete Profile →</Link>
            </div>
          ) : (
            <div className="relative z-10 mt-6 text-center"><span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Perfect Profile!</span></div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MatchesZone({ incomingInterests, suggestedProfiles, shortlistIds, onShortlist, onAction }: any) {
  return (
    <div className="space-y-6">
      {/* Pending Interests */}
      {incomingInterests.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-rose-100/60 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0"><Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" /></span>
              Pending Interests
            </h2>
            <Link to="/interests" className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">Manage All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {incomingInterests.slice(0, 4).map((interest: any) => {
                const sender = interest.sender || {};
                const senderId = sender.id || sender.user_id || interest.sender_id;
                return (
                  <motion.div key={interest.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[2rem] p-4 flex flex-col gap-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      <Link to={`/profile/${senderId}`} className="relative shrink-0 overflow-hidden rounded-[1.25rem] w-20 h-20 shadow-sm"><SmartImage src={sender.photo || ''} alt="Profile" className="w-full h-full object-cover hover:scale-110 transition-transform" /></Link>
                      <div className="py-1 flex-1 min-w-0">
                        <Link to={`/profile/${senderId}`} className="text-base font-bold text-slate-800 hover:text-rose-600 truncate block">{sender.first_name || 'Member'}{sender.age ? `, ${sender.age}` : ''}</Link>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{sender.work_location || 'India'}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium bg-slate-50 inline-block px-2 py-0.5 rounded-md">Received {relativeTime(interest.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onAction(interest.id, 'DECLINED')} className="flex-1 py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5"><X className="w-3.5 h-3.5" /> Decline</button>
                      <button onClick={() => onAction(interest.id, 'ACCEPTED')} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-rose-600 transition-colors shadow-md flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Accept</button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Curated Picks */}
      <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0"><Star className="w-4 h-4 text-violet-500 fill-violet-500/20" /></span>
            Curated For You
          </h2>
          <Link to="/search" className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 bg-violet-50 px-4 py-2 rounded-full transition-colors">Advanced Search <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {suggestedProfiles.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestedProfiles.map((profile: any) => (
              <MatchCard key={profile.id} profile={profile} shortlisted={shortlistIds.has(profile.id)} onShortlist={onShortlist} onInterest={() => console.log('interest')} onPass={() => console.log('pass')} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <Compass className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No curated matches available right now</p>
            <p className="text-xs text-slate-400 mt-1">Try updating your partner preferences.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareZone({ shortlisted }: { shortlisted: any[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id); // max 2 selections
      return next;
    });
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm min-h-[500px]">
      <div className="text-center max-w-2xl mx-auto mb-10 mt-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4"><Scale className="w-7 h-7 text-indigo-500" /></div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Compare Profiles Side-by-Side</h2>
        <p className="text-sm text-slate-500">Select exactly one profile from your shortlist below to compare it against your own profile, or select two to compare them against each other.</p>
      </div>

      {shortlisted.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 max-w-2xl mx-auto">
          <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Your shortlist is empty</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Save profiles you like to compare them later.</p>
          <Link to="/search" className="inline-flex px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">Browse Profiles</Link>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Your Shortlist ({shortlisted.length})</h3>
            <span className="text-xs font-medium text-slate-500">{selectedIds.size} / 2 selected</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
            {shortlisted.map(p => {
              const isSelected = selectedIds.has(p.id);
              const isDisabled = !isSelected && selectedIds.size >= 2;
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  disabled={isDisabled}
                  className={`relative text-left rounded-2xl overflow-hidden border-2 transition-all ${isSelected ? 'border-indigo-500 shadow-md shadow-indigo-200/50 scale-105' : isDisabled ? 'border-slate-100 opacity-50 cursor-not-allowed' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="aspect-[3/4] relative">
                    <SmartImage src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {isSelected && <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm"><Check className="w-3.5 h-3.5 text-white" /></div>}
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs font-bold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-white/70">{p.age} yrs • {p.location}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="flex justify-center border-t border-slate-100 pt-8">
            <Link 
              to={selectedIds.size === 1 ? `/compare?candidate=${Array.from(selectedIds)[0]}` : selectedIds.size === 2 ? `/compare?candidate1=${Array.from(selectedIds)[0]}&candidate2=${Array.from(selectedIds)[1]}` : '#'}
              className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all ${selectedIds.size > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              <Scale className="w-4 h-4" />
              {selectedIds.size === 0 ? 'Select profiles to compare' : selectedIds.size === 1 ? 'Compare with My Profile' : 'Compare Selected Profiles'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesZone({ conversations }: { conversations: any[] }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm min-h-[500px]">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0"><MessageSquare className="w-4 h-4 text-rose-500 fill-rose-500/20" /></span>
          Recent Conversations
        </h2>
        <Link to="/messages" className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-4 py-2 rounded-full transition-colors">Go to Inbox <ArrowRight className="w-3 h-3" /></Link>
      </div>

      {conversations.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 max-w-2xl mx-auto">
          <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No active conversations</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Start connecting with your matches to chat.</p>
          <Link to="/matches" className="inline-flex px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">View Matches</Link>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-3">
          {conversations.slice(0, 5).map(chat => {
            const partner = chat.profile || {};
            const unread = chat.unread_count > 0;
            return (
              <Link key={chat.id} to={`/messages?chat=${chat.id}`} className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-rose-100 transition-all">
                <div className="relative shrink-0">
                  <SmartImage src={partner.photo} alt={partner.name} className="w-14 h-14 rounded-full object-cover shadow-sm group-hover:scale-105 transition-transform" />
                  {partner.is_verified && <div className="absolute bottom-0 right-0 w-4 h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center"><BadgeCheck className="w-2.5 h-2.5 text-white" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm truncate pr-4 ${unread ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{partner.name}</h3>
                    <span className={`text-[10px] whitespace-nowrap shrink-0 ${unread ? 'font-bold text-rose-600' : 'text-slate-400'}`}>{relativeTime(chat.last_message_at || chat.created_at)}</span>
                  </div>
                  <p className={`text-xs truncate ${unread ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{chat.last_message_preview || 'Say hi to start the conversation!'}</p>
                </div>
                {unread && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ml-2 shadow-sm shadow-rose-300" />}
              </Link>
            );
          })}
          {conversations.length > 5 && (
            <div className="text-center pt-4">
              <Link to="/messages" className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">View {conversations.length - 5} older conversations</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
