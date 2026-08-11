'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronRight,
  CircleUserRound,
  Crown,
  Eye,
  Heart,
  LoaderCircle,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
  X,
} from 'lucide-react';

import SmartImage from '@/components/shared/smart-image';
import { useToast } from '@/components/ui';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import {
  getInterests,
  getProfiles,
  getShortlists,
  sendInterest,
  toggleShortlist,
  updateInterestStatus,
} from '@/legacy/services/dataService';
import type { Profile } from '@/legacy/types/domain';

import { interestFeedback } from '../interest-feedback';
import { mergeUniqueProfiles } from '../profile-search-contract';

export type FeedTab = 'discover' | 'new';

interface Visitor {
  id: string;
  viewed_at?: string;
  profile?: {
    id?: string;
    user_id?: string;
    full_name?: string;
    first_name?: string;
    photo?: string;
    work_location?: string;
  };
}

const DISCOVER_PAGE_SIZE = 6;

function timeAgo(value?: string) {
  if (!value) return 'Recently';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function useful(value?: string) {
  return value && value !== 'Not specified' ? value : null;
}

function initials(name?: string) {
  return (name || 'Member')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ProfileFeedCard({
  profile,
  interested,
  shortlisted,
  onInterest,
  onShortlist,
  onPass,
}: {
  profile: Profile;
  interested: boolean;
  shortlisted: boolean;
  onInterest: (id: string) => void;
  onShortlist: (id: string) => void;
  onPass: (id: string) => void;
}) {
  const occupation = useful(profile.occupation);
  const location = useful(profile.location);
  const religion = useful(profile.religion);
  const height = useful(profile.height);
  const about = profile.about && profile.about !== 'This member has not added an introduction yet.'
    ? profile.about
    : 'View the full profile to learn more about this member and their preferences.';
  const interests = profile.hobbies?.filter(Boolean).slice(0, 3) ?? [];
  const visiblePhoto = profile.photoVisibility === 'visible'
    ? profile.photoFull || profile.photo
    : '';

  return (
    <article className="min-h-full snap-start scroll-mt-2 overflow-hidden rounded-[1.45rem] border border-[#e8dcd7] bg-[#fffefd] shadow-[0_12px_36px_rgba(64,36,47,.07)] transition-shadow duration-300 hover:shadow-[0_18px_46px_rgba(64,36,47,.11)]">
      <div className="relative isolate overflow-hidden">
        <Link
          href={`/profile/${profile.id}`}
          aria-label={`View ${profile.name || 'member'} profile`}
          className="block aspect-[4/3] sm:aspect-[16/9]"
        >
          <SmartImage
            src={visiblePhoto}
            alt={profile.name || 'Member profile'}
            fallback="brand"
            fallbackMessage="Photo not yet approved"
            className="dashboard-match-photo h-full w-full rounded-none object-cover object-top"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/45 via-black/5 to-black/80" />

        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-4">
          <Link href={`/profile/${profile.id}`} className="flex min-w-0 items-center gap-2.5 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-[#8e3d58]/90 text-xs font-extrabold shadow-sm backdrop-blur-md">
              {initials(profile.name)}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate text-sm font-extrabold">
                {profile.name || 'Member'}
                {profile.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#bcebd8]" />}
              </span>
              <span className="block text-[11px] font-medium text-white/75">{profile.age ? `${profile.age} years` : 'Member profile'}</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPass(profile.id)}
              aria-label={`Hide ${profile.name || 'this profile'}`}
              title="Not for me"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-md transition hover:bg-white hover:text-[#8e3d58]"
            >
              <X className="h-4 w-4" />
            </button>
            <Link
              href={`/profile/${profile.id}`}
              aria-label="Open full profile"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-md transition hover:bg-white hover:text-[#8e3d58]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 p-4 pb-6 text-white sm:p-5 sm:pb-7">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${profile.id}`} className="font-display text-xl font-extrabold tracking-[-.03em] hover:text-[#ffdce5] sm:text-2xl">
              {profile.name || 'Member'}{profile.age ? `, ${profile.age}` : ''}
            </Link>
            {profile.premium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cc72] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#4b3810]">
                <Crown className="h-3 w-3" /> Premium
              </span>
            )}
          </div>
          {occupation && <p className="mt-1 text-xs font-semibold text-white/85 sm:text-sm">{occupation}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interests.length > 0 ? interests.map((interest) => (
              <span key={interest} className="rounded-full border border-white/25 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#473b3f] backdrop-blur-md">{interest}</span>
            )) : (
              <>
                {religion && <span className="rounded-full border border-white/25 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#473b3f] backdrop-blur-md">{religion}</span>}
                {height && <span className="rounded-full border border-white/25 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#473b3f] backdrop-blur-md">{height}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative -mt-5 rounded-t-[1.35rem] bg-[#fffefd] px-4 pb-0 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9f6f7c]">About</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5f5558] sm:text-[13px]">{about}</p>
          </div>
          {profile.compatibility > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#edf6f1] px-2.5 py-1 text-[10px] font-extrabold text-[#24664f]">
              <Sparkles className="h-3 w-3" /> {profile.compatibility}%
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#796a6f]">
          {location && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[#f8f3f1] px-2.5 py-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-[#9e5368]" /> <span className="truncate">{location}</span>
            </span>
          )}
          {profile.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#edf6f1] px-2.5 py-1.5 text-[#24664f]">
              <ShieldCheck className="h-3 w-3" /> Identity verified
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-2">
          <button
            type="button"
            onClick={() => onInterest(profile.id)}
            disabled={interested}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition active:scale-[.98] ${
              interested
                ? 'cursor-default bg-[#e9f5ef] text-[#24664f]'
                : 'bg-gradient-to-r from-[#a63f58] to-[#c55268] text-white shadow-[0_8px_18px_rgba(166,63,88,.22)] hover:brightness-95'
            }`}
          >
            {interested ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {interested ? 'Interest sent' : 'Send interest'}
          </button>
          <Link
            href={`/profile/${profile.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dfd2cd] bg-white text-xs font-extrabold text-[#4e4347] transition hover:border-[#bd8c99] hover:text-[#8e3d58]"
          >
            <MessageCircle className="h-4 w-4" /> View profile
          </Link>
          <button
            type="button"
            onClick={() => onShortlist(profile.id)}
            aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition active:scale-95 ${
              shortlisted
                ? 'border-[#8e3d58] bg-[#8e3d58] text-white'
                : 'border-[#dfd2cd] bg-white text-[#67595e] hover:border-[#bd8c99] hover:text-[#8e3d58]'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${shortlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 border-t border-[#eee5e1] py-3 text-center">
          <div>
            <p className="text-xs font-extrabold text-[#342c2f]">{profile.compatibility > 0 ? `${profile.compatibility}%` : '—'}</p>
            <p className="mt-0.5 text-[9px] font-semibold text-[#9a898f]">Compatibility</p>
          </div>
          <div className="border-x border-[#eee5e1]">
            <p className="text-xs font-extrabold text-[#342c2f]">{shortlisted ? 'Saved' : 'Open'}</p>
            <p className="mt-0.5 text-[9px] font-semibold text-[#9a898f]">Shortlist</p>
          </div>
          <div>
            <p className="text-xs font-extrabold text-[#342c2f]">{profile.verified ? 'Verified' : 'Standard'}</p>
            <p className="mt-0.5 text-[9px] font-semibold text-[#9a898f]">Profile status</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[73rem] animate-pulse px-3 pb-24 sm:px-5 lg:px-6 lg:pb-8">
      <div className="h-11 rounded-xl bg-[#eee5e1]" />
      <div className="mt-4 h-12 rounded-xl bg-[#eee5e1]" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,42rem)_17rem] lg:justify-center">
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-[34rem] rounded-3xl bg-[#eee5e1]" />)}
        </div>
        <div className="hidden space-y-4 lg:block">
          <div className="h-44 rounded-2xl bg-[#eee5e1]" />
          <div className="h-52 rounded-2xl bg-[#eee5e1]" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardReels() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const feedRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const dismissedIdsRef = useRef(new Set<string>());
  const requestRef = useRef(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [feedTab, setFeedTab] = useState<FeedTab>('discover');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadData = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setFeedError('');
    setLoadMoreError('');
    try {
      const [profileResult, interestsResult, outgoingResult, visitorResult, shortlistResult] = await Promise.allSettled([
        getProfiles({ page: '1', page_size: String(DISCOVER_PAGE_SIZE) }),
        getInterests('incoming'),
        getInterests('outgoing'),
        fetchApi<any>('/profile-visitors/', { params: { limit: 5 } }),
        getShortlists(),
      ]);

      if (requestRef.current !== requestId) return;

      let sentSet = new Set<string>();
      if (outgoingResult.status === 'fulfilled') {
        const outgoing = outgoingResult.value ?? [];
        sentSet = new Set(
          outgoing
            .map((item: any) => item?.receiver?.id || item?.receiver?.user_id || item?.receiver_id || item?.target_id)
            .filter(Boolean)
        );
        setInterestedIds(sentSet);
      }

      if (profileResult.status === 'fulfilled') {
        const profilePage = profileResult.value;
        const availableProfiles = (profilePage.results ?? []).filter(
          (profile) => !dismissedIdsRef.current.has(profile.id) && !sentSet.has(profile.id)
        );
        setProfiles(mergeUniqueProfiles([], availableProfiles));
        setPage(profilePage.page || 1);
        setHasMore(Boolean(profilePage.next));
      } else {
        setProfiles([]);
        setHasMore(false);
        setFeedError('We could not load your Discover profiles. Please try again.');
      }

      if (interestsResult.status === 'fulfilled') {
        setIncoming((interestsResult.value ?? []).filter((item: any) => item.status === 'PENDING'));
      }
      if (visitorResult.status === 'fulfilled') {
        const visitorData = visitorResult.value;
        setVisitors(visitorData.results ?? []);
        setCanViewVisitors(Boolean(visitorData.can_view_visitors));
        setVisitorCount(Number(visitorData.total_unique_visitors ?? visitorData.results?.length ?? 0));
      }
      if (shortlistResult.status === 'fulfilled') {
        setShortlistedIds(new Set((shortlistResult.value.results ?? []).map((profile) => profile.id)));
      }
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [query]);

  const loadMoreProfiles = useCallback(async () => {
    if (!hasMore || loadingMore || loadMoreError) return;
    setLoadingMore(true);
    try {
      const profilePage = await getProfiles({
        page: String(page + 1),
        page_size: String(DISCOVER_PAGE_SIZE),
      });
      const availableProfiles = (profilePage.results ?? []).filter(
        (profile) => !dismissedIdsRef.current.has(profile.id) && !interestedIds.has(profile.id)
      );
      setProfiles((current) => mergeUniqueProfiles(current, availableProfiles));
      setPage(profilePage.page || page + 1);
      setHasMore(Boolean(profilePage.next));
      setLoadMoreError('');
    } catch {
      setLoadMoreError('More profiles could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadMoreError, loadingMore, page, interestedIds]);

  useEffect(() => {
    const root = feedRef.current;
    const target = loadMoreRef.current;
    if (!root || !target || !hasMore || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreProfiles();
      },
      { root, rootMargin: '0px 0px 360px', threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMoreError, loadMoreProfiles]);

  const completion = Math.max(0, Math.min(100, user?.completion_percentage ?? 0));

  const visibleProfiles = useMemo(() => {
    let result = profiles.filter((profile) => !interestedIds.has(profile.id));
    if (feedTab === 'new') {
      result = [...result].reverse();
    }
    const normalized = query.trim().toLowerCase();
    if (!normalized) return result;
    return result.filter((profile) => [
      profile.name,
      profile.occupation,
      profile.location,
      profile.religion,
      profile.education,
    ].some((value) => value?.toLowerCase().includes(normalized)));
  }, [feedTab, interestedIds, profiles, query]);

  const handleInterest = async (id: string) => {
    if (interestedIds.has(id)) return;
    try {
      await sendInterest(id);
      setInterestedIds((current) => new Set(current).add(id));
      dismissedIdsRef.current.add(id);
      setProfiles((current) => current.filter((profile) => profile.id !== id));
      showToast('Interest sent successfully.', 'success');
    } catch (error) {
      const feedback = interestFeedback(error);
      showToast(feedback.message, feedback.tone);
    }
  };

  const handleShortlist = async (id: string) => {
    try {
      const result = await toggleShortlist(id);
      setShortlistedIds((current) => {
        const next = new Set(current);
        if (result.action === 'added') next.add(id);
        else next.delete(id);
        return next;
      });
      showToast(result.action === 'added' ? 'Profile added to shortlist.' : 'Profile removed from shortlist.', 'success');
    } catch {
      showToast('Shortlist could not be updated.', 'error');
    }
  };

  const handlePass = (id: string) => {
    dismissedIdsRef.current.add(id);
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    showToast('Profile removed from this feed.', 'success');
  };

  const handleInterestAction = async (id: string, nextStatus: 'ACCEPTED' | 'DECLINED') => {
    try {
      await updateInterestStatus(id, nextStatus);
      setIncoming((current) => current.filter((item) => item.id !== id));
      showToast(nextStatus === 'ACCEPTED' ? 'Interest accepted.' : 'Interest declined.', 'success');
    } catch {
      showToast('Request could not be updated.', 'error');
    }
  };

  if (loading) return <DashboardSkeleton />;

  const firstPending = incoming[0];
  const pendingSender = firstPending?.sender ?? {};
  const pendingSenderId = pendingSender.id ?? pendingSender.user_id ?? firstPending?.sender_id;

  return (
    <div className="min-h-full bg-[#faf8f6] pb-24 lg:pb-7">
      <div className="mx-auto w-full max-w-[73rem] px-3 sm:px-5 lg:px-6">
        <header className="sticky top-0 z-20 -mx-3 grid bg-[#faf8f6]/95 px-3 pt-2 pb-1 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-6 lg:hidden">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#dfd3ce] bg-white px-3.5 shadow-[0_5px_18px_rgba(64,36,47,.04)] focus-within:border-[#b98291]">
                <Search className="h-[1.1rem] w-[1.1rem] shrink-0 text-[#8c7a80]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search profiles"
                  aria-label="Search dashboard profiles"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#342c2f] outline-none placeholder:text-[#a99a9f]"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-[#9a898f] hover:text-[#8e3d58]">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              <Link href="/settings/profile/preferences" aria-label="Match filters" title="Match filters" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2dde4] text-[#8e3d58] transition hover:bg-[#8e3d58] hover:text-white">
                <SlidersHorizontal className="h-[1.1rem] w-[1.1rem]" />
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,42rem)_17rem] lg:justify-center">
          <main className="min-w-0">
            <div
              ref={feedRef}
              className="space-y-4 scroll-smooth pb-6 lg:h-[calc(100dvh-11rem)] lg:snap-y lg:snap-proximity lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
            >
              {visibleProfiles.length > 0 ? visibleProfiles.map((profile) => (
                <ProfileFeedCard
                  key={profile.id}
                  profile={profile}
                  interested={interestedIds.has(profile.id)}
                  shortlisted={shortlistedIds.has(profile.id)}
                  onInterest={(id) => void handleInterest(id)}
                  onShortlist={(id) => void handleShortlist(id)}
                  onPass={handlePass}
                />
              )) : (
                <section className="flex min-h-[24rem] flex-col items-center justify-center rounded-3xl border border-dashed border-[#d8c8c2] bg-[#fffefd] p-8 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4e3e8] text-[#8e3d58]">
                    <CircleUserRound className="h-7 w-7" />
                  </span>
                  <h2 className="mt-4 font-display text-xl font-extrabold text-[#342c2f]">No profiles found</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#776a6f]">Try another search or refine your match preferences.</p>
                  <button type="button" onClick={() => setQuery('')} className="mt-5 rounded-xl bg-[#8e3d58] px-4 py-2.5 text-xs font-extrabold text-white">Clear search</button>
                </section>
              )}
            </div>
          </main>

          <aside className="hidden space-y-3 lg:block">
            <section className="rounded-2xl border border-[#e7dbd5] bg-[#fffefd] p-4 shadow-[0_9px_28px_rgba(64,36,47,.05)]">
              <Link href="/visitors" className="group block">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#342c2f]">Profile visitors ({visitorCount})</h2>
                    <p className="mt-1 text-[10px] leading-4 text-[#8f7f84]">See who has recently viewed your profile.</p>
                  </div>
                  <Eye className="h-4 w-4 shrink-0 text-[#9e5368]" />
                </div>
              </Link>

              {canViewVisitors && visitors.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-[#eee5e1] pt-3">
                  {visitors.slice(0, 2).map((visitor) => {
                    const profileId = visitor.profile?.id || visitor.profile?.user_id || visitor.id;
                    const name = visitor.profile?.full_name || visitor.profile?.first_name || 'Member';
                    return (
                      <Link key={visitor.id} href={`/profile/${profileId}`} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-[#faf5f2]">
                        <SmartImage src={visitor.profile?.photo} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold text-[#4c4145]">{name}</span>
                          <span className="block text-[9px] text-[#9a898f]">{timeAgo(visitor.viewed_at)}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="my-3 h-px bg-[#eee5e1]" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-[#342c2f]">Matches to review ({incoming.length})</h2>
                  <p className="mt-1 text-[10px] leading-4 text-[#8f7f84]">Members who are waiting for your response.</p>
                </div>
                <UserRoundCheck className="h-4 w-4 shrink-0 text-[#2d8062]" />
              </div>

              {firstPending ? (
                <div className="mt-3 border-t border-[#eee5e1] pt-3">
                  <Link href={`/profile/${pendingSenderId}`} className="flex items-center gap-2.5">
                    <SmartImage src={pendingSender.photo} alt={pendingSender.first_name || 'Member'} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#4c4145]">{pendingSender.full_name || pendingSender.first_name || 'Member'}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#baa9ae]" />
                  </Link>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => void handleInterestAction(firstPending.id, 'DECLINED')} className="h-8 rounded-lg border border-[#e3d7d2] text-[10px] font-bold text-[#716167] hover:bg-[#faf6f3]">Decline</button>
                    <button type="button" onClick={() => void handleInterestAction(firstPending.id, 'ACCEPTED')} className="h-8 rounded-lg bg-[#2d8062] text-[10px] font-bold text-white hover:bg-[#236b51]">Accept</button>
                  </div>
                </div>
              ) : (
                <Link href="/search" className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8e3d58]">Find new matches <ChevronRight className="h-3 w-3" /></Link>
              )}
            </section>

            <section className="rounded-2xl border border-[#e7dbd5] bg-[#fffefd] p-4 shadow-[0_9px_28px_rgba(64,36,47,.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9f6f7c]">Profile readiness</p>
                  <h2 className="mt-1 text-sm font-extrabold text-[#342c2f]">Stand out to better matches</h2>
                </div>
                <span className="text-xl font-extrabold text-[#2d8062]">{completion}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee7e3]">
                <div className="h-full rounded-full bg-[#2d8062] transition-[width] duration-700" style={{ width: `${completion}%` }} />
              </div>
              <Link href="/settings/profile" className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8e3d58]">Complete profile <ChevronRight className="h-3 w-3" /></Link>
            </section>

            <section className="rounded-2xl border border-[#e8dcc4] bg-[#fffaf0] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6c28]" />
                <div>
                  <h2 className="text-[11px] font-extrabold text-[#493d26]">Connect safely</h2>
                  <p className="mt-1 text-[9px] leading-4 text-[#796d55]">Keep early conversations on My Dear Partner and report suspicious behavior.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
