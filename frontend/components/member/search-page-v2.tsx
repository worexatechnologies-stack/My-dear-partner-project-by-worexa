'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Eye,
  GraduationCap,
  Heart,
  Languages,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  SlidersHorizontal,
  UserCheck,
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

/* ── Modern Design Tokens ────────────────────────────────────────── */
const inputStyle = 'h-10 w-full rounded-xl border border-[#efefef] bg-[#f9fafb] px-3.5 text-xs font-semibold text-[#0f0f10] outline-none transition-all placeholder:text-[#a8989f] hover:border-[#dfd8dc] focus:border-[#e11d48] focus:bg-white focus:ring-2 focus:ring-[#e11d48]/10';
const selectStyle = `${inputStyle} appearance-none cursor-pointer pr-8`;
const labelStyle = 'mb-1.5 flex items-center justify-between text-[11px] font-bold text-[#443c40] tracking-wide';

/* ── Refined Filter Panel ────────────────────────────────────────── */
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
  const activeCount = activeProfileFilterCount(filters);

  useEffect(() => {
    if (hasAdvancedValue) setShowMore(true);
  }, [hasAdvancedValue]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
      className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#efefef] bg-white px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f9fafb] border border-[#efefef] text-[#262626]">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-[#0f0f10]">Refine Matches</p>
              {activeCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#e11d48] px-1.5 text-[9px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8c7a82]">Personalized partner preferences</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#efefef] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#8c7a82] shadow-2xs transition-all hover:bg-[#f7f4f5] hover:text-[#e11d48] active:scale-95"
        >
          <RefreshCw className="h-3 w-3" /> Clear
        </button>
      </div>

      {/* Scrollable Filters Body */}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:#e8dbe0_transparent]">
        {/* Search */}
        <div>
          <label className="block">
            <span className={labelStyle}>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => onChange('search', event.target.value)}
                placeholder="Name, profession, or city"
                className={`${inputStyle} pl-8.5`}
              />
            </div>
          </label>
        </div>

        {/* Age Range */}
        <div>
          <div className={labelStyle}>
            <span>Age range</span>
            <span className="text-[10px] font-medium text-[#8c7a82]">18 – 100 yrs</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <input
              type="number"
              value={filters.min_age}
              onChange={(event) => onChange('min_age', event.target.value)}
              placeholder="Min"
              min={18}
              max={100}
              aria-label="Minimum age"
              className={`${inputStyle} text-center`}
            />
            <span className="text-xs font-bold text-[#a8989f]">—</span>
            <input
              type="number"
              value={filters.max_age}
              onChange={(event) => onChange('max_age', event.target.value)}
              placeholder="Max"
              min={18}
              max={100}
              aria-label="Maximum age"
              className={`${inputStyle} text-center`}
            />
          </div>
        </div>

        {/* Religion */}
        <div>
          <label className="block">
            <span className={labelStyle}>Religion</span>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
              <select
                value={filters.religion}
                onChange={(event) => onChange('religion', event.target.value)}
                className={`${selectStyle} pl-8.5`}
              >
                <option value="">Any Religion</option>
                {['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Jewish', 'Parsi', 'Other'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
            </div>
          </label>
        </div>

        {/* Location */}
        <div>
          <label className="block">
            <span className={labelStyle}>Location</span>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
              <input
                type="text"
                value={filters.location}
                onChange={(event) => onChange('location', event.target.value)}
                placeholder="e.g. Mumbai, Bengaluru"
                className={`${inputStyle} pl-8.5`}
              />
            </div>
          </label>
        </div>

        {/* Education */}
        <div>
          <label className="block">
            <span className={labelStyle}>Education</span>
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
              <select
                value={filters.education}
                onChange={(event) => onChange('education', event.target.value)}
                className={`${selectStyle} pl-8.5`}
              >
                <option value="">Any Education</option>
                {['High School', 'Diploma', 'B.Tech', 'B.Com', 'B.Sc', 'BA', 'BE', 'BBA', 'MBA', 'MCA', 'M.Tech', 'MBBS', 'MD', 'PhD', 'Other'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
            </div>
          </label>
        </div>

        {/* Marital Status */}
        <div>
          <label className="block">
            <span className={labelStyle}>Marital status</span>
            <div className="relative">
              <Heart className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
              <select
                value={filters.marital_status}
                onChange={(event) => onChange('marital_status', event.target.value)}
                className={`${selectStyle} pl-8.5`}
              >
                <option value="">Any Status</option>
                <option value="Never Married">Never Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Awaiting Divorce">Awaiting Divorce</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
            </div>
          </label>
        </div>

        {/* More Preferences Accordion */}
        <button
          type="button"
          onClick={() => setShowMore((visible) => !visible)}
          className="flex h-9.5 w-full items-center justify-between rounded-xl border border-[#efefef] bg-[#f9fafb] px-3.5 text-xs font-bold text-[#443c40] transition-all hover:bg-[#f3f4f6]"
          aria-expanded={showMore}
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3 w-3 text-[#262626]" />
            More preferences
          </span>
          {showMore ? <ChevronUp className="h-3.5 w-3.5 text-[#8c7a82]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#8c7a82]" />}
        </button>

        {showMore && (
          <div className="space-y-3.5 rounded-xl border border-[#efefef] bg-[#f9fafb] p-3">
            <div>
              <label className="block">
                <span className={labelStyle}>Caste / community</span>
                <input
                  type="text"
                  value={filters.caste}
                  onChange={(event) => onChange('caste', event.target.value)}
                  placeholder="e.g. Brahmin, Nair"
                  className={inputStyle}
                />
              </label>
            </div>
            <div>
              <label className="block">
                <span className={labelStyle}>Mother tongue</span>
                <div className="relative">
                  <Languages className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
                  <select
                    value={filters.mother_tongue}
                    onChange={(event) => onChange('mother_tongue', event.target.value)}
                    className={`${selectStyle} pl-8.5`}
                  >
                    <option value="">Any Language</option>
                    {['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Other'].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
                </div>
              </label>
            </div>
          </div>
        )}

        {validationMessage && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold leading-4 text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {validationMessage}
          </p>
        )}
      </div>

      {/* Footer Apply Button */}
      <div className="border-t border-[#efefef] bg-white p-3.5">
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:from-[#be123c] hover:to-[#9f1239] px-4 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_14px_rgba(225,29,72,0.25)] transition-all active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {loading ? 'Searching…' : 'Apply Filters'}
          {!loading && activeCount > 0 && (
            <span className="ml-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}

/* ── Luxury Profile Card ─────────────────────────────────────────── */
function SearchProfileCard({
  profile,
  interestStatus,
  shortlisted,
  busy,
  onLike,
  onShortlist,
}: {
  profile: Profile;
  interestStatus: 'ACCEPTED' | 'SENT' | 'RECEIVED' | 'DECLINED' | null;
  shortlisted: boolean;
  busy: boolean;
  onLike: (id: string) => void;
  onShortlist: (id: string) => void;
}) {
  const visiblePhoto = profile.photoVisibility === 'visible'
    ? profile.photoFull || profile.photo
    : '';

  const communityStr = [profile.religion, profile.caste].filter(Boolean).join(', ');

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[#dfd8dc] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
      {/* Photo Area - Crystal clear, zero blur or dark overlay */}
      <Link href={profileHref(profile)} className="relative isolate block aspect-[4/5] overflow-hidden bg-[#f7f4f5]">
        <SmartImage
          src={visiblePhoto}
          alt={profile.name || 'Member profile'}
          fallback="brand"
          fallbackMessage={PHOTO_FALLBACK_MESSAGE}
          watermark={false}
          className="h-full w-full rounded-none object-cover object-top transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
        />

        {/* Top Badges - Crisp solid badges, no blur */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5">
          {profile.compatibility > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
              <Heart className="h-3 w-3 fill-[#e11d48] text-[#e11d48]" /> {profile.compatibility}% match
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5">
            {profile.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {profile.premium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                <Crown className="h-3 w-3 fill-white" /> Premium
              </span>
            )}
          </span>
        </div>
      </Link>

      {/* Card Info & Actions - Clean layout like visitors page */}
      <div className="flex flex-1 flex-col p-3.5 justify-between">
        <div className="space-y-1.5">
          <Link href={profileHref(profile)} className="block group/link">
            <h2 className="truncate font-display text-sm sm:text-base font-bold text-[#0f0f10] group-hover/link:text-[#e11d48] transition-colors">
              {profile.name || 'Member'}{profile.age ? `, ${profile.age}` : ''}
            </h2>
          </Link>

          {profile.location && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-[#8c7a82] truncate">
              <MapPin className="h-3 w-3 shrink-0 text-[#e11d48]" />
              <span className="truncate">{profile.location}</span>
            </p>
          )}

          {profile.occupation && (
            <p className="flex items-center gap-1 text-[11px] text-[#443c40] truncate font-medium">
              <Briefcase className="w-3 h-3 text-[#8c7a82] shrink-0" />
              <span className="truncate">{profile.occupation}</span>
            </p>
          )}

          <div className="flex min-h-6 flex-wrap gap-1.5">
            {profile.height && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 text-[10px] font-medium text-[#443c40]">
                <Ruler className="w-2.5 h-2.5 text-[#8c7a82]" />
                {profile.height}
              </span>
            )}
            {communityStr && (
              <span className="inline-flex max-w-full truncate items-center rounded-md bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 text-[10px] font-medium text-[#443c40]">
                {communityStr}
              </span>
            )}
            {profile.education && profile.education !== 'Not specified' && (
              <span className="inline-flex max-w-full truncate items-center rounded-md bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 text-[10px] font-medium text-[#443c40]">
                {profile.education}
              </span>
            )}
            {profile.motherTongue && !communityStr && (
              <span className="inline-flex max-w-full truncate items-center rounded-md bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 text-[10px] font-medium text-[#443c40]">
                {profile.motherTongue}
              </span>
            )}
          </div>
        </div>

        {/* Actions Row */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-[#f2edf0] pt-2.5">
          {interestStatus === 'ACCEPTED' ? (
            <div
              title="Connected (Mutual match)"
              aria-label="Connected"
              className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Connected</span>
            </div>
          ) : interestStatus === 'SENT' ? (
            <div
              title="Interest sent"
              aria-label="Interest sent"
              className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs select-none"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Sent</span>
            </div>
          ) : interestStatus === 'DECLINED' ? (
            <div
              title="Declined"
              aria-label="Declined"
              className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#f7f4f5] border border-[#efefef] text-[#8c7a82] text-xs font-semibold shadow-2xs select-none"
            >
              <X className="h-3.5 w-3.5 text-[#8c7a82] shrink-0" />
              <span>Declined</span>
            </div>
          ) : interestStatus === 'RECEIVED' ? (
            <Link
              href={profileHref(profile)}
              className="flex-1 min-w-0 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#be123c] px-3 text-xs font-bold text-white shadow-[0_4px_14px_rgba(225,29,72,0.25)] transition hover:brightness-110 active:scale-[.98]"
            >
              <Heart className="h-3.5 w-3.5 fill-white shrink-0" />
              <span className="truncate">Respond</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onLike(profile.id)}
              disabled={busy}
              aria-label="Connect with member"
              title="Connect with member"
              className="flex-1 min-w-0 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:from-[#be123c] hover:to-[#9f1239] px-3 text-xs font-bold text-white shadow-[0_4px_14px_rgba(225,29,72,0.25)] transition-all hover:brightness-110 active:scale-[.98] disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <>
                  <Heart className="h-3.5 w-3.5 fill-white text-white shrink-0" />
                  <span className="truncate">Connect</span>
                </>
              )}
            </button>
          )}

          <Link
            href={profileHref(profile)}
            className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-[#efefef] bg-white px-3 text-xs font-semibold text-[#262626] hover:bg-[#f7f4f5] hover:border-[#dfd8dc] shadow-2xs transition-all"
          >
            <Eye className="h-3.5 w-3.5 text-[#8c7a82] shrink-0" />
            <span>View</span>
          </Link>

          <button
            type="button"
            onClick={() => onShortlist(profile.id)}
            disabled={busy}
            aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
              shortlisted
                ? 'border-[#e11d48] bg-[#e11d48] text-white shadow-[0_4px_10px_rgba(225,29,72,0.3)]'
                : 'border-[#efefef] bg-white text-[#8c7a82] hover:border-[#e11d48] hover:bg-[#f7f4f5] hover:text-[#e11d48]'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${shortlisted ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Skeleton Loading ────────────────────────────────────────────── */
function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-[#efefef] bg-white">
          <div className="aspect-[4/5] animate-pulse bg-[#f4f0f2]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-2/3 animate-pulse rounded bg-[#f4f0f2]" />
            <div className="h-10 animate-pulse rounded-xl bg-[#f7f4f5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Search Page ────────────────────────────────────────────── */
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
  const [interestMap, setInterestMap] = useState<Map<string, 'ACCEPTED' | 'SENT' | 'RECEIVED' | 'DECLINED'>>(new Map());
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'recommended' | 'compatibility' | 'newest' | 'age'>('recommended');

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
      const [outgoing, incoming, shortlists] = await Promise.all([
        getInterests('outgoing').catch(() => []),
        getInterests('incoming').catch(() => []),
        getShortlists().catch(() => ({ count: 0, results: [] })),
      ]);
      const statusMap = new Map<string, 'ACCEPTED' | 'SENT' | 'RECEIVED' | 'DECLINED'>();

      for (const item of incoming ?? []) {
        const senderId = item?.sender?.id || item?.sender?.user_id || item?.sender_id;
        if (!senderId) continue;
        if (item.status === 'ACCEPTED') statusMap.set(String(senderId), 'ACCEPTED');
        else if (item.status === 'PENDING') statusMap.set(String(senderId), 'RECEIVED');
        else if (item.status === 'DECLINED') statusMap.set(String(senderId), 'DECLINED');
      }

      for (const item of outgoing ?? []) {
        const receiverId = item?.receiver?.id || item?.receiver?.user_id || item?.receiver_id;
        if (!receiverId) continue;
        if (item.status === 'ACCEPTED') statusMap.set(String(receiverId), 'ACCEPTED');
        else if (item.status === 'PENDING') {
          if (!statusMap.has(String(receiverId))) statusMap.set(String(receiverId), 'SENT');
        } else if (item.status === 'DECLINED') {
          if (!statusMap.has(String(receiverId))) statusMap.set(String(receiverId), 'DECLINED');
        }
      }
      setInterestMap(statusMap);
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
    if (interestMap.get(id) || busyIds.has(id)) return;
    setBusy(id, true);
    try {
      await sendInterest(id);
      setInterestMap((current) => {
        const next = new Map(current);
        next.set(id, 'SENT');
        return next;
      });
      showToast('Interest sent successfully!', 'success');
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
    (appliedFilters.min_age || appliedFilters.max_age) && `${appliedFilters.min_age || '18'}–${appliedFilters.max_age || '100'} yrs`,
  ].filter(Boolean) as string[];

  /* Sorting computation */
  const sortedProfiles = useMemo(() => {
    const list = [...profiles];
    if (sortBy === 'compatibility') {
      return list.sort((a, b) => (b.compatibility || 0) - (a.compatibility || 0));
    }
    if (sortBy === 'age') {
      return list.sort((a, b) => (a.age || 0) - (b.age || 0));
    }
    // Default 'recommended'
    return list.sort((a, b) => {
      const aStatus = interestMap.get(String(a.id));
      const bStatus = interestMap.get(String(b.id));

      const rank = (status?: string) => {
        if (!status) return 0; // Fresh profiles first
        if (status === 'RECEIVED') return 1; // Incoming request
        if (status === 'SENT') return 2; // Sent interest
        if (status === 'ACCEPTED') return 3; // Connected (at the end)
        if (status === 'DECLINED') return 4; // Declined (at the very end)
        return 0;
      };

      const rankDiff = rank(aStatus) - rank(bStatus);
      if (rankDiff !== 0) return rankDiff;
      return (b.compatibility || 0) - (a.compatibility || 0);
    });
  }, [profiles, interestMap, sortBy]);

  return (
    <div className="min-h-full bg-[#fafafa] pb-24 lg:pb-8" style={{ backgroundColor: '#fafafa' }}>
      <div className="mx-auto w-full max-w-[96rem] px-3 sm:px-5 lg:px-6">

        {/* ── Sleek Page Header ── */}
        <header className="mb-5 flex flex-col gap-3 border-b border-[#efefef] py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-[#0f0f10] sm:text-2xl">
              Find your matches
            </h1>
            <p className="mt-0.5 text-xs text-[#8c7a82] sm:text-sm">
              Refine what matters and explore verified member profiles.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {!loading && !error && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#efefef] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#443c40] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#e11d48]" />
                <strong className="text-[#0f0f10]">{totalCount}</strong> {totalCount === 1 ? 'match' : 'matches'}
              </span>
            )}

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort profiles"
                className="appearance-none cursor-pointer rounded-full border border-[#efefef] bg-white pl-3.5 pr-8 py-1.5 text-xs font-semibold text-[#0f0f10] shadow-2xs hover:bg-[#f9fafb] outline-none transition-colors"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="compatibility">Highest Match %</option>
                <option value="age">Age: Youngest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8c7a82]" />
            </div>
          </div>
        </header>

        {/* ── Quick Filter Bar (Clean Lucide Icons, No Emojis, No Sparkles) ── */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              const next = { ...draftFilters, marital_status: draftFilters.marital_status === 'Never Married' ? '' : 'Never Married' };
              setDraftFilters(next);
              updateRoute(next);
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              appliedFilters.marital_status === 'Never Married'
                ? 'bg-[#0f0f10] text-white border-[#0f0f10]'
                : 'bg-white text-[#443c40] border-[#efefef] hover:bg-[#f9fafb]'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${appliedFilters.marital_status === 'Never Married' ? 'text-white' : 'text-[#262626]'}`} />
            <span>Never Married</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = { ...draftFilters, education: draftFilters.education ? '' : 'B.Tech' };
              setDraftFilters(next);
              updateRoute(next);
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              appliedFilters.education
                ? 'bg-[#0f0f10] text-white border-[#0f0f10]'
                : 'bg-white text-[#443c40] border-[#efefef] hover:bg-[#f9fafb]'
            }`}
          >
            <GraduationCap className={`w-3.5 h-3.5 ${appliedFilters.education ? 'text-white' : 'text-[#262626]'}`} />
            <span>Graduates & Above</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSortBy(sortBy === 'compatibility' ? 'recommended' : 'compatibility');
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              sortBy === 'compatibility'
                ? 'bg-[#e11d48] text-white border-[#e11d48]'
                : 'bg-white text-[#443c40] border-[#efefef] hover:bg-[#f9fafb]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${sortBy === 'compatibility' ? 'fill-white text-white' : 'fill-[#e11d48] text-[#e11d48]'}`} />
            <span>High Compatibility</span>
          </button>

          {chips.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#e11d48] hover:text-[#be123c] transition-colors"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* ── Active Filter Chips ── */}
        {chips.length > 0 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => (
              <span
                key={chip}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#efefef] bg-white px-3 py-1 text-xs font-semibold text-[#262626] shadow-2xs"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* ── Mobile Search Toolbar ── */}
        <div className="mb-4 lg:hidden">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c7a82]" />
              <input
                value={draftFilters.search}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleApply(); }}
                placeholder="Search name, profession or city"
                aria-label="Search profiles"
                className={`${inputStyle} h-11 pl-9`}
              />
            </label>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#efefef] bg-white px-3.5 text-xs font-bold text-[#0f0f10] shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#262626]" /> Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        {mobileFiltersOpen && (
          <>
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => setMobileFiltersOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <aside className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto rounded-t-3xl bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden">
              <div className="mb-3 flex items-center justify-between px-1 py-2">
                <div>
                  <p className="font-display text-lg font-bold text-[#0f0f10]">Refine Matches</p>
                  <p className="text-[11px] text-[#8c7a82]">Your choices stay selected until you apply them.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#efefef] bg-white text-[#262626]"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FilterPanel
                filters={draftFilters}
                onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
                onApply={handleApply}
                onReset={handleReset}
                loading={loading}
                validationMessage={filterError || validationMessage}
              />
            </aside>
          </>
        )}

        {/* ── Main Layout (Sidebar + Results Grid) ── */}
        <div className="grid gap-6 lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:items-start">
          {/* Desktop Sticky Filter Sidebar */}
          <aside className="relative z-10 hidden lg:sticky lg:top-4 lg:block">
            <FilterPanel
              filters={draftFilters}
              onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
              onApply={handleApply}
              onReset={handleReset}
              loading={loading}
              validationMessage={filterError || validationMessage}
            />
          </aside>

          {/* Results Grid */}
          <main className="min-w-0">
            {loading ? (
              <ResultsSkeleton />
            ) : error ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[#efefef] bg-white p-8 text-center shadow-xs">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#e11d48]">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold text-[#0f0f10]">We couldn’t load profiles</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#8c7a82]">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadProfiles(appliedFilters, 1, false)}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#be123c] px-4 text-xs font-bold text-white shadow-sm hover:brightness-110"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
              </section>
            ) : profiles.length === 0 ? (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfd8dc] bg-white p-8 text-center shadow-xs">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f7f4f5] text-[#262626]">
                  <Search className="h-6 w-6" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold text-[#0f0f10]">No profiles match these filters</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#8c7a82]">
                  Try a wider age range or clear one preference to discover more members.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-5 h-10 rounded-xl border border-[#efefef] bg-white px-5 text-xs font-bold text-[#0f0f10] shadow-xs hover:bg-[#f7f4f5]"
                >
                  Clear all filters
                </button>
              </section>
            ) : (
              <>
                {loadMoreError && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {loadMoreError}
                    </span>
                    <button
                      type="button"
                      onClick={() => void loadProfiles(appliedFilters, page + 1, true)}
                      className="shrink-0 font-bold underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {sortedProfiles.map((profile) => (
                    <SearchProfileCard
                      key={profile.id}
                      profile={profile}
                      interestStatus={interestMap.get(String(profile.id)) || null}
                      shortlisted={shortlistedIds.has(profile.id)}
                      busy={busyIds.has(profile.id)}
                      onLike={(id) => void handleLike(id)}
                      onShortlist={(id) => void handleShortlist(id)}
                    />
                  ))}
                </div>

                {/* Load More Pagination */}
                <div className="flex min-h-20 items-center justify-center pt-8">
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() => void loadProfiles(appliedFilters, page + 1, true)}
                      disabled={loadingMore}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#efefef] bg-white px-6 text-xs font-bold text-[#0f0f10] shadow-xs transition hover:border-[#dfd8dc] hover:bg-[#f9fafb] active:scale-95 disabled:cursor-wait disabled:opacity-60"
                    >
                      {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin text-[#e11d48]" />}
                      {loadingMore ? 'Loading more profiles…' : `Load more · ${Math.max(0, totalCount - profiles.length)} remaining`}
                    </button>
                  ) : (
                    <p className="text-xs font-medium text-[#8c7a82]">
                      You’ve reached the end of these results.
                    </p>
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
