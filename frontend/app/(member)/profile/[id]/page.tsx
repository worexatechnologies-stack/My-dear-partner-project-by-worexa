'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Crown,
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
import { getInterests, getShortlists, toggleShortlist } from '@/legacy/services/dataService';

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

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profileId = id;
  const router = useRouter();
  const { user } = useAuth();
  const { membershipSummary } = useMembership();
  const { data: profileData, isLoading, error } = useGetProfileDetailQuery(profileId);
  const [sendInterest, { isLoading: interestLoading }] = useSendInterestMutation();
  const [reportProfile, { isLoading: reporting }] = useReportProfileMutation();

  const [shortlisted, setShortlisted] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<'messaging' | 'all_photos' | null>(null);
  const [showMessageTerms, setShowMessageTerms] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [mounted, setMounted] = useState(false);

  const isOwnProfile = user?.id === profileId;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    getShortlists()
      .then((response) => setShortlisted(response.results.some((profile) => profile.id === profileId)))
      .catch(() => undefined);
    // Preload whether the interest was already sent so the button shows
    // "Interest sent" (disabled) immediately instead of after a click.
    getInterests('outgoing')
      .then((outgoing) => {
        const already = (outgoing || []).some(
          (i: any) => (i?.receiver?.id || i?.receiver?.user_id) === profileId
        );
        if (already) setInterestSent(true);
      })
      .catch(() => undefined);
  }, [profileId]);

  const handleShortlist = async () => {
    try {
      const response = await toggleShortlist(profileId);
      setShortlisted(response.action === 'added');
    } catch {
      window.alert('Your shortlist could not be updated. Please try again.');
    }
  };

  const handleInterest = async () => {
    if (!profileData?.profile.id || interestSent) return;
    try {
      await sendInterest(profileData.profile.id).unwrap();
      setInterestSent(true);
    } catch (requestError: any) {
      const membershipError = requestError?.data?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.code === 'MEMBERSHIP_REQUIRED'
        || requestError?.status === 402
        || requestError?.status === 403;
      if (membershipError) setUpgradeFeature('messaging');
      else if (requestError?.status === 409) setInterestSent(true);
      else window.alert('Interest could not be sent. Please try again.');
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
      await reportProfile({ profileId, reason: reportReason, description: reportDetails }).unwrap();
      setShowReport(false);
      setReportDetails('');
      window.alert('Report submitted. Our trust team will review it.');
    } catch {
      window.alert('Report could not be submitted. Please try again.');
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

  const profile = profileData.profile as typeof profileData.profile & {
    mother_tongue?: string;
    sub_caste?: string;
    gothra?: string;
    weight?: string | number;
    income?: string;
  };
  const profileUser = profile.user as typeof profile.user & { is_verified?: boolean; is_premium?: boolean; work_location?: string };
  const photos: MemberPhoto[] = Array.isArray(profile.photos) && profile.photos.length > 0
    ? profile.photos
    : profileUser.primary_photo?.id
      ? [profileUser.primary_photo]
      : [];
  const primaryPhoto = photos[0];
  const primaryPhotoUrl = primaryPhoto?.image_url || primaryPhoto?.thumbnail_url || profileUser.photo;
  const location = [profile.location?.city, profile.location?.state].filter(Boolean).join(', ') || 'Location private';
  const matchScore = profile.compatibility_score;
  const currentPhoto = lightboxIndex === null ? null : photos[lightboxIndex];

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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative aspect-[4/5] max-h-[calc(100dvh-10rem)] min-h-[28rem] overflow-hidden rounded-2xl bg-[#18232d] shadow-[0_18px_45px_rgba(23,35,45,0.18)]">
              {primaryPhotoUrl ? (
                <SmartImage src={primaryPhotoUrl} alt={profileUser.full_name || 'Member'} className="h-full w-full object-cover object-top" />
              ) : (
                <div className="flex h-full items-center justify-center text-white/40"><UserRound className="h-16 w-16" /></div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
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
                <button type="button" onClick={() => setLightboxIndex(0)} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur" aria-label={`View ${photos.length} photos`}>
                  <Camera className="h-3.5 w-3.5" /> {photos.length}
                </button>
              )}
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
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
              <div className="grid grid-cols-5 gap-2">
                {photos.slice(0, 5).map((photo, index) => (
                  <button key={photo.id || index} type="button" onClick={() => setLightboxIndex(index)} aria-label={`View photo ${index + 1}`} className="relative aspect-square overflow-hidden rounded-xl bg-slate-200">
                    <SmartImage src={photo.thumbnail_url || photo.image_url} alt={`Profile photo ${index + 1}`} className="h-full w-full object-cover" />
                    {index === 4 && photos.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">+{photos.length - 5}</span>}
                  </button>
                ))}
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
                      disabled={interestLoading || interestSent}
                      className={`group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed ${
                        interestSent
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/25'
                          : 'bg-gradient-to-r from-[#a91d4c] via-[#bd1e4e] to-[#e11d48] shadow-rose-500/30 hover:from-[#8d143c] hover:to-[#be123c] hover:shadow-lg hover:shadow-rose-500/40'
                      }`}
                    >
                      {interestLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : interestSent ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <Heart className="h-4 w-4 fill-white/20 text-white transition-transform group-hover:scale-110" />
                      )}
                      <span>{interestSent ? 'Interest sent' : 'Connect'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
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



      <AnimatePresence>
        {currentPhoto && lightboxIndex !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label="Profile photo viewer">
            <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{lightboxIndex + 1} / {photos.length}</span>
              <button type="button" onClick={() => setLightboxIndex(null)} aria-label="Close photo viewer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>
            <div className="member-photo-protected relative flex h-full w-full items-center justify-center" onContextMenu={(event) => event.preventDefault()}>
              <img src={currentPhoto.image_url || currentPhoto.thumbnail_url || undefined} alt={`Profile photo ${lightboxIndex + 1}`} data-protected-photo="true" draggable={false} className="max-h-[88dvh] max-w-[92dvw] rounded-lg object-contain" />
              <span className="member-photo-watermark" aria-hidden="true">Protected &bull; My Dear Partner</span>
            </div>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)} aria-label="Previous photo" className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-7"><ChevronLeft className="h-6 w-6" /></button>
                <button type="button" onClick={() => setLightboxIndex((lightboxIndex + 1) % photos.length)} aria-label="Next photo" className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-7"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
              <button type="button" onClick={() => router.push(`/messages?user=${profileId}`)} className="flex-1 rounded-lg bg-[#267255] px-4 py-2.5 text-sm font-bold text-white">Continue to chat</button>
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

