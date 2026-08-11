'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Heart, ShieldCheck, Crown, MapPin, GraduationCap, Briefcase,
  Calendar, Ruler, Users, ChevronRight, Edit, Camera, CheckCircle2,
  XCircle, AlertTriangle, Trash2, Mail, Smartphone, BookOpen,
  Compass, KeyRound, Phone, Lock, Scale, Check, Home, Utensils
} from 'lucide-react';
import Link from 'next/link';
import ProfileImage from '@/components/profile/ProfileImage';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import { useDeletePhotoMutation, type MemberPhoto } from '@/legacy/services/photoApi';

function DisplayValue({ value, fallback = 'Not specified' }: { value?: any; fallback?: string }) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return <span className="font-extrabold text-gray-900">{value}</span>;
  }
  return <span className="text-gray-400 font-normal italic text-xs">{fallback}</span>;
}

function statusBadge(status: string) {
  const s = status?.toLowerCase() || 'draft';
  const isApproved = s === 'approved';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
      isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
    }`}>
      {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
      {isApproved ? 'Approved' : 'Under Review'}
    </span>
  );
}

export default function NewMemberProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'religion' | 'career' | 'family' | 'preferences'>('overview');
  const [deletePhoto] = useDeletePhotoMutation();

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId).unwrap();
      setProfile((prev: any) => ({
        ...prev,
        photos: (prev.photos || []).filter((ph: any) => ph.id !== photoId),
      }));
    } catch {
      setError('Failed to delete photo.');
    } finally {
      setDeletingId(null);
    }
  };

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
          setError(err?.message || 'Failed to load profile details.');
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf8f5] pt-28 pb-16 flex items-center justify-center">
        <div className="text-center font-bold text-xs text-[#e11d48] animate-pulse">
          Loading profile dashboard...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#fdf8f5] pt-28 pb-16 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-xs max-w-sm text-center space-y-4">
          <User className="w-12 h-12 text-[#e11d48] mx-auto" />
          <h2 className="text-lg font-black text-[#230914]">Access Required</h2>
          <p className="text-xs text-gray-500">Please sign in to view and manage your profile dashboard.</p>
          <Link href="/login" className="block w-full py-2.5 rounded-2xl bg-[#e11d48] text-white font-extrabold text-xs shadow-xs">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const p = profile;
  const photos: MemberPhoto[] = p.photos || [];
  const primaryPhoto = photos.find((ph) => ph.is_primary) || photos[0];
  const completion = p.completion_percentage ?? 85;
  const displayName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'My Profile';
  const profileId = p.profile_id || p.member_id || p.id;
  const profileLocation = p.work_location || p.location || p.city;

  const tabs = [
    { id: 'overview', label: 'Overview & About' },
    { id: 'personal', label: 'Basic Details' },
    { id: 'religion', label: 'Religion & Horoscope' },
    { id: 'career', label: 'Education & Career' },
    { id: 'family', label: 'Family Background' },
    { id: 'preferences', label: 'Partner Preferences' },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ffe9f0_0,_transparent_28%),linear-gradient(180deg,_#fff8fa_0%,_#f5f7fb_46%,_#fff_100%)] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Profile Dashboard Banner Card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4a1028] via-[#851c45] to-[#dd3d70] p-6 shadow-[0_28px_70px_-34px_rgba(107,20,57,0.85)] sm:p-9">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-rose-300/20 blur-3xl" />
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">

            {/* Circular Avatar Frame */}
            <div className="relative shrink-0">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-white/80 shadow-2xl overflow-hidden bg-rose-50">
                <ProfileImage
                  photoId={primaryPhoto?.id}
                  src={primaryPhoto?.thumbnail_url}
                  variant="thumbnail"
                  alt="Profile Avatar"
                  size="xl"
                  shape="circle"
                  className="w-full h-full object-cover"
                />
              </div>
              {p.is_fully_verified && (
                <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-white shadow-xs" title="Govt ID Verified">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              )}
            </div>

            {/* Main Header Info */}
            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{displayName}</h1>
                {p.is_premium ? (
                  <span className="px-3 py-0.5 rounded-full bg-amber-300 text-amber-950 border border-amber-200 text-xs font-black flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-600" /> Premium Member
                  </span>
                ) : (
                  <span className="px-3 py-0.5 rounded-full bg-white/15 text-white border border-white/25 text-xs font-bold">
                    Free Member
                  </span>
                )}
                {statusBadge(p.profile_status)}
              </div>

              {profileId && (
                <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold">
                  <span className="text-white bg-white/15 border border-white/25 px-3 py-1 rounded-full">
                    Profile ID: MDP-{String(profileId).slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-emerald-50 bg-emerald-500/25 border border-emerald-200/30 px-3 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> ID Verified
                  </span>
                </div>
              )}

              {/* Quick Info Tags */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-bold text-white">
                {p.age && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{p.age} Yrs</span>}
                {p.gender && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{p.gender}</span>}
                {p.marital_status && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{p.marital_status}</span>}
                {p.height && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{p.height}</span>}
                {p.religion && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{p.religion}</span>}
                {profileLocation && <span className="px-3 py-1 rounded-full bg-black/15 border border-white/15">{profileLocation}</span>}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <Link
                  href="/settings/profile"
                  className="px-5 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-[#a91d4c] font-extrabold text-xs transition-all shadow-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Profile
                </Link>
                <Link
                  href="/profile/photos"
                  className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-extrabold text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#e11d48]" /> Manage Photos ({photos.length})
                </Link>
                <Link
                  href="/settings/security"
                  className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-extrabold text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-gray-500" /> Privacy &amp; Security
                </Link>
              </div>
            </div>

          </div>

          {/* Profile Completeness Bar */}
          <div className="relative mt-7 rounded-2xl border border-white/15 bg-black/10 p-4 space-y-2 backdrop-blur-sm">
            <div className="flex justify-between items-center text-xs font-extrabold">
              <span className="text-rose-100 uppercase tracking-wider">Profile Completeness Score</span>
              <span className="text-white">{completion}%</span>
            </div>
            <div className="h-2.5 bg-black/20 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-gradient-to-r from-amber-300 to-rose-100 rounded-full transition-all duration-500" style={{ width: `${completion}%` }} />
            </div>
            {completion < 100 && (
              <div className="flex items-center justify-between text-xs font-semibold text-rose-100 pt-1">
                <span>Add education details, family background &amp; preferences to get 3x higher responses.</span>
                <Link href="/settings/profile" className="text-white font-black hover:underline shrink-0 ml-2">Complete Now &rarr;</Link>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="sticky top-0 z-30 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-md backdrop-blur-md flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#a91d4c] text-white shadow-lg shadow-rose-200'
                  : 'text-slate-600 hover:bg-rose-50 hover:text-[#a91d4c]'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Account Verifications & Photo Gallery Teaser */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Verification Widget */}
            <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2 border-b border-rose-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-[#e11d48]" /> Account Verifications
              </h2>

              <div className="space-y-3 text-xs font-bold">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> Email Address</span>
                  {p.is_email_verified ? (
                    <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                  ) : (
                    <Link href="/profile/edit" className="text-amber-700 font-extrabold hover:underline">Verify by OTP</Link>
                  )}
                </div>
                <div className="flex justify-between items-center py-1 border-t border-rose-50">
                  <span className="text-gray-500 flex items-center gap-2"><Smartphone className="w-4 h-4 text-gray-400" /> Mobile Number</span>
                  {p.is_mobile_verified ? (
                    <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                  ) : (
                    <Link href="/profile/edit" className="text-amber-700 font-extrabold hover:underline">Verify by OTP</Link>
                  )}
                </div>
                <div className="flex justify-between items-center py-1 border-t border-rose-50">
                  <span className="text-gray-500 flex items-center gap-2"><Camera className="w-4 h-4 text-gray-400" /> Photo Moderation</span>
                  {statusBadge(p.photo_status)}
                </div>
              </div>
            </div>

            {/* Photos Quick Gallery */}
            <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#e11d48]" /> My Photos ({photos.length})
                </h2>
                <Link href="/profile/photos" className="text-xs font-bold text-[#e11d48] hover:underline">+ Upload</Link>
              </div>

              {photos.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <Camera className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs font-semibold text-gray-500">No photos uploaded yet.</p>
                  <Link href="/profile/photos" className="inline-block px-3 py-1.5 rounded-xl bg-rose-50 text-[#e11d48] text-xs font-bold">Upload Photos</Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((ph) => (
                    <div key={ph.id} className="relative aspect-square rounded-xl overflow-hidden border border-rose-100 bg-gray-100 group">
                      <ProfileImage
                        photoId={ph.id}
                        src={ph.thumbnail_url}
                        variant="thumbnail"
                        alt=""
                        size="sm"
                        shape="square"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleDelete(ph.id)}
                        disabled={deletingId === ph.id}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Information Cards */}
          <div className="lg:col-span-8 space-y-6">

            {/* About Myself Card */}
            {(activeTab === 'overview' || activeTab === 'personal') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-3">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#e11d48]" /> About Myself
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>
                {p.about ? (
                  <p className="text-xs font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                    "{p.about}"
                  </p>
                ) : (
                  <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 text-center space-y-1">
                    <p className="text-xs font-semibold text-gray-500">No introduction added yet.</p>
                    <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">+ Write About Yourself</Link>
                  </div>
                )}

                {p.hobbies && (
                  <div className="pt-3 border-t border-rose-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Hobbies &amp; Interests</span>
                    <p className="text-xs font-bold text-gray-800">{p.hobbies}</p>
                  </div>
                )}
              </div>
            )}

            {/* Basic & Personal Details */}
            {(activeTab === 'overview' || activeTab === 'personal') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <User className="w-4 h-4 text-[#e11d48]" /> Basic Details
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Age</span>
                    <DisplayValue value={p.age ? `${p.age} Yrs` : undefined} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Gender</span>
                    <DisplayValue value={p.gender} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Marital Status</span>
                    <DisplayValue value={p.marital_status} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Height</span>
                    <DisplayValue value={p.height} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Mother Tongue</span>
                    <DisplayValue value={p.mother_tongue} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Eating Habits</span>
                    <DisplayValue value={p.diet} />
                  </div>
                </div>
              </div>
            )}

            {/* Religion & Horoscope Details */}
            {(activeTab === 'overview' || activeTab === 'religion') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#e11d48]" /> Religion &amp; Horoscope
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Religion</span>
                    <DisplayValue value={p.religion} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Caste</span>
                    <DisplayValue value={p.caste} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Sub-Caste</span>
                    <DisplayValue value={p.sub_caste} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Gothra</span>
                    <DisplayValue value={p.gothra} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Star / Nakshatra</span>
                    <DisplayValue value={p.star_nakshatra} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Manglik Status</span>
                    <DisplayValue value={p.manglik_status} />
                  </div>
                </div>
              </div>
            )}

            {/* Education & Career Details */}
            {(activeTab === 'overview' || activeTab === 'career') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#e11d48]" /> Education &amp; Career
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Highest Qualification</span>
                    <DisplayValue value={p.highest_education} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Occupation</span>
                    <DisplayValue value={p.occupation} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Annual Income</span>
                    <DisplayValue value={p.annual_income} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Work Location</span>
                    <DisplayValue value={p.work_location} />
                  </div>
                </div>
              </div>
            )}

            {/* Family Background */}
            {(activeTab === 'overview' || activeTab === 'family') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#e11d48]" /> Family Background
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Father's Occupation</span>
                    <DisplayValue value={p.father_status} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Mother's Occupation</span>
                    <DisplayValue value={p.mother_status} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Family Type</span>
                    <DisplayValue value={p.family_type} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Family Location</span>
                    <DisplayValue value={p.family_location} />
                  </div>
                </div>
              </div>
            )}

            {/* Partner Preferences */}
            {(activeTab === 'overview' || activeTab === 'preferences') && (
              <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#e11d48] flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#e11d48]" /> Partner Preferences
                  </h2>
                  <Link href="/settings/profile" className="text-xs font-bold text-[#e11d48] hover:underline">Edit</Link>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Preferred Age Range</span>
                    <DisplayValue value={p.pref_age_min || p.pref_age_max ? `${p.pref_age_min || 'Any'} - ${p.pref_age_max || 'Any'} Yrs` : undefined} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Preferred Height</span>
                    <DisplayValue value={p.pref_height_min || p.pref_height_max ? `${p.pref_height_min || 'Any'} - ${p.pref_height_max || 'Any'}` : undefined} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Preferred Religion</span>
                    <DisplayValue value={p.pref_religion} />
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Preferred Location</span>
                    <DisplayValue value={p.pref_location} />
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  );
}
