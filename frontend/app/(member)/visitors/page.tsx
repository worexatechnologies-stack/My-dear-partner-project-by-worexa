'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Eye, Lock, Crown, ShieldCheck, MapPin, Heart, ArrowRight,
  Sparkles, RefreshCw, User
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { fetchApi } from '@/legacy/services/apiClient';
import { sendInterest, getInterests, getShortlists } from '@/legacy/services/dataService';
import { useToast } from '@/components/ui';
import { interestFeedback } from '@/components/member/interest-feedback';

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
    occupation?: string;
  };
}

interface ProfileVisitorsResponse {
  can_view_visitors: boolean;
  total_unique_visitors: number;
  results: ProfileVisitor[];
}

function relativeTime(value: string | undefined | null) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ProtectionWatermark() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-1 px-2"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)',
      }}
    >
      <span
        className="flex items-center gap-1 text-white/90 font-bold tracking-widest uppercase select-none"
        style={{ fontSize: '7.5px', letterSpacing: '0.16em', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
        PROTECTED · MY DEAR PARTNER
      </span>
    </div>
  );
}

export default function VisitorsPage() {
  const { showToast } = useToast();
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [canView, setCanView] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<ProfileVisitorsResponse>('/profile-visitors/', { params: { limit: 20 } });
      setVisitors(data.results || []);
      setCanView(data.can_view_visitors);
      setTotalCount(data.total_unique_visitors || 0);
      // Preload already-sent interests so previously liked visitors cannot be re-liked
      const outgoing = await getInterests('outgoing').catch(() => []);
      const liked = new Set<string>();
      (outgoing || []).forEach((i: any) => {
        const rid = i?.receiver?.id || i?.receiver?.user_id;
        if (rid) liked.add(rid);
      });
      setLikedIds(liked);
    } catch {
      setVisitors([]);
      setCanView(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const handleLike = async (profileId: string) => {
    if (likedIds.has(profileId)) return;
    try {
      await sendInterest(profileId);
      setLikedIds((prev) => new Set([...prev, profileId]));
    } catch (error) {
      const fb = interestFeedback(error);
      showToast(fb.message, fb.tone);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
          }}
        >
          {/* Subtle rose glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-rose-500/15 blur-3xl" />
          
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 shrink-0">
                <Eye className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Activity</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Profile Visitors</h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  See who viewed your profile and interacted with your photos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={loadVisitors}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="bg-rose-500/20 border border-rose-400/30 rounded-xl px-4 py-2 text-center">
                <span className="block text-xl font-extrabold text-white">{totalCount}</span>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-rose-200">Total Visitors</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Visitors Content ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : !canView ? (
          /* Locked State for Non-Premium / Free Users */
          <div className="rounded-3xl border border-rose-100 bg-white p-8 sm:p-12 text-center shadow-sm relative overflow-hidden">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                <Crown className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800">
                Unlock Profile Visitors
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Upgrade to a Membership Plan to see exact names, photos, and details of members who recently visited your profile.
              </p>
              
              {/* Teaser placeholder grid */}
              <div className="grid grid-cols-3 gap-3 py-4 opacity-50 filter blur-[3px] pointer-events-none">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="aspect-[4/5] rounded-xl bg-slate-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                ))}
              </div>

              <Link
                href="/membership"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 text-white font-bold text-sm px-6 py-3 shadow-md hover:bg-rose-600 transition-all hover:scale-105"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                Upgrade Membership
              </Link>
            </div>
          </div>
        ) : visitors.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <Eye className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No visitors yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Complete your profile and upload good photos to get discovered by more potential matches!
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 mt-4 rounded-xl bg-rose-500 text-white font-bold text-xs px-4 py-2.5 shadow hover:bg-rose-600 transition-colors"
            >
              Explore Matches <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          /* Visitor Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visitors.map((item) => {
              const profile = item.profile || {};
              const pid = profile.id || profile.user_id || item.id;
              const name = profile.full_name || profile.first_name || 'Member';
              const liked = likedIds.has(pid);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-300"
                >
                  {/* Photo area */}
                  <Link href={`/profile/${pid}`} className="block relative overflow-hidden bg-rose-50" style={{ aspectRatio: '4/5' }}>
                    <SmartImage
                      src={profile.photo}
                      alt={name}
                      className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                    />
                    <ProtectionWatermark />

                    <span className="absolute top-2.5 right-2.5 bg-slate-900/75 backdrop-blur-md text-white text-[9.5px] font-semibold px-2 py-0.5 rounded-full shadow">
                      {relativeTime(item.viewed_at)}
                    </span>
                  </Link>

                  {/* Info area */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/profile/${pid}`}>
                        <h3 className="font-bold text-slate-800 text-sm truncate hover:text-rose-600 transition-colors">
                          {name}{profile.age ? `, ${profile.age}` : ''}
                        </h3>
                      </Link>
                      {profile.work_location && (
                        <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                          {profile.work_location}
                        </p>
                      )}
                      {profile.occupation && (
                        <p className="text-slate-400 text-[11px] mt-0.5 truncate">{profile.occupation}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleLike(pid)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          liked
                            ? 'bg-rose-50 border-rose-200 text-rose-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        {liked ? 'Liked' : 'Like'}
                      </button>
                      <Link
                        href={`/profile/${pid}`}
                        className="flex-1 text-center py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
