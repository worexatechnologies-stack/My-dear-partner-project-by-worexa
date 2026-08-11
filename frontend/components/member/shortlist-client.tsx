'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, BookmarkX, Search, Star, Loader2, Crown, X } from 'lucide-react';
import { getShortlists, toggleShortlist, sendInterest } from '@/legacy/services/dataService';
import SmartImage from '@/components/shared/smart-image';
import type { Profile } from '@/legacy/types/domain';
import { useToast } from '@/components/ui';
import { interestFeedback } from './interest-feedback';

export function ShortlistClient() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState('');
  const [interestSentIds, setInterestSentIds] = useState<Set<string>>(new Set());
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getShortlists();
      setProfiles(data.results || []);
    } catch (e) {
      console.error('Failed to load shortlist', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRemove = async (profileId: string) => {
    setRemovingId(profileId);
    try {
      await toggleShortlist(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch {
      // silently fail
    } finally {
      setRemovingId('');
    }
  };

  const handleInterest = async (profileId: string) => {
    try {
      await sendInterest(profileId);
      setInterestSentIds((prev) => new Set([...prev, profileId]));
    } catch (e: any) {
      const isMembershipError =
        e?.code === 'MEMBERSHIP_REQUIRED' ||
        e?.errors?.code === 'MEMBERSHIP_REQUIRED' ||
        (typeof e?.message === 'string' && e.message.toLowerCase().includes('membership plan')) ||
        (e?.status === 403 && !e?.message?.toLowerCase()?.includes?.('csrf'));
      if (isMembershipError) {
        setShowUpgradeBanner(true);
      } else if (e?.status === 409) {
        setInterestSentIds((prev) => new Set([...prev, profileId]));
      } else {
        const fb = interestFeedback(e);
        showToast(fb.message, fb.tone);
      }
    }
  };

  return (
    <main className="min-h-screen pt-24 pb-16 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">My Shortlist ❤️</h1>
          <p className="text-sm text-slate-500 mt-1">
            Profiles you've saved for quick comparison and follow-up.
          </p>
        </div>

        <AnimatePresence>
          {showUpgradeBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-sm">Activate a Membership Plan</h3>
                <p className="text-xs text-slate-500 mt-0.5">You need an active plan to send interests and connect with matches.</p>
              </div>
              <Link href="/membership" className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200/50">
                View Plans
              </Link>
              <button onClick={() => setShowUpgradeBanner(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-slate-400 text-sm font-semibold">Loading your shortlist...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-14 text-center shadow-sm">
            <Heart className="w-14 h-14 text-rose-100 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">Your shortlist is empty</h2>
            <p className="text-slate-400 text-sm mb-6">
              Browse matches and tap the <strong>Shortlist</strong> button on any profile to save them here.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-2xl hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-200 transition-all"
            >
              <Search className="w-4 h-4" /> Browse Matches
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-5 font-semibold">{profiles.length} saved profile{profiles.length !== 1 ? 's' : ''}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence>
                {profiles.map((profile) => (
                  <motion.div
                    key={profile.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative aspect-[4/5] bg-slate-50 overflow-hidden">
                      <SmartImage
                        src={profile.photo}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl shadow text-xs font-black text-rose-500 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-rose-500 stroke-none" /> {profile.compatibility}%
                      </div>
                      <button
                        onClick={() => handleRemove(profile.id)}
                        disabled={removingId === profile.id}
                        className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-xl shadow text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                        title="Remove from shortlist"
                      >
                        {removingId === profile.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <BookmarkX className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-800 truncate mb-1">
                          {profile.name}, {profile.age}
                        </h3>
                        <p className="text-slate-400 text-xs font-semibold flex items-center gap-1 mb-2">
                          <MapPin className="w-3 h-3 text-rose-400" /> {profile.location}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded font-semibold border border-slate-100">{profile.religion}</span>
                          <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded font-semibold border border-slate-100 truncate max-w-[100px]">{profile.occupation}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 mt-3 border-t border-slate-50">
                        <Link
                          href={`/profile/${profile.id}`}
                          className="flex-1 text-center py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-100 transition-all"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleInterest(profile.id)}
                          disabled={interestSentIds.has(profile.id)}
                          className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1 ${
                            interestSentIds.has(profile.id)
                              ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                              : 'bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 border-rose-100'
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5 fill-current" />
                          {interestSentIds.has(profile.id) ? 'Sent!' : 'Interest'}
                        </button>
                        <Link
                          href={`/compare?candidate=${profile.id}`}
                          className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-100 text-xs font-extrabold transition-all"
                          title="Compare"
                        >
                          ⚖️
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
