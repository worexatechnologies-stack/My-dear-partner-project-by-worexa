'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, CheckCircle2, XCircle, RotateCcw, MessageSquare, X, 
  User, MapPin, Briefcase, Lock, ShieldCheck, ArrowRight, Clock, Maximize2
} from 'lucide-react';
import { getInterests, updateInterestStatus, withdrawInterest, sendInterest, cacheSentInterestId } from '@/legacy/services/dataService';
import { ApiError } from '@/legacy/services/apiClient';
import SmartImage from '@/components/shared/smart-image';
import { profileHref } from '@/lib/profile-url';
import { getPassedProfiles, fetchPassedProfilesFromBackend, removePassedProfile } from '@/lib/discover-actions';
import { interestFeedback } from './interest-feedback';

type InterestMode = 'received' | 'sent' | 'accepted' | 'declined';
type InterestDirection = 'incoming' | 'outgoing';

interface InterestItem {
  id: string;
  sender: any;
  receiver: any;
  status: string;
  created_at: string;
  direction: InterestDirection;
}

export function InterestsClient({ mode }: { mode: InterestMode }) {
  const [items, setItems] = useState<InterestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [locked, setLocked] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [withdrawConfirmingId, setWithdrawConfirmingId] = useState<string | null>(null);
  const [matchRemovalConfirmingId, setMatchRemovalConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [mounted, setMounted] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox, closeLightbox]);

  // Tab counts
  const [counts, setCounts] = useState({ received: 0, accepted: 0, declined: 0, sent: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionError('');
    setLocked(false);
    try {
      const [incoming, sent, passedList] = await Promise.all([
        getInterests('incoming').catch((err) => {
          if (err instanceof ApiError && err.status === 403) throw err;
          return [];
        }),
        getInterests('outgoing').catch(() => []),
        fetchPassedProfilesFromBackend().catch(() => getPassedProfiles()),
      ]);

      const incomingItems: InterestItem[] = incoming.map((item: Omit<InterestItem, 'direction'>) => ({
        ...item,
        direction: 'incoming',
      }));
      const sentItems: InterestItem[] = sent.map((item: Omit<InterestItem, 'direction'>) => ({
        ...item,
        direction: 'outgoing',
      }));

      // 1. Accepted Matches: deduplicate by partner ID across incoming and outgoing
      const acceptedPartnerIds = new Set<string>();
      const acceptedMatches: InterestItem[] = [];
      for (const item of [...incomingItems, ...sentItems]) {
        if (item.status === 'ACCEPTED') {
          const partner = item.direction === 'incoming' ? item.sender : item.receiver;
          const partnerId = String(partner?.id || partner?.user_id || '');
          if (partnerId && !acceptedPartnerIds.has(partnerId)) {
            acceptedPartnerIds.add(partnerId);
            acceptedMatches.push(item);
          }
        }
      }

      // 2. Sent Likes: strictly PENDING outgoing requests to members who are NOT already an accepted match
      const sentPartnerIds = new Set<string>();
      const sentRequests: InterestItem[] = [];
      for (const item of sentItems) {
        if (item.status === 'PENDING') {
          const partner = item.receiver;
          const partnerId = String(partner?.id || partner?.user_id || '');
          if (partnerId && !acceptedPartnerIds.has(partnerId) && !sentPartnerIds.has(partnerId)) {
            sentPartnerIds.add(partnerId);
            sentRequests.push(item);
          }
        }
      }

      // 3. Received Likes: strictly PENDING incoming requests from members who are NOT already an accepted match
      const receivedPartnerIds = new Set<string>();
      const pendingIncoming: InterestItem[] = [];
      for (const item of incomingItems) {
        if (item.status === 'PENDING') {
          const partner = item.sender;
          const partnerId = String(partner?.id || partner?.user_id || '');
          if (partnerId && !acceptedPartnerIds.has(partnerId) && !receivedPartnerIds.has(partnerId)) {
            receivedPartnerIds.add(partnerId);
            pendingIncoming.push(item);
          }
        }
      }

      // 4. Passed & Disliked: strictly mutually exclusive from accepted matches, sent likes, and received likes
      const passedPartnerIds = new Set<string>();
      const declinedAndPassed: InterestItem[] = [];

      // Declined incoming requests
      for (const item of incomingItems) {
        if (item.status === 'DECLINED') {
          const partner = item.sender;
          const partnerId = String(partner?.id || partner?.user_id || '');
          if (
            partnerId &&
            !acceptedPartnerIds.has(partnerId) &&
            !sentPartnerIds.has(partnerId) &&
            !passedPartnerIds.has(partnerId)
          ) {
            passedPartnerIds.add(partnerId);
            declinedAndPassed.push(item);
          }
        }
      }

      // Discover passed profiles
      for (const p of passedList) {
        const pId = String(p.id);
        if (
          pId &&
          !acceptedPartnerIds.has(pId) &&
          !sentPartnerIds.has(pId) &&
          !passedPartnerIds.has(pId)
        ) {
          passedPartnerIds.add(pId);
          declinedAndPassed.push({
            id: `passed_${p.id}`,
            sender: {
              id: p.id,
              user_id: p.id,
              full_name: p.name,
              photo: p.photo,
              work_location: p.location,
              occupation: p.occupation,
              highest_education: p.education,
              age: p.age,
            },
            receiver: null,
            status: 'DISCOVER_PASSED',
            created_at: p.passedAt,
            direction: 'incoming',
          });
        }
      }

      setCounts({
        received: pendingIncoming.length,
        accepted: acceptedMatches.length,
        declined: declinedAndPassed.length,
        sent: sentRequests.length,
      });

      // Cache sent and accepted partner IDs so opening their profile is 100% instantaneous
      for (const req of sentRequests) {
        const pId = req?.receiver?.id || req?.receiver?.user_id;
        if (pId) cacheSentInterestId(pId);
      }
      for (const req of acceptedMatches) {
        const pId = req?.receiver?.id || req?.receiver?.user_id || req?.sender?.id || req?.sender?.user_id;
        if (pId) cacheSentInterestId(pId);
      }

      if (mode === 'accepted') {
        setItems(acceptedMatches);
      } else if (mode === 'declined') {
        setItems(declinedAndPassed);
      } else if (mode === 'received') {
        setItems(pendingIncoming);
      } else {
        setItems(sentRequests);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setLocked(true);
      } else {
        setError(caught instanceof Error ? caught.message : 'Interests could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const handleLikePassed = async (profileId: string, itemId: string) => {
    setProcessingId(itemId);
    setActionError('');
    try {
      await sendInterest(profileId);
      removePassedProfile(profileId);
      setNotice('Interest sent! Moved to Sent Likes 💕');
      await loadData();
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Could not send interest.';
      // Gracefully handle idempotent case — interest was already sent before
      if (
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('already sent')
      ) {
        removePassedProfile(profileId);
        setNotice('Interest was already sent to this member. Moved to Sent Likes 💕');
        await loadData();
      } else {
        // Use interestFeedback to properly map DAILY_INTEREST_LIMIT / MEMBERSHIP_REQUIRED codes
        const { message } = interestFeedback(caught);
        setActionError(message);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleUndoPass = async (profileId: string, _itemId: string) => {
    setActionError('');
    removePassedProfile(profileId);
    setNotice('Profile restored! It will appear again in Discover.');
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const respond = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    setProcessingId(id);
    setActionError('');
    try {
      await updateInterestStatus(id, status);
      setNotice(status === 'ACCEPTED' ? 'Request accepted! You can now start messaging.' : 'Request declined.');
      await loadData();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Action could not be updated.');
    } finally {
      setProcessingId(null);
    }
  };

  const withdraw = async (id: string) => {
    setProcessingId(id);
    setActionError('');
    try {
      await withdrawInterest(id);
      setNotice('Interest request withdrawn. It is no longer visible to this member.');
      await loadData();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Interest could not be withdrawn.');
      if (caught instanceof ApiError && caught.status === 409) {
        void loadData();
      }
    } finally {
      setWithdrawConfirmingId(null);
      setProcessingId(null);
    }
  };

  const removeMatch = async (item: InterestItem) => {
    setProcessingId(item.id);
    setActionError('');
    try {
      if (item.direction === 'outgoing') {
        await withdrawInterest(item.id);
      } else {
        await updateInterestStatus(item.id, 'DECLINED');
      }
      setNotice('Match removed. Chat and contact access are now closed for both members.');
      await loadData();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Match could not be removed.');
      if (caught instanceof ApiError && caught.status === 409) {
        void loadData();
      }
    } finally {
      setMatchRemovalConfirmingId(null);
      setProcessingId(null);
    }
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const navTabs: { key: InterestMode; label: string; count: number; href: string; icon: any }[] = [
    { key: 'received', label: 'Received Likes', count: counts.received, href: '/interests/received', icon: Heart },
    { key: 'accepted', label: 'Accepted Matches', count: counts.accepted, href: '/interests/accepted', icon: CheckCircle2 },
    { key: 'declined', label: 'Passed & Disliked', count: counts.declined, href: '/interests/declined', icon: XCircle },
    { key: 'sent', label: 'Sent Likes', count: counts.sent, href: '/interests/sent', icon: ArrowRight },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-20 font-sans" style={{ backgroundColor: '#fafafa' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Page Header ── */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Connection Requests
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-display">
            {mode === 'sent'
              ? 'Sent Connection Requests'
              : mode === 'accepted'
              ? 'Accepted Matches'
              : mode === 'declined'
              ? 'Passed Profiles & Declined Requests'
              : 'Received Connection Requests'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            {mode === 'declined'
              ? 'Profiles you swiped left on or declined. You can undo a pass to see them in Discover again, or like them instead to connect.'
              : 'Manage member connections, respond to interest requests, and keep track of your match interactions.'}
          </p>
        </div>

        {notice && (
          <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 flex items-center justify-between shadow-sm">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="p-1 text-emerald-600 hover:text-emerald-950 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 flex items-center justify-between shadow-sm">
            <span>{actionError}</span>
            <button onClick={() => setActionError('')} className="p-1 text-rose-600 hover:text-rose-950 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Navigation Tabs ── */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-[#efefef] shadow-xs mb-8">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#e11d48] text-white shadow-md shadow-rose-500/20'
                    : 'text-[#443c40] hover:bg-[#f7f4f5] hover:text-[#0f0f10]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#737373]'}`} strokeWidth={1.85} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-white/25 text-white' : 'bg-[#fff1f2] text-[#e11d48]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Content Body ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse h-64 flex flex-col justify-between">
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-150 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-10 bg-slate-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : locked ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-amber-200/80 shadow-xl max-w-lg mx-auto my-12 relative overflow-hidden">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Unlock Received Requests</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Your current membership plan does not include viewing incoming connection requests. Upgrade to see who wants to connect with you!
            </p>
            <Link
              href="/membership"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-amber-700 transition-all"
            >
              <ShieldCheck className="w-4 h-4" /> View Premium Membership Plans
            </Link>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-rose-200 max-w-md mx-auto my-8">
            <XCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-slate-900 text-lg mb-1">Could not load requests</h3>
            <p className="text-slate-500 text-xs mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Retry Loading
            </button>
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const isOutgoing = item.direction === 'outgoing';
                const profile = isOutgoing ? item.receiver : item.sender;
                const profileId = profile?.id || profile?.user_id;
                const name = profile?.full_name || profile?.first_name || 'Member';
                const photo = profile?.photo;
                const location = profile?.work_location || profile?.location || profile?.city || 'Location private';
                const occupation = profile?.occupation || profile?.highest_education || 'Member Profile';
                const isBusy = processingId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#efefef] bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/8 hover:-translate-y-1 transition-all duration-200 text-center"
                  >
                    {/* Top Status & Timestamp Banner */}
                    <div className="flex items-center justify-between gap-2 w-full mb-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8e8e8e]">
                        <Clock className="w-3 h-3 text-[#8e8e8e]" strokeWidth={1.85} />
                        {formatRelativeTime(item.created_at)}
                      </span>
                      
                      {item.status === 'ACCEPTED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Matched
                        </span>
                      )}
                      {item.status === 'DECLINED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <XCircle className="w-3 h-3" strokeWidth={2} /> Declined
                        </span>
                      )}
                      {item.status === 'PENDING' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" strokeWidth={2} /> Requested
                        </span>
                      )}
                      {item.status === 'DISCOVER_PASSED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          Passed
                        </span>
                      )}
                    </div>

                    {/* Center: Instagram Story-Ring Avatar */}
                    <div className="my-2 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => {
                          const primary = Array.isArray(profile?.photos)
                            ? (profile.photos.find((p: any) => p?.is_primary) ?? profile.photos[0])
                            : null;
                          const full = primary?.image_url || primary?.url || photo || '';
                          setLightbox({ src: full, name });
                        }}
                        className="relative cursor-pointer group/avatar"
                        aria-label={`Open ${name}'s profile photo`}
                        title="Click to view full photo"
                      >
                        {/* Story gradient ring */}
                        <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md transition-transform duration-200 group-hover/avatar:scale-105">
                          <div className="w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
                            <SmartImage
                              src={photo}
                              alt={name}
                              aspectRatio="1:1"
                              shape="circle"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>

                        {/* Hover zoom overlay */}
                        <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 transition-colors group-hover/avatar:bg-black/25">
                          <Maximize2 className="h-4 w-4 text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 drop-shadow" strokeWidth={2} />
                        </span>
                      </button>

                      {/* Name & Details */}
                      <div className="mt-3 w-full px-2">
                        <Link
                          href={profileHref(profile)}
                          className="font-black text-base text-[#0f0f10] hover:text-[#e11d48] transition-colors truncate block"
                        >
                          {name}
                        </Link>
                        <p className="text-xs text-[#737373] font-medium truncate mt-1 flex items-center justify-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#8e8e8e] shrink-0" strokeWidth={1.85} />
                          {occupation}
                        </p>
                        <p className="text-xs font-semibold text-[#e11d48] truncate mt-1 flex items-center justify-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.85} />
                          {location}
                        </p>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-4 border-t border-[#efefef] mt-3 flex flex-col gap-2">
                      {/* Sent & Pending (Instagram "Requested" / "Unsend Request" Flip Button) */}
                      {isOutgoing && item.status === 'PENDING' && (
                        withdrawConfirmingId === item.id ? (
                          <div className="rounded-2xl border border-rose-200 bg-[#fff1f2] p-3 text-center animate-in fade-in zoom-in-95 duration-150">
                            <p className="mb-2 text-[11px] font-bold text-rose-900 leading-relaxed">
                              Cancel this connection request?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setWithdrawConfirmingId(null)}
                                disabled={isBusy}
                                className="flex-1 rounded-xl border border-[#efefef] bg-white py-1.5 text-xs font-bold text-[#443c40] hover:bg-[#f7f4f5] transition-colors disabled:opacity-50"
                              >
                                Keep
                              </button>
                              <button
                                onClick={() => withdraw(item.id)}
                                disabled={isBusy}
                                className="flex-1 rounded-xl bg-[#e11d48] py-1.5 text-xs font-bold text-white hover:bg-[#be123c] transition-colors shadow-sm shadow-rose-500/20 disabled:opacity-50"
                              >
                                {isBusy ? 'Cancelling...' : 'Unsend'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setWithdrawConfirmingId(item.id)}
                            disabled={isBusy}
                            className="group/btn relative w-full h-10 rounded-xl bg-[#efefef] hover:bg-[#fff1f2] hover:border hover:border-rose-200 text-xs font-bold text-[#0f0f10] hover:text-[#e11d48] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Clock className="w-3.5 h-3.5 text-[#737373] group-hover/btn:hidden" strokeWidth={2} />
                            <span className="group-hover/btn:hidden">Requested</span>
                            <X className="w-3.5 h-3.5 text-[#e11d48] hidden group-hover/btn:inline-block" strokeWidth={2.2} />
                            <span className="hidden group-hover/btn:inline-block">Unsend Request</span>
                          </button>
                        )
                      )}

                      {/* Received & Pending */}
                      {!isOutgoing && item.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respond(item.id, 'DECLINED')}
                            disabled={isBusy}
                            className="flex-1 h-10 rounded-xl bg-[#efefef] hover:bg-[#dbdbdb] text-[#0f0f10] font-bold text-xs transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => respond(item.id, 'ACCEPTED')}
                            disabled={isBusy}
                            className="flex-1 h-10 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-sm shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Accept
                          </button>
                        </div>
                      )}

                      {/* Accepted Match */}
                      {item.status === 'ACCEPTED' && (
                        <>
                          <Link
                            href={`/messages?user=${profileId}`}
                            className="w-full h-10 rounded-xl bg-[#0f0f10] hover:bg-[#262626] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-rose-400" strokeWidth={2} /> Send Message
                          </Link>
                          {matchRemovalConfirmingId === item.id ? (
                            <div className="rounded-2xl border border-rose-200 bg-[#fff1f2] p-3 text-center animate-in fade-in zoom-in-95 duration-150">
                              <p className="mb-2 text-[11px] font-bold text-rose-900 leading-relaxed">
                                Remove this match?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setMatchRemovalConfirmingId(null)}
                                  disabled={isBusy}
                                  className="flex-1 rounded-xl border border-[#efefef] bg-white py-1.5 text-xs font-bold text-[#443c40] hover:bg-[#f7f4f5] transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => removeMatch(item)}
                                  disabled={isBusy}
                                  className="flex-1 rounded-xl bg-[#e11d48] py-1.5 text-xs font-bold text-white hover:bg-[#be123c] transition-colors"
                                >
                                  {isBusy ? 'Removing...' : 'Remove'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setMatchRemovalConfirmingId(item.id)}
                              disabled={isBusy}
                              className="text-[11px] font-semibold text-[#8e8e8e] hover:text-red-600 transition-colors py-1 cursor-pointer"
                            >
                              Remove Match
                            </button>
                          )}
                        </>
                      )}

                      {/* Declined (Undo Option) */}
                      {!isOutgoing && item.status === 'DECLINED' && (
                        <button
                          onClick={() => respond(item.id, 'ACCEPTED')}
                          disabled={isBusy}
                          className="w-full h-10 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-sm shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Accept Instead
                        </button>
                      )}

                      {/* Discover Passed / Disliked */}
                      {item.status === 'DISCOVER_PASSED' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUndoPass(profileId, item.id)}
                            disabled={isBusy}
                            className="flex-1 h-10 rounded-xl bg-[#efefef] hover:bg-[#dbdbdb] text-[#0f0f10] font-bold text-xs transition-colors disabled:opacity-50"
                          >
                            Undo
                          </button>
                          <button
                            onClick={() => handleLikePassed(profileId, item.id)}
                            disabled={isBusy}
                            className="flex-1 h-10 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-sm shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Heart className="w-3.5 h-3.5" fill="white" strokeWidth={2} /> Like
                          </button>
                        </div>
                      )}

                      {/* View Profile Link */}
                      <Link
                        href={profileHref(profile)}
                        className="text-[11px] font-bold text-[#8e8e8e] hover:text-[#e11d48] transition-colors block text-center mt-1"
                      >
                        View Full Profile →
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-200/80 shadow-sm max-w-md mx-auto my-8">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Heart className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              {mode === 'declined' ? 'No Passed or Declined Profiles' : 'No Connections Here Yet'}
            </h3>
            <p className="text-slate-500 text-xs max-w-xs mx-auto mb-6 leading-relaxed">
              {mode === 'declined'
                ? 'Profiles you pass or dislike in Discover, or connection requests you decline, will appear here so you can undo or like them anytime.'
                : 'Explore member matches in your area and send interest requests to start connecting.'}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/20"
            >
              Discover Matches
            </Link>
          </div>
        )}
{/* ── Full-clarity photo lightbox (portaled to body so it always
          overlays the viewport, even when opened from a scrolled position) ── */}
        {mounted && createPortal(
          <AnimatePresence>
            {lightbox && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8"
                role="dialog"
                aria-modal="true"
                aria-label={`${lightbox.name}'s profile photo`}
                onClick={closeLightbox}
              >
                {/* Top bar */}
                <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6">
                  <span className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white">
                    <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lightbox.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={closeLightbox}
                    aria-label="Close photo viewer"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Image stage */}
                <div
                  className="member-photo-protected relative flex h-full w-full items-center justify-center"
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <img
                    src={lightbox.src.replace(/^\/api\/profile-photos\//, '/api/proxy/profile-photos/')}
                    alt={`${lightbox.name} high-resolution profile photo`}
                    data-protected-photo="true"
                    draggable={false}
                    className="max-h-[84dvh] max-w-full rounded-xl object-contain shadow-2xl"
                    style={{ width: 'auto', height: 'auto' }}
                  />
                  <span className="member-photo-watermark" aria-hidden="true">Protected &bull; My Dear Partner</span>
                </div>

                {/* Bottom hint */}
                <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold text-white/90">
                  Click outside or press Esc to close
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      </div>
    </div>
  );
}
