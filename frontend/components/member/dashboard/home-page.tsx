'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Heart, MapPin, BadgeCheck, Search,
  Eye, Star, ShieldCheck, Crown, ChevronRight, ArrowRight,
  Bookmark, Bell, Sparkles, Compass, UserRound, TrendingUp, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/legacy/contexts/AuthContext';
import {
  getInterests, getProfiles, getShortlists, updateInterestStatus, toggleShortlist, sendInterest,
} from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';
import { useToast } from '@/components/ui';
import { interestFeedback } from '../interest-feedback';

/* ─── helpers ─── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(value: string | undefined | null) {
  if (!value) return 'Recently';
  const s = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface ProfileVisitor {
  id: string;
  viewed_at: string;
  profile: { id?: string; user_id?: string; full_name?: string; first_name?: string; age?: number; photo?: string; work_location?: string };
}

/* ─── Profile strength ring (animated SVG) ─── */
function StrengthRing({ pct }: { pct: number }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#strengthGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="strengthGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none text-plum-800">{clamped}%</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-soft-muted">Profile</span>
      </div>
    </div>
  );
}

/* ─── Stat summary card ─── */
function StatCard({ icon: Icon, label, value, tone, sub, href }: {
  icon: any; label: string; value: string | number; tone: string; sub?: string; href: string;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Link href={href} className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-soft-muted">{label}</p>
          <p className="text-xl font-extrabold leading-tight text-plum-800">{value}</p>
          {sub && <p className="truncate text-[11px] font-medium text-muted">{sub}</p>}
        </div>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-soft-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rose-500" />
      </Link>
    </motion.div>
  );
}
/* ─── Protection watermark overlay ─── */
function ProtectionWatermark() {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-1.5 px-2"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)',
      }}
    >
      <span className="flex select-none items-center gap-1 font-bold uppercase tracking-[0.18em] text-white/90"
        style={{ fontSize: '8px', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
      >
        <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
        PROTECTED · MY DEAR PARTNER
      </span>
    </div>
  );
}

/* ─── Profile Match Card — modern ─── */
function MatchCard({ profile, onLike, onShortlist, likedIds, shortlistedIds }: {
  profile: any;
  onLike: (id: string) => void;
  onShortlist: (id: string) => void;
  likedIds: Set<string>;
  shortlistedIds: Set<string>;
}) {
  const liked = likedIds.has(profile.id);
  const shortlisted = shortlistedIds.has(profile.id);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-xl"
    >
      <Link href={`/profile/${profile.id}`} className="relative block overflow-hidden" style={{ aspectRatio: '4/5' }}>
        <SmartImage
          src={profile.photo}
          alt={profile.name || 'Profile'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {profile.verified && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold text-emerald-600 shadow-sm backdrop-blur-sm">
            <BadgeCheck className="w-3 h-3" /> Verified
          </span>
        )}

        {profile.isOnline && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-emerald-600 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Online
          </span>
        )}

        <ProtectionWatermark />
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link href={`/profile/${profile.id}`}>
          <h3 className="truncate text-sm font-bold text-plum-800 transition-colors hover:text-rose-600">
            {profile.name || 'Member'}{profile.age ? `, ${profile.age}` : ''}
          </h3>
        </Link>
        {profile.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-soft-muted">
            <MapPin className="w-3 h-3 shrink-0 text-rose-400" />
            {profile.location}
          </p>
        )}
        {profile.occupation && profile.occupation !== 'Not specified' && (
          <p className="truncate text-[11px] text-soft-muted">{profile.occupation}</p>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5">
          <button
            type="button"
            onClick={() => onLike(profile.id)}
            aria-label={liked ? 'Liked' : 'Like'}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition-all ${
              liked
                ? 'border-rose-200 bg-rose-50 text-rose-600'
                : 'border-line bg-surface text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
            {liked ? 'Liked' : 'Like'}
          </button>
          <Link
            href={`/profile/${profile.id}`}
            className="flex flex-1 items-center justify-center rounded-xl bg-rose-500 py-2 text-[11px] font-bold text-white transition-colors hover:bg-rose-600"
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => onShortlist(profile.id)}
            aria-label={shortlisted ? 'Remove shortlist' : 'Shortlist'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              shortlisted ? 'border-gold-300 bg-gold-100 text-gold-500' : 'border-line bg-surface text-soft-muted hover:bg-gold-100 hover:text-gold-500'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${shortlisted ? 'fill-gold-400' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
/* ─── Pending Interest Card — modern ─── */
function PendingInterestCard({ interest, onAccept, onDecline }: {
  interest: any; onAccept: () => void; onDecline: () => void;
}) {
  const sender = interest.sender || {};
  const senderId = sender.id || sender.user_id || interest.sender_id;

  return (
    <motion.div
      whileHover={{ x: 3 }}
      className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-3 transition-colors hover:bg-rose-50"
    >
      <Link href={`/profile/${senderId}`} className="shrink-0">
        <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-rose-100 ring-2 ring-white">
          <SmartImage src={sender.photo} alt={sender.first_name || 'Member'} className="h-full w-full object-cover" />
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-plum-800">
          {sender.first_name || sender.full_name || 'Member'}{sender.age ? `, ${sender.age}` : ''}
        </p>
        <p className="truncate text-xs text-soft-muted">{sender.work_location || 'India'}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={onDecline} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-plum-700 transition-colors hover:bg-slate-50">
          Decline
        </button>
        <button type="button" onClick={onAccept} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-600">
          Accept
        </button>
      </div>
    </motion.div>
  );
}
/* ─── Main Home Page — modern ─── */
export default function HomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());

  const completionPct = user?.completion_percentage ?? 0;
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || 'there';
  const isPremium = user?.is_premium ?? false;

  const loadData = useCallback(async () => {
    try {
      const [profiles, interests, visitorData] = await Promise.all([
        getProfiles({ page_size: '8' }).catch(() => ({ results: [] })),
        getInterests('incoming').catch(() => []),
        fetchApi<{ can_view_visitors: boolean; results: ProfileVisitor[] }>(
          '/profile-visitors/', { params: { limit: 5 } }
        ).catch(() => ({ can_view_visitors: false, results: [] })),
      ]);

      // Preload already-sent interests + shortlists so previously liked /
      // shortlisted profiles show as such and cannot be re-sent.
      const [outgoing, short] = await Promise.all([
        getInterests('outgoing').catch(() => []),
        getShortlists().catch(() => ({ results: [] })),
      ]);
      const liked = new Set<string>();
      (outgoing || []).forEach((i: any) => {
        const rid = i?.receiver?.id || i?.receiver?.user_id;
        if (rid) liked.add(rid);
      });
      setLikedIds(liked);
      setShortlistedIds(new Set((short.results || []).map((p: any) => p.id)));

      setSuggestedProfiles((profiles as any).results?.slice(0, 8) ?? []);
      setIncomingInterests((interests as any[]).filter((i) => i.status === 'PENDING').slice(0, 3));
      setVisitors(visitorData.results ?? []);
      setCanViewVisitors(visitorData.can_view_visitors);
    } catch { /* silent fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleLike = async (id: string) => {
    if (likedIds.has(id)) return;
    try {
      await sendInterest(id);
      // Only reflect "liked" after the server confirms it, so a failed send
      // (e.g. daily limit or membership required) never leaves the button stuck.
      setLikedIds((prev) => new Set([...prev, id]));
    } catch (error) {
      const fb = interestFeedback(error);
      showToast(fb.message, fb.tone);
    }
  };

  const handleShortlist = async (id: string) => {
    if (shortlistedIds.has(id)) return; // already shortlisted — don't re-add
    setShortlistedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    try { await toggleShortlist(id); } catch { /* ignore */ }
  };

  const handleInterestAction = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    try { await updateInterestStatus(id, status); setIncomingInterests((prev) => prev.filter((i) => i.id !== id)); }
    catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#fafafa] px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-48 animate-pulse rounded-3xl bg-cream-100" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-cream-100" style={{ aspectRatio: '4/5' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const quickActions = [
    { icon: Search,   label: 'Find Matches', sub: 'Search profiles',  href: '/search',             tone: 'bg-rose-50 text-rose-500' },
    { icon: Heart,    label: 'Likes',        sub: 'Who liked you',    href: '/interests/received', tone: 'bg-rose-50 text-rose-500' },
    { icon: Bookmark, label: 'Shortlist',    sub: 'Saved profiles',   href: '/shortlist',          tone: 'bg-gold-100 text-gold-500' },
    { icon: Eye,      label: 'Visitors',     sub: 'Who viewed you',   href: '/visitors',           tone: 'bg-emerald-50 text-emerald-600' },
  ];
  return (
    <div className="min-h-full bg-[#fafafa] px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-amber-50/40 to-white px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-rose-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="pointer-events-none absolute right-1/3 top-0 h-24 w-24 rounded-full bg-emerald-100/50 blur-2xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-600 shadow-sm backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" /> My Partner Dashboard
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-plum-800 sm:text-4xl">
                {getGreeting()}, <span className="bg-gradient-to-r from-rose-600 to-gold-500 bg-clip-text text-transparent">{firstName}</span> 🌸
              </h1>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
                Your life partner may be just one profile away. Discover meaningful, verified matches today.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/search" className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition-all hover:-translate-y-0.5 hover:bg-rose-600">
                  <Search className="h-4 w-4" /> Find Matches
                </Link>
                {completionPct < 100 && (
                  <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-plum-800 transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:text-rose-600">
                    <UserRound className="h-4 w-4 text-rose-500" /> Complete Profile
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <StrengthRing pct={completionPct} />
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-plum-700"><BadgeCheck className="h-4 w-4 text-emerald-500" /> Verified members</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-plum-700"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Privacy protected</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-plum-700"><CheckCircle2 className="h-4 w-4 text-rose-500" /> Safe messaging</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Compass} label="Matches" value={suggestedProfiles.length} tone="bg-rose-50 text-rose-500" sub="For you today" href="/search" />
          <StatCard icon={Heart} label="Likes" value={incomingInterests.length} tone="bg-rose-50 text-rose-500" sub="Pending requests" href="/interests/received" />
          <StatCard icon={Eye} label="Profile views" value={canViewVisitors ? visitors.length : 'Locked'} tone="bg-gold-100 text-gold-500" sub={canViewVisitors ? 'Recent visitors' : 'Upgrade to view'} href="/visitors" />
          <StatCard icon={TrendingUp} label="Strength" value={`${completionPct}%`} tone="bg-emerald-50 text-emerald-600" sub="Profile completeness" href="/settings" />
        </div>
        {/* ── Pending Interests ── */}
        {incomingInterests.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold text-plum-800">People who liked you</h2>
                <p className="text-xs text-soft-muted">{incomingInterests.length} pending {incomingInterests.length === 1 ? 'request' : 'requests'}</p>
              </div>
              <Link href="/interests/received" className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {incomingInterests.map((interest) => (
                <PendingInterestCard
                  key={interest.id}
                  interest={interest}
                  onAccept={() => handleInterestAction(interest.id, 'ACCEPTED')}
                  onDecline={() => handleInterestAction(interest.id, 'DECLINED')}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Recommended Matches ── */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold text-plum-800">Matches for You</h2>
              <p className="text-xs text-soft-muted">People who match your preferences</p>
            </div>
            <Link href="/search" className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {suggestedProfiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {suggestedProfiles.map((profile) => (
                <MatchCard
                  key={profile.id}
                  profile={profile}
                  onLike={handleLike}
                  onShortlist={handleShortlist}
                  likedIds={likedIds}
                  shortlistedIds={shortlistedIds}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <Search className="h-7 w-7" />
              </div>
              <p className="font-display text-base font-bold text-plum-800">No matches yet</p>
              <p className="mt-1 max-w-xs text-sm text-soft-muted">Complete your profile to get personalised matches.</p>
              <Link href="/search" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-600">
                <Search className="h-4 w-4" /> Find Matches
              </Link>
            </div>
          )}
        </section>

        {/* ── Quick Actions ── */}
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-extrabold text-plum-800">Shortcuts</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickActions.map((item) => (
              <motion.div key={item.href} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <Link href={item.href} className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tone} transition-transform group-hover:scale-105`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-plum-800">{item.label}</p>
                    <p className="text-[11px] text-soft-muted">{item.sub}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
{/* ── Two column: Activity + Widgets ── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Recent Activity */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-plum-800">
                <Bell className="h-4 w-4 text-soft-muted" /> Recent Activity
              </h2>
              <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {canViewVisitors && visitors.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {visitors.map((visitor) => {
                  const name = visitor.profile?.full_name || visitor.profile?.first_name || 'Someone';
                  const pid = visitor.profile?.id || visitor.profile?.user_id || visitor.id;
                  return (
                    <Link key={visitor.id} href={`/profile/${pid}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-rose-50/50">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-rose-50">
                        <SmartImage src={visitor.profile?.photo} alt={name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-plum-800">{name} viewed your profile</p>
                        <p className="text-xs text-soft-muted">{relativeTime(visitor.viewed_at)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-soft-muted" />
                    </Link>
                  );
                })}
              </div>
            ) : !canViewVisitors ? (
              <div className="flex items-center gap-3 rounded-2xl border border-gold-100 bg-gold-100/50 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-500">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-plum-800">See who viewed your profile</p>
                  <p className="text-xs text-soft-muted">Available with a membership plan</p>
                </div>
                <Link href="/membership" className="shrink-0 whitespace-nowrap text-xs font-bold text-rose-600 hover:underline">Upgrade</Link>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-soft-muted">No recent activity yet</p>
            )}
          </section>
          {/* Right widgets */}
          <div className="space-y-4">
            {/* Matrimonial trust */}
            <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50/60 p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
                  <Heart className="h-4 w-4 fill-rose-200" />
                </div>
                <h3 className="text-sm font-bold text-plum-800">Find the right match</h3>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-muted">My Dear Partner helps you find a life partner through a safe, verified, and respectful platform.</p>
              <div className="space-y-2">
                {['Verified profiles only', 'Privacy protected photos', 'Safe messaging system'].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs text-plum-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-rose-400" /> {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Premium */}
            {!isPremium && (
              <div className="relative overflow-hidden rounded-2xl border border-gold-300/60 bg-gradient-to-br from-gold-100 via-amber-50 to-white p-5">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-300/30 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gold-500 shadow-sm">
                      <Crown className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-plum-800">Unlock more features</h3>
                  </div>
                  <ul className="mb-4 space-y-2">
                    {['See who liked you', 'More profile unlocks', 'Unlimited messaging'].map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-plum-700">
                        <Star className="h-3.5 w-3.5 shrink-0 fill-gold-400 text-gold-400" /> {b}
                      </li>
                    ))}
                  </ul>
                  <Link href="/membership" className="block rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 px-4 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-gold-500/25 transition-all hover:-translate-y-0.5">
                    View Plans
                  </Link>
                </div>
              </div>
            )}

            {/* Safety */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-plum-800">Your safety matters</h3>
              </div>
              <ul className="mb-3 space-y-2">
                {['Profile verification', 'Secure conversations', 'Privacy controls'].map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-plum-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {b}
                  </li>
                ))}
              </ul>
              <Link href="/support" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline">
                Learn About Safety <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}