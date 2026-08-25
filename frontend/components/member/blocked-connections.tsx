'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, EyeOff, RotateCcw, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/legacy/services/apiClient';
import { getInterests, updateInterestStatus } from '@/legacy/services/dataService';
import SmartImage from '@/components/shared/smart-image';
import { profileHref } from '@/lib/profile-url';

type BlockedProfile = {
  id: string;
  full_name?: string;
  gender?: string;
  photo?: string;
  photos?: Array<{ image_url?: string; url?: string; thumbnail_url?: string; is_primary?: boolean }> | null;
};

type RejectedItem = { id: string; sender: BlockedProfile };

function photoOf(p: BlockedProfile): string {
  if ((p.photo || '').trim()) return p.photo || '';
  const primary = (Array.isArray(p.photos) ? p.photos : []).find((x) => x.is_primary) || p.photos?.[0];
  return primary?.image_url || primary?.url || primary?.thumbnail_url || '';
}

export function BlockedConnections() {
  const [tab, setTab] = useState<'blocked' | 'rejected'>('blocked');
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [rejected, setRejected] = useState<RejectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [blocks, interests] = await Promise.all([
        fetchApi<{ data?: BlockedProfile[] } | BlockedProfile[]>('/blocks/').catch(() => ({ data: [] })),
        getInterests('incoming').catch(() => []),
      ]);
      const blockList = Array.isArray(blocks) ? blocks : (blocks?.data ?? []);
      setBlocked(blockList);
      const incoming = Array.isArray(interests) ? interests : [];
      setRejected(
        incoming
          .filter((item) => item?.status === 'DECLINED')
          .map((item) => ({ id: item.id, sender: item.sender as BlockedProfile })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const handleUnblock = async (id: string) => {
    setBusyId(id);
    try {
      await fetchApi(`/blocks/${id}/`, { method: 'DELETE' });
      setBlocked((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId('');
    }
  };

  const handleReconsider = async (interestId: string) => {
    setBusyId(interestId);
    try {
      await updateInterestStatus(interestId, 'ACCEPTED');
      setRejected((prev) => prev.filter((i) => i.id !== interestId));
    } finally {
      setBusyId('');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-16">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Blocked &amp; Rejected</h1>
          <p className="text-sm text-slate-500 mt-1">
            Profiles you have blocked or declined. You can unblock or reconsider any of them anytime.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-slate-200">
          {([
            { key: 'blocked' as const, label: 'Blocked', icon: Ban },
            { key: 'rejected' as const, label: 'Rejected', icon: EyeOff },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                tab === key ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                tab === key ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {key === 'blocked' ? blocked.length : rejected.length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            <span className="ml-2 text-sm font-semibold text-slate-500">Loading…</span>
          </div>
        ) : tab === 'blocked' ? (
          blocked.length === 0 ? (
            <BlockedEmpty />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <AnimatePresence>
                {blocked.map((p) => {
                  const photo = photoOf(p);
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          <SmartImage
                            src={photo}
                            alt={p.full_name || 'Blocked profile'}
                            aspectRatio="4:5"
                            shape="none"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Ban className="h-4 w-4 shrink-0 text-slate-400" />
                            <p className="truncate text-sm font-extrabold text-slate-900">{p.full_name || 'Member'}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{p.gender || 'Member'}</p>
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-600">
                            <ShieldCheck className="h-3 w-3" /> Blocked profile
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4 pt-1">
                        <button
                          type="button"
                          onClick={() => handleUnblock(p.id)}
                          disabled={busyId === p.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {busyId === p.id ? 'Unblocking…' : 'Unblock'}
                        </button>
                        <Link
                          href={profileHref(p)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-rose-700"
                        >
                          View Profile <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        ) : rejected.length === 0 ? (
          <RejectedEmpty />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {rejected.map((item) => {
                const p = item.sender;
                const photo = photoOf(p);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                  >
                    <div className="flex items-start gap-4 p-4">
                      <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <SmartImage
                          src={photo}
                          alt={p.full_name || 'Rejected profile'}
                          aspectRatio="4:5"
                          shape="none"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="h-4 w-4 shrink-0 text-slate-400" />
                          <p className="truncate text-sm font-extrabold text-slate-900">{p.full_name || 'Member'}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{p.gender || 'Member'}</p>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-600">
                          <EyeOff className="h-3.5 w-3.5" /> Declined request
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 px-4 pb-4 pt-1">
                      <button
                        type="button"
                        onClick={() => handleReconsider(item.id)}
                        disabled={busyId === item.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {busyId === item.id ? 'Accepting…' : 'Change Mind & Accept'}
                      </button>
                      <Link
                        href={profileHref(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-rose-700"
                      >
                        View Profile <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}

function BlockedEmpty() {
  return (
    <div className="mx-auto my-8 max-w-md rounded-[2rem] border border-slate-200/80 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-rose-50">
        <Ban className="h-8 w-8 text-rose-400" />
      </div>
      <h3 className="mb-1 text-xl font-extrabold text-slate-900">No blocked profiles</h3>
      <p className="mx-auto mb-6 max-w-xs text-xs leading-relaxed text-slate-500">
        When you block a profile they can no longer see or contact you. Blocked profiles will appear here so you can unblock them later.
      </p>
      <Link href="/search" className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition-colors hover:bg-rose-600">
        Discover Matches
      </Link>
    </div>
  );
}

function RejectedEmpty() {
  return (
    <div className="mx-auto my-8 max-w-md rounded-[2rem] border border-slate-200/80 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
        <EyeOff className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="mb-1 text-xl font-extrabold text-slate-900">No rejected requests</h3>
      <p className="mx-auto mb-6 max-w-xs text-xs leading-relaxed text-slate-500">
        Requests you decline will appear here. If you change your mind, you can accept them again anytime.
      </p>
      <Link href="/interests/received" className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition-colors hover:bg-rose-600">
        View Received Requests
      </Link>
    </div>
  );
}