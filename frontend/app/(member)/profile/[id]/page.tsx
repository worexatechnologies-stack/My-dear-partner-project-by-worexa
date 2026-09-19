'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Eye,
  Flag,
  GraduationCap,
  Heart,
  Home,
  Languages,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Ruler,
  Scale,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  RotateCcw,
} from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';
import UpgradeModal from '@/components/member/upgrade-modal';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { useMembership } from '@/components/member/membership-provider';
import {
  useGetProfileDetailQuery,
  useReportProfileMutation,
  useSendInterestMutation,
} from '@/legacy/services/profileApi';
import type { MemberPhoto } from '@/legacy/services/photoApi';
import { getInterests, getShortlists, toggleShortlist, updateInterestStatus, cacheSentInterestId, getCachedSentInterestIds } from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';
import { useToast } from '@/components/ui';

function DetailRow({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon: React.ElementType }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3.5 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f3] text-[#267255]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-[#1f2b35]">{value}</p>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-slate-200 bg-white px-5 py-6 last:border-0 sm:px-7">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-[#17232d]">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

type InterestState = 'ACCEPTED' | 'SENT' | 'RECEIVED' | 'DECLINED' | null;

interface InterestInfo {
  state: InterestState;
  interestId: string | null;
  direction?: 'sent' | 'received' | null;
}

function resolveInterestState(outgoing: any[], incoming: any[], profileId: string): InterestInfo {
  const sentToProfile = outgoing.filter(
    (interest) => String(interest?.receiver?.id || interest?.receiver?.user_id || '') === profileId,
  );
  const receivedFromProfile = incoming.filter(
    (interest) => String(interest?.sender?.id || interest?.sender?.user_id || '') === profileId,
  );
  const sent = sentToProfile[sentToProfile.length - 1];
  const received = receivedFromProfile[receivedFromProfile.length - 1];

  if (sent?.status === 'ACCEPTED' || received?.status === 'ACCEPTED') {
    return { state: 'ACCEPTED', interestId: sent?.id || received?.id || null, direction: sent?.status === 'ACCEPTED' ? 'sent' : 'received' };
  }
  if (received?.status === 'PENDING') return { state: 'RECEIVED', interestId: received.id, direction: 'received' };
  if (sent?.status === 'PENDING') return { state: 'SENT', interestId: sent.id, direction: 'sent' };
  if (received?.status === 'DECLINED') return { state: 'DECLINED', interestId: received.id, direction: 'received' };
  if (sent?.status === 'DECLINED') return { state: 'DECLINED', interestId: sent.id, direction: 'sent' };
  return { state: null, interestId: null, direction: null };
}


export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profileId = id;
  const router = useRouter();
  const { user } = useAuth();
  const { membershipSummary } = useMembership();
  const { data: profileData, isLoading, error, refetch } = useGetProfileDetailQuery(profileId);
  const memberId = profileData?.profile?.id ? String(profileData.profile.id) : '';
  const [sendInterest, { isLoading: interestLoading }] = useSendInterestMutation();
  const [reportProfile, { isLoading: reporting }] = useReportProfileMutation();

  const [shortlisted, setShortlisted] = useState(false);
  const [interestInfo, setInterestInfo] = useState<InterestInfo>({ state: null, interestId: null });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  // Synchronous instant check from session cache
  const isInstantSent = useMemo(() => {
    if (interestInfo.state) return false;
    const cached = getCachedSentInterestIds();
    return Boolean(
      (profileId && cached.has(String(profileId))) ||
      (memberId && cached.has(String(memberId)))
    );
  }, [interestInfo.state, profileId, memberId]);

  const interestState = interestInfo.state || (isInstantSent ? 'SENT' : null);

  // When profileData returns with interest state from backend, update immediately
  useEffect(() => {
    if (profileData?.interest?.state) {
      setInterestInfo({
        state: profileData.interest.state,
        interestId: profileData.interest.interestId || profileData.interest.id || null,
        direction: profileData.interest.direction || null,
      });
      if (profileData.interest.state === 'SENT' || profileData.interest.state === 'ACCEPTED') {
        if (memberId) cacheSentInterestId(memberId);
        if (profileId) cacheSentInterestId(profileId);
      }
    }
  }, [profileData?.interest, memberId, profileId]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<'messaging' | 'all_photos' | 'unlimited_views' | null>(null);
  const [showMessageTerms, setShowMessageTerms] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState<null | 'block' | 'unblock'>(null);
  const [mounted, setMounted] = useState(false);
  const { showToast } = useToast();

  const isOwnProfile = Boolean(memberId && user?.id === memberId);

  const photos: MemberPhoto[] = useMemo(() => {
    if (!profileData?.profile) return [];
    const prof = profileData.profile;
    const profUser = (prof.user || {}) as any;
    if (Array.isArray(prof.photos) && prof.photos.length > 0) {
      return prof.photos;
    }
    if (profUser.primary_photo?.id) {
      return [profUser.primary_photo];
    }
    return [];
  }, [profileData]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (photos.length > 0) {
      const pIdx = photos.findIndex((p) => p.is_primary);
      if (pIdx >= 0) {
        setSelectedPhotoIndex(pIdx);
      }
    }
  }, [photos]);

  useEffect(() => {
    if (lightboxIndex === null || photos.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => {
          if (prev === null) return null;
          const newIdx = (prev - 1 + photos.length) % photos.length;
          setSelectedPhotoIndex(newIdx);
          return newIdx;
        });
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => {
          if (prev === null) return null;
          const newIdx = (prev + 1) % photos.length;
          setSelectedPhotoIndex(newIdx);
          return newIdx;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    getShortlists()
      .then((response) => {
        if (!cancelled) setShortlisted(response.results.some((profile) => profile.id === memberId));
      })
      .catch(() => undefined);

    // Reconcile in background without wiping existing instantaneous state
    Promise.all([
      getInterests('outgoing').catch(() => []),
      getInterests('incoming').catch(() => []),
    ]).then(([outgoing, incoming]) => {
      if (!cancelled) {
        const resolved = resolveInterestState(outgoing, incoming, memberId);
        if (resolved.state) {
          setInterestInfo(resolved);
          if (resolved.state === 'SENT' || resolved.state === 'ACCEPTED') {
            cacheSentInterestId(memberId);
          }
        }
      }
    });

    return () => { cancelled = true; };
  }, [memberId]);

  const handleShortlist = async () => {
    try {
      const response = await toggleShortlist(memberId || profileId);
      setShortlisted(response.action === 'added');
    } catch {
      window.alert('Your shortlist could not be updated. Please try again.');
    }
  };

  const handleInterest = async () => {
    const targetId = profileData?.profile.id || memberId || profileId;
    if (!targetId || interestState) return;

    // Instant optimistic update (0ms delay)
    setInterestInfo({ state: 'SENT', interestId: null, direction: 'sent' });
    cacheSentInterestId(targetId);
    showToast('Interest sent successfully 💕', 'success');

    try {
      const interest = await sendInterest(targetId).unwrap();
      setInterestInfo({
        state: interest.status === 'ACCEPTED' ? 'ACCEPTED' : 'SENT',
        interestId: interest?.id || null,
        direction: 'sent',
      });
      if (interest.status === 'ACCEPTED') void refetch();
    } catch (requestError: any) {
      const membershipError = requestError?.data?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.status === 402
        || requestError?.status === 403;
      if (membershipError) {
        setInterestInfo({ state: null, interestId: null });
        setUpgradeFeature('messaging');
      } else if (requestError?.status === 409) {
        setInterestInfo({ state: 'SENT', interestId: null, direction: 'sent' });
      } else {
        setInterestInfo({ state: null, interestId: null });
        showToast('Interest could not be sent. Please try again.', 'error');
      }
    }
  };

  const [respondBusy, setRespondBusy] = useState(false);

  const handleRespondToRequest = async (action: 'ACCEPTED' | 'DECLINED') => {
    if (!interestInfo.interestId || respondBusy) return;
    setRespondBusy(true);
    try {
      await updateInterestStatus(interestInfo.interestId, action);
      setInterestInfo({ state: action === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED', interestId: interestInfo.interestId, direction: interestInfo.direction });
      if (action === 'ACCEPTED' && profileData?.profile.id) void refetch();
    } catch {
      // The interests list remains the source of truth; keep the current state.
    } finally {
      setRespondBusy(false);
    }
  };

  const handleMessage = () => {
    if (profileData?.profile.can_message) {
      setShowMessageTerms(true);
      return;
    }
    if (!membershipSummary?.can_message) {
      setUpgradeFeature('messaging');
      return;
    }
    window.alert('Messaging becomes available after both members accept the interest.');
  };

  const submitReport = async () => {
    try {
      await reportProfile({ profileId: memberId || profileId, reason: reportReason, description: reportDetails }).unwrap();
      setShowReport(false);
      setReportDetails('');
      window.alert('Report submitted. Our trust team will review it.');
    } catch {
      window.alert('Report could not be submitted. Please try again.');
    }
  };

  const confirmBlockAction = async () => {
    if (!showBlockConfirm) return;
    setBlocking(true);
    const targetId = (profileData?.profile?.user as any)?.id || profileData?.profile?.id || profileId;
    try {
      if (showBlockConfirm === 'block') {
        await fetchApi('/blocks/', { method: 'POST', body: JSON.stringify({ profile_id: targetId, member_id: targetId }) });
        setBlocked(true);
        setShowBlockConfirm(null);
        showToast('Profile has been blocked.', 'info');
        void refetch();
      } else {
        await fetchApi(`/blocks/${targetId}/`, { method: 'DELETE' });
        setBlocked(false);
        setShowBlockConfirm(null);
        showToast('Profile has been unblocked successfully.', 'success');
        void refetch();
      }
    } catch {
      showToast(`Could not ${showBlockConfirm} profile. Please try again.`, 'error');
    } finally {
      setBlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[34rem] items-center justify-center bg-[#f4f6f7] pb-20 lg:pb-0">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#bd304d]" /> Loading profile
        </div>
      </div>
    );
  }

  if (error || !profileData?.profile) {
    const errData = (error as any)?.data || (error as any);
    const isDailyLimitReached =
      Boolean(error) &&
      (
        (error as any)?.status === 403 ||
        errData?.code === 'daily_profile_unlock_limit_reached' ||
        errData?.error === 'DAILY_LIMIT_REACHED' ||
        errData?.entitlement === 'daily_profile_view_limit' ||
        (typeof errData?.message === 'string' && errData.message.toLowerCase().includes('limit')) ||
        (typeof errData?.detail === 'string' && errData.detail.toLowerCase().includes('limit'))
      ) &&
      errData?.code !== 'blocked_by_user' &&
      errData?.code !== 'you_blocked';

    if (isDailyLimitReached) {
      const limitValue = errData?.limit ?? errData?.views_limit ?? errData?.daily_limit ?? 10;
      const planName = errData?.current_plan || (user as any)?.active_membership?.plan_name || 'Free';
      return (
        <div className="flex h-full min-h-[36rem] flex-col items-center justify-center bg-[#f4f6f7] px-4 py-12 text-center pb-24 lg:pb-12">
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-200/80 bg-gradient-to-b from-white via-[#FFFDF9] to-[#FFF9F2] p-7 sm:p-9 shadow-xl text-center overflow-hidden">
            {/* Ambient Background Accent */}
            <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-amber-200/40 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-rose-200/30 blur-2xl" />

            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_8px_20px_-4px_rgba(217,119,6,0.4)]">
              <Lock className="h-9 w-9" />
            </div>

            {/* Pill */}
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 border border-amber-300/80 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-900">
              <Crown className="h-3.5 w-3.5 text-amber-700" /> Daily Limit Reached (0 / {limitValue} Left)
            </div>

            <h1 className="mt-4 font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              You&apos;ve viewed all {limitValue} profiles today
            </h1>

            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-600">
              You have exhausted your daily limit of <strong className="font-bold text-slate-800">{limitValue} profile views</strong> on your <span className="font-semibold text-amber-900">{planName} Plan</span>. Your daily allowance will automatically refresh tomorrow.
            </p>

            {/* Feature Callout */}
            <div className="mt-6 rounded-2xl border border-amber-200/70 bg-white/90 p-4 text-left shadow-2xs backdrop-blur-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Upgrade to Premium for <strong>unlimited profile views</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Direct contact details, verified matchmaking & direct chat</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setUpgradeFeature('unlimited_views')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:brightness-110 active:scale-98 transition-all"
              >
                <Crown className="h-4 w-4" /> Upgrade for Unlimited Views
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <ArrowLeft className="h-4 w-4" /> Go Back
              </button>
            </div>
          </div>

          {upgradeFeature && (
            <UpgradeModal
              isOpen={Boolean(upgradeFeature)}
              onClose={() => setUpgradeFeature(null)}
              feature={upgradeFeature}
            />
          )}
        </div>
      );
    }

    if (typeof error === 'object' && error && (error as any)?.code === 'blocked_by_user') {
      return (
        <div className="flex h-full min-h-[34rem] flex-col items-center justify-center bg-[#f4f6f7] px-5 text-center pb-20 lg:pb-0">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            <Ban className="h-9 w-9 text-slate-300" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-[#17232d]">You have been blocked by this user</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            You can't view this profile or send them messages anymore.
          </p>
          <button type="button" onClick={() => router.back()} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#17232d] px-4 py-2.5 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </div>
      );
    }
    if (typeof error === 'object' && error && (error as any)?.code === 'you_blocked') {
      return (
        <div className="flex h-full min-h-[34rem] flex-col items-center justify-center bg-[#f4f6f7] px-5 text-center pb-20 lg:pb-0">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 shadow-sm border border-rose-100">
            <Ban className="h-9 w-9 text-rose-500" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-[#17232d]">You have blocked this user</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Unblock them if you'd like to view their details or reconnect.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowBlockConfirm('unblock')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <ShieldCheck className="h-4 w-4" /> Unblock Profile
            </button>
            <Link href="/blocked" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-2xs">
              Manage blocked
            </Link>
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-900 shadow-2xs">
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
          </div>

          {mounted && showBlockConfirm && createPortal(
            <div
              className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto"
              role="dialog"
              aria-modal="true"
              onClick={() => { if (!blocking) setShowBlockConfirm(null); }}
            >
              <div
                className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 my-auto transform transition-all text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs bg-emerald-50 border border-emerald-100 text-emerald-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBlockConfirm(null)}
                    disabled={blocking}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    Unblock this profile?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Are you sure you want to unblock this member? You will immediately be able to view their full profile, photos, and reconnect with them.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockConfirm(null)}
                    disabled={blocking}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmBlockAction()}
                    disabled={blocking}
                    className="flex-1 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                  >
                    {blocking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Unblock Profile
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-[34rem] flex-col items-center justify-center bg-[#f4f6f7] px-5 text-center pb-20 lg:pb-0">
        <UserRound className="h-10 w-10 text-slate-300" />
        <h1 className="mt-4 text-xl font-extrabold text-[#17232d]">Profile unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">This member may have paused or removed their profile.</p>
        <button type="button" onClick={() => router.back()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#17232d] px-4 py-2.5 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" /> Go back
        </button>
      </div>
    );
  }

  const isBlockedByMe = Boolean((profileData as any)?.blocked_by_me);

  const profile = profileData.profile as typeof profileData.profile & {
    mother_tongue?: string;
    sub_caste?: string;
    gothra?: string;
    weight?: string | number;
    income?: string;
  };
  const profileUser = profile.user as typeof profile.user & { is_verified?: boolean; is_premium?: boolean; work_location?: string };
  const safeSelectedIdx = selectedPhotoIndex < photos.length ? selectedPhotoIndex : 0;
  const currentSelectedPhoto = photos[safeSelectedIdx] || photos[0];
  const currentSelectedPhotoUrl = currentSelectedPhoto?.image_url || currentSelectedPhoto?.thumbnail_url || profileUser.photo;
  const location = [profile.location?.city, profile.location?.state].filter(Boolean).join(', ') || 'Location private';
  const matchScore = profile.compatibility_score;
  const currentLightboxPhoto = lightboxIndex === null ? null : photos[lightboxIndex];
  const isMatched = interestState === 'ACCEPTED';
  const interestLabel = isMatched
    ? 'Matched'
    : interestState === 'SENT'
      ? 'Interest sent'
      : interestState === 'RECEIVED'
        ? 'Respond'
        : interestState === 'DECLINED'
          ? 'Declined'
          : 'Connect';

  const remainingToday = profileData?.usage?.remaining_today;
  const dailyLimit = profileData?.usage?.daily_limit;
  const usedToday = profileData?.usage?.used_today;

  const highlights = [
    { label: 'Age', value: profile.age ? `${profile.age} years` : 'Private', icon: CalendarDays },
    { label: 'Height', value: profile.height || 'Private', icon: Ruler },
    { label: 'Education', value: profile.education || 'Private', icon: GraduationCap },
    { label: 'Status', value: profile.marital_status || 'Private', icon: Heart },
  ];

  return (
    <div className="min-h-full bg-[#f4f6f7] px-3 pb-24 sm:px-5 lg:px-7 lg:pb-10">
      <div className="mx-auto max-w-7xl">
        {/* Highlight Banner when 1 or 2 views remain */}
        {typeof remainingToday === 'number' && remainingToday <= 2 && remainingToday >= 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/90 bg-gradient-to-r from-amber-50 via-rose-50 to-pink-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-2xs">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-amber-950">
                  ⚠️ Only {remainingToday} profile view{remainingToday === 1 ? '' : 's'} remaining today!
                </p>
                <p className="text-[11px] sm:text-xs text-amber-800 font-medium">
                  You have viewed {usedToday ?? (dailyLimit ? dailyLimit - remainingToday : 0)} of your {dailyLimit ?? 10} daily profiles. Upgrade to Premium for unlimited views.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUpgradeFeature('unlimited_views')}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:brightness-110 active:scale-95 transition-all"
            >
              <Crown className="h-3.5 w-3.5" /> Upgrade Plan
            </button>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-slate-600 hover:bg-white" aria-label="Back">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to results</span>
            </button>
            {typeof remainingToday === 'number' && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                remainingToday <= 2
                  ? 'border border-amber-300 bg-amber-100 text-amber-950 shadow-2xs'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}>
                <Eye className="h-3.5 w-3.5 text-slate-500" />
                <span>{remainingToday} {remainingToday === 1 ? 'view' : 'views'} left today</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!isOwnProfile && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setShowReport(true)}
                  aria-label="Report profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-[#bd304d] transition-colors"
                >
                  <Flag className="h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  Report
                </span>
              </div>
            )}
            {!isOwnProfile && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setShowBlockConfirm(blocked ? 'unblock' : 'block')}
                  aria-label={blocked ? 'Unblock profile' : 'Block profile'}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-[#bd304d] transition-colors"
                  disabled={blocking}
                >
                  {blocked ? <ShieldCheck className="h-4 w-4 text-[#bd304d]" /> : <ShieldCheck className="h-4 w-4" />}
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  {blocked ? 'Blocked (Click to unblock)' : 'Block Profile'}
                </span>
              </div>
            )}
            <div className="relative group">
              <Link
                href={`/compare?candidate=${profileId}`}
                aria-label="Compare profile"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
              >
                <Scale className="h-4 w-4" />
              </Link>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30">
                Compare
              </span>
            </div>
            {!isOwnProfile && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => void handleShortlist()}
                  aria-label={shortlisted ? 'Remove from shortlist' : 'Save profile'}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                    shortlisted ? 'bg-[#f6c65b] text-[#17232d] shadow-xs' : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {shortlisted ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  {shortlisted ? 'Shortlisted' : 'Shortlist'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(330px,430px)_minmax(0,1fr)] lg:gap-7">
          <aside className="lg:sticky lg:top-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              role={photos.length > 0 ? "button" : undefined}
              tabIndex={photos.length > 0 ? 0 : undefined}
              onClick={() => {
                if (photos.length > 0) setLightboxIndex(safeSelectedIdx);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && photos.length > 0) {
                  e.preventDefault();
                  setLightboxIndex(safeSelectedIdx);
                }
              }}
              className={`relative aspect-[4/5] max-h-[calc(100dvh-10rem)] min-h-[28rem] overflow-hidden rounded-2xl bg-[#18232d] shadow-[0_18px_45px_rgba(23,35,45,0.18)] lg:aspect-[4/5] lg:max-h-[calc(100dvh-12rem)] lg:min-h-0 select-none ${
                photos.length > 0 ? 'cursor-pointer group' : ''
              }`}
              title={photos.length > 0 ? "Click to view full photo" : undefined}
            >
              {currentSelectedPhotoUrl ? (
                <SmartImage
                  src={currentSelectedPhotoUrl}
                  alt={profileUser.full_name || 'Member'}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/40"><UserRound className="h-16 w-16" /></div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />

              {/* Click to view hover overlay */}
              {photos.length > 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-extrabold text-white shadow-2xl backdrop-blur-md border border-white/20">
                    <Eye className="h-4 w-4 text-rose-400" /> View full photo
                  </span>
                </div>
              )}

              <div className="absolute left-4 top-4 flex flex-wrap gap-2 pointer-events-none">
                {(profile.is_verified || profileUser.is_verified) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-bold text-[#267255] backdrop-blur">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {profileUser.is_premium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f6c65b] px-2.5 py-1.5 text-[11px] font-bold text-[#17232d]">
                    <Crown className="h-3.5 w-3.5" /> Premium
                  </span>
                )}
              </div>
              {photos.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(safeSelectedIdx);
                  }}
                  className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 hover:bg-black/75 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur transition-all"
                  aria-label={`View ${photos.length} photos`}
                >
                  <Camera className="h-3.5 w-3.5" /> {safeSelectedIdx + 1}/{photos.length}
                </button>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                <h1 className="break-words text-3xl font-black leading-tight bg-gradient-to-r from-white via-rose-100 to-amber-100 bg-clip-text text-transparent drop-shadow-md">
                  {profileUser.full_name || 'Member'}
                </h1>
                <div className="mt-2.5 flex items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 px-3 py-1 text-xs font-bold text-white/90 shadow-sm">
                    <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    {location}
                  </span>
                </div>
              </div>
            </motion.div>

            {photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                {photos.map((photo, index) => {
                  const isSelected = safeSelectedIdx === index;
                  return (
                    <button
                      key={photo.id || index}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(index)}
                      onDoubleClick={() => setLightboxIndex(index)}
                      aria-label={`Select photo ${index + 1}`}
                      title="Click to switch photo, double-click to view full size"
                      className={`relative aspect-square h-16 w-16 sm:h-18 sm:w-18 shrink-0 overflow-hidden rounded-xl bg-slate-200 transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-3 ring-[#a91d4c] ring-offset-2 scale-105 shadow-lg border-2 border-white'
                          : 'opacity-70 hover:opacity-100 hover:scale-[1.03] border border-slate-300'
                      }`}
                    >
                      <SmartImage
                        src={photo.thumbnail_url || photo.image_url}
                        alt={`Profile photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#a91d4c]/15 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action Buttons directly under the image */}
            <div className="rounded-2xl border border-rose-100/90 bg-white p-3 shadow-lg shadow-rose-900/5">
              <div className="flex items-center gap-2.5">
                {isOwnProfile ? (
                  <Link href="/profile/edit" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-extrabold text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.98]">
                    <UserRound className="h-4 w-4" /> Edit profile
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="group flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200/90 bg-white px-4 py-3 text-xs sm:text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-[#a91d4c]/50 hover:bg-rose-50/50 hover:text-[#a91d4c] hover:shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      {profile.can_message ? (
                        <MessageCircle className="h-4 w-4 text-slate-500 transition-colors group-hover:text-[#a91d4c]" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-500 transition-colors group-hover:text-[#a91d4c]" />
                      )}
                      <span>Message</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInterest()}
                      disabled={interestLoading || Boolean(interestState)}
                      className={`group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed ${
                        interestState
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/25'
                          : 'bg-gradient-to-r from-[#a91d4c] via-[#bd1e4e] to-[#e11d48] shadow-rose-500/30 hover:from-[#8d143c] hover:to-[#be123c] hover:shadow-lg hover:shadow-rose-500/40'
                      }`}
                    >
                      {interestLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : interestState ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <Heart className="h-4 w-4 fill-white/20 text-white transition-transform group-hover:scale-110" />
                      )}
                      <span>{interestLabel}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
{/* Connection state banner — shows requests they sent, requests you
                received/declined, and active matches without a full page reload */}
            {!isOwnProfile && interestState && (
              <div className={`rounded-2xl border p-3.5 shadow-sm transition-colors ${
                interestState === 'ACCEPTED'
                  ? 'border-[#cfe6dc] bg-[#f1f8f5]'
                  : interestState === 'DECLINED'
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-rose-100 bg-[#fff7f9]'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    interestState === 'ACCEPTED'
                      ? 'bg-[#267255] text-white'
                      : interestState === 'DECLINED'
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-gradient-to-br from-rose-500 to-pink-600 text-white'
                  }`}>
                    {interestState === 'ACCEPTED' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : interestState === 'DECLINED' ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Heart className="h-5 w-5 fill-white/20" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-extrabold ${
                      interestState === 'ACCEPTED'
                        ? 'text-[#1f5f47]'
                        : interestState === 'DECLINED'
                          ? 'text-slate-600'
                          : 'text-[#8d143c]'
                    }`}>
                      {interestState === 'ACCEPTED'
                        ? `You & ${profileUser.full_name || 'them'} are connected`
                        : interestState === 'DECLINED'
                          ? interestInfo.direction === 'received'
                            ? `You declined ${profileUser.full_name || 'this member'}'s request`
                            : `Your request to ${profileUser.full_name || 'them'} was declined`
                          : interestState === 'RECEIVED'
                            ? `${profileUser.full_name || 'This member'} sent you a connection request`
                            : `You sent ${profileUser.full_name || 'them'} a connection`}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      {interestState === 'ACCEPTED'
                        ? 'Start a conversation with your match.'
                        : interestState === 'DECLINED'
                          ? interestInfo.direction === 'received'
                            ? 'Changed your mind? Re-accept and connect with them.'
                            : 'You can revisit this request anytime under Interests.'
                          : interestState === 'RECEIVED'
                            ? 'Respond to their request to start connecting.'
                            : 'Waiting for their response.'}
                    </p>

                    {interestState === 'RECEIVED' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRespondToRequest('ACCEPTED')}
                          disabled={respondBusy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 active:scale-[0.98]"
                        >
                          {respondBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRespondToRequest('DECLINED')}
                          disabled={respondBusy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60 active:scale-[0.98]"
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </button>
                      </div>
                    )}

                    {interestState === 'DECLINED' && interestInfo.direction === 'received' && (
                      <button
                        type="button"
                        onClick={() => void handleRespondToRequest('ACCEPTED')}
                        disabled={respondBusy}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 active:scale-[0.98]"
                      >
                        {respondBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Undo & Re-accept
                      </button>
                    )}

                    {interestState === 'ACCEPTED' && (
                      <button
                        type="button"
                        onClick={handleMessage}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#17232d] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#2a3b49]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Chat now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200/80 bg-gradient-to-br from-rose-50/50 via-white to-amber-50/25 px-5 py-6 sm:px-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 border border-slate-200/60 px-2.5 py-0.5 text-slate-700">
                      <CalendarDays className="h-3 w-3 text-slate-500" />
                      {profile.age ? `${profile.age} years` : 'Age private'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 border border-slate-200/60 px-2.5 py-0.5 text-slate-700">
                      <GraduationCap className="h-3 w-3 text-slate-500" />
                      {profile.occupation || 'Occupation private'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-[#7a1537] via-[#a91d4c] to-[#e11d48] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(169,29,76,0.12)]">
                      {profileUser.full_name || 'Member profile'}
                    </h2>
                    {(profile.is_verified || profileUser.is_verified) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-extrabold text-[#1f5f47] shadow-2xs">
                        <BadgeCheck className="h-3.5 w-3.5 text-[#267255]" /> Verified
                      </span>
                    )}
                    {profileUser.is_premium && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300/80 px-2.5 py-1 text-xs font-extrabold text-amber-900 shadow-2xs">
                        <Crown className="h-3.5 w-3.5 text-amber-600" /> Premium
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200/70 px-3.5 py-1 text-xs font-extrabold text-[#8d143c] shadow-2xs transition-all hover:bg-rose-100/70">
                      <MapPin className="h-3.5 w-3.5 text-[#e11d48] shrink-0" />
                      {location}
                    </span>
                  </div>
                </div>
                {matchScore !== undefined && matchScore !== null && (
                  <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#cfe6dc] bg-[#f1f8f5] px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#267255] text-sm font-extrabold text-white">{matchScore}%</div>
                    <div><p className="text-xs font-extrabold text-[#1f5f47]">Compatibility</p><p className="text-[11px] text-[#4d7665]">Based on preferences</p></div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 border-y border-slate-100 sm:grid-cols-4">
                {highlights.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="min-w-0 border-slate-100 px-3 py-4 even:border-l sm:border-l sm:first:border-l-0">
                    <Icon className="h-4 w-4 text-[#267255]" />
                    <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-[#17232d]">{value}</p>
                  </div>
                ))}
              </div>

              <nav className="mt-5 flex gap-1 overflow-x-auto" aria-label="Profile sections">
                {[['about', 'About'], ['career', 'Career'], ['background', 'Background'], ['personal', 'Personal']].map(([target, label]) => (
                  <a key={target} href={`#${target}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-[#17232d]">{label}</a>
                ))}
              </nav>
            </header>

            <Section id="about" title="About" description="A personal introduction shared by this member.">
              <p className="max-w-3xl whitespace-pre-wrap text-[15px] leading-7 text-slate-600">
                {profile.about || 'This member has chosen to share more about themselves after connecting.'}
              </p>
              {profile.hobbies?.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.hobbies.map((hobby) => <span key={hobby} className="rounded-full border border-slate-200 bg-[#f7f8f8] px-3 py-1.5 text-xs font-bold text-slate-600">{hobby}</span>)}
                </div>
              )}
            </Section>

            <Section id="career" title="Career and education">
              <div className="grid gap-x-8 md:grid-cols-2">
                <DetailRow label="Highest education" value={profile.education} icon={GraduationCap} />
                <DetailRow label="Occupation" value={profile.occupation} icon={BriefcaseBusiness} />
                <DetailRow label="Annual income" value={profile.income || profile.annual_income} icon={CircleDollarSign} />
                <DetailRow label="Work location" value={location} icon={MapPin} />
              </div>
            </Section>

            <Section id="background" title="Family and background">
              <div className="grid gap-x-8 md:grid-cols-2">
                <DetailRow label="Religion" value={profile.religion} icon={Heart} />
                <DetailRow label="Caste" value={profile.caste} icon={UsersRound} />
                <DetailRow label="Sub-caste" value={profile.sub_caste} icon={UsersRound} />
                <DetailRow label="Gothra" value={profile.gothra} icon={Home} />
                <DetailRow label="Family type" value={profile.family_type} icon={Home} />
                <DetailRow label="Mother tongue" value={profile.mother_tongue} icon={Languages} />
              </div>
            </Section>

            <Section id="personal" title="Personal details">
              <div className="grid gap-x-8 md:grid-cols-2">
                <DetailRow label="Marital status" value={profile.marital_status} icon={Heart} />
                <DetailRow label="Height" value={profile.height} icon={Ruler} />
                <DetailRow label="Weight" value={profile.weight ? `${profile.weight} kg` : null} icon={Scale} />
                <DetailRow label="Complexion" value={profile.complexion} icon={UserRound} />
                <DetailRow label="Blood group" value={profile.blood_group} icon={ShieldCheck} />
              </div>
            </Section>
          </main>
        </div>
      </div>



      {mounted && currentLightboxPhoto && lightboxIndex !== null && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/95 p-3 sm:p-6 backdrop-blur-md select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Profile photo viewer"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top Bar */}
            <div
              className="w-full flex items-center justify-between z-20 shrink-0 max-w-5xl px-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-black tracking-wider text-white shadow-md backdrop-blur-md border border-white/20">
                  {lightboxIndex + 1} / {photos.length}
                </span>
                {photos[lightboxIndex]?.is_primary && (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 px-3 py-1 text-[11px] font-extrabold backdrop-blur-md">
                    Primary Photo
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close photo viewer"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 hover:scale-105 active:scale-95 transition-all shadow-xl backdrop-blur-md border border-white/20 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Center Stage: Photo with Prev/Next buttons */}
            <div
              className="relative flex-1 w-full max-w-5xl flex items-center justify-center min-h-0 my-2 px-2"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIdx = (lightboxIndex - 1 + photos.length) % photos.length;
                    setLightboxIndex(newIdx);
                    setSelectedPhotoIndex(newIdx);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 sm:left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 hover:scale-110 active:scale-95 border border-white/25 shadow-2xl transition-all backdrop-blur-md cursor-pointer"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
              )}

              <div
                className="member-photo-protected relative flex items-center justify-center max-h-[72vh] sm:max-h-[78vh] max-w-[88vw] rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/15 bg-black/50"
                onContextMenu={(event) => event.preventDefault()}
              >
                <img
                  src={currentLightboxPhoto.image_url || currentLightboxPhoto.thumbnail_url || undefined}
                  alt={`Profile photo ${lightboxIndex + 1}`}
                  data-protected-photo="true"
                  draggable={false}
                  className="max-h-[72vh] sm:max-h-[78vh] max-w-[88vw] w-auto h-auto object-contain select-none"
                />
                <span className="member-photo-watermark" aria-hidden="true">Protected &bull; My Dear Partner</span>
              </div>

              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIdx = (lightboxIndex + 1) % photos.length;
                    setLightboxIndex(newIdx);
                    setSelectedPhotoIndex(newIdx);
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 sm:right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 hover:scale-110 active:scale-95 border border-white/25 shadow-2xl transition-all backdrop-blur-md cursor-pointer"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              )}
            </div>

            {/* Bottom Strip: Photo Switcher Thumbnails */}
            {photos.length > 1 && (
              <div
                className="w-full max-w-xl z-20 shrink-0 flex items-center justify-center gap-2.5 overflow-x-auto py-2 px-4 scrollbar-none"
                onClick={(e) => e.stopPropagation()}
              >
                {photos.map((photo, index) => {
                  const isCurrent = lightboxIndex === index;
                  return (
                    <button
                      key={photo.id || index}
                      type="button"
                      onClick={() => {
                        setLightboxIndex(index);
                        setSelectedPhotoIndex(index);
                      }}
                      className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-rose-500 scale-110 ring-2 ring-rose-400/60 shadow-xl'
                          : 'border-white/30 opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      aria-label={`Switch to photo ${index + 1}`}
                    >
                      <SmartImage
                        src={photo.thumbnail_url || photo.image_url}
                        alt={`Thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {upgradeFeature && <UpgradeModal feature={upgradeFeature} onClose={() => setUpgradeFeature(null)} />}

      {mounted && showMessageTerms && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="message-terms-title">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef7f3] text-[#267255]"><ShieldCheck className="h-5 w-5" /></div>
              <button type="button" onClick={() => setShowMessageTerms(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <h2 id="message-terms-title" className="mt-5 text-xl font-extrabold text-[#17232d]">Start a respectful conversation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Keep personal details private until you are comfortable. Never share payments, passwords, or verification codes in chat.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowMessageTerms(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              <button type="button" onClick={() => router.push(`/messages?user=${memberId || profileId}`)} className="flex-1 rounded-lg bg-[#267255] px-4 py-2.5 text-sm font-bold text-white">Continue to chat</button>
            </div>
          </div>
        </div>, document.body)}

      {mounted && showReport && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-profile-title">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="report-profile-title" className="text-xl font-extrabold text-[#17232d]">Report profile</h2>
              <button type="button" onClick={() => setShowReport(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm text-slate-500">Reports are reviewed privately by the trust and safety team.</p>
            <label className="mt-5 block text-xs font-bold text-slate-600">Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#17232d] outline-none focus:border-[#bd304d]">
                <option>Fake profile</option><option>Inappropriate photos</option><option>Abusive language</option><option>Spam or scam</option><option>Other</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-bold text-slate-600">Details
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={4} placeholder="Tell us what happened" className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-[#17232d] outline-none focus:border-[#bd304d]" />
            </label>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowReport(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              <button type="button" onClick={() => void submitReport()} disabled={reporting || !reportDetails.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#bd304d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {reporting && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
              </button>
            </div>
          </div>
        </div>, document.body)}

      {mounted && showBlockConfirm && createPortal(
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!blocking) setShowBlockConfirm(null); }}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 my-auto transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                showBlockConfirm === 'block' ? 'bg-rose-50 border border-rose-100 text-rose-600' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
              }`}>
                {showBlockConfirm === 'block' ? <Ban className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <button
                type="button"
                onClick={() => setShowBlockConfirm(null)}
                disabled={blocking}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {showBlockConfirm === 'block' ? 'Block this profile?' : 'Unblock this profile?'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {showBlockConfirm === 'block'
                  ? `Are you sure you want to block ${profileUser.full_name || 'this member'}? They will no longer be able to message you or view your profile. You can unblock them anytime from Blocked & Rejected.`
                  : `Are you sure you want to unblock ${profileUser.full_name || 'this member'}? They will be able to see your profile and connect with you again.`}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockConfirm(null)}
                disabled={blocking}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmBlockAction()}
                disabled={blocking}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  showBlockConfirm === 'block'
                    ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {blocking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showBlockConfirm === 'block' ? (
                  <>
                    <Ban className="w-4 h-4" /> Block Profile
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Unblock Profile
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

