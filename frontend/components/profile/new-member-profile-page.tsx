'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UserRound, ShieldCheck, Crown, MapPin, Briefcase,
  ChevronRight, ChevronLeft, Camera, CheckCircle2,
  Mail, Smartphone, BookOpen, Compass, Check, X, Eye,
  Users, Lock, Heart, GraduationCap, ArrowRight, Trash2,
  Home, Phone,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfileImage from '@/components/profile/ProfileImage';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { useMembership } from '@/components/member/membership-provider';
import { fetchApi } from '@/legacy/services/apiClient';
import { fetchInterestStats } from '@/lib/interest-stats';
import { useDeletePhotoMutation, type MemberPhoto } from '@/legacy/services/photoApi';

/* ── helpers ─────────────────────────────────────── */

function DisplayValue({ value, fallback = 'Not specified' }: { value?: any; fallback?: string }) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return <span className="font-bold text-slate-800 text-xs sm:text-sm">{String(value)}</span>;
  }
  return <span className="text-slate-400 font-normal italic text-xs">{fallback}</span>;
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() || 'draft';
  const isApproved = s === 'approved';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
        isApproved
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
          : 'bg-amber-50 text-amber-700 border border-amber-200/80'
      }`}
    >
      {isApproved ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {isApproved ? 'Approved' : 'Under Review'}
    </span>
  );
}

/* ── main component ──────────────────────────────── */

export default function NewMemberProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { membershipSummary } = useMembership();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'personal' | 'religion' | 'career' | 'family' | 'preferences' | 'photos'
  >('overview');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletePhoto] = useDeletePhotoMutation();

  const [stats, setStats] = useState({
    interestsReceived: 0,
    interestsSent: 0,
    mutualMatches: 0,
    visitors: 0,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }
    let active = true;

    fetchApi<any>('/member-auth/me/')
      .then((data) => {
        if (active) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (active) {
          setError(err?.message || 'Failed to load profile.');
          setLoading(false);
        }
      });

    fetchInterestStats()
      .then((s) => {
        if (!active) return;
        setStats((prev) => ({
          ...prev,
          interestsReceived: s.received,
          interestsSent: s.sent,
          mutualMatches: s.accepted,
        }));
      })
      .catch(() => {});

    fetchApi<any>('/visitors/')
      .then((res) => {
        if (!active) return;
        const count = res?.total_unique_visitors ?? (Array.isArray(res?.results) ? res.results.length : 0);
        setStats((prev) => ({ ...prev, visitors: count }));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const count = profile?.photos?.length || 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight' && count > 1) setLightboxIndex((p) => (p !== null ? (p + 1) % count : 0));
      else if (e.key === 'ArrowLeft' && count > 1) setLightboxIndex((p) => (p !== null ? (p - 1 + count) % count : 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, profile?.photos]);

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId).unwrap();
      setProfile((prev: any) => ({
        ...prev,
        photos: (prev?.photos || []).filter((ph: any) => ph.id !== photoId),
      }));
    } catch {
      alert('Failed to delete photo.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-rose-100 border-t-[#e11d48] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center space-y-4 shadow-sm max-w-sm w-full">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mx-auto text-[#e11d48]">
            <X className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-900">Profile Unavailable</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl bg-[#e11d48] text-white text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const p = profile || {};
  const photos: MemberPhoto[] = p.photos || [];
  const primaryPhoto = photos.find((ph) => ph.is_primary) || photos[0];
  const displayName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || user?.full_name || 'Member Account';
  const profileId = p.profile_id || p.member_id || (user?.id ? `MDP-${user.id.slice(0, 6).toUpperCase()}` : 'MDP-MEMBER');
  const isPremium = Boolean(user?.is_premium || p.is_premium || (membershipSummary?.has_active_plan && !membershipSummary?.is_free));
  const planName = membershipSummary?.plan_name || (isPremium ? 'Premium' : 'Free Member');
  const completion = p.completion_percentage ?? 80;
  const remainingConnects = membershipSummary?.daily_profile_unlocks_remaining;
  const totalLimit = membershipSummary?.daily_profile_unlock_limit;
  const connects = remainingConnects != null
    ? (totalLimit ? `${remainingConnects} / ${totalLimit} left today` : `${remainingConnects} left today`)
    : totalLimit != null
      ? (totalLimit >= 999 ? 'Unlimited' : `${totalLimit} / day`)
      : (isPremium ? 'Unlimited' : '10 / day');

  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'personal',     label: 'Basic Details & Bio' },
    { id: 'religion',     label: 'Religion & Horoscope' },
    { id: 'career',       label: 'Education & Career' },
    { id: 'family',       label: 'Family Details' },
    { id: 'preferences',  label: 'Partner Preferences' },
    { id: 'photos',       label: `Photos (${photos.length})` },
  ];

  return (
    <div className="min-h-full bg-[#fafafa] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Breadcrumb Navigation ── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#e11d48]">
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">My Profile</span>
        </nav>

        {/* ── 1. Profile Snapshot Card ── */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
          {/* Top brand accent border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#e11d48]" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-1">
            {/* Left: Avatar & Identity Details */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div
                  onClick={() => photos.length > 0 ? setLightboxIndex(0) : router.push('/profile/photos')}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer group transition-transform duration-200 hover:scale-[1.02] border-2 ${
                    isPremium
                      ? 'border-[#e11d48]/50 ring-2 ring-rose-100 shadow-sm bg-rose-50/50'
                      : 'border-rose-100 bg-rose-50'
                  }`}
                  title="Click to view photos"
                >
                  {primaryPhoto?.thumbnail_url || user?.photo ? (
                    <img
                      src={primaryPhoto?.thumbnail_url || user?.photo}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#e11d48] text-2xl font-bold">
                      {displayName[0] || 'M'}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Manage Photos Camera Button */}
                <Link
                  href="/profile/photos"
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-[#e11d48] transition-colors"
                  title="Manage Photos"
                >
                  <Camera className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Verified
                  </span>
                </div>

                {/* Meta Chips */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                  <span className="font-mono font-medium text-slate-600">{profileId}</span>
                  <span className="text-slate-300">•</span>
                  <span className={`font-semibold inline-flex items-center gap-1 ${isPremium ? 'text-[#e11d48]' : 'text-slate-700'}`}>
                    {isPremium && <Crown className="w-3.5 h-3.5 text-[#e11d48]" />}
                    {planName}
                  </span>
                  {(user?.email || p.email) && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        {user?.email || p.email}
                      </span>
                    </>
                  )}
                  {(user?.mobile_number || p.mobile) && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        {user?.mobile_number || p.mobile}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">

              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#e11d48] hover:bg-rose-700 transition-colors shadow-xs"
              >
                <UserRound className="w-3.5 h-3.5 text-white" />
                <span>Edit Profile</span>
              </Link>
              <Link
                href="/profile/photos"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-[#e11d48]" />
                <span>Photos ({photos.length})</span>
              </Link>
              <Link
                href="/membership"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-200 bg-rose-50/80 text-[#e11d48] hover:bg-rose-100/80 transition-colors"
              >
                <Crown className="w-3.5 h-3.5 text-[#e11d48]" />
                <span>{isPremium ? 'Manage Plan' : 'Upgrade Plan'}</span>
              </Link>
            </div>
          </div>

          {/* Bottom Strip: 4 Key Account/Profile Status Metrics */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ACCOUNT STATUS</p>
              <p className="mt-1 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Profile
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VISIBILITY</p>
              <p className="mt-1 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#e11d48]" />
                Visible to Matches
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DAILY CONNECTS</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{connects}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PROFILE STRENGTH</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">{completion}%</span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#e11d48] rounded-full transition-all duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. SECTION HEADER & TAB NAV PILLS
        ══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              PROFILE DETAILS
            </h2>
            <span className="text-xs text-slate-400 font-medium">• 6 sections</span>
          </div>

          {/* Filter Pills */}
          <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#e11d48] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            4. DETAILED TAB CONTENT PANELS
        ══════════════════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* ── Basic Details & Bio ── */}
          {(activeTab === 'overview' || activeTab === 'personal') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <UserRound className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Basic Details &amp; Bio</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PERSONAL ATTRIBUTES</p>
                  </div>
                </div>
                <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline flex items-center gap-1">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Bio snippet */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">About Myself</p>
                {p.about ? (
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    "{p.about}"
                  </p>
                ) : (
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-center space-y-1">
                    <p className="text-xs font-medium text-slate-400">No introduction added yet.</p>
                    <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline">+ Write About Yourself</Link>
                  </div>
                )}
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Age</span>
                  <DisplayValue value={p.age ? `${p.age} Yrs` : undefined} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Gender</span>
                  <DisplayValue value={p.gender} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Marital Status</span>
                  <DisplayValue value={p.marital_status} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Height</span>
                  <DisplayValue value={p.height} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Mother Tongue</span>
                  <DisplayValue value={p.mother_tongue} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Weight</span>
                  <DisplayValue value={p.weight} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Blood Group</span>
                  <DisplayValue value={p.blood_group} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Location</span>
                  <DisplayValue value={p.city || p.work_location || p.location} />
                </div>
              </div>

              {p.hobbies && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hobbies &amp; Interests</span>
                  <p className="text-xs font-semibold text-slate-800">
                    {Array.isArray(p.hobbies) ? p.hobbies.join(', ') : p.hobbies}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Religion & Horoscope ── */}
          {(activeTab === 'overview' || activeTab === 'religion') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <Compass className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Religion &amp; Horoscope</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ASTROLOGICAL &amp; COMMUNITY</p>
                  </div>
                </div>
                <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline flex items-center gap-1">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Religion</span>
                  <DisplayValue value={p.religion} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Caste</span>
                  <DisplayValue value={p.caste} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Sub-Caste</span>
                  <DisplayValue value={p.sub_caste} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Gothra</span>
                  <DisplayValue value={p.gothra} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Star / Nakshatra</span>
                  <DisplayValue value={p.star_nakshatra} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Raasi / Moon Sign</span>
                  <DisplayValue value={p.raasi} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Manglik / Dosham</span>
                  <DisplayValue value={p.dosham || p.manglik} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Time of Birth</span>
                  <DisplayValue value={p.birth_time} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Birth Place</span>
                  <DisplayValue value={p.birth_city || p.birth_place} />
                </div>
              </div>
            </div>
          )}

          {/* ── Education & Career ── */}
          {(activeTab === 'overview' || activeTab === 'career') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <Briefcase className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Education &amp; Career</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PROFESSIONAL DETAILS</p>
                  </div>
                </div>
                <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline flex items-center gap-1">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Highest Degree</span>
                  <DisplayValue value={p.highest_education} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Education Detail</span>
                  <DisplayValue value={p.education_detail} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Occupation</span>
                  <DisplayValue value={p.occupation} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Employed In</span>
                  <DisplayValue value={p.employed_in} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Company / Org</span>
                  <DisplayValue value={p.company} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Annual Income</span>
                  <DisplayValue value={p.annual_income ? `₹${p.annual_income}` : undefined} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Work Location</span>
                  <DisplayValue value={p.work_location} />
                </div>
              </div>
            </div>
          )}

          {/* ── Family & Heritage ── */}
          {(activeTab === 'overview' || activeTab === 'family') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Family &amp; Heritage</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FAMILY BACKGROUND</p>
                  </div>
                </div>
                <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline flex items-center gap-1">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Father's Occupation</span>
                  <DisplayValue value={p.father_status} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Mother's Occupation</span>
                  <DisplayValue value={p.mother_status} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Family Type</span>
                  <DisplayValue value={p.family_type} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Family Values</span>
                  <DisplayValue value={p.family_values} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Brothers</span>
                  <DisplayValue value={p.num_brothers} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Sisters</span>
                  <DisplayValue value={p.num_sisters} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Family Location / Native</span>
                  <DisplayValue value={p.family_location} />
                </div>
              </div>
            </div>
          )}

          {/* ── Partner Preferences ── */}
          {(activeTab === 'overview' || activeTab === 'preferences') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <Heart className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Partner Preferences</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MATCHING CRITERIA</p>
                  </div>
                </div>
                <Link href="/profile/edit" className="text-xs font-bold text-[#e11d48] hover:underline flex items-center gap-1">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Age</span>
                  <DisplayValue
                    value={p.pref_age_min || p.pref_age_max ? `${p.pref_age_min || 18} - ${p.pref_age_max || 60} Yrs` : undefined}
                  />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Height</span>
                  <DisplayValue
                    value={p.pref_height_min || p.pref_height_max ? `${p.pref_height_min || 'Any'} - ${p.pref_height_max || 'Any'}` : undefined}
                  />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Religion</span>
                  <DisplayValue value={p.pref_religion} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Caste</span>
                  <DisplayValue value={p.pref_caste} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Education</span>
                  <DisplayValue value={p.pref_education} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Location</span>
                  <DisplayValue value={p.pref_location} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preferred Occupation</span>
                  <DisplayValue value={p.pref_occupation} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Marital Status</span>
                  <DisplayValue value={p.pref_marital_status} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Dietary Preference</span>
                  <DisplayValue value={p.pref_diet} />
                </div>
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">About Ideal Partner</span>
                  <DisplayValue value={p.pref_about} />
                </div>
              </div>
            </div>
          )}

          {/* ── Photo Gallery Section ── */}
          {(activeTab === 'overview' || activeTab === 'photos') && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#e11d48]">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">My Photos ({photos.length})</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PHOTO GALLERY</p>
                  </div>
                </div>
                <Link
                  href="/profile/photos"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 text-[#e11d48] text-xs font-bold hover:bg-rose-100 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>+ Upload Photos</span>
                </Link>
              </div>

              {photos.length === 0 ? (
                <div className="text-center py-8 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Camera className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No photos uploaded yet.</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Profiles with verified photos receive up to 5× more interest requests.
                  </p>
                  <Link
                    href="/profile/photos"
                    className="inline-block mt-2 px-4 py-2 rounded-xl bg-[#e11d48] text-white text-xs font-bold hover:bg-rose-700 transition"
                  >
                    Upload Photo Now
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {photos.map((ph, idx) => (
                    <div
                      key={ph.id}
                      onClick={() => setLightboxIndex(idx)}
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-[#e11d48] transition-all shadow-xs"
                      title="Click to view"
                    >
                      <ProfileImage
                        photoId={ph.id}
                        src={ph.thumbnail_url}
                        variant="thumbnail"
                        alt=""
                        size="md"
                        shape="square"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />

                      {/* Primary badge */}
                      {ph.is_primary && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
                          Primary
                        </span>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Eye className="w-5 h-5 text-white" />
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(ph.id);
                        }}
                        disabled={deletingId === ph.id}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-700 cursor-pointer shadow-sm z-10"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* ── Lightbox Modal ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {lightboxIndex !== null && photos[lightboxIndex] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
              onClick={() => setLightboxIndex(null)}
            >
              {/* Top Bar */}
              <div
                className="w-full max-w-3xl flex items-center justify-between px-5 py-3 rounded-2xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-md mb-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-white">{displayName}</span>
                  {photos[lightboxIndex].is_primary && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase">
                      Primary
                    </span>
                  )}
                  <StatusBadge status={photos[lightboxIndex].status || p.photo_status} />
                </div>

                <div className="flex items-center gap-3">
                  {photos.length > 1 && (
                    <span className="text-xs font-semibold text-slate-400">
                      {lightboxIndex + 1} / {photos.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Photo Display */}
              <div
                className="relative flex items-center justify-center max-w-full my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {photos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((prev) => (prev !== null ? (prev - 1 + photos.length) % photos.length : 0))}
                    className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition cursor-pointer z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                <div className="max-h-[75vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl border border-white/10">
                  <img
                    src={photos[lightboxIndex].image_url || photos[lightboxIndex].thumbnail_url || ''}
                    alt=""
                    className="max-h-[75vh] max-w-[90vw] object-contain"
                  />
                </div>

                {photos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((prev) => (prev !== null ? (prev + 1) % photos.length : 0))}
                    className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition cursor-pointer z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
