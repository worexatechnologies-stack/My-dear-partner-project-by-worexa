'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Crown, MapPin, BadgeCheck, X, Eye, Lock, ShieldCheck, Compass, CheckCircle2, ChevronRight, Activity, Clock
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { getInterests, getProfiles, updateInterestStatus, toggleShortlist, getShortlists } from '@/legacy/services/dataService';
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

/* ─────────────────────────── Main Feed Match Card ─────────────────────────── */

function FeedMatchCard({ profile, onInterest, onPass, onShortlist, isShortlisted }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100/60 hover:shadow-xl transition-shadow duration-300"
    >
      <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full group">
        <Link to={`/profile/${profile.id}`} className="absolute inset-0 z-10" aria-label={`View ${profile.name}'s profile`} />
        
        <SmartImage 
          src={profile.photo} 
          alt={profile.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
        />
        
        {/* Soft gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          {profile.compatibility > 0 && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md text-white text-[11px] font-black px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" /> {profile.compatibility}% Match
            </div>
          )}
          {profile.is_premium && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg">
              <Crown className="w-3.5 h-3.5" /> Premium
            </div>
          )}
        </div>

        {/* Bottom Info & Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 sm:pb-8 z-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2 tracking-tight truncate">
              {profile.name}
              {profile.is_verified && <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0" />}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-white/90 font-medium">
              <span>{profile.age} yrs</span>
              {profile.height && <><span className="w-1 h-1 rounded-full bg-white/40" /><span>{profile.height}</span></>}
              {profile.occupation && <><span className="w-1 h-1 rounded-full bg-white/40" /><span className="truncate max-w-[150px] sm:max-w-none">{profile.occupation}</span></>}
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs sm:text-sm text-white/70">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{profile.location || 'Location not specified'}</span>
            </div>
          </div>
          
          <div className="shrink-0 flex gap-3 relative z-30 justify-end sm:justify-start">
            <button 
              onClick={(e) => { e.preventDefault(); onPass(profile.id); }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-slate-900 transition-all active:scale-95 shadow-lg"
              aria-label="Pass"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); onInterest(profile.id); }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 flex items-center justify-center text-white hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-rose-500/40"
              aria-label="Send Interest"
            >
              <Heart className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Compact Daily Usage ─────────────────────────── */

function CompactUsageWidget() {
  const { data: usage, isLoading } = useGetUnlockUsageQuery();

  if (isLoading || !usage) return <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />;

  const unlockPct = usage.daily_limit && usage.daily_limit > 0 ? Math.min((usage.used_today / usage.daily_limit) * 100, 100) : 0;
  const lowUnlocks = usage.remaining_today !== null && usage.remaining_today !== undefined && usage.remaining_today <= 2;

  return (
    <div className="bg-slate-900 rounded-3xl p-5 shadow-lg shadow-slate-900/10 border border-slate-800">
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

export default function DashboardDiscovery() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [profiles, incoming, visitorData, shortData] = await Promise.all([
        getProfiles().catch(() => ({ results: [] })),
        getInterests('incoming').catch(() => []),
        fetchApi<any>('/profile-visitors/', { params: { limit: 5 } }).catch(() => ({ can_view_visitors: false, total_unique_visitors: 0, results: [] })),
        getShortlists().catch(() => ({ results: [] })),
      ]);

      setSuggestedProfiles(profiles.results.slice(0, 10)); // Top 10 matches for the feed
      setIncomingInterests(incoming.filter((i: any) => i.status === 'PENDING'));
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
    loadData(); // Refresh to remove the item from pending
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

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4"><DashboardSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#F8FAFC] font-sans pt-20 md:pt-28">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Minimal Greeting Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight font-display">
              {getGreeting()}, {user?.first_name || 'Member'}
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Here are the most compatible matches we found for you today.</p>
          </div>
          <Link to="/search" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-sm shadow-sm hover:shadow-md hover:border-slate-300 transition-all shrink-0">
            <Compass className="w-4 h-4 text-rose-500" /> Advanced Search
          </Link>
        </header>

        <div className="grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-8 items-start">
          
          {/* ─── Left Column: The Discovery Feed ─── */}
          <main className="space-y-8">
            {suggestedProfiles.length > 0 ? (
              <div className="space-y-6">
                {suggestedProfiles.map(profile => (
                  <FeedMatchCard 
                    key={profile.id} 
                    profile={profile} 
                    isShortlisted={shortlistIds.has(profile.id)}
                    onShortlist={handleShortlistToggle}
                    onInterest={(id: string) => console.log('interest', id)}
                    onPass={(id: string) => console.log('pass', id)}
                  />
                ))}
                
                <div className="py-12 text-center bg-white rounded-3xl border border-slate-200">
                  <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-rose-500" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1">You've reached the end of today's curated matches</h3>
                  <p className="text-slate-500 text-sm mb-6">Check back tomorrow for fresh recommendations, or search manually.</p>
                  <Link to="/search" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition-colors">
                    Search All Profiles
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
                <Compass className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-black text-slate-800 mb-2">No matches found</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">Try broadening your partner preferences in your settings to see more curated matches here.</p>
                <Link to="/settings" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors">
                  Update Preferences
                </Link>
              </div>
            )}
          </main>

          {/* ─── Right Column: Elegant Sidebar ─── */}
          <aside className="space-y-6 sticky top-24">
            
            <CompactUsageWidget />

            {/* Pending Interests Sidebar Card */}
            {incomingInterests.length > 0 && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
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
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
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

            {/* Compact Profile Score */}
            {(user?.missing_fields?.length ?? 0) > 0 && (
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full border-[3px] border-rose-500 flex items-center justify-center text-xs font-black text-rose-600">
                    {user?.completion_percentage ?? 0}%
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Profile Incomplete</h3>
                    <p className="text-[10px] text-slate-500">Missing {user?.missing_fields?.length} details</p>
                  </div>
                </div>
                <Link to="/settings" className="mt-3 block w-full py-2 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-700 hover:bg-slate-50">Complete Profile</Link>
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}
