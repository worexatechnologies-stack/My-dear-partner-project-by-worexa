'use client';

import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect } from 'react';
import { Link } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Crown, Bell, Settings,
  UserPlus, MapPin, BadgeCheck, CheckCircle2,
  ArrowRight, Check, X, ShieldAlert, Eye, Lock,
  ExternalLink, ShieldCheck, Compass, ChevronRight, Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getInterests, getConversations, getProfiles, updateInterestStatus } from '../services/dataService';
import { fetchApi } from '../services/apiClient';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import DailyUsageWidget from '@/components/member/daily-usage-widget';

const fieldLabels: Record<string, string> = {
  mobile_number: 'Mobile Number',
  gender: 'Gender',
  profile_created_by: 'Profile Created For',
  date_of_birth: 'Date of Birth',
  marital_status: 'Marital Status',
  height: 'Height',
  weight: 'Weight',
  religion: 'Religion',
  mother_tongue: 'Mother Tongue',
  highest_education: 'Education Details',
  occupation: 'Occupation',
  annual_income: 'Annual Income',
  work_location: 'Current City',
  photo: 'Profile Photo',
  about: 'About Me',
};

interface ProfileVisitor {
  id: string;
  viewed_at: string;
  profile: {
    id?: string;
    user_id?: string;
    full_name?: string;
    first_name?: string;
    age?: number;
    photo?: string;
    work_location?: string;
  };
}

interface ProfileVisitorsResponse {
  can_view_visitors: boolean;
  total_unique_visitors: number;
  results: ProfileVisitor[];
}

function relativeTime(value: string) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [incomingInterests, setIncomingInterests] = useState<any[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [canViewVisitors, setCanViewVisitors] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [stats, setStats] = useState({
    receivedCount: 0,
    sentCount: 0,
    acceptedCount: 0,
    chatsCount: 0,
    unreadNotifications: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [incoming, outgoing, conversations, notificationStats, profiles, visitorData] = await Promise.all([
        getInterests('incoming').catch(() => []),
        getInterests('outgoing').catch(() => []),
        getConversations().catch(() => []),
        fetchApi<{ unread_count: number }>('/notifications/unread-count/').catch(() => ({ unread_count: 0 })),
        getProfiles().catch(() => ({ results: [] })),
        fetchApi<ProfileVisitorsResponse>('/profile-visitors/', { params: { limit: 5 } })
          .catch(() => ({ can_view_visitors: false, total_unique_visitors: 0, results: [] })),
      ]);

      const pendingIncoming = incoming.filter((i: any) => i.status === 'PENDING');
      setIncomingInterests(pendingIncoming);
      setSuggestedProfiles(profiles.results.slice(0, 6));
      setVisitors(visitorData.results || []);
      setCanViewVisitors(visitorData.can_view_visitors);
      setVisitorCount(visitorData.total_unique_visitors);

      const allInterests = [...incoming, ...outgoing];
      const accepted = allInterests.filter((i: any) => i.status === 'ACCEPTED').length;

      setStats({
        receivedCount: incoming.length,
        sentCount: outgoing.length,
        acceptedCount: accepted,
        chatsCount: conversations.length,
        unreadNotifications: notificationStats.unread_count,
      });
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadDashboardData().finally(() => {
      if (!active) return;
    });
    return () => { active = false; };
  }, []);

  const handleInterestAction = async (interestId: string, statusVal: 'ACCEPTED' | 'DECLINED') => {
    try {
      await updateInterestStatus(interestId, statusVal);
      await loadDashboardData();
    } catch (err) {
      console.error(`Failed to ${statusVal.toLowerCase()} interest:`, err);
    }
  };

  const completionPercentage = user?.completion_percentage ?? 0;
  const missingFields = user?.missing_fields ?? [];
  const profilePhoto = user?.photo || '/favicon.svg';
  const isPremium = user?.is_premium ?? false;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-20 bg-slate-50 overflow-x-hidden font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* ── NEW HERO BANNER (Light & Premium) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/40 p-8 sm:p-12 text-slate-800"
        >
          {/* Subtle Ambient Glows */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full blur-[100px] opacity-30 bg-gradient-to-br from-rose-200 to-transparent" />
            <div className="absolute -bottom-24 -left-24 w-[450px] h-[450px] rounded-full blur-[100px] opacity-30 bg-gradient-to-tr from-indigo-200 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              
              {/* User Avatar */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] border-[4px] border-white shadow-xl shadow-slate-200/50 overflow-hidden bg-slate-100 transition-transform duration-300 group-hover:scale-105">
                  <SmartImage src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                </div>
                {isPremium ? (
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 rounded-xl p-2.5 shadow-lg shadow-amber-200/50 border-2 border-white text-white" title="Premium Member">
                    <Crown className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl p-2.5 shadow-lg shadow-emerald-200/50 border-2 border-white text-white" title="Standard Member">
                    <Heart className="w-4 h-4 fill-white/20" />
                  </div>
                )}
              </div>

              {/* Greeting Info */}
              <div className="space-y-3">
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 items-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${isPremium ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {isPremium ? <Crown className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                    {isPremium ? 'Premium Partner' : 'Standard Member'}
                  </div>
                  {user?.is_verified && (
                    <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </div>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-black font-display text-slate-800 tracking-tight">
                  Welcome back, {user?.first_name || 'Member'} 👋
                </h1>
                <p className="text-slate-500 font-medium text-sm max-w-md">
                  Discover new matches tailored for you. Complete your profile checklist to maximize your visibility.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Link
                to="/search"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 hover:-translate-y-0.5"
              >
                <Compass className="w-4 h-4 text-rose-300" />
                <span>Discover Matches</span>
              </Link>
              <Link
                to="/settings"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm hover:-translate-y-0.5"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Edit Profile</span>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── BENTO DASHBOARD GRID ── */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          
          {/* Main Content Column */}
          <div className="space-y-8">
            
            {/* Statistics Bento Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: UserPlus, label: 'Received', value: stats.receivedCount, color: 'text-rose-600 bg-rose-50 border-rose-100 shadow-rose-100/50' },
                { icon: Heart, label: 'Sent', value: stats.sentCount, color: 'text-indigo-600 bg-indigo-50 border-indigo-100 shadow-indigo-100/50' },
                { icon: CheckCircle2, label: 'Accepted', value: stats.acceptedCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 shadow-emerald-100/50' },
                { icon: MessageCircle, label: 'Chats', value: stats.chatsCount, color: 'text-amber-600 bg-amber-50 border-amber-100 shadow-amber-100/50' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className="bg-white border border-slate-100 p-5 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-lg shadow-slate-100 hover:-translate-y-1 transition-transform cursor-default"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${stat.color} shrink-0 shadow-sm border`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className="text-3xl font-black text-slate-800 font-display tracking-tight">{stat.value}</div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Recent Pending Interests */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black font-display text-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                  </div>
                  Pending Interests
                </h2>
                {incomingInterests.length > 0 && (
                  <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-wider border border-rose-100">
                    {incomingInterests.length} New
                  </span>
                )}
              </div>
              
              {incomingInterests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                  <div className="w-16 h-16 bg-white text-slate-300 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 mb-2">No pending requests</h3>
                  <p className="text-slate-500 text-sm max-w-sm">
                    Enhance your profile with more photos to attract more connections.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {incomingInterests.slice(0, 4).map((interest, i) => {
                      const sender = interest.sender || {};
                      const senderPhoto = sender.photo || '';
                      const senderId = sender.id || sender.user_id || interest.sender_id;
                      
                      return (
                        <motion.div
                          key={interest.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="group bg-slate-50 rounded-[2rem] p-3 flex flex-col gap-3 border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-slate-100 hover:border-slate-200 transition-all"
                        >
                          <div className="flex gap-4">
                            <Link to={`/profile/${senderId}`} className="relative shrink-0 overflow-hidden rounded-2xl w-20 h-20 shadow-sm">
                              <SmartImage src={senderPhoto} alt={sender.full_name || 'Member'} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            </Link>
                            <div className="py-2 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link to={`/profile/${senderId}`} className="text-sm font-bold text-slate-800 hover:text-rose-600 truncate">
                                  {sender.first_name || sender.full_name || 'Member'}{sender.age ? `, ${sender.age}` : ''}
                                </Link>
                                {sender.is_verified && <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 mt-1 truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {sender.work_location || 'Not Specified'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleInterestAction(interest.id, 'DECLINED')}
                              className="flex-1 py-2.5 rounded-xl bg-white text-slate-500 font-bold text-xs hover:bg-rose-50 hover:text-rose-600 border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" /> Decline
                            </button>
                            <button
                              onClick={() => handleInterestAction(interest.id, 'ACCEPTED')}
                              className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-rose-600 shadow-md shadow-slate-200 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Curated Matches */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black font-display text-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 text-indigo-500 fill-indigo-500/20" />
                  </div>
                  Curated Picks
                </h2>
                <Link to="/search" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {suggestedProfiles.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {suggestedProfiles.map((profile) => (
                    <Link
                      key={profile.id}
                      to={`/profile/${profile.id}`}
                      className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-slate-100 shadow-sm border border-slate-100/50 block"
                    >
                      <SmartImage src={profile.photo} alt={profile.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                      
                      {profile.compatibility > 0 && (
                        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/30 shadow-sm flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-amber-300" /> {profile.compatibility}%
                        </div>
                      )}
                      
                      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                        <p className="font-black text-sm truncate">{profile.name}{profile.age ? `, ${profile.age}` : ''}</p>
                        <p className="text-[11px] font-medium text-white/70 truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {profile.location || 'India'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50 p-10 text-center text-sm font-medium text-slate-500">
                  Update your preferences to see curated matches here.
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar Insights Column */}
          <div className="space-y-6">
            
            <DailyUsageWidget />

            {/* Profile Visitors */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black font-display text-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Eye className="w-4 h-4 text-emerald-500" />
                  </div>
                  Recent Visitors
                </h3>
                {canViewVisitors && visitors.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100">
                    {visitorCount}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {canViewVisitors && visitors.map((visitor) => {
                  const targetProfileId = visitor.profile?.id || visitor.profile?.user_id || visitor.id;
                  const displayName = visitor.profile?.full_name || visitor.profile?.first_name || 'Member';
                  const displayAge = visitor.profile?.age ? `, ${visitor.profile.age}` : '';

                  return (
                    <Link
                      key={visitor.id}
                      to={`/profile/${targetProfileId}`}
                      className="group flex items-center p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 hover:shadow-sm transition-all"
                    >
                      <SmartImage
                        src={visitor.profile?.photo}
                        alt={displayName}
                        className="w-12 h-12 rounded-[1rem] object-cover border border-slate-100 group-hover:scale-105 transition-transform shrink-0"
                      />
                      <div className="ml-3 min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                          {displayName}{displayAge}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                          {relativeTime(visitor.viewed_at)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </Link>
                  );
                })}

                {canViewVisitors && visitors.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400 font-medium">
                    No one has viewed your profile yet.
                  </div>
                )}

                {!canViewVisitors && visitorCount > 0 && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                    <Lock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs text-amber-900 font-bold mb-1">
                      {visitorCount} members viewed your profile
                    </p>
                    <p className="text-[10px] text-amber-700/80 mb-4 font-medium">
                      Upgrade to Premium to see who is interested in you.
                    </p>
                    <Link
                      to="/membership"
                      className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-200 hover:bg-amber-600 transition-colors"
                    >
                      Unlock Premium
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Profile Strength */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-rose-500/20 blur-2xl rounded-full" />
              
              <h3 className="font-black font-display text-white mb-6 relative z-10 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-rose-400" /> Profile Score
              </h3>
              
              <div className="relative w-32 h-32 mx-auto mb-6 z-10">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-rose-400 transition-all duration-1000 ease-out" strokeDasharray="351.86" strokeDashoffset={351.86 * (1 - completionPercentage / 100)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <span className="text-3xl font-black font-display tracking-tighter">{completionPercentage}%</span>
                </div>
              </div>
              
              {missingFields.length > 0 && (
                <div className="relative z-10">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-3 text-center">Missing Details</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {missingFields.slice(0, 4).map((field: string) => (
                      <span key={field} className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-[10px] font-semibold border border-white/10">
                        {fieldLabels[field] || field}
                      </span>
                    ))}
                    {missingFields.length > 4 && (
                      <span className="px-3 py-1.5 rounded-full bg-white/5 text-white/50 text-[10px] font-semibold border border-white/5">
                        +{missingFields.length - 4} more
                      </span>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    className="block w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/10 transition-colors"
                  >
                    Complete Profile
                  </Link>
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
