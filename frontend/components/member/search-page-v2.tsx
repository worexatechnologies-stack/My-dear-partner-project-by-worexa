'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Crown,
  Heart,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';

import SmartImage from '@/components/shared/smart-image';
import { useToast } from '@/components/ui';
import {
  getInterests,
  getProfiles,
  getShortlists,
  sendInterest,
  toggleShortlist,
} from '@/legacy/services/dataService';
import type { Profile } from '@/legacy/types/domain';
import { profileHref } from '@/lib/profile-url';

import { interestFeedback } from './interest-feedback';
import {
  EMPTY_PROFILE_SEARCH_FILTERS,
  activeProfileFilterCount,
  cleanProfileSearchFilters,
  mergeUniqueProfiles,
  profileSearchApiParams,
  profileSearchFiltersFromParams,
  profileSearchQuery,
  profileSearchValidation,
  type ProfileSearchFilters,
} from './profile-search-contract';

const PAGE_SIZE = 12;
const PHOTO_FALLBACK_MESSAGE = 'Photo not yet approved';

/* ── Portfolio brand design tokens ─────────────────────────────────────── */
const inputClass = 'h-10 w-full rounded-xl border border-[#E9DDE1] bg-white px-3 text-sm font-semibold text-[#29242A] outline-none transition placeholder:text-[#B8ADB2] focus:border-[#9B3F5F] focus:ring-4 focus:ring-[#9B3F5F]/[.08]';
const selectClass = `${inputClass} appearance-none cursor-pointer pr-8`;

function FilterPanel({
  filters,
  onChange,
  onApply,
  onReset,
  loading,
  validationMessage,
}: {
  filters: ProfileSearchFilters;
  onChange: (key: keyof ProfileSearchFilters, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  loading: boolean;
  validationMessage: string | null;
}) {
  const hasAdvancedValue = Boolean(filters.caste || filters.mother_tongue || filters.education || filters.location || filters.min_age || filters.max_age);
  const [showMore, setShowMore] = useState(hasAdvancedValue);

  useEffect(() => {
    if (hasAdvancedValue) setShowMore(true);
  }, [hasAdvancedValue]);

  const labelClass = 'mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#8F7D84]';

  const textField = (label: string, key: keyof ProfileSearchFilters, placeholder: string, type: 'text' | 'number' = 'text') => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type={type}
        value={filters[key]}
        onChange={(event) => onChange(key, event.target.value)}
        placeholder={placeholder}
        min={type === 'number' ? 18 : undefined}
        max={type === 'number' ? 100 : undefined}
        className={inputClass}
      />
    </label>
  );

  const selectField = (label: string, key: keyof ProfileSearchFilters, options: string[]) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="relative">
        <select value={filters[key]} onChange={(event) => onChange(key, event.target.value)} className={selectClass}>
          <option value="">Any</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BAA8B2]" />
      </div>
    </label>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
      className="flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E9DDE1] bg-white shadow-[0_10px_36px_-18px_rgba(127,41,72,.25),0_1px_0_rgba(255,255,255,.9)_inset]"
    >
      {/* Header — always visible */}
      <div className="flex items-start justify-between gap-3 border-b border-[#EFE4E8] bg-[#FCF5F7] px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#D94B73] to-[#9B3F5F] text-white shadow-[0_6px_14px_-6px_rgba(155,63,95,.55)]">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-[#29242A]">Refine Matches</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#7D737A]">Find profiles that match your preferences.</p>
          </div>
        </div>
        <button type="button" onClick={onReset} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold text-[#9B3F5F] transition-colors hover:bg-[#F8E7ED] hover:text-[#7F2948]">
          <RefreshCw className="h-3 w-3" /> Clear all
        </button>
      </div>

      {/* Scrollable body — only this area scrolls when the panel is taller than the viewport */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {textField('Search', 'search', 'Name, profession or city')}

        <div>
          <span className={labelClass}>Age range</span>
          <div className="grid grid-cols-2 items-center gap-2">
            <input type="number" value={filters.min_age} onChange={(event) => onChange('min_age', event.target.value)} placeholder="Min" min={18} max={100} aria-label="Minimum age" className={inputClass} />
            <input type="number" value={filters.max_age} onChange={(event) => onChange('max_age', event.target.value)} placeholder="Max" min={18} max={100} aria-label="Maximum age" className={inputClass} />
          </div>
        </div>

        {selectField('Religion', 'religion', ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Jewish', 'Parsi', 'Other'])}

        {textField('Location', 'location', 'e.g. Mumbai, Bengaluru')}

        {selectField('Education', 'education', ['High School', 'Diploma', 'B.Tech', 'B.Com', 'B.Sc', 'BA', 'BE', 'BBA', 'MBA', 'MCA', 'M.Tech', 'MBBS', 'MD', 'PhD', 'Other'])}

        <div>
          <span className={labelClass}>Marital status</span>
          <div className="relative">
            <select value={filters.marital_status} onChange={(event) => onChange('marital_status', event.target.value)} className={selectClass}>
              <option value="">Any status</option>
              <option value="Never Married">Never Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
              <option value="Awaiting Divorce">Awaiting Divorce</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BAA8B2]" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((visible) => !visible)}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-[#E9DDE1] bg-[#FCF5F7] px-3 text-xs font-bold text-[#7D737A] transition hover:border-[#E8C9D4] hover:bg-white"
          aria-expanded={showMore}
        >
          <span>More preferences</span>
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showMore && (
          <div className="space-y-4 border-l-2 border-[#F0E2E7] pl-3">
            {textField('Caste / community', 'caste', 'e.g. Brahmin, Nair')}
            {selectField('Mother tongue', 'mother_tongue', ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Other'])}
          </div>
        )}

        {validationMessage && (
          <p className="flex items-start gap-2 rounded-xl border border-[#F3D3D9] bg-[#FFF1F3] px-3 py-2 text-[11px] font-semibold leading-4 text-[#9A304C]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {validationMessage}
          </p>
        )}
      </div>

      {/* Footer Apply — always visible */}
      <div className="border-t border-[#EFE4E8] bg-[#FCF5F7] p-3.5">
        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9B3F5F] to-[#7F2948] px-4 text-sm font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(127,41,72,.6)] transition hover:brightness-110 hover:shadow-[0_12px_26px_-10px_rgba(127,41,72,.65)] active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Searching…' : 'Apply filters'}
        </button>
      </div>
    </form>
  );
}

function SearchProfileCard({
  profile,
  liked,
  shortlisted,
  busy,
  onLike,
  onShortlist,
}: {
  profile: Profile;
  liked: boolean;
  shortlisted: boolean;
  busy: boolean;
  onLike: (id: string) => void;
  onShortlist: (id: string) => void;
}) {
  const visiblePhoto = profile.photoVisibility === 'visible'
    ? profile.photoFull || profile.photo
    : '';

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#E9DDE1] bg-white shadow-[0_1px_2px_rgba(41,36,42,.04),0_8px_24px_-14px_rgba(127,41,72,.16)] transition duration-200 hover:-translate-y-1 hover:border-[#E9DDE1] hover:shadow-[0_14px_32px_-14px_rgba(127,41,72,.26)]">
      <Link href={profileHref(profile)} className="relative isolate block aspect-[4/5] overflow-hidden bg-[#FBF9F8]">
        <SmartImage
          src={visiblePhoto}
          alt={profile.name || 'Member profile'}
          fallback="brand"
          fallbackMessage={PHOTO_FALLBACK_MESSAGE}
          className="h-full w-full rounded-none object-cover object-top transition-transform duration-500 group-hover:scale-[1.015]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-[#1B0811]/90 via-[#3A1A28]/55 to-transparent" />

        {/* Name + location overlay */}
        <div className="absolute inset-x-0 bottom-0 z-30 p-3.5 text-white">
          <h2 className="truncate font-display text-base font-black tracking-tight text-white drop-shadow-sm">
            {profile.name || 'Member'}{profile.age ? `, ${profile.age}` : ''}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-xs border border-white/20">
            <MapPin className="h-3 w-3 shrink-0 text-[#F9C9D8]" /> {profile.location || 'Location private'}
          </p>
        </div>

        {/* Top badges */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
          {profile.compatibility > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF5F7] px-2.5 py-1 text-[9px] font-extrabold text-[#9B3F5F] shadow-[0_2px_8px_rgba(155,63,95,.14)]">
              <Heart className="h-3 w-3 fill-current" /> {profile.compatibility}% match
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1">
            {profile.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF6F1]/95 px-2 py-1 text-[9px] font-extrabold text-[#2A7D5B] shadow-sm">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
            {profile.premium && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FBF6E4]/95 px-2 py-1 text-[9px] font-extrabold text-[#A08B35] shadow-sm ring-1 ring-[#F0DFB9]">
                <Crown className="h-3 w-3" /> Premium
              </span>
            )}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <p className="truncate text-xs font-bold text-[#65575C]">{profile.occupation || 'Profession private'}</p>
        <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
          {[profile.religion, profile.education].filter((value) => value && value !== 'Not specified').slice(0, 2).map((value) => (
            <span key={value} className="max-w-full truncate rounded-full border border-[#EDE1E5] bg-[#FCF5F7] px-2 py-1 text-[9px] font-bold text-[#7D737A]">{value}</span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] items-center gap-2 border-t border-[#EFE4E8] pt-3">
          <Link href={profileHref(profile)} className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#9B3F5F] to-[#7F2948] px-3 text-[11px] font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(127,41,72,.55)] transition hover:brightness-110">View profile</Link>
          <button type="button" onClick={() => onLike(profile.id)} disabled={liked || busy} aria-label={liked ? 'Interest sent' : 'Send interest'} title={liked ? 'Interest sent' : 'Send interest'} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${liked ? 'border-[#D6E8DE] bg-[#EDF6F1] text-[#2A7D5B]' : 'border-[#E9DDE1] bg-white text-[#9B3F5F] hover:border-[#DBC2CD] hover:bg-[#FCF5F7]'} disabled:cursor-default`}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />}
          </button>
          <button type="button" onClick={() => onShortlist(profile.id)} disabled={busy} aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${shortlisted ? 'border-[#9B3F5F] bg-[#9B3F5F] text-white' : 'border-[#E9DDE1] bg-white text-[#7D737A] hover:border-[#DBC2CD] hover:text-[#9B3F5F]'}`}>
            <Bookmark className={`h-4 w-4 ${shortlisted ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-[#E9DDE1] bg-white">
          <div className="aspect-[4/5] animate-pulse bg-[#F3ECE9]" />
          <div className="space-y-3 p-4"><div className="h-3 w-2/3 animate-pulse rounded bg-[#F3ECE9]" /><div className="h-10 animate-pulse rounded-xl bg-[#F8ECE6]" /></div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { showToast } = useToast();
  const requestSequence = useRef(0);

  const [draftFilters, setDraftFilters] = useState<ProfileSearchFilters>({ ...EMPTY_PROFILE_SEARCH_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<ProfileSearchFilters>({ ...EMPTY_PROFILE_SEARCH_FILTERS });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const loadProfiles = useCallback(async (filters: ProfileSearchFilters, requestedPage = 1, append = false) => {
    const requestId = ++requestSequence.current;
    if (append) {
      setLoadingMore(true);
      setLoadMoreError('');
    } else {
      setLoading(true);
      setError('');
      setLoadMoreError('');
    }
    try {
      const data = await getProfiles(profileSearchApiParams(filters, requestedPage, PAGE_SIZE));
      if (requestId !== requestSequence.current) return;
      setProfiles((current) => append ? mergeUniqueProfiles(current, data.results) : mergeUniqueProfiles([], data.results));
      setTotalCount(data.count);
      setHasMore(data.next !== null);
      setPage(data.page);
    } catch (caught) {
      if (requestId !== requestSequence.current) return;
      const message = caught instanceof Error ? caught.message : 'Profiles could not be loaded. Please try again.';
      if (append) setLoadMoreError(message);
      else {
        setProfiles([]);
        setTotalCount(0);
        setHasMore(false);
        setError(message);
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const nextFilters = profileSearchFiltersFromParams(new URLSearchParams(queryString));
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setFilterError(null);
    void loadProfiles(nextFilters, 1, false);
  }, [loadProfiles, queryString]);

  useEffect(() => {
    void (async () => {
      const [outgoing, shortlists] = await Promise.all([
        getInterests('outgoing').catch(() => []),
        getShortlists().catch(() => ({ count: 0, results: [] })),
      ]);
      const liked = new Set<string>();
      for (const interest of outgoing ?? []) {
        const receiverId = interest?.receiver?.id || interest?.receiver?.user_id || interest?.receiver_id;
        if (receiverId) liked.add(receiverId);
      }
      setLikedIds(liked);
      setShortlistedIds(new Set((shortlists.results ?? []).map((profile) => profile.id)));
    })();
  }, []);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    document.body.classList.add('mdp-modal-lock');
    return () => document.body.classList.remove('mdp-modal-lock');
  }, [mobileFiltersOpen]);

  const activeFilterCount = useMemo(() => activeProfileFilterCount(appliedFilters), [appliedFilters]);
  const validationMessage = useMemo(() => profileSearchValidation(draftFilters), [draftFilters]);

  const updateRoute = (filters: ProfileSearchFilters) => {
    const cleaned = cleanProfileSearchFilters(filters);
    const nextQuery = profileSearchQuery(cleaned);
    const nextUrl = nextQuery ? `/search?${nextQuery}` : '/search';
    setMobileFiltersOpen(false);
    if (nextQuery === queryString) {
      setAppliedFilters(cleaned);
      void loadProfiles(cleaned, 1, false);
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const handleApply = () => {
    const message = profileSearchValidation(draftFilters);
    setFilterError(message);
    if (message) return;
    updateRoute(draftFilters);
  };

  const handleReset = () => {
    setDraftFilters({ ...EMPTY_PROFILE_SEARCH_FILTERS });
    setFilterError(null);
    updateRoute(EMPTY_PROFILE_SEARCH_FILTERS);
  };

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleLike = async (id: string) => {
    if (likedIds.has(id) || busyIds.has(id)) return;
    setBusy(id, true);
    try {
      await sendInterest(id);
      setLikedIds((current) => new Set(current).add(id));
      showToast('Interest sent successfully.', 'success');
    } catch (caught) {
      const feedback = interestFeedback(caught);
      showToast(feedback.message, feedback.tone);
    } finally {
      setBusy(id, false);
    }
  };

  const handleShortlist = async (id: string) => {
    if (busyIds.has(id)) return;
    setBusy(id, true);
    try {
      const result = await toggleShortlist(id);
      setShortlistedIds((current) => {
        const next = new Set(current);
        if (result.action === 'added') next.add(id); else next.delete(id);
        return next;
      });
      showToast(result.action === 'added' ? 'Profile added to shortlist.' : 'Profile removed from shortlist.', 'success');
    } catch (caught) {
      const feedback = interestFeedback(caught);
      showToast(feedback.message, feedback.tone);
    } finally {
      setBusy(id, false);
    }
  };

  const chips = [
    appliedFilters.search && `“${appliedFilters.search}”`,
    appliedFilters.marital_status,
    appliedFilters.religion,
    appliedFilters.location,
    appliedFilters.mother_tongue,
    appliedFilters.education,
    appliedFilters.caste,
    (appliedFilters.min_age || appliedFilters.max_age) && `${appliedFilters.min_age || '18'}–${appliedFilters.max_age || '100'} years`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-full bg-[#FBF9F8] pb-24 lg:pb-6">
      <div className="mx-auto w-full max-w-[96rem] px-3 sm:px-5 lg:px-6">

        {/* ── Compact page header ── */}
        <header className="mb-4 flex flex-col gap-3 border-b border-[#EFE4E8] py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-[-.02em] text-[#29242A] sm:text-2xl">Find your matches</h1>
            <p className="mt-0.5 text-xs text-[#7D737A] sm:text-sm">Refine what matters and explore verified member profiles.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!loading && !error && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9DDE1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#7D737A]">
                <strong className="text-[#9B3F5F]">{totalCount}</strong> {totalCount === 1 ? 'match' : 'matches'}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FCF5F7] px-3 py-1.5 text-[11px] font-bold text-[#9B3F5F] ring-1 ring-[#F0DFE4]">
              <Sparkles className="h-3 w-3" /> Sort: Recommended
            </span>
          </div>
        </header>

        {/* ── Mobile search toolbar ── */}
        <div className="mb-4 lg:hidden">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A8B2]" />
              <input
                value={draftFilters.search}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleApply(); }}
                placeholder="Search name, profession or city"
                aria-label="Search profiles"
                className={`${inputClass} h-11 pl-9`}
              />
            </label>
            <button type="button" onClick={() => setMobileFiltersOpen(true)} className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#E9DDE1] bg-white px-3.5 text-xs font-extrabold text-[#7F2948] shadow-sm">
              <SlidersHorizontal className="h-4 w-4 text-[#9B3F5F]" /> Filters
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#9B3F5F] px-1 text-[9px] text-white">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => <span key={chip} className="shrink-0 rounded-full border border-[#E9DDE1] bg-[#FCF5F7] px-2.5 py-1 text-[10px] font-bold text-[#7F5A68]">{chip}</span>)}
            <button type="button" onClick={handleReset} className="shrink-0 text-[10px] font-extrabold text-[#9B3F5F] hover:underline">Clear filters</button>
          </div>
        )}

        {mobileFiltersOpen && (
          <>
            <button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} className="fixed inset-0 z-40 bg-[#24151D]/45 lg:hidden" />
            <aside className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto rounded-t-3xl bg-[#FBF9F8] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden">
              <div className="mb-3 flex items-center justify-between px-1 py-2">
                <div><p className="font-display text-lg font-extrabold text-[#29242A]">Refine Matches</p><p className="text-[11px] text-[#7D737A]">Your choices stay selected until you apply them.</p></div>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9DDE1] bg-white text-[#7D737A]" aria-label="Close filters"><X className="h-4 w-4" /></button>
              </div>
              <FilterPanel filters={draftFilters} onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))} onApply={handleApply} onReset={handleReset} loading={loading} validationMessage={filterError || validationMessage} />
            </aside>
          </>
        )}

        <div className="grid gap-5 lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:items-start">
          {/* The filter card is a grid item that spans the full results row height —
              position: sticky on the grid item itself is what makes it travel the
              results column while the page scrolls (never scrolls away, never
              overlaps the app header because the scroll container starts below it). */}
          <aside className="relative z-10 hidden lg:sticky lg:top-5 lg:block">
            <FilterPanel filters={draftFilters} onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))} onApply={handleApply} onReset={handleReset} loading={loading} validationMessage={filterError || validationMessage} />
          </aside>

          <main className="min-w-0">
            {loading ? <ResultsSkeleton /> : error ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[#E9DDE1] bg-white p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FCF5F7] text-[#9B3F5F]"><AlertCircle className="h-5 w-5" /></span>
                <h2 className="mt-4 font-display text-lg font-extrabold text-[#29242A]">We couldn’t load profiles</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#7D737A]">{error}</p>
                <button type="button" onClick={() => void loadProfiles(appliedFilters, 1, false)} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#9B3F5F] to-[#7F2948] px-4 text-xs font-extrabold text-white"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
              </section>
            ) : profiles.length === 0 ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E9DDE1] bg-[#FCF5F7] p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F8E7ED] text-[#9B3F5F]"><Search className="h-6 w-6" /></span>
                <h2 className="mt-4 font-display text-lg font-extrabold text-[#29242A]">No profiles match these filters</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#7D737A]">Try a wider age range or clear one preference to discover more members.</p>
                <button type="button" onClick={handleReset} className="mt-5 h-10 rounded-xl border border-[#E9DDE1] bg-white px-4 text-xs font-extrabold text-[#9B3F5F]">Clear filters</button>
              </section>
            ) : (
              <>
                {loadMoreError && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#F3D3D9] bg-[#FFF1F3] px-4 py-3 text-xs font-semibold text-[#8F3851]">
                    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> {loadMoreError}</span>
                    <button type="button" onClick={() => void loadProfiles(appliedFilters, page + 1, true)} className="shrink-0 font-extrabold underline">Retry</button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {profiles.map((profile) => (
                    <SearchProfileCard key={profile.id} profile={profile} liked={likedIds.has(profile.id)} shortlisted={shortlistedIds.has(profile.id)} busy={busyIds.has(profile.id)} onLike={(id) => void handleLike(id)} onShortlist={(id) => void handleShortlist(id)} />
                  ))}
                </div>

                <div className="flex min-h-20 items-center justify-center pt-6">
                  {hasMore ? (
                    <button type="button" onClick={() => void loadProfiles(appliedFilters, page + 1, true)} disabled={loadingMore} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E9DDE1] bg-white px-5 text-xs font-extrabold text-[#9B3F5F] shadow-sm transition hover:border-[#DBC2CD] hover:bg-[#FCF5F7] disabled:cursor-wait disabled:opacity-60">
                      {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}{loadingMore ? 'Loading more profiles' : `Load more · ${Math.max(0, totalCount - profiles.length)} remaining`}
                    </button>
                  ) : (
                    <p className="text-[11px] font-semibold text-[#B8A8B2]">You’ve reached the end of these results.</p>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
