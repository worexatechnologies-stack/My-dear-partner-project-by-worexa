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

const inputClass = 'h-10 w-full rounded-xl border border-[#e4d8d3] bg-[#fcfaf8] px-3 text-sm font-semibold text-[#3e3438] outline-none transition placeholder:text-[#aa9ca1] focus:border-[#b56b80] focus:bg-white focus:ring-4 focus:ring-[#8e3d58]/[.07]';

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

  const field = (label: string, key: keyof ProfileSearchFilters, placeholder: string, type: 'text' | 'number' = 'text') => (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#8f7d84]">{label}</span>
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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
      className="rounded-2xl border border-[#e7dcd7] bg-[#fffefd] p-4 shadow-[0_10px_32px_rgba(64,36,47,.05)] sm:p-5"
    >
      <div className="mb-5 flex items-center justify-between border-b border-[#eee5e1] pb-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[#3d3337]">
          <SlidersHorizontal className="h-4 w-4 text-[#a44461]" />
          Refine matches
        </div>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#9a3d59] hover:text-[#762b43]">
          <RefreshCw className="h-3 w-3" /> Clear
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#8f7d84]">Keyword</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a6969b]" />
            <input
              value={filters.search}
              onChange={(event) => onChange('search', event.target.value)}
              placeholder="Name, profession or city"
              className={`${inputClass} pl-9`}
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#8f7d84]">Marital status</span>
          <select value={filters.marital_status} onChange={(event) => onChange('marital_status', event.target.value)} className={inputClass}>
            <option value="">Any status</option>
            <option value="Never Married">Never Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
            <option value="Awaiting Divorce">Awaiting Divorce</option>
          </select>
        </label>

        {field('Religion', 'religion', 'e.g. Hindu, Muslim, Christian')}

        <button
          type="button"
          onClick={() => setShowMore((visible) => !visible)}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-[#e7dcd7] bg-[#fcfaf8] px-3 text-xs font-extrabold text-[#6f6065] transition hover:border-[#d7bcc4] hover:bg-white"
          aria-expanded={showMore}
        >
          <span>More preferences</span>
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showMore && (
          <div className="space-y-4 border-l-2 border-[#f0e2e6] pl-3">
            {field('Caste / community', 'caste', 'e.g. Brahmin, Nair')}
            {field('Mother tongue', 'mother_tongue', 'e.g. Hindi, Tamil')}
            {field('Education', 'education', 'e.g. B.Tech, MBA')}
            {field('Location', 'location', 'e.g. Mumbai, Bengaluru')}
            <div>
              <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#8f7d84]">Age range</span>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={filters.min_age} onChange={(event) => onChange('min_age', event.target.value)} placeholder="Min" min={18} max={100} aria-label="Minimum age" className={inputClass} />
                <input type="number" value={filters.max_age} onChange={(event) => onChange('max_age', event.target.value)} placeholder="Max" min={18} max={100} aria-label="Maximum age" className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {validationMessage && (
          <p className="flex items-start gap-2 rounded-xl border border-[#efcdd3] bg-[#fff5f6] px-3 py-2 text-[11px] font-semibold leading-4 text-[#9a304c]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {validationMessage}
          </p>
        )}

        <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#8e3d58] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(142,61,88,.18)] transition hover:bg-[#783149] active:scale-[.99] disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Searching' : 'Apply filters'}
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
    <article className="group overflow-hidden rounded-2xl border border-[#e7dcd7] bg-[#fffefd] shadow-[0_8px_28px_rgba(64,36,47,.055)] transition duration-200 hover:-translate-y-0.5 hover:border-[#dabfc7] hover:shadow-[0_14px_34px_rgba(64,36,47,.09)]">
      <Link href={`/profile/${profile.id}`} className="relative isolate block aspect-[4/5] overflow-hidden bg-[#fbf7f2]">
        <SmartImage
          src={visiblePhoto}
          alt={profile.name || 'Member profile'}
          fallback="brand"
          fallbackMessage={PHOTO_FALLBACK_MESSAGE}
          className="h-full w-full rounded-none object-cover object-top transition-transform duration-500 group-hover:scale-[1.025]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#24151d]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-30 p-3.5 text-white">
          <h2 className="truncate font-display text-base font-extrabold tracking-[-.02em]">{profile.name || 'Member'}{profile.age ? `, ${profile.age}` : ''}</h2>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-white/85">
            <MapPin className="h-3 w-3 shrink-0" /> {profile.location || 'Location private'}
          </p>
        </div>
        <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
          {profile.compatibility > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-extrabold text-[#8e3d58] shadow-sm">
              <Sparkles className="h-3 w-3" /> {profile.compatibility}% match
            </span>
          ) : <span />}
          {profile.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#edf6f1]/95 px-2 py-1 text-[9px] font-extrabold text-[#24664f] shadow-sm">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          )}
        </div>
      </Link>

      <div className="p-3.5">
        <p className="truncate text-xs font-bold text-[#65575c]">{profile.occupation || 'Profession private'}</p>
        <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
          {[profile.religion, profile.education].filter((value) => value && value !== 'Not specified').slice(0, 2).map((value) => (
            <span key={value} className="max-w-full truncate rounded-full border border-[#eee2de] bg-[#faf6f3] px-2 py-1 text-[9px] font-bold text-[#7a696f]">{value}</span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-2 border-t border-[#eee5e1] pt-3">
          <Link href={`/profile/${profile.id}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#8e3d58] px-3 text-[11px] font-extrabold text-white transition hover:bg-[#783149]">View profile</Link>
          <button type="button" onClick={() => onLike(profile.id)} disabled={liked || busy} aria-label={liked ? 'Interest sent' : 'Send interest'} title={liked ? 'Interest sent' : 'Send interest'} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${liked ? 'border-[#d4e8df] bg-[#edf6f1] text-[#24664f]' : 'border-[#e4d8d3] bg-white text-[#8e3d58] hover:border-[#c992a2] hover:bg-[#faf0f3]'} disabled:cursor-default`}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />}
          </button>
          <button type="button" onClick={() => onShortlist(profile.id)} disabled={busy} aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${shortlisted ? 'border-[#8e3d58] bg-[#8e3d58] text-white' : 'border-[#e4d8d3] bg-white text-[#76676c] hover:border-[#c992a2] hover:text-[#8e3d58]'}`}>
            <Bookmark className={`h-4 w-4 ${shortlisted ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-[#eadfd9] bg-white">
          <div className="aspect-[4/5] animate-pulse bg-[#eee6e2]" />
          <div className="space-y-3 p-4"><div className="h-3 w-2/3 animate-pulse rounded bg-[#eee6e2]" /><div className="h-10 animate-pulse rounded-xl bg-[#f2ece9]" /></div>
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
    <div className="min-h-full bg-[#fbf7f2] pb-24 lg:pb-8">
      <div className="mx-auto w-full max-w-[78rem] px-3 sm:px-5 lg:px-6">
        <header className="mb-5 flex flex-col gap-4 border-b border-[#e7dcd7] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-[#a45a70]">Thoughtful search</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-[-.035em] text-[#342c2f] sm:text-3xl">Find a meaningful match</h1>
            <p className="mt-1 text-xs leading-5 text-[#7e7075] sm:text-sm">Refine what matters and explore verified member profiles.</p>
          </div>
          {!loading && !error && (
            <span className="w-fit rounded-full border border-[#e4d8d3] bg-[#fffefd] px-3 py-1.5 text-[11px] font-bold text-[#796a6f]">
              <strong className="text-[#8e3d58]">{totalCount}</strong> {totalCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </header>

        <div className="mb-4 lg:hidden">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9c8b91]" />
              <input
                value={draftFilters.search}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleApply(); }}
                placeholder="Search name, profession or city"
                aria-label="Search profiles"
                className={`${inputClass} h-11 pl-9`}
              />
            </label>
            <button type="button" onClick={() => setMobileFiltersOpen(true)} className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#dccbc6] bg-[#fffefd] px-3.5 text-xs font-extrabold text-[#5d4f54] shadow-sm">
              <SlidersHorizontal className="h-4 w-4 text-[#8e3d58]" /> Filters
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8e3d58] px-1 text-[9px] text-white">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => <span key={chip} className="shrink-0 rounded-full border border-[#e8d8dd] bg-[#fffefd] px-2.5 py-1 text-[10px] font-bold text-[#7d4a5b]">{chip}</span>)}
            <button type="button" onClick={handleReset} className="shrink-0 text-[10px] font-extrabold text-[#9a3d59] hover:underline">Clear filters</button>
          </div>
        )}

        {mobileFiltersOpen && (
          <>
            <button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} className="fixed inset-0 z-40 bg-[#24151d]/45 lg:hidden" />
            <aside className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto rounded-t-3xl bg-[#fbf7f2] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden">
              <div className="mb-3 flex items-center justify-between px-1 py-2">
                <div><p className="font-display text-lg font-extrabold text-[#342c2f]">Refine matches</p><p className="text-[11px] text-[#8a7a80]">Your choices stay selected until you apply them.</p></div>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e4d8d3] bg-white text-[#796a6f]" aria-label="Close filters"><X className="h-4 w-4" /></button>
              </div>
              <FilterPanel filters={draftFilters} onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))} onApply={handleApply} onReset={handleReset} loading={loading} validationMessage={filterError || validationMessage} />
            </aside>
          </>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-4">
              <FilterPanel filters={draftFilters} onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))} onApply={handleApply} onReset={handleReset} loading={loading} validationMessage={filterError || validationMessage} />
            </div>
          </aside>

          <main className="min-w-0">
            {loading ? <ResultsSkeleton /> : error ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[#ead5d9] bg-[#fffefd] p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0f2] text-[#a33c58]"><AlertCircle className="h-5 w-5" /></span>
                <h2 className="mt-4 font-display text-lg font-extrabold text-[#3d3337]">We couldn’t load profiles</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#7d6e73]">{error}</p>
                <button type="button" onClick={() => void loadProfiles(appliedFilters, 1, false)} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#8e3d58] px-4 text-xs font-extrabold text-white"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
              </section>
            ) : profiles.length === 0 ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dbcac5] bg-[#fffefd] p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f7e9ed] text-[#8e3d58]"><Search className="h-6 w-6" /></span>
                <h2 className="mt-4 font-display text-lg font-extrabold text-[#3d3337]">No profiles match these filters</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#7d6e73]">Try a wider age range or clear one preference to discover more members.</p>
                <button type="button" onClick={handleReset} className="mt-5 h-10 rounded-xl border border-[#d9bdc5] bg-white px-4 text-xs font-extrabold text-[#8e3d58]">Clear filters</button>
              </section>
            ) : (
              <>
                {loadMoreError && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#efd2d7] bg-[#fff6f7] px-4 py-3 text-xs font-semibold text-[#8f3851]">
                    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> {loadMoreError}</span>
                    <button type="button" onClick={() => void loadProfiles(appliedFilters, page + 1, true)} className="shrink-0 font-extrabold underline">Retry</button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {profiles.map((profile) => (
                    <SearchProfileCard key={profile.id} profile={profile} liked={likedIds.has(profile.id)} shortlisted={shortlistedIds.has(profile.id)} busy={busyIds.has(profile.id)} onLike={(id) => void handleLike(id)} onShortlist={(id) => void handleShortlist(id)} />
                  ))}
                </div>

                <div className="flex min-h-20 items-center justify-center pt-6">
                  {hasMore ? (
                    <button type="button" onClick={() => void loadProfiles(appliedFilters, page + 1, true)} disabled={loadingMore} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9c5cb] bg-[#fffefd] px-5 text-xs font-extrabold text-[#8e3d58] shadow-sm transition hover:border-[#b98291] hover:bg-white disabled:cursor-wait disabled:opacity-60">
                      {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}{loadingMore ? 'Loading more profiles' : `Load more · ${Math.max(0, totalCount - profiles.length)} remaining`}
                    </button>
                  ) : (
                    <p className="text-[11px] font-semibold text-[#998a8f]">You’ve reached the end of these results.</p>
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
