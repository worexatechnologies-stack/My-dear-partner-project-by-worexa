'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, CheckCircle2, XCircle, RotateCcw, MessageSquare, 
  User, MapPin, Briefcase, Lock, ShieldCheck, ArrowRight, Clock
} from 'lucide-react';
import { getInterests, updateInterestStatus } from '@/legacy/services/dataService';
import { ApiError } from '@/legacy/services/apiClient';
import SmartImage from '@/components/shared/smart-image';

type InterestMode = 'received' | 'sent' | 'accepted' | 'declined';

interface InterestItem {
  id: string;
  sender: any;
  receiver: any;
  status: string;
  created_at: string;
}

export function InterestsClient({ mode }: { mode: InterestMode }) {
  const outgoing = mode === 'sent';
  const [items, setItems] = useState<InterestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Tab counts
  const [counts, setCounts] = useState({ received: 0, accepted: 0, declined: 0, sent: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setLocked(false);
    try {
      const [incoming, sent] = await Promise.all([
        getInterests('incoming').catch((err) => {
          if (err instanceof ApiError && err.status === 403) throw err;
          return [];
        }),
        getInterests('outgoing').catch(() => []),
      ]);

      const pendingIncoming = incoming.filter((r: any) => r.status === 'PENDING');
      const acceptedIncoming = incoming.filter((r: any) => r.status === 'ACCEPTED');
      const declinedIncoming = incoming.filter((r: any) => r.status === 'DECLINED');

      setCounts({
        received: pendingIncoming.length,
        accepted: acceptedIncoming.length,
        declined: declinedIncoming.length,
        sent: sent.length,
      });

      if (mode === 'accepted') {
        setItems(acceptedIncoming);
      } else if (mode === 'declined') {
        setItems(declinedIncoming);
      } else if (mode === 'received') {
        setItems(pendingIncoming);
      } else {
        setItems(sent);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const respond = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    setProcessingId(id);
    try {
      await updateInterestStatus(id, status);
      // Optimistic, in-place update — no full reload.
      //
      // The previous code called loadData() after every accept/decline. That
      // starts with setLoading(true), which flashed the whole grid into a
      // loading skeleton, then re-fetched BOTH incoming + outgoing lists and
      // re-rendered every card (reloading every profile photo). Updating local
      // state instead keeps the action instant and smooth, and lets the card
      // animate out through <AnimatePresence>.
      setItems((prev) => {
        if (mode === 'received') {
          // An accepted/declined request leaves the "received" (PENDING) list.
          return prev.filter((item) => item.id !== id);
        }
        if (mode === 'declined' && status === 'ACCEPTED') {
          // "Change mind": the card leaves the "declined" list.
          return prev.filter((item) => item.id !== id);
        }
        return prev;
      });

      setCounts((prev) => ({
        received: Math.max(0, prev.received - (mode === 'received' ? 1 : 0)),
        accepted: prev.accepted + (status === 'ACCEPTED' ? 1 : 0),
        declined:
          prev.declined +
          (status === 'DECLINED' ? 1 : 0) -
          (mode === 'declined' && status === 'ACCEPTED' ? 1 : 0),
        sent: prev.sent,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action could not be updated.');
    } finally {
      setProcessingId(null);
    }
  };

  const navTabs: { key: InterestMode; label: string; count: number; href: string; icon: any }[] = [
    { key: 'received', label: 'Received', count: counts.received, href: '/interests/received', icon: Heart },
    { key: 'accepted', label: 'Accepted Matches', count: counts.accepted, href: '/interests/accepted', icon: CheckCircle2 },
    { key: 'declined', label: 'Declined (Undo)', count: counts.declined, href: '/interests/declined', icon: RotateCcw },
    { key: 'sent', label: 'Sent Requests', count: counts.sent, href: '/interests/sent', icon: ArrowRight },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-24 pb-20 font-sans">
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
              ? 'Declined Requests & Undo'
              : 'Received Connection Requests'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            {mode === 'declined'
              ? 'Rejected a profile by mistake? You can easily change your mind and accept their request here to start messaging.'
              : 'Manage member connections, respond to interest requests, and keep track of your match interactions.'}
          </p>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex flex-wrap gap-2.5 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm mb-8">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
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
                const profile = outgoing ? item.receiver : item.sender;
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
                    className="bg-white rounded-[2rem] p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-rose-100 transition-all flex flex-col justify-between relative group overflow-hidden"
                  >
                    {/* Top Status Banner */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      
                      {item.status === 'ACCEPTED' && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Accepted
                        </span>
                      )}
                      {item.status === 'DECLINED' && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Declined
                        </span>
                      )}
                      {item.status === 'PENDING' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>

                    {/* Member Info */}
                    <div className="flex items-center gap-4 mb-5">
                      <Link href={`/profile/${profileId}`} className="shrink-0 relative">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-100 group-hover:border-rose-300 transition-colors relative">
                          <SmartImage src={photo} alt={name} fill className="object-cover" />
                        </div>
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${profileId}`} className="font-extrabold text-slate-900 text-base truncate block hover:text-rose-600 transition-colors font-display">
                          {name}
                        </Link>
                        <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {occupation}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {location}
                        </p>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                      {/* Received & Pending */}
                      {!outgoing && item.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respond(item.id, 'DECLINED')}
                            disabled={isBusy}
                            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => respond(item.id, 'ACCEPTED')}
                            disabled={isBusy}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-xs hover:from-rose-700 hover:to-rose-800 shadow-sm shadow-rose-200 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Message
                          </button>
                        </div>
                      )}

                      {/* Declined (Undo Option) */}
                      {!outgoing && item.status === 'DECLINED' && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2 rounded-xl border border-amber-100 text-center">
                            Rejected by mistake? You can change your mind!
                          </p>
                          <button
                            onClick={() => respond(item.id, 'ACCEPTED')}
                            disabled={isBusy}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Change Mind & Agree (Accept)
                          </button>
                        </div>
                      )}

                      {/* Accepted Match */}
                      {item.status === 'ACCEPTED' && (
                        <Link
                          href={`/messages?user=${profileId}`}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-rose-400" /> Start Conversation
                        </Link>
                      )}

                      {/* View Profile Link */}
                      <Link
                        href={`/profile/${profileId}`}
                        className="w-full text-center py-2 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors block"
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
              {mode === 'declined' ? 'No Declined Requests' : 'No Connections Here Yet'}
            </h3>
            <p className="text-slate-500 text-xs max-w-xs mx-auto mb-6 leading-relaxed">
              {mode === 'declined'
                ? 'If you ever decline a connection request by mistake, it will appear here so you can accept it anytime.'
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
      </div>
    </div>
  );
}
