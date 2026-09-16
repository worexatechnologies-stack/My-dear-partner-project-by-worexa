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
import { getInterests, getShortlists, toggleShortlist, updateInterestStatus } from '@/legacy/services/dataService';
import { fetchApi } from '@/legacy/services/apiClient';

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
  const interestState = interestInfo.state;
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<'messaging' | 'all_photos' | null>(null);
  const [showMessageTerms, setShowMessageTerms] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    setInterestInfo({ state: null, interestId: null });
    getShortlists()
      .then((response) => {
        if (!cancelled) setShortlisted(response.results.some((profile) => profile.id === memberId));
      })
      .catch(() => undefined);

    // Accepted interests are mutual matches, not merely sent requests. Read
    // both directions so the label stays correct for either member.
    Promise.all([
      getInterests('outgoing').catch(() => []),
      getInterests('incoming').catch(() => []),
    ]).then(([outgoing, incoming]) => {
      if (!cancelled) setInterestInfo(resolveInterestState(outgoing, incoming, memberId));
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
    if (!profileData?.profile.id || interestState) return;
    try {
      const interest = await sendInterest(profileData.profile.id).unwrap();
      setInterestInfo({ state: interest.status === 'ACCEPTED' ? 'ACCEPTED' : 'SENT', interestId: interest?.id || null });
      if (interest.status === 'ACCEPTED') void refetch();
    } catch (requestError: any) {
      const membershipError = requestError?.data?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.status === 402
        || requestError?.status === 403;
      if (membershipError) setUpgradeFeature('messaging');
      else if (requestError?.status === 409) setInterestInfo({ state: 'SENT', interestId: null });
      else window.alert('Interest could not be sent. Please try again.');
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

  const handleBlock = async () => {
    if (blocked) return;
    setBlocking(true);
    try {
      await fetchApi('/blocks/', { method: 'POST', body: JSON.stringify({ profile_id: memberId || profileId }) });
      setBlocked(true);
      window.alert('This profile has been blocked. You can unblock it anytime from Blocked & Rejected.');
    } catch {
      window.alert('Profile could not be blocked. Please try again.');
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
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            <Ban className="h-9 w-9 text-slate-300" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-[#17232d]">You have blocked this user</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Unblock them if you'd like to reconnect. You can do this from Blocked &amp; Rejected.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/blocked" className="inline-flex items-center gap-2 rounded-lg bg-[#bd304d] px-4 py-2.5 text-sm font-bold text-white">
              <ShieldCheck className="h-4 w-4" /> Manage blocked
            </Link>
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-lg bg-[#17232d] px-4 py-2.5 text-sm font-bold text-white">
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
          </div>
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

  const highlights = [
    { label: 'Age', value: profile.age ? `${profile.age} years` : 'Private', icon: CalendarDays },
    { label: 'Height', value: profile.height || 'Private', icon: Ruler },
    { label: 'Education', value: profile.education || 'Private', icon: GraduationCap },
    { label: 'Status', value: profile.marital_status || 'Private', icon: Heart },
  ];

  return (
    <div className="min-h-full bg-[#f4f6f7] px-3 pb-24 sm:px-5 lg:px-7 lg:pb-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-slate-600 hover:bg-white" aria-label="Back">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to results</span>
          </button>
          <div className="flex items-center gap-1.5">
            {!isOwnProfile && (
              <button type="button" onClick={() => setShowReport(true)} title="Report profile" aria-label="Report profile" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-[#bd304d]">
                <Flag className="h-4 w-4" />
              </button>
            )}
            {!isOwnProfile && (
              <button type="button" onClick={() => void handleBlock()} title={blocked ? 'Blocked' : 'Block profile'} aria-label={blocked ? 'Blocked' : 'Block profile'} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-[#bd304d]" disabled={blocking}>
                {blocked ? <ShieldCheck className="h-4 w-4 text-[#bd304d]" /> : <ShieldCheck className="h-4 w-4" />}
              </button>
            )}
            <Link href={`/compare?candidate=${profileId}`} title="Compare profile" aria-label="Compare profile" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white">
              <Scale className="h-4 w-4" />
            </Link>
            {!isOwnProfile && (
              <button type="button" onClick={() => void handleShortlist()} title={shortlisted ? 'Remove from shortlist' : 'Save profile'} aria-label={shortlisted ? 'Remove from shortlist' : 'Save profile'} className={`flex h-9 w-9 items-center justify-center rounded-full ${shortlisted ? 'bg-[#f6c65b] text-[#17232d]' : 'text-slate-500 hover:bg-white'}`}>
                {shortlisted ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
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
    </div>
  );
}

