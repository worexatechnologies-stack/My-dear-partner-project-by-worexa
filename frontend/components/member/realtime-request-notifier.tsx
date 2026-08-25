'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Check, X, Shield, Bell, UserCheck, ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRealtime } from '@/providers/RealtimeProvider';
import { getInterests, updateInterestStatus } from '@/legacy/services/dataService';
import SmartImage from '@/components/shared/smart-image';

interface RequestItem {
  id: string;
  sender: {
    id: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    photo?: string;
    work_location?: string;
    occupation?: string;
    religion?: string;
    caste?: string;
  };
  created_at: string;
  status: string;
}

const MAX_REQUEST_POPUPS = 5;

function initialsOf(name?: string): string {
  return (name || 'M').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
}

/** Resolve the best visible photo URL for a sender/actor from any wire shape. */
function resolveSenderPhoto(sender?: RequestItem['sender']): { photoUrl: string; userId?: string } {
  if (!sender || typeof sender !== 'object') return { photoUrl: '' };
  const anySender = sender as any;

  // Standard MemberPublicSerializer output.
  const vis = String(anySender.photo_visibility || '');
  if (vis === 'visible') {
    if (typeof (sender.photo as string | undefined) === 'string' && (sender.photo as string).trim()) {
      return { photoUrl: sender.photo as string, userId: sender.id };
    }
  }
  // Fall back to the photos array / nested primary_photo objects.
  const collect = (candidate: unknown): string => {
    if (!candidate) return '';
    if (typeof candidate === 'string') return candidate.trim();
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const url = collect(item);
        if (url) return url;
      }
      return '';
    }
    if (typeof candidate === 'object') {
      const rec = candidate as Record<string, unknown>;
      for (const key of ['url', 'image_url', 'thumbnail_url', 'download_url', 'photo']) {
        const url = collect(rec[key]);
        if (url) return url;
      }
    }
    return '';
  };
  const photoUrl = collect(anySender.photos) || collect(anySender.primary_photo) || collect(anySender.photo);
  if (photoUrl) return { photoUrl, userId: sender.id };
  return { photoUrl: '' };
}

export function RealtimeRequestNotifier() {
  const { subscribe } = useRealtime();
  const [requestQueue, setRequestQueue] = useState<RequestItem[]>([]);
  const requestQueueRef = useRef<RequestItem[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const shownPopupCountRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [morePendingCount, setMorePendingCount] = useState(0);
  const activeRequest = requestQueue[0] || null;

  const enqueueRequests = useCallback((requests: RequestItem[]) => {
    if (!requests.length) return;
    setRequestQueue((current) => {
      const next = [...current, ...requests];
      requestQueueRef.current = next;
      return next;
    });
  }, []);

  const dismissActiveRequest = useCallback(() => {
    setRequestQueue((current) => {
      const next = current.slice(1);
      requestQueueRef.current = next;
      return next;
    });
  }, []);

  // Synthesize notification sound using Web Audio API
  const playChimeSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Pleasant dual-tone chord (E5 -> A5)
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.12); // C#6

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      /* AudioContext autoplay policy fallback */
    }
  }, []);

  // Check incoming pending interests
  const checkForNewRequests = useCallback(async () => {
    try {
      const incoming = await getInterests('incoming');
      const pending = incoming.filter((item: any) => item.status === 'PENDING');
      
      const remainingPopupSlots = Math.max(0, MAX_REQUEST_POPUPS - shownPopupCountRef.current);
      const nextRequests = pending
        .filter((item: any) => !processedIdsRef.current.has(item.id))
        .slice(0, remainingPopupSlots);

      if (nextRequests.length) {
        nextRequests.forEach((request: RequestItem) => processedIdsRef.current.add(request.id));
        shownPopupCountRef.current += nextRequests.length;
        enqueueRequests(nextRequests);
        playChimeSound();
      }

      const queuedAfterUpdate = requestQueueRef.current.length + nextRequests.length;
      setMorePendingCount(Math.max(0, pending.length - queuedAfterUpdate));
    } catch {
      /* Silently ignore if unauthenticated or locked */
    }
  }, [enqueueRequests, playChimeSound]);

  // WebSocket realtime listener
  useEffect(() => {
    const unsubscribe = subscribe('*', (event) => {
      const notificationType = String(event.notification_type || event.data.notification_type || '').toUpperCase();
      const isInterestEvent = event.type.toUpperCase().includes('INTEREST')
        || event.entity === 'interest'
        || notificationType.includes('INTEREST');
      if (isInterestEvent) checkForNewRequests();
    });

    // The database snapshot handles requests that arrived while offline;
    // subsequent changes come through the authenticated socket only.
    void checkForNewRequests();

    return () => {
      unsubscribe();
    };
  }, [subscribe, checkForNewRequests]);

  const handleRespond = async (status: 'ACCEPTED' | 'DECLINED') => {
    if (!activeRequest || busy) return;
    setBusy(true);
    try {
      await updateInterestStatus(activeRequest.id, status);
      const senderName = activeRequest.sender?.full_name || 'Member';
      
      if (status === 'ACCEPTED') {
        setToastMsg({
          text: `You accepted ${senderName}'s request! You can connect with them anytime from Matches.`,
          type: 'success',
        });
        setRejected(false);
        dismissActiveRequest();
      } else {
        // Stay open in a "rejected" state so the member can undo a mistake
        // instead of hunting for the request again later.
        setRejected(true);
      }
    } catch {
      setToastMsg({
        text: 'Action could not be saved. Please try again.',
        type: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

  const undoReject = async () => {
    if (!activeRequest || busy) return;
    setBusy(true);
    try {
      await updateInterestStatus(activeRequest.id, 'ACCEPTED');
      const senderName = activeRequest.sender?.full_name || 'Member';
      setToastMsg({
        text: `You re-accepted ${senderName}'s request! They can now connect with you. 💕`,
        type: 'success',
      });
      setRejected(false);
      dismissActiveRequest();
    } catch {
      setToastMsg({
        text: 'Could not undo the rejection. Please try again.',
        type: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

  const dismissPopup = () => {
    if (busy) return;
    setRejected(false);
    dismissActiveRequest();
  };

  return (
    <>
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] bg-slate-900/90 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 text-xs font-semibold">
              <Bell className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{toastMsg.text}</span>
            </div>
            <button
              onClick={() => setToastMsg(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-up Request Card */}
      <AnimatePresence>
        {activeRequest && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
              onClick={dismissPopup}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl border border-rose-100 pointer-events-auto overflow-hidden"
            >
              {/* Decorative Header Glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={dismissPopup}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Badge */}
              {rejected ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-4">
                  <X className="w-3 h-3" />
                  Request Declined
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-4">
                  <Heart className="w-3 h-3 fill-rose-500 text-rose-500 animate-pulse" />
                  Connection Request Received
                </div>
              )}

              {/* Sender Details */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-rose-50 border-2 border-rose-100 shrink-0">
                  {(() => {
                    const { photoUrl, userId } = resolveSenderPhoto(activeRequest.sender);
                    if (photoUrl) {
                      return (
                        <SmartImage
                          src={photoUrl}
                          userId={userId || null}
                          alt={activeRequest.sender?.full_name || 'Member'}
                          fill
                          className="h-full w-full object-cover"
                        />
                      );
                    }
                    return (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-100 to-rose-200 text-rose-600 font-black text-2xl select-none border border-rose-100">
                        {initialsOf(activeRequest.sender?.full_name)}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-snug font-display">
                    {activeRequest.sender?.full_name || 'A Member'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {activeRequest.sender?.occupation || 'Profile Seeker'}
                    {activeRequest.sender?.work_location ? ` • ${activeRequest.sender.work_location}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold mt-1">
                    {rejected
                      ? 'You chose to decline this request.'
                      : 'Wants to connect & message with you!'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {!rejected ? (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleRespond('DECLINED')}
                    disabled={busy}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                    Decline
                  </button>
                  <button
                    onClick={() => handleRespond('ACCEPTED')}
                    disabled={busy}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs hover:from-rose-600 hover:to-pink-700 shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:-translate-y-0.5"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <Link
                    href="/interests/declined"
                    onClick={dismissPopup}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-4 h-4" />
                    View Declined
                  </Link>
                  <button
                    onClick={undoReject}
                    disabled={busy}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:-translate-y-0.5"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                    {busy ? 'Accepting...' : 'Undo & Accept'}
                  </button>
                </div>
              )}

              {/* Mistake Help Tip */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>{rejected ? 'Changed your mind? Re-accept anytime.' : 'Swipe request or tap later'}</span>
                <Link
                  href="/interests/received"
                  onClick={dismissPopup}
                  className="text-rose-600 font-bold hover:underline"
                >
                  View Pending Requests →
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {morePendingCount > 0 && !activeRequest && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-5 right-5 z-[80] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-rose-100 bg-white p-4 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-900">More requests pending</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {morePendingCount} more connection {morePendingCount === 1 ? 'request is' : 'requests are'} waiting.
              </p>
              <Link
                href="/interests/received"
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-rose-600 hover:text-rose-700"
              >
                View all requests <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <button type="button" onClick={() => setMorePendingCount(0)} aria-label="Dismiss pending requests notice" className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
