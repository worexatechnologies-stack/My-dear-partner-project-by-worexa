'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from '@/lib/router-compat';
import {
  Heart, MessageCircle, MapPin, ShieldCheck, User, Star, Crown, Search, SlidersHorizontal, RefreshCw, X, Check,
} from 'lucide-react';
import type { Profile } from '../types/domain';
import { getProfiles, sendInterest } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { usePresence } from '../../hooks/use-presence';

export default function SearchPage() {
  const { user } = useAuth();
  const [messageTermsProfile, setMessageTermsProfile] = useState<Profile | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (messageTermsProfile) {
      document.body.classList.add('mdp-modal-lock');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('mdp-modal-lock');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('mdp-modal-lock');
      document.body.style.overflow = '';
    };
  }, [messageTermsProfile]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 12;

  // Live presence for visible profiles
  const visibleProfileIds = useMemo(
    () => profilesList.map((p) => p.id),
    [profilesList],
  );
  const { isOnline } = usePresence(visibleProfileIds);

  // Filter States
  const [keyword, setKeyword] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [religionFilter, setReligionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [maritalStatusFilter, setMaritalStatusFilter] = useState('');
  const [motherTongueFilter, setMotherTongueFilter] = useState('');
  const [educationFilter, setEducationFilter] = useState('');
  const [casteFilter, setCasteFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const currentFilterParams = (overrides: Record<string, string> = {}) => {
    const values = {
      search: keyword,
      gender: genderFilter,
      religion: religionFilter,
      location: locationFilter,
      min_age: ageMin,
      max_age: ageMax,
      marital_status: maritalStatusFilter,
      mother_tongue: motherTongueFilter,
      education: educationFilter,
      caste: casteFilter,
      ...overrides,
    };
    return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ''));
  };

  // Active filters counter badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (keyword) count++;
    if (genderFilter) count++;
    if (religionFilter) count++;
    if (locationFilter) count++;
    if (ageMin || ageMax) count++;
    if (maritalStatusFilter) count++;
    if (motherTongueFilter) count++;
    if (educationFilter) count++;
    if (casteFilter) count++;
    return count;
  }, [
    keyword, genderFilter, religionFilter, locationFilter, ageMin, ageMax,
    maritalStatusFilter, motherTongueFilter, educationFilter, casteFilter
  ]);

  const loadProfiles = async (filterParams: Record<string, string> = currentFilterParams(), page = 1, append = false) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const params: Record<string, string> = { ...filterParams, page: String(page), page_size: String(PAGE_SIZE) };

      const data = await getProfiles(params);
      const results = data.results || [];
      setProfilesList((prev) => append ? [...prev, ...results] : results);
      setTotalCount((data as any).count || results.length);
      setHasMore(Boolean((data as any).next));
      setCurrentPage(page);
    } catch (err: any) {
      setError(err?.message || 'Failed to load matching profiles.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load from search query params
  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      const apiKey = ({ q: 'search', work_location: 'location', age_min: 'min_age', age_max: 'max_age', highest_education: 'education' } as Record<string, string>)[key] || key;
      params[apiKey] = value;
      if (key === 'q') setKeyword(value);
      else if (key === 'gender') setGenderFilter(value);
      else if (key === 'religion') setReligionFilter(value);
      else if (key === 'location' || key === 'work_location') setLocationFilter(value);
      else if (key === 'min_age' || key === 'age_min') setAgeMin(value);
      else if (key === 'max_age' || key === 'age_max') setAgeMax(value);
      else if (key === 'marital_status') setMaritalStatusFilter(value);
      else if (key === 'mother_tongue') setMotherTongueFilter(value);
      else if (key === 'education' || key === 'highest_education') setEducationFilter(value);
      else if (key === 'caste') setCasteFilter(value);
    });
    loadProfiles(params);
  }, [searchParams]);

  const expressInterest = async (id: string) => {
    setBusyId(id);
    try {
      await sendInterest(id);
      alert('Interest sent successfully!');
    } catch (err: any) {
      const isMembershipError =
        err?.code === 'MEMBERSHIP_REQUIRED' ||
        err?.errors?.code === 'MEMBERSHIP_REQUIRED' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('membership plan')) ||
        (err?.status === 403 && !err?.message?.toLowerCase?.()?.includes?.('csrf'));
      if (isMembershipError) {
        alert('You need an active membership plan to send interests. Please upgrade your plan from the Membership page.');
      } else {
        alert(err instanceof Error ? err.message : 'Interest could not be sent.');
      }
    } finally {
      setBusyId('');
    }
  };

  const handleResetFilters = () => {
    setKeyword('');
    setGenderFilter('');
    setReligionFilter('');
    setLocationFilter('');
    setAgeMin('');
    setAgeMax('');
    setMaritalStatusFilter('');
    setMotherTongueFilter('');
    setEducationFilter('');
    setCasteFilter('');
    setCurrentPage(1);
    loadProfiles({}, 1, false);
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadProfiles(currentFilterParams(), 1, false);
  };

  const handleLoadMore = () => {
    loadProfiles(currentFilterParams(), currentPage + 1, true);
  };

  // Reusable Filter Form Content
  const renderFilterFormContent = (onApply?: () => void) => (
    <form onSubmit={(e) => { handleApplyFilters(e); onApply?.(); }} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Keyword Search</label>
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search name, job, city..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 pl-8 pr-3 text-slate-800 transition-all placeholder-slate-400 font-semibold"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold cursor-pointer transition-all"
        >
          <option value="">Opposite Gender (Default)</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="all">Universal (Show All)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Marital Status</label>
        <select
          value={maritalStatusFilter}
          onChange={(e) => setMaritalStatusFilter(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold cursor-pointer transition-all"
        >
          <option value="">Any Status</option>
          <option value="Single">Single</option>
          <option value="Never Married">Never Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
          <option value="Awaiting Divorced">Awaiting Divorced</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Religion</label>
        <input
          type="text"
          value={religionFilter}
          onChange={(e) => setReligionFilter(e.target.value)}
          placeholder="e.g. Hindu, Muslim, Christian"
          className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvancedFilters((visible) => !visible)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
      >
        <span>Advanced filters</span>
        <span className="text-rose-500">{showAdvancedFilters ? '−' : '+'}</span>
      </button>

      {/* Advanced Filters */}
      {showAdvancedFilters && <div className="relative">
        <div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Caste</label>
            <input
              type="text"
              value={casteFilter}
              onChange={(e) => setCasteFilter(e.target.value)}
              placeholder="e.g. Nair, General, Brahmin"
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mother Tongue</label>
            <input
              type="text"
              value={motherTongueFilter}
              onChange={(e) => setMotherTongueFilter(e.target.value)}
              placeholder="e.g. Hindi, Punjabi, Tamil"
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Education</label>
            <input
              type="text"
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              placeholder="e.g. B.Tech, MBA, MBBS"
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Work Location</label>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="e.g. Mumbai, Bangalore"
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-display">Age Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                placeholder="Min"
                min="18"
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
              />
              <input
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                placeholder="Max"
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:outline-none rounded-xl text-xs sm:text-sm py-2.5 px-3 text-slate-800 font-semibold transition-all placeholder-slate-400"
              />
            </div>
          </div>
        </div>

      </div>}

      <button
        type="submit"
        className="w-full py-3 sm:py-3.5 mt-4 bg-gradient-to-r from-rose-500 via-[#8e3d58] to-[#2b101d] text-white text-xs sm:text-sm font-extrabold rounded-xl hover:opacity-95 shadow-md shadow-rose-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Search className="w-4 h-4" /> Apply Filters
      </button>
    </form>
  );

  return (
    <div className="min-h-[100svh] bg-[#fcfaf9] pb-16 pt-24 sm:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-[#a13a59]">Curated for you</p>
            <h1 className="font-display text-2xl font-black tracking-tight text-[#351320] sm:text-3xl lg:text-4xl">
              Discover people with intention
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Explore profiles at your pace and connect when it feels right.
            </p>
          </div>
          {totalCount > 0 && !loading && (
            <div className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
              Showing <span className="text-rose-600 font-black">{profilesList.length}</span> of {totalCount} matches
            </div>
          )}
        </div>

        {/* Mobile & Tablet Action Bar (< lg) */}
        <div className="lg:hidden mb-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(e); }}
                placeholder="Search name, job, city..."
                className="w-full bg-white border border-slate-200 focus:border-rose-400 focus:outline-none rounded-2xl text-xs sm:text-sm py-3 pl-9 pr-3 text-slate-800 shadow-xs font-semibold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs hover:bg-slate-50 transition-all shrink-0 active:scale-95 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-rose-500" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Active:</span>
              {genderFilter && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                  {genderFilter}
                </span>
              )}
              {maritalStatusFilter && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                  {maritalStatusFilter}
                </span>
              )}
              {religionFilter && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                  {religionFilter}
                </span>
              )}
              {locationFilter && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                  {locationFilter}
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-extrabold text-rose-600 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
          
          {/* Desktop Sidebar Filters (lg+) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block bg-white rounded-3xl border border-slate-100 p-6 shadow-xs sticky top-24 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <SlidersHorizontal className="w-4 h-4 text-rose-500" />
                <span>Search Filters</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>

            {renderFilterFormContent()}
          </motion.div>

          {/* Mobile Filter Slide-Over Drawer (< lg) */}
          <AnimatePresence>
            {mobileFiltersOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileFiltersOpen(false)}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 lg:hidden"
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="fixed inset-x-0 bottom-0 top-16 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col lg:hidden overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-2.5 font-extrabold text-slate-900 text-base">
                      <SlidersHorizontal className="w-5 h-5 text-rose-500" />
                      <span>Filter Matches</span>
                      {activeFilterCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
                          {activeFilterCount} active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileFiltersOpen(false)}
                        className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 pb-24">
                    {renderFilterFormContent(() => setMobileFiltersOpen(false))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Profiles Grid */}
          <div className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
                <p className="text-slate-400 text-sm font-semibold">Finding perfect matches...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-800 rounded-3xl p-6 text-center border border-red-100">
                {error}
              </div>
            ) : profilesList.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
                <p className="text-slate-500 text-sm font-bold">No approved profiles match your filter options.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 px-6 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all cursor-pointer border border-rose-200"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {profilesList.map((profile) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xs overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                    >
                      <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                        <SmartImage
                          src={profile.photo}
                          alt={profile.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        />
                        {profile.photoVisibility === 'pending_approval' ? (
                          <div className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-900/80 px-3 py-2 text-center text-xs font-bold text-white backdrop-blur-xs">
                            Photo pending approval
                          </div>
                        ) : null}
                        {isOnline(profile.id) && (
                          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs" title="Online now" />
                        )}
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs text-xs font-black text-rose-600 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-rose-500 stroke-none" /> {profile.compatibility}%
                        </div>
                        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                          {profile.verified && (
                            <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">Verified</span>
                          )}
                          {profile.premium && (
                            <span className="bg-amber-500 text-slate-900 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">Premium</span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 truncate mb-1">
                            {profile.name}, {profile.age}
                          </h3>
                          <p className="text-slate-500 text-xs font-bold mb-3 flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {profile.location}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            <span className="text-[10px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-100">
                              {profile.religion}
                            </span>
                            <span className="text-[10px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-100 truncate max-w-[130px]">
                              {profile.occupation}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed mb-4 font-medium">
                            {profile.about}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3.5">
                          <Link
                            to={`/profile/${profile.id}`}
                            className="flex-1 text-center py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-extrabold transition-all border border-slate-200 active:scale-95"
                          >
                            View Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => expressInterest(profile.id)}
                            disabled={busyId === profile.id}
                            className="w-10 h-10 shrink-0 rounded-xl bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 transition-all border border-rose-200 flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Send Interest"
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMessageTermsProfile(profile)}
                            className="w-10 h-10 shrink-0 rounded-xl bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 transition-all border border-rose-200 flex items-center justify-center active:scale-95 cursor-pointer"
                            title="Direct Message"
                          >
                            <MessageCircle className="w-4 h-4 fill-none" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="text-center pt-6">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-8 py-3.5 bg-gradient-to-r from-rose-500 via-[#8e3d58] to-[#2b101d] text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-lg shadow-rose-200 hover:opacity-95 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2 justify-center">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Loading Matches...
                        </span>
                      ) : (
                        `Load More (${totalCount - profilesList.length} remaining)`
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>

        {messageTermsProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-6 shadow-2xl sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50">
                <ShieldCheck className="h-5 w-5 text-[#c43d63]" />
              </div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#b54a6a]">A safer conversation</p>
              <h2 className="mb-2 text-xl font-black text-[#35212b]">Keep it thoughtful and private</h2>
              <p className="mb-5 text-sm leading-relaxed text-slate-500">Start with a respectful conversation here. Share personal details only when you feel comfortable.</p>
              <div className="mb-5 space-y-2.5 rounded-2xl border border-rose-100 bg-[#fff8fa] p-4 text-xs font-medium text-[#604452]">
                <p className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Be kind and communicate with respect.</p>
                <p className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Keep contact, payment, and private information protected.</p>
              </div>
              <p className="mb-5 text-[11px] leading-relaxed text-slate-400">My Dear Partner is not responsible for information shared or arrangements made outside the platform. Please use your own judgement and stay safe.</p>
              <div className="flex gap-3 mt-6 justify-end">
                <button
                  type="button"
                  onClick={() => setMessageTermsProfile(null)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <Link
                  to={`/messages?user=${messageTermsProfile.id}`}
                  state={{ profile: messageTermsProfile }}
                  className="inline-flex items-center justify-center rounded-xl bg-[#b63d61] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-200 transition-colors hover:bg-[#972e4d]"
                >
                  Continue to chat
                </Link>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
