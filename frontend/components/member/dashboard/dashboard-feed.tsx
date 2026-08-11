'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Bookmark, X, Activity, MapPin, 
  BadgeCheck, ShieldCheck, Clock, Crown, Eye, CheckCircle2, Compass, Lock, ChevronRight, UserRound, HeartHandshake
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { getInterests, getProfiles, updateInterestStatus, toggleShortlist, getShortlists, sendInterest } from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';
import { DashboardSkeleton } from '@/legacy/components/SkeletonLoader';
import { useGetUnlockUsageQuery } from '@/legacy/services/profileApi';

function relativeTime(value: string | undefined | null) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

import FeedMatchCard from '@/components/shared/feed-match-card';

/* ─────────────────────────── Compact Daily Usage Sidebar ─────────────────────────── */

function CompactUsageWidget() {
  const { data: usage, isLoading } = useGetUnlockUsageQuery();

  if (isLoading || !usage) return <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />;

  const unlockPct = usage.daily_limit && usage.daily_limit > 0 ? Math.min((usage.used_today / usage.daily_limit) * 100, 100) : 0;
  const lowUnlocks = usage.remaining_today !== null && usage.remaining_today !== undefined && usage.remaining_today <= 2;

  return (
    <div className="bg-slate-900 rounded-[1.5rem] p-5 shadow-xl shadow-slate-900/10 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-400" />
          <h3 className="font-bold text-white text-sm">Daily Limits</h3>
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Resets Midnight</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300">Profile Unlocks</span>
            <span className="text-xs font-black text-white">{usage.remaining_today ?? '∞'} left</span>
          </div>
          {usage.daily_limit && usage.daily_limit > 0 && (
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${unlockPct}%` }} className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500" />
            </div>
          )}
        </div>
        
        {lowUnlocks && usage.daily_limit && (
          <Link to="/membership" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors">
            <Crown className="w-3.5 h-3.5 text-amber-400" /> Upgrade Plan
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */

export default function DashboardFeed() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [likingProfileId, setLikingProfileId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profiles, incoming, outgoing, visitorData, shortData] = await Promise.all([
        getProfiles().catch(() => ({ results: [] })),
        getInterests('incoming').catch(() => []),
        getInterests('outgoing').catch(() => []),
        fetchApi<any>('/profile-visitors/', { params: { limit: 5 } }).catch(() => ({ can_view_visitors: false, total_unique_visitors: 0, results: [] })),
        getShortlists().catch(() => ({ results: [] })),
      ]);

      const sentReceiverIds = new Set(outgoing.map((i: any) => String(i.receiver?.id || i.receiver_id || i.receiver)));
      const uncontacted = (profiles.results || []).filter((p: any) => !sentReceiverIds.has(String(p.id)));

      setSuggestedProfiles(uncontacted); // Uncontacted profiles for the feed
      setIncomingInterests(incoming.filter((i: any) => i.status === 'PENDING'));
      setSentCount(outgoing.length || 0);
      setDeclinedCount(incoming.filter((i: any) => i.status === 'DECLINED').length || 0);
      setVisitors(visitorData.results || []);
      setCanViewVisitors(visitorData.can_view_visitors);
      setVisitorCount(visitorData.total_unique_visitors);
      setShortlistIds(new Set((shortData.results || []).map((p: any) => p.id)));
    } catch (err) {
      console.error('Failed to load discovery data:', err);
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleInterest = async (id: string) => {
    if (likingProfileId) return;
    setLikingProfileId(String(id));
    let removeProfile = true;
    try {
      await sendInterest(id);
      setSentCount(prev => prev + 1);
    } catch (e: any) {
      const isMembershipError =
        e?.code === 'MEMBERSHIP_REQUIRED' ||
        e?.errors?.code === 'MEMBERSHIP_REQUIRED' ||
        (typeof e?.errors === 'object' && e?.errors?.detail?.includes?.('membership plan')) ||
        (typeof e?.message === 'string' && e.message.toLowerCase().includes('membership plan')) ||
        (e?.status === 403 && !e?.message?.toLowerCase()?.includes?.('csrf'));
      if (isMembershipError) {
        setShowUpgradeBanner(true);
        removeProfile = false;
      } else if (e?.status === 409) {
        setSentCount(prev => prev + 1);
      } else {
        console.error('Failed to send interest:', e);
      }
    } finally {
      // Let the heart confirmation play before advancing the reel.
      window.setTimeout(() => {
        if (removeProfile) setSuggestedProfiles(prev => prev.filter(p => String(p.id) !== String(id)));
        setLikingProfileId(null);
      }, 650);
    }
  };

  const handlePass = (id: string) => {
    setSuggestedProfiles(prev => prev.filter(p => String(p.id) !== String(id)));
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#F8FAFC] pb-16 pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="max-w-7xl mx-auto px-4"><DashboardSkeleton /></div>
      </div>
    );
  }

  // We pop the first profile in the array to show it
  const currentProfile = suggestedProfiles[0];

  return (
    <div className="min-h-[100svh] bg-[#F8FAFC] pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] font-sans md:pb-20 md:pt-28">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <header className="relative mb-6 overflow-hidden rounded-[2rem] border border-rose-100 bg-gradient-to-br from-[#fff8f7] via-white to-rose-50 px-5 py-6 shadow-[0_12px_35px_rgba(136,54,80,0.07)] sm:mb-8 sm:px-8 sm:py-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-rose-200/35 blur-3xl" />
          <div className="absolute bottom-0 right-20 h-24 w-24 rounded-full bg-amber-100/70 blur-2xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600">Member dashboard</p>
              <h1 className="font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {getGreeting()}, {user?.first_name || 'Member'}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500 sm:text-base">Your carefully selected introductions are ready. Take your time and discover a connection that feels right.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white bg-white/75 p-3 shadow-sm backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><UserRound className="h-5 w-5" /></div>
              <div><p className="text-xs font-bold text-slate-800">Your profile</p><p className="mt-0.5 text-[11px] text-slate-500">Keep it complete to improve matches</p></div>
              <Link to="/settings/profile" className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-rose-700">Update</Link>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {showUpgradeBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-sm">Activate a Membership Plan</h3>
                <p className="text-xs text-slate-500 mt-0.5">You need an active plan to send interests and connect with matches.</p>
              </div>
              <Link to="/membership" className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200/50">
                View Plans
              </Link>
              <button onClick={() => setShowUpgradeBanner(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-5 grid grid-cols-3 gap-3 sm:mb-6 sm:gap-4 xl:hidden">
          <Link to="/interests/sent" className="rounded-2xl border border-rose-100 bg-white p-3 shadow-sm"><Heart className="mb-2 h-4 w-4 text-rose-500" /><p className="text-lg font-black text-slate-800">{sentCount}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sent</p></Link>
          <Link to="/shortlist" className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm"><Bookmark className="mb-2 h-4 w-4 text-indigo-500" /><p className="text-lg font-black text-slate-800">{shortlistIds.size}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Saved</p></Link>
          <Link to="/interests/received" className="rounded-2xl border border-amber-100 bg-white p-3 shadow-sm"><HeartHandshake className="mb-2 h-4 w-4 text-amber-500" /><p className="text-lg font-black text-slate-800">{incomingInterests.length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Requests</p></Link>
        </div>

        <div className="grid items-start gap-5 sm:gap-6 xl:grid-cols-[minmax(0,620px)_minmax(280px,360px)] xl:justify-center xl:gap-10">
          
          {/* ─── Left Column: The Card Feed ─── */}
          <main className="flex w-full min-w-0 flex-col justify-center">
            <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-rose-500">Today&apos;s introduction</p><p className="mt-1 text-sm font-semibold text-slate-600">A profile picked for your preferences</p></div><Link to="/search" className="text-xs font-bold text-rose-600 hover:text-rose-700">Browse all</Link></div>
            <AnimatePresence mode="popLayout">
              {currentProfile ? (
                <FeedMatchCard 
                  key={currentProfile.id} 
                  profile={currentProfile} 
                  isShortlisted={shortlistIds.has(currentProfile.id)}
                  isLiking={likingProfileId === String(currentProfile.id)}
                  onShortlist={handleShortlistToggle}
                  onInterest={handleInterest}
                  onPass={handlePass}
                />
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mx-auto w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white py-12 text-center shadow-sm sm:py-14"
                >
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">You're all caught up!</h3>
                  <p className="text-slate-500 text-sm max-w-[250px] mx-auto mb-8">You've seen all curated matches for today. Check back tomorrow for more.</p>
                  <Link to="/search" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition-colors">
                    <Compass className="w-4 h-4" /> Search All Profiles
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* ─── Right Column: Elegant Sidebar ─── */}
          <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] space-y-6 overflow-y-auto pr-1 pb-2 xl:block">
            
            <CompactUsageWidget />

            {/* Connection Activity & Saved Stats */}
            <div className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-500" /> My Activity & Saved
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Link to="/interests/sent" className="p-3 bg-rose-50 hover:bg-rose-100/70 rounded-2xl border border-rose-100 transition-colors block">
                  <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                  <span className="text-base font-black text-slate-800 block">{sentCount}</span>
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tight block">Likes Sent</span>
                </Link>

                <Link to="/shortlist" className="p-3 bg-indigo-50 hover:bg-indigo-100/70 rounded-2xl border border-indigo-100 transition-colors block">
                  <Bookmark className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                  <span className="text-base font-black text-slate-800 block">{shortlistIds.size}</span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight block">Saved</span>
                </Link>

                <Link to="/interests/declined" className="p-3 bg-amber-50 hover:bg-amber-100/70 rounded-2xl border border-amber-100 transition-colors block">
                  <X className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <span className="text-base font-black text-slate-800 block">{declinedCount}</span>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight block">Declined (Undo)</span>
                </Link>
              </div>
            </div>

            {/* Pending Interests Sidebar Card */}
            {incomingInterests.length > 0 && (
              <div className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" /> Requests ({incomingInterests.length})
                  </h3>
                  <Link to="/interests" className="text-xs font-bold text-rose-600 hover:text-rose-700">View All</Link>
                </div>
                <div className="space-y-3">
                  {incomingInterests.slice(0, 3).map((interest: any) => {
                    const sender = interest.sender || {};
                    const senderId = sender.id || sender.user_id || interest.sender_id;
                    return (
                      <div key={interest.id} className="flex gap-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <Link to={`/profile/${senderId}`} className="shrink-0 block">
                          <SmartImage src={sender.photo} alt="Profile" className="w-12 h-12 rounded-xl object-cover" />
                        </Link>
                        <div className="flex-1 min-w-0 py-0.5">
                          <Link to={`/profile/${senderId}`} className="text-xs font-bold text-slate-800 truncate block hover:text-rose-600">{sender.first_name || 'Member'}</Link>
                          <p className="text-[10px] text-slate-400 truncate">{sender.age} yrs • {sender.work_location || 'India'}</p>
                          <div className="flex gap-1.5 mt-1.5">
                            <button onClick={() => handleInterestAction(interest.id, 'ACCEPTED')} className="flex-1 py-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-lg hover:bg-rose-600 transition-colors">Accept</button>
                            <button onClick={() => handleInterestAction(interest.id, 'DECLINED')} className="flex-1 py-1.5 bg-white text-slate-500 border border-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-100 transition-colors">Decline</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Profile Visitors Sidebar Card */}
            <div className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" /> Recent Visitors
                </h3>
              </div>
              
              <div className="space-y-2">
                {canViewVisitors && visitors.map((v: any) => {
                  const pid = v.profile?.id || v.profile?.user_id || v.id;
                  const name = v.profile?.full_name || v.profile?.first_name || 'Member';
                  return (
                    <Link key={v.id} to={`/profile/${pid}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group">
                      <SmartImage src={v.profile?.photo} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-600">{name}</p>
                        <p className="text-[10px] text-slate-400">{relativeTime(v.viewed_at)}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                    </Link>
                  );
                })}

                {canViewVisitors && visitors.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No recent visitors.</p>}

                {!canViewVisitors && visitorCount > 0 && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                    <Lock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-amber-900 mb-1">{visitorCount} views</p>
                    <p className="text-[10px] text-amber-700/80 mb-3">Upgrade to see who viewed you.</p>
                    <Link to="/membership" className="inline-block px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-amber-600">Unlock Premium</Link>
                  </div>
                )}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
