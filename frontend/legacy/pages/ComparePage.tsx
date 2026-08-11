// Side-by-Side Profile Comparison Page
'use client';

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { 
  Heart, Check, Star, Scale, User, ChevronDown, ShieldCheck, 
  ChevronRight, BookOpen, Briefcase, 
  DollarSign, MapPin, Users, Calendar, Ruler
} from 'lucide-react';
import { checkCompatibility, getProfile, getShortlists, sendInterest } from '../services/dataService';
import { fetchApi } from '../services/apiClient';
import type { Profile } from '../types/domain';
import SmartImage from '@/components/shared/smart-image';
import FeedMatchCard from '@/components/shared/feed-match-card';

// Map a raw API user to Profile shape (same logic as dataService.ts profileFromWire)
function wireToProfile(user: any): Profile {
  const photoUrl =
    user.photo ||
    user.image_url ||
    user.thumbnail_url ||
    user.profile_photo ||
    user.primary_photo?.url ||
    user.primary_photo?.download_url ||
    user.primary_photo?.image_url ||
    user.primary_photo?.thumbnail_url ||
    (Array.isArray(user.photos) && (user.photos[0]?.url || user.photos[0]?.download_url || user.photos[0]?.image_url || user.photos[0]?.thumbnail_url)) ||
    (Array.isArray(user.profile_photos) && (user.profile_photos[0]?.url || user.profile_photos[0]?.download_url || user.profile_photos[0]?.image_url || user.profile_photos[0]?.thumbnail_url)) ||
    '';

  return {
    id: user.id,
    name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Member',
    age: user.age || 0,
    height: user.height || 'Not specified',
    religion: user.religion || 'Not specified',
    caste: user.caste || 'Not specified',
    education: user.highest_education || 'Not specified',
    occupation: user.occupation || 'Not specified',
    income: user.annual_income || 'Not specified',
    location: user.work_location || 'Not specified',
    photo: photoUrl,
    verified: Boolean(user.is_verified),
    premium: Boolean(user.is_premium),
    compatibility: Number(user.compatibility_score || user.compatibility || 0),
    about: user.about || '',
    familyType: user.family_type || 'Not specified',
    motherTongue: user.mother_tongue || 'Not specified',
    maritalStatus: user.marital_status || 'Not specified',
    hobbies: Array.isArray(user.hobbies) ? user.hobbies : [],
    partnerPrefs: user.pref_about || 'Not specified',
    chat_public_key: user.chat_public_key,
    is_unlocked: true,
  };
}

interface CompareRow {
  key: string;
  label: string;
  category: 'BASIC' | 'CULTURE' | 'CAREER' | 'LIFESTYLE';
  icon: any;
  format?: (v: any) => string;
}

const COMPARE_CATEGORIES = [
  { id: 'BASIC', label: 'Basic Profile & Physicals', icon: User },
  { id: 'CULTURE', label: 'Faith & Community', icon: ShieldCheck },
  { id: 'CAREER', label: 'Career & Financials', icon: Briefcase },
  { id: 'LIFESTYLE', label: 'Location & Family Structure', icon: MapPin },
];

const COMPARE_ROWS: CompareRow[] = [
  { key: 'age', label: 'Age', category: 'BASIC', icon: Calendar, format: (v: any) => v ? `${v} years` : '—' },
  { key: 'height', label: 'Height', category: 'BASIC', icon: Ruler },
  { key: 'maritalStatus', label: 'Marital Status', category: 'BASIC', icon: User },
  { key: 'religion', label: 'Religion', category: 'CULTURE', icon: Star },
  { key: 'caste', label: 'Caste', category: 'CULTURE', icon: ShieldCheck },
  { key: 'motherTongue', label: 'Mother Tongue', category: 'CULTURE', icon: ShieldCheck },
  { key: 'education', label: 'Highest Education', category: 'CAREER', icon: BookOpen },
  { key: 'occupation', label: 'Profession', category: 'CAREER', icon: Briefcase },
  { key: 'income', label: 'Annual Income', category: 'CAREER', icon: DollarSign },
  { key: 'location', label: 'Work City', category: 'LIFESTYLE', icon: MapPin },
  { key: 'familyType', label: 'Family Type', category: 'LIFESTYLE', icon: Users },
];

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const requestedCandidateId = searchParams.get('candidate');
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [shortlistedCandidates, setShortlistedCandidates] = useState<Profile[]>([]);
  const [profileB, setProfileB] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchCandidatePhoto = async (prof: Profile): Promise<Profile> => {
    if (prof.photo && !prof.photo.includes('placeholder') && !prof.photo.includes('favicon.svg')) {
      return prof;
    }
    try {
      const detail = await fetchApi<any>(`/profiles/${prof.id}/`);
      const wire = detail?.profile || detail;
      const photoUrl = wireToProfile(wire).photo;
      if (photoUrl) {
        return { ...prof, photo: photoUrl };
      }
    } catch {
      // Photo fetch is optional
    }
    return prof;
  };

  const withCompatibility = async (profile: Profile | null | undefined) => {
    if (!profile) return null;
    const fullProfile = await fetchCandidatePhoto(profile);
    try {
      const result = await checkCompatibility({ member_id: fullProfile.id });
      return { ...fullProfile, compatibility: Number(result.compatibility ?? fullProfile.compatibility ?? 0) };
    } catch {
      return fullProfile;
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        // Load my own profile from /member-auth/me/
        const me = await fetchApi<any>('/member-auth/me/');
        const myProf = wireToProfile(me);

        // Fetch my profile photo explicitly if missing or default
        if (!myProf.photo || myProf.photo.includes('favicon.svg') || myProf.photo.includes('placeholder')) {
          try {
            const myPhotos = await fetchApi<any>('/profile-photos/');
            const photoList = Array.isArray(myPhotos) ? myPhotos : (myPhotos?.photos || myPhotos?.results || []);
            const primaryPhoto = photoList.find((p: any) => p.is_primary) || photoList[0];
            if (primaryPhoto) {
              const photoPath = primaryPhoto.image_url || primaryPhoto.thumbnail_url || primaryPhoto.url;
              if (photoPath) {
                myProf.photo = photoPath;
              }
            }
          } catch (err) {
            console.warn('Could not fetch self photo from /profile-photos/:', err);
          }
        }
        setMyProfile(myProf);

        // Load shortlisted candidates
        const sl = await getShortlists().catch(() => ({ count: 0, results: [] }));
        const shortlisted = sl.results || [];
        setShortlistedCandidates(shortlisted);

        let selected = requestedCandidateId
          ? shortlisted.find((profile) => profile.id === requestedCandidateId)
          : undefined;

        if (!selected && requestedCandidateId) {
          try {
            selected = await getProfile(requestedCandidateId);
          } catch (err) {
            console.error('Failed to fetch requested candidate directly:', err);
          }
        }

        if (selected) {
          setProfileB(await withCompatibility(selected));
        } else if (shortlisted.length > 0) {
          setProfileB(await withCompatibility(shortlisted[0]));
        }
      } catch (err) {
        console.error('ComparePage init error', err);
        setLoadError('Profiles could not be loaded. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [requestedCandidateId]);

  const handleSelectB = async (id: string) => {
    setProfileB(await withCompatibility(shortlistedCandidates.find((p) => p.id === id)));
    setInterestSent(false);
  };

  const handleSendInterest = async () => {
    if (!profileB) return;
    setSendingInterest(true);
    try {
      await sendInterest(profileB.id);
      setInterestSent(true);
    } catch (err: any) {
      const isMembershipError =
        err?.code === 'MEMBERSHIP_REQUIRED' ||
        err?.errors?.code === 'MEMBERSHIP_REQUIRED' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('membership plan')) ||
        (err?.status === 403 && !err?.message?.toLowerCase()?.includes?.('csrf'));
      if (err?.status === 409) {
        setInterestSent(true);
      } else if (isMembershipError) {
        alert('You need an active membership plan to send interests. Please upgrade your plan from the Membership page.');
      } else {
        alert('Could not send interest. Please try again.');
      }
    } finally {
      setSendingInterest(false);
    }
  };

  const isMatch = (valA: any, valB: any) => {
    if (!valA || !valB || valA === 'Not specified' || valB === 'Not specified') return false;
    return String(valA).trim().toLowerCase() === String(valB).trim().toLowerCase();
  };

  const activeCandidates = shortlistedCandidates;



  if (loading) {
    return (
      <div className="min-h-screen pt-36 flex flex-col items-center justify-center bg-[#fdf8f5]">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#e11d48] border-t-transparent mb-4" />
        <p className="text-sm font-bold text-[#e11d48]">Loading Profile Comparison...</p>
      </div>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#fcfaf9] pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Simple & Clean Header Bar */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-[1.75rem] border border-rose-100 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(91,23,53,.42)] md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-[#e11d48] text-xs font-bold mb-2">
              <Scale className="w-3.5 h-3.5 text-[#e11d48]" />
              <span>Connection overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#230914] tracking-tight">
              Compare with clarity
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-gray-500 mt-0.5">
              See what matters most, side by side.
            </p>
          </div>

          {/* Integrated Candidate Switcher Dropdown & Interest CTA */}
          {activeCandidates.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <select
                  value={profileB?.id ?? ''}
                  onChange={(e) => handleSelectB(e.target.value)}
                  className="w-full bg-rose-50/50 hover:bg-rose-50 border border-rose-200 text-gray-900 px-4 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#e11d48]/20 focus:border-[#e11d48] transition-all appearance-none cursor-pointer pr-9"
                >
                  <option value="">Switch candidate...</option>
                  {activeCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age} yrs, {p.location})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#e11d48] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {profileB && (
                <button
                  onClick={handleSendInterest}
                  disabled={sendingInterest || interestSent}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer shrink-0 ${
                    interestSent
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                      : 'bg-[#e11d48] hover:bg-[#743047] text-white shadow-xs'
                  }`}
                >
                  {interestSent ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-600" /> Interest Sent</>
                  ) : sendingInterest ? (
                    'Sending...'
                  ) : (
                    <><Heart className="w-3.5 h-3.5 fill-white" /> Express Interest</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {loadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 shadow-sm">
            {loadError}
          </div>
        )}

        {/* Comparison Content */}
        {myProfile && profileB ? (
          <>
            {/* Side-by-Side Profile Cards */}
            <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {[
                  { profile: myProfile, label: 'You (My Profile)', isMe: true },
                  { profile: profileB, label: `Candidate (${profileB.name})`, isMe: false }
                ].map(({ profile, label, isMe }, index) => (
                  <div key={profile.id} className="flex flex-col items-center">
                    {/* Slot Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-100 text-[#e11d48] text-xs font-bold mb-4">
                      <span className={`w-2 h-2 rounded-full ${isMe ? 'bg-emerald-500' : 'bg-[#e11d48]'}`}></span>
                      {label}
                    </div>

                    <FeedMatchCard 
                      profile={profile} 
                      showActions={false} 
                      className="w-full max-w-sm" 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Categorized Attribute Comparison Table */}
            <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] bg-rose-50/70 border-b border-rose-100 px-6 py-3.5 items-center">
                <div className="text-sm font-black text-[#e11d48] text-right pr-4 sm:pr-8">{myProfile.name}</div>
                <div className="px-3.5 py-1 rounded-full bg-white border border-rose-200 text-[11px] font-black text-[#e11d48] uppercase tracking-wider text-center">
                  ATTRIBUTE COMPARISON
                </div>
                <div className="text-sm font-black text-[#e11d48] pl-4 sm:pl-8">{profileB.name}</div>
              </div>

              <div className="divide-y divide-rose-50">
                {COMPARE_CATEGORIES.map((cat) => {
                  const catRows = COMPARE_ROWS.filter((r) => r.category === cat.id);
                  const CatIcon = cat.icon;

                  return (
                    <div key={cat.id}>
                      {/* Category Header */}
                      <div className="bg-rose-50/40 px-6 py-2 flex items-center justify-center gap-2 border-y border-rose-100/60 text-xs font-bold uppercase tracking-wider text-[#e11d48]">
                        <CatIcon className="w-3.5 h-3.5 text-[#e11d48]" />
                        <span>{cat.label}</span>
                      </div>

                      {/* Category Rows */}
                      {catRows.map((row, i) => {
                        const valA = (myProfile as any)[row.key];
                        const valB = (profileB as any)[row.key];
                        const matched = isMatch(valA, valB);
                        const displayA = row.format ? row.format(valA) : (valA || '—');
                        const displayB = row.format ? row.format(valB) : (valB || '—');
                        const RowIcon = row.icon;

                        return (
                          <div
                            key={row.key}
                            className={`grid grid-cols-[1fr_auto_1fr] px-4 sm:px-6 py-3.5 items-center transition-colors ${
                              matched ? 'bg-emerald-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-rose-50/10'
                            }`}
                          >
                            <div className={`text-xs sm:text-sm text-right pr-4 sm:pr-8 font-bold ${matched ? 'text-emerald-900' : 'text-gray-800'}`}>
                              {displayA}
                            </div>

                            <div className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-[110px]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center flex items-center gap-1">
                                <RowIcon className="w-3 h-3 text-[#e11d48]" />
                                {row.label}
                              </span>
                              {matched && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 mt-0.5">
                                  <Check className="w-3 h-3 text-emerald-600" /> Match
                                </span>
                              )}
                            </div>

                            <div className={`text-xs sm:text-sm pl-4 sm:pl-8 font-bold ${matched ? 'text-emerald-900' : 'text-gray-800'}`}>
                              {displayB}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hobbies Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[{ profile: myProfile, isMe: true }, { profile: profileB, isMe: false }].map(({ profile, isMe }) => (
                <div key={profile.id} className="bg-white rounded-3xl border border-rose-100 p-6 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#e11d48] mb-3 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 fill-[#e11d48] text-[#e11d48]" />
                    {profile.name}'s Hobbies & Interests
                  </h3>
                  {profile.hobbies && profile.hobbies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.hobbies.map((h, index) => {
                        const isShared = (isMe ? profileB.hobbies : myProfile.hobbies)?.includes(h);
                        return (
                          <span
                            key={`${profile.id}-${h}-${index}`}
                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                              isShared
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50/60 text-[#e11d48] border-rose-100'
                            }`}
                          >
                            {isShared && '✨ '} {h}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs italic">No hobbies specified.</p>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Action Footer */}
            <div className="text-center pt-2 pb-6">
              <Link
                to={`/profile/${profileB.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#e11d48] hover:bg-[#743047] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                View Full Profile of {profileB.name}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-rose-100 p-12 text-center shadow-sm">
            <User className="w-12 h-12 text-[#e11d48]/40 mx-auto mb-3" />
            <p className="text-gray-700 font-bold text-sm">Select a candidate from your shortlist above to begin comparison.</p>
          </div>
        )}
      </div>
    </main>
  );
}
