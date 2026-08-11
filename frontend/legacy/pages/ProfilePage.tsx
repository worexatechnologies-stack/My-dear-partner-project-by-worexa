'use client';

import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import {
  Heart, MessageCircle, Shield, Crown, MapPin,
  GraduationCap, Briefcase, Users, Star, Phone, Mail,
  Calendar, Ruler, Globe, Home, ChevronRight, Send, Eye, Check, Flag
} from 'lucide-react';
import { getProfile, sendInterest } from '../services/dataService';
import { fetchApi, ApiError } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { toggleShortlist, isShortlisted } from '../../lib/shortlist';

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [interestBusy, setInterestBusy] = useState(false);
  const [shortlisted, setShortlisted] = useState(false);
  const [limitExceededData, setLimitExceededData] = useState<any>(null);

  const isOwnProfile = Boolean(user && id && String(user.id) === String(id));

  useEffect(() => {
    if (user?.id && id) setShortlisted(isShortlisted(user.id, id));
  }, [id, user?.id]);

  useEffect(() => {
    if (id) {
      getProfile(id)
        .then(data => setProfile(data))
        .catch((err) => {
          if (err instanceof ApiError || (err && typeof err === 'object' && 'status' in err)) {
            const apiErr = err as any;
            if (apiErr.status === 403 && apiErr.data?.code === 'daily_profile_unlock_limit_reached') {
              setLimitExceededData(apiErr.data);
              return;
            }
          }
          setError('This profile is unavailable or you do not have permission to view it.');
        });
    }
  }, [id]);

  if (limitExceededData) {
    return (
      <div className="min-h-screen pt-32 pb-16 bg-[#FFFAF9] flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-lg bg-white border border-rose-100 rounded-3xl p-8 sm:p-10 text-center shadow-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-6">
            <Crown className="w-8 h-8 text-amber-500" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mb-4">Daily Unlock Limit Reached</h2>
          <p className="text-slate-600 text-sm sm:text-base mb-8 leading-relaxed">
            You have used all {limitExceededData.limit || limitExceededData.daily_limit} profile unlocks available today. Your daily limit resets at:
            <br />
            <strong className="text-slate-800 mt-2 block">
              {new Date(limitExceededData.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Asia/Kolkata timezone)
            </strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/membership"
              className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-md hover:brightness-110 transition-all text-center"
            >
              Choose Premium Plan
            </Link>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/dashboard');
                }
              }}
              className="py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all text-center cursor-pointer border-0"
            >
              Back to Matches
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) return <div className="min-h-screen pt-32 text-center text-red-700 font-semibold">{error}</div>;
  if (!profile) {
    return (
      <div className="min-h-screen pt-32 text-center text-gray-500 font-semibold">
        Loading profile details...
      </div>
    );
  }

  const expressInterest = async () => {
    setInterestBusy(true); setError('');
    try { await sendInterest(profile.id); }
    catch (err: any) {
      const isMembershipError =
        err?.code === 'MEMBERSHIP_REQUIRED' ||
        err?.errors?.code === 'MEMBERSHIP_REQUIRED' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('membership plan')) ||
        (err?.status === 403 && !err?.message?.toLowerCase?.()?.includes?.('csrf'));
      if (isMembershipError) {
        setError('You need an active membership plan to send interests. Please upgrade your plan.');
      } else {
        setError(err instanceof Error ? err.message : 'Interest could not be sent.');
      }
    }
    finally { setInterestBusy(false); }
  };

  const handleShortlist = () => {
    if (!user?.id || !profile?.id) return;
    setShortlisted(toggleShortlist(user.id, profile.id));
  };

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [showMessageTerms, setShowMessageTerms] = useState(false);

  const submitReport = async () => {
    setReportBusy(true);
    setReportError('');
    try {
      await fetchApi('/profile-reports/', {
        method: 'POST',
        body: JSON.stringify({
          reported_member: profile.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      alert('Thank you. The report has been filed and trust team has been notified.');
      setReportModalOpen(false);
      setReportDetails('');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Report could not be submitted.');
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#FFFAF9]">
      {/* Full Bleed Banner - Fixed aspect ratio to prevent stretching */}
      <div className="relative w-full aspect-video overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1, filter: 'blur(10px)' }}
          animate={{ scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8 }}
          src={profile.photo} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/20 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
        {/* Breadcrumb & Back Button */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-[var(--theme-primary-700)]">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/search" className="hover:text-[var(--theme-primary-700)]">Search</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/90 font-medium">{profile.name}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard');
              }
            }}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-full bg-white/25 hover:bg-white/40 text-white font-black text-xs backdrop-blur-md transition-all cursor-pointer shadow-sm border border-white/20"
          >
            â† Back to profiles
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-premium bg-white/80 backdrop-blur-xl border border-white/80 overflow-hidden shadow-2xl p-6 lg:p-8"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <motion.img
                  layoutId={`profile-img-${profile.id}`}
                  src={profile.photo}
                  alt={profile.name}
                  className="w-32 h-32 rounded-3xl object-cover ring-4 ring-white shadow-xl"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900 font-display">{profile.name}</h1>
                    {profile.verified && <Shield className="w-6 h-6 text-[var(--theme-emerald)]" />}
                    {profile.premium && <Crown className="w-6 h-6 text-accent-gold drop-shadow-md" />}
                  </div>
                  <p className="text-slate-600 text-sm font-medium">{profile.occupation} â€¢ {profile.location}</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" disabled={interestBusy} onClick={expressInterest} className="btn-primary flex items-center gap-2 !py-3 !px-5 text-sm shadow-primary/20">
                    <Heart className="w-4 h-4 fill-white" />
                    Send Interest
                  </button>
                  {!isOwnProfile && <button type="button" onClick={handleShortlist} className="btn-outline flex items-center gap-2 !py-3 !px-5 text-sm" aria-pressed={shortlisted}>
                    <Star className={`w-4 h-4 ${shortlisted ? 'fill-current' : ''}`} /> {shortlisted ? 'Shortlisted' : 'Shortlist'}
                  </button>}
                  <button type="button" onClick={() => setShowMessageTerms(true)} className="btn-outline flex items-center gap-2 !py-3 !px-5 text-sm bg-white/50">
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                  <button type="button" onClick={() => setReportModalOpen(true)} className="btn-outline flex items-center justify-center !p-3 bg-white/50 border-red-200 hover:bg-red-50 hover:border-red-300" title="Report Profile">
                    <Flag className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* About */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--theme-primary-700)]" />
                About
              </h2>
              <p className="text-gray-600 leading-relaxed">{profile.about}</p>
            </motion.div>

            {/* Details Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">Personal Details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Calendar, label: 'Age', value: `${profile.age} years` },
                  { icon: Ruler, label: 'Height', value: profile.height },
                  { icon: Globe, label: 'Mother Tongue', value: profile.motherTongue },
                  { icon: Home, label: 'Marital Status', value: profile.maritalStatus },
                  { icon: Users, label: 'Family Type', value: profile.familyType },
                  { icon: MapPin, label: 'Location', value: profile.location },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary-50)] flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[var(--theme-primary-700)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-sm font-medium text-gray-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Education & Career */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">Education & Career</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-premium-purple" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Education</p>
                    <p className="text-sm font-medium text-gray-900">{profile.education}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary-100)] flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-[var(--theme-primary-500)]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Occupation</p>
                    <p className="text-sm font-medium text-gray-900">{profile.occupation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Star className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Annual Income</p>
                    <p className="text-sm font-medium text-gray-900">{profile.income}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Hobbies */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">Hobbies & Interests</h2>
              <div className="flex flex-wrap gap-2">
                {profile.hobbies.map((hobby: string, i: number) => (
                  <span key={i} className="px-4 py-2 rounded-xl bg-[var(--theme-primary-50)] text-[var(--theme-primary-700)] text-sm font-medium">
                    {hobby}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Partner Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">Partner Preferences</h2>
              <p className="text-gray-600">{profile.partnerPrefs}</p>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Compatibility Prediction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6 text-center"
            >
              <h3 className="font-bold text-gray-900 mb-4">Compatibility Prediction</h3>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none" stroke="#E91E63" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${profile.compatibility * 2.64} 264`}
                    initial={{ strokeDasharray: '0 264' }}
                    animate={{ strokeDasharray: `${profile.compatibility * 2.64} 264` }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-[var(--theme-primary-700)] font-display">{profile.compatibility}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Compatibility Match</p>
              {profile.compatibility_explanation && profile.compatibility_explanation.length > 0 && (
                <div className="mt-4 text-left border-t border-gray-100 pt-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Key Factors</span>
                  <ul className="text-xs text-gray-600 space-y-1.5 list-none pl-0">
                    {profile.compatibility_explanation.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* Unlock Status */}
            {profile.access && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-500/20 p-6 text-center"
              >
                <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" /> Unlock Status
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  This profile is unlocked for today.
                </p>
                <div className="grid grid-cols-3 gap-2 border-t border-amber-500/10 pt-3">
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider scale-90">Limit</span>
                    <span className="text-sm font-extrabold text-slate-800">{profile.access.daily_limit ?? '∞'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider scale-90">Used</span>
                    <span className="text-sm font-extrabold text-slate-800">{profile.access.used_today}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider scale-90">Left</span>
                    <span className="text-sm font-extrabold text-slate-800">{profile.access.daily_limit !== null ? profile.access.remaining_today : '∞'}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-[var(--theme-primary-700)]" /> Contact Information
              </h3>
              <div className="space-y-3.5 text-left">
                {profile.access?.can_view_contact ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Phone Number</span>
                        <span className="text-sm font-medium text-slate-800">{profile.mobile_number || 'Not available'}</span>
                      </div>
                    </div>
                    {/* Email section removed */}
                  </>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100/50 flex items-start gap-2.5">
                    <Shield className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-800 block mb-0.5">Contact Details Locked</span>
                      <p className="text-xs text-amber-700/80 leading-normal">
                        {profile.contact_locked || 'Upgrade to Platinum/Elite or accept mutual interest to view contact details.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button type="button" disabled={interestBusy} onClick={expressInterest} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--theme-primary-50)] hover:bg-[var(--theme-primary-700)] hover:text-white text-[var(--theme-primary-700)] transition-all group">
                  <Heart className="w-5 h-5" />
                  <span className="text-sm font-medium">Send Interest</span>
                </button>
                <button type="button" onClick={() => setShowMessageTerms(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-premium-purple hover:text-white text-premium-purple transition-all">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Send Message</span>
                </button>
              </div>
            </motion.div>

            {/* Verification Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card-premium bg-white/60 backdrop-blur-lg border border-white/50 p-6"
            >
              <h3 className="font-bold text-gray-900 mb-4">Verification Status</h3>
              <div className="space-y-3">
                {[
                  { label: 'Email Verified', status: true },
                  { label: 'Phone Verified', status: true },
                  { label: 'ID Proof Verified', status: true },
                  { label: 'Education Verified', status: profile.verified },
                  { label: 'Income Verified', status: profile.premium },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    {item.status ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <span className="text-xs text-gray-400">Pending</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              Report Profile
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Help us keep the community safe. Please let us know why you are reporting <strong>{profile.name}</strong>.
            </p>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Reason *</span>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm bg-white"
                >
                  <option value="Fake profile">Fake Profile / Scam</option>
                  <option value="Harassment">Harassment or Abuse</option>
                  <option value="Inappropriate photo">Inappropriate Photos</option>
                  <option value="Underage">Underage user</option>
                  <option value="Other">Other reason</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Additional details *</span>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide details about the issue..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>
            </div>

            {reportError && <p className="text-xs text-red-600 mt-2 font-medium">{reportError}</p>}

            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="btn-outline !py-2 !px-4 text-xs font-semibold"
                disabled={reportBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                className="btn-primary !py-2 !px-4 text-xs font-semibold bg-red-600 hover:bg-red-700 shadow-red-100"
                disabled={reportBusy || !reportDetails.trim()}
              >
                {reportBusy ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMessageTerms && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-dark/40 p-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-6">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-rose-100 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50">
              <Shield className="h-5 w-5 text-[#c43d63]" />
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
                onClick={() => setShowMessageTerms(false)}
                className="btn-outline !py-2 !px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMessageTerms(false);
                  navigate(`/messages?user=${profile.id}`, { state: { profile } });
                }}
                className="rounded-xl bg-[#b63d61] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-200 transition-colors hover:bg-[#972e4d]"
              >
                Continue to chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
