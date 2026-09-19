'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Eye, Lock, Crown, ShieldCheck, MapPin, Heart, ArrowRight,
  RefreshCw, Check, User
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import { fetchApi } from '@/legacy/services/apiClient';
import { sendInterest, getInterests, updateInterestStatus } from '@/legacy/services/dataService';
import { useToast } from '@/components/ui';
import { interestFeedback } from '@/components/member/interest-feedback';
import { profileHref } from '@/lib/profile-url';

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
    photos?: Array<{ id?: string; image_url?: string; thumbnail_url?: string; url?: string; is_primary?: boolean }>;
    work_location?: string;
    occupation?: string;
  };
}

interface BlurredVisitor {
  id: string;
  viewed_at: string;
  photo?: string | null;
}

interface ProfileVisitorsResponse {
  can_view_visitors: boolean;
  total_unique_visitors: number;
  visible_limit?: number | null;
  locked_count?: number;
  blurred_visitors?: BlurredVisitor[];
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

function getFullPhoto(photoUrl?: string, photos?: any[]): string {
  if (photos && Array.isArray(photos) && photos.length > 0) {
    const primary = photos.find((p) => p?.is_primary) || photos[0];
    const url = primary?.image_url || primary?.url || primary?.download_url;
    if (url && typeof url === 'string') return url;
  }
  if (typeof photoUrl === 'string' && photoUrl.includes('/thumbnail/')) {
    return photoUrl.replace('/thumbnail/', '/image/');
  }
  return photoUrl || '';
}



export default function VisitorsPage() {
  const { showToast } = useToast();
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [blurredVisitors, setBlurredVisitors] = useState<BlurredVisitor[]>([]);
  const [canView, setCanView] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [incomingBySender, setIncomingBySender] = useState<Record<string, string>>({});
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<ProfileVisitorsResponse>('/profile-visitors/', { params: { limit: 20 } });
      const results = data.results || [];
      setVisitors(results);
      setCanView(data.can_view_visitors);
      const total = data.total_unique_visitors || 0;
      setTotalCount(total);
      setLockedCount(data.locked_count !== undefined ? data.locked_count : Math.max(0, total - results.length));
      setBlurredVisitors(data.blurred_visitors || []);

      const outgoing = await getInterests('outgoing').catch(() => []);
      const liked = new Set<string>();
      (outgoing || []).forEach((i: any) => {
        const rid = i?.receiver?.id || i?.receiver?.user_id;
        if (rid) liked.add(rid);
      });
      setLikedIds(liked);

      const incoming = await getInterests('incoming').catch(() => []);
      const requestMap: Record<string, string> = {};
      const accepted = new Set<string>();
      (incoming || []).forEach((i: any) => {
        const sid = i?.sender?.id || i?.sender?.user_id;
        if (!sid) return;
        if (i.status === 'PENDING') requestMap[sid] = i.id;
        if (i.status === 'ACCEPTED') accepted.add(sid);
      });
      (outgoing || []).forEach((i: any) => {
        const rid = i?.receiver?.id || i?.receiver?.user_id;
        if (rid && i.status === 'ACCEPTED') accepted.add(rid);
      });
      setIncomingBySender(requestMap);
      setAcceptedIds(accepted);
    } catch {
      setVisitors([]);
      setBlurredVisitors([]);
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

  const handleAcceptRequest = async (interestId: string, pid: string) => {
    if (acceptedIds.has(pid)) return;
    try {
      await updateInterestStatus(interestId, 'ACCEPTED');
      setAcceptedIds((prev) => new Set([...prev, pid]));
      setIncomingBySender((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      showToast('You accepted their connection request!', 'success');
    } catch (error) {
      const fb = interestFeedback(error);
      showToast(fb.message, fb.tone);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Native Clean Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Profile Visitors</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                See who viewed your profile and interacted with your photos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={loadVisitors}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="bg-[#fff1f2] border border-[#fecdd3] rounded-xl px-3.5 py-1.5 text-center shadow-2xs">
              <span className="block text-base font-black text-[#e11d48] leading-tight">{totalCount}</span>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#e11d48]">Visitors</span>
            </div>
          </div>
        </div>

        {/* ── Visitors Content ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : !canView ? (
          /* ── Locked State: Clean Native Upgrade Banner + Blurred Visitor Cards ── */
          totalCount === 0 && blurredVisitors.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
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
            <div className="space-y-6">
              {/* Clean Native Upgrade Banner */}
              <div className="rounded-2xl border border-[#fecdd3] bg-gradient-to-r from-white via-white to-rose-50/40 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#fff1f2] border border-[#fecdd3] text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fff1f2] text-[#e11d48] text-[11px] font-bold border border-[#fecdd3]">
                        <Eye className="w-3 h-3 text-[#e11d48]" />
                        {totalCount} {totalCount === 1 ? 'Person' : 'People'} Viewed Your Profile
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Unlock Profile Visitors
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                      Upgrade to a Membership Plan to unblur photos, see exact names, and message everyone who views your profile.
                    </p>
                  </div>
                </div>

                <Link
                  href="/membership"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-sm transition-all shrink-0 active:scale-95"
                >
                  <Lock className="w-4 h-4" />
                  Upgrade Membership
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Grid of Blurred Visitors + Teaser Placeholders */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {blurredVisitors.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {/* Photo Container with Gaussian blur */}
                    <div className="relative aspect-[4/5] bg-rose-50/60 overflow-hidden">
                      {v.photo ? (
                        <div className="w-full h-full overflow-hidden">
                          <SmartImage
                            src={getFullPhoto(v.photo)}
                            alt="Visitor"
                            watermark={false}
                            className="w-full h-full object-cover select-none pointer-events-none filter blur-xl scale-125"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-rose-50 to-slate-100 flex items-center justify-center">
                          <User className="w-14 h-14 text-rose-300/80" />
                        </div>
                      )}

                      {/* Relative Timestamp */}
                      <span className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white text-[9.5px] font-semibold px-2.5 py-0.5 rounded-full shadow">
                        {relativeTime(v.viewed_at)}
                      </span>

                      {/* Center Lock Badge */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 backdrop-blur-[2px] p-4 text-center">
                        <div className="w-10 h-10 rounded-full bg-white/95 text-[#e11d48] flex items-center justify-center shadow-lg mb-2">
                          <Lock className="w-5 h-5" />
                        </div>
                        <span className="text-white text-xs font-bold tracking-wide drop-shadow">Photo Locked</span>
                      </div>
                    </div>

                    {/* Card Info Area */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">•••••• ••••••</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">Profile details hidden</p>
                      </div>

                      <Link
                        href="/membership"
                        className="w-full text-center py-2 rounded-xl bg-[#fff1f2] hover:bg-[#ffe4e6] text-[#e11d48] text-xs font-bold border border-[#fecdd3] transition-colors"
                      >
                        Upgrade to View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : visitors.length === 0 ? (
          /* ── Empty State ── */
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
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
          /* ── Active Visitors Grid ── */
          <div className="space-y-6">
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
                    <Link href={profileHref(profile)} className="block relative overflow-hidden bg-rose-50" style={{ aspectRatio: '4/5' }}>
                      <SmartImage
                        src={getFullPhoto(profile.photo, profile.photos)}
                        alt={name}
                        watermark={false}
                        className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                      />

                      <span className="absolute top-2.5 right-2.5 bg-slate-900/80 text-white text-[9.5px] font-semibold px-2 py-0.5 rounded-full shadow">
                        {relativeTime(item.viewed_at)}
                      </span>
                      {incomingBySender[pid] && (
                        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-rose-500 text-white text-[9.5px] font-bold px-2 py-0.5 shadow-md">
                          <Heart className="w-3 h-3 fill-current" /> Sent you a connection
                        </span>
                      )}
                      {acceptedIds.has(pid) && (
                        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[9.5px] font-bold px-2 py-0.5 shadow-md">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      )}
                    </Link>

                    {/* Info area */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <Link href={profileHref(profile)}>
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
                        {incomingBySender[pid] ? (
                          <button
                            type="button"
                            onClick={() => void handleAcceptRequest(incomingBySender[pid], pid)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold border border-emerald-500 transition-all hover:bg-emerald-600 active:scale-[0.98] shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                        ) : acceptedIds.has(pid) ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold cursor-default"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Connected
                          </button>
                        ) : (
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
                        )}
                        <Link
                          href={profileHref(profile)}
                          className="flex-1 text-center py-1.5 rounded-xl bg-[#e11d48] text-white text-xs font-bold hover:bg-[#be123c] transition-colors shadow-2xs"
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── LinkedIn-Style Locked Visitors Teaser (When lockedCount > 0) ── */}
            {lockedCount > 0 && (
              <div className="rounded-2xl border border-[#fecdd3] bg-gradient-to-r from-white via-white to-rose-50/40 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fff1f2] text-[#e11d48] text-[11px] font-bold border border-[#fecdd3] mb-1.5">
                      <Lock className="w-3 h-3 text-[#e11d48]" />
                      +{lockedCount} More Profile {lockedCount === 1 ? 'Visitor' : 'Visitors'}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Unlock All {totalCount} Profile Visitors
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Upgrade to a Membership Plan to unblur and message all remaining visitors.
                    </p>
                  </div>

                  <Link
                    href="/membership"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-sm transition-all shrink-0 active:scale-95"
                  >
                    <Lock className="w-4 h-4" />
                    Unlock All Visitors
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Blurred teaser cards showing actual remaining locked visitors */}
                {blurredVisitors.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
                    {blurredVisitors.map((v) => (
                      <div key={v.id} className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs flex flex-col">
                        <div className="aspect-[4/5] bg-rose-50/50 relative overflow-hidden">
                          {v.photo ? (
                            <div className="w-full h-full overflow-hidden">
                              <SmartImage src={getFullPhoto(v.photo)} alt="Locked visitor" watermark={false} className="w-full h-full object-cover select-none pointer-events-none filter blur-xl scale-125" />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                              <User className="w-10 h-10 text-slate-300" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="p-2 rounded-full bg-white/95 text-[#e11d48] shadow-md">
                              <Lock className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2 bg-white space-y-0.5">
                          <p className="font-bold text-slate-600 text-xs truncate">•••••• ••••••</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
