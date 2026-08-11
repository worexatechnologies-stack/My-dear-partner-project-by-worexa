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

export function RealtimeRequestNotifier() {
  const { subscribe } = useRealtime();
  const [activeRequest, setActiveRequest] = useState<RequestItem | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

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

  // Native Web Push Notification
  const triggerBrowserPush = useCallback((senderName: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('New Match Request!', {
          body: `${senderName} sent you a connection request on MyDearPartner.`,
          icon: '/images/main-logo.png',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Check incoming pending interests
  const checkForNewRequests = useCallback(async () => {
    try {
      const incoming = await getInterests('incoming');
      const pending = incoming.filter((item: any) => item.status === 'PENDING');
      
      if (pending.length > 0) {
        // Find first request not yet dismissed in current session
        const nextRequest = pending.find((item: any) => !processedIdsRef.current.has(item.id));
        if (nextRequest) {
          processedIdsRef.current.add(nextRequest.id);
          setActiveRequest(nextRequest);
          playChimeSound();
          triggerBrowserPush(nextRequest.sender?.full_name || 'A member');
        }
      }
    } catch {
      /* Silently ignore if unauthenticated or locked */
    }
  }, [playChimeSound, triggerBrowserPush]);

  // WebSocket realtime listener
  useEffect(() => {
    const unsubscribe = subscribe('*', (event) => {
      if (
        event.type === 'notification.created' ||
        event.type === 'INTEREST_RECEIVED' ||
        event.entity === 'interest'
      ) {
        checkForNewRequests();
      }
    });

    // Initial check & light polling interval (every 25 seconds)
    checkForNewRequests();
    const interval = setInterval(checkForNewRequests, 25000);

    return () => {
      unsubscribe();
      clearInterval(interval);
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
          text: `You accepted ${senderName}'s request! Redirecting to chat...`,
          type: 'success',
        });
        setTimeout(() => {
          window.location.href = `/messages?user=${activeRequest.sender.id}`;
        }, 1200);
      } else {
        setToastMsg({
          text: `Request declined. If rejected by mistake, you can agree anytime under Interests > Declined.`,
          type: 'info',
        });
      }
      setActiveRequest(null);
    } catch {
      setToastMsg({
        text: 'Action could not be saved. Please try again.',
        type: 'info',
      });
    } finally {
      setBusy(false);
    }
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
              onClick={() => setActiveRequest(null)}
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
                onClick={() => setActiveRequest(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-4">
                <Heart className="w-3 h-3 fill-rose-500 text-rose-500 animate-pulse" />
                Connection Request Received
              </div>

              {/* Sender Details */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-rose-100 shrink-0">
                  <SmartImage
                    src={activeRequest.sender?.photo}
                    alt={activeRequest.sender?.full_name || 'Member'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-snug font-display">
                    {activeRequest.sender?.full_name || 'A Member'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {activeRequest.sender?.occupation || 'Profile Seeker'}
                    {activeRequest.sender?.work_location ? ` • ${activeRequest.sender.work_location}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-600 mt-1">
                    Wants to connect & message with you!
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
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
                  Accept & Message
                </button>
              </div>

              {/* Mistake Help Tip */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Mistake recovery available</span>
                <Link
                  href="/interests/declined"
                  onClick={() => setActiveRequest(null)}
                  className="text-rose-600 font-bold hover:underline"
                >
                  View Declined Requests →
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
