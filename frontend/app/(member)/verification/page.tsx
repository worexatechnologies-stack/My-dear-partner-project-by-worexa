'use client';



import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { createPortal } from 'react-dom';

import { motion } from 'framer-motion';

import {

  AlertCircle, ArrowRight, Camera, Check, Clock, FileText,

  Loader2, LockKeyhole, ShieldCheck, Smartphone, UserRound, Upload, X,

} from 'lucide-react';

import {
  type MemberVerificationDocument,
  useGetMemberVerificationDocumentsQuery,
  useGetVerificationStatusQuery,
  useSubmitMemberVerificationDocumentMutation,
} from '@/legacy/services/verificationStatusApi';



type StepStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';

type Step = {

  id: string;

  title: string;

  description: string;

  status: StepStatus;

  href?: string;

  action?: string;

  reason?: string | null;

  icon: typeof UserRound;

};

function documentStatus(
  documents: MemberVerificationDocument[],
  matches: (document: MemberVerificationDocument) => boolean,
): { status: StepStatus; reason?: string | null } {
  const matching = documents.filter(matches);
  if (matching.some((document) => document.status.toUpperCase() === 'APPROVED')) {
    return { status: 'approved' };
  }
  const latest = matching
    .slice()
    .sort((a, b) => Date.parse(b.uploaded_at ?? '') - Date.parse(a.uploaded_at ?? ''))[0];
  if (!latest) return { status: 'incomplete' };
  const status = latest.status.toUpperCase();
  return {
    status: status === 'PENDING' ? 'pending' : status === 'REJECTED' ? 'rejected' : 'incomplete',
    reason: latest.rejection_reason,
  };
}

const isSelfieDocument = (document: MemberVerificationDocument) =>
  document.document_type === 'OTHER' &&
  document.custom_document_name?.toLowerCase() === 'verification selfie';

const isGovernmentId = (document: MemberVerificationDocument) =>
  ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID'].includes(document.document_type) ||
  (document.document_type === 'OTHER' && document.custom_document_name?.toLowerCase() === 'government id');



const statusCopy: Record<StepStatus, string> = {

  incomplete: 'Not started',

  pending: 'In review',

  approved: 'Verified',

  rejected: 'Action needed',

};



export default function VerificationCenterPage() {

  const { data, isLoading, error, refetch } = useGetVerificationStatusQuery(undefined, {

    refetchOnMountOrArgChange: true,

    refetchOnFocus: true,

  });

  const {
    data: documents = [],
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useGetMemberVerificationDocumentsQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const [submitDocument, { isLoading: isUploadingDocument }] =
    useSubmitMemberVerificationDocumentMutation();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [governmentIdType, setGovernmentIdType] = useState('AADHAAR');
  const streamRef = useRef<MediaStream | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 4500);
  }, []);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setShowCamera(false);
  }, []);

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      void video.play().then(() => {
        if (video.readyState >= 2 && video.videoWidth > 0) setCameraReady(true);
      }).catch(() => {
        showMessage('The camera opened but the preview did not start. Close this window and try again.');
      });
    }
  }, [showCamera, showMessage]);

  useEffect(() => {
    if (!showCamera) return;
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add('mdp-modal-lock');
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stopCamera();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.classList.remove('mdp-modal-lock');
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCamera, stopCamera]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showMessage('Camera access needs a secure HTTPS page and a browser that supports camera access.');
      return;
    }
    setCameraStarting(true);
    try {
      if (!window.isSecureContext) {
        throw new Error('Open this page over HTTPS before starting face verification.');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'user' } },
        });
      } catch (cameraError) {
        const name = cameraError instanceof Error ? cameraError.name : '';
        if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') throw cameraError;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current = stream;
      setCameraReady(false);
      setShowCamera(true);
    } catch (cameraError) {
      const name = cameraError instanceof Error ? cameraError.name : '';
      const message = cameraError instanceof Error ? cameraError.message : '';
      if (message.startsWith('Open this page')) showMessage(message);
      else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') showMessage('Camera permission is blocked. Allow camera access for this site in your browser settings, then try again.');
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') showMessage('No camera was found on this device. Connect a camera and try again.');
      else if (name === 'NotReadableError' || name === 'TrackStartError') showMessage('The camera is busy in another app. Close other camera apps and try again.');
      else if (name === 'SecurityError') showMessage('The browser blocked camera access. Open this site over HTTPS and allow camera access.');
      else showMessage('Could not open the camera. Check browser camera permission and try again.');
    } finally {
      setCameraStarting(false);
    }
  };

  const uploadSelfie = async (file: File) => {
    const mimeType = file.type.toLowerCase();
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : null;
    if (!extension) {
      showMessage('Choose a JPEG, PNG, or WebP image for selfie verification.');
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      showMessage('The selfie must be a valid image no larger than 5 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file, `verification-selfie.${extension}`);
    form.append('document_type', 'OTHER');
    form.append('custom_document_name', 'Verification selfie');
    try {
      await submitDocument(form).unwrap();
      await Promise.all([refetchDocuments(), refetch()]);
      showMessage('Selfie submitted for review. It will show as verified after approval.');
    } catch (uploadError) {
      showMessage(uploadError instanceof Error ? uploadError.message : 'Selfie upload failed. Please try again.');
    }
  };

  const uploadGovernmentId = async (file: File) => {
    const mimeType = file.type.toLowerCase();
    const lowerName = file.name.toLowerCase();
    const isPdf = mimeType === 'application/pdf' && lowerName.endsWith('.pdf');
    const isImage =
      (mimeType === 'image/jpeg' && /\.(jpe?g)$/.test(lowerName)) ||
      (mimeType === 'image/png' && lowerName.endsWith('.png')) ||
      (mimeType === 'image/webp' && lowerName.endsWith('.webp'));
    if (!isPdf && !isImage) {
      showMessage('Choose a PDF, JPEG, PNG, or WebP document.');
      return;
    }
    const maxSize = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size === 0 || file.size > maxSize) {
      showMessage(isPdf ? 'The PDF must be no larger than 10 MB.' : 'The image must be no larger than 5 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', governmentIdType);
    try {
      await submitDocument(form).unwrap();
      await Promise.all([refetchDocuments(), refetch()]);
      showMessage('Government ID submitted for review. Its status will update after approval.');
    } catch (uploadError) {
      showMessage(uploadError instanceof Error ? uploadError.message : 'Document upload failed. Please try again.');
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      showMessage('The camera is still starting. Please wait a moment and try again.');
      return;
    }
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      showMessage('Could not capture the selfie. Please try again or upload a photo.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    stopCamera();
    if (!blob) {
      showMessage('Could not capture the selfie. Please try again or upload a photo.');
      return;
    }
    await uploadSelfie(new File([blob], 'verification-selfie.jpg', { type: 'image/jpeg' }));
  };

  const handleGovernmentIdFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) await uploadGovernmentId(file);
  };



  useEffect(() => { void refetch(); }, [refetch]);



  const steps = useMemo<Step[]>(() => {

    if (!data) return [];

    const verified = Boolean(data.is_verified) || data.account_status === 'VERIFIED';

    const mobileVerified = Boolean(data.contact?.mobile_verified);

    const resolved = (value: StepStatus): StepStatus => verified ? 'approved' : value;

    const idDocument = documentStatus(documents, isGovernmentId);
    const selfieDocument = documentStatus(documents, isSelfieDocument);



    return [

      {

        id: 'contact',

        title: 'Verify your mobile number',

        description: mobileVerified

          ? 'Your registered mobile number is confirmed.'

          : 'Confirm your registered mobile number with an OTP.',

        status: resolved(mobileVerified ? 'approved' : 'incomplete'),

        href: '/profile/edit',

        action: 'Verify mobile',

        reason: data.contact.reason,

        icon: Smartphone,

      },

      { id: 'profile', title: 'Complete your profile', description: 'Add the personal details that help create meaningful matches.', status: resolved(data.profile.status as StepStatus), href: '/profile/edit', action: 'Complete profile', reason: data.profile.reason, icon: UserRound },

      { id: 'photo', title: 'Add a profile photo', description: 'Upload a clear, recent photo to make your profile recognisable.', status: resolved(data.primary_photo.status as StepStatus), href: '/profile/edit', action: 'Add photo', reason: data.primary_photo.reason, icon: Camera },

      { id: 'document', title: 'Submit government ID', description: 'Upload Aadhaar, PAN, passport, driving licence, or voter ID for review.', status: resolved(idDocument.status), reason: idDocument.reason ?? data.documents.reason, icon: FileText },

      { id: 'selfie', title: 'Live selfie verification', description: 'Take a current selfie so our team can review that your profile photos belong to you.', status: selfieDocument.status, reason: selfieDocument.reason, icon: Camera },

    ];

  }, [data, documents]);



  if (isLoading || documentsLoading) return <div className="grid min-h-screen place-items-center bg-[#faf8f7]"><Loader2 className="h-8 w-8 animate-spin text-[#e11d48]" /></div>;

  if (error || !data) return <div className="grid min-h-screen place-items-center bg-[#faf8f7] px-4"><div className="max-w-md rounded-[2rem] border border-[#f0e6ea] bg-white p-8 text-center shadow-xl"><AlertCircle className="mx-auto h-11 w-11 text-[#e11d48]" /><h1 className="mt-4 text-xl font-bold text-[#20111a]">Verification is unavailable</h1><p className="mt-2 text-sm text-slate-500">We could not load your verification status.</p><button type="button" onClick={() => void refetch()} className="mt-6 rounded-xl bg-[#e11d48] px-5 py-3 text-sm font-bold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#be123c]">Try again</button></div></div>;



  const done = steps.filter((step) => step.status === 'approved').length;

  const progress = Math.round((done / steps.length) * 100);

  const fullyVerified = Boolean(data.is_verified) || data.account_status === 'VERIFIED';



  return (

    <main className="min-h-full w-full max-w-full overflow-x-clip bg-[#faf8f7] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 text-slate-900 sm:px-6 sm:pb-16 sm:pt-8 lg:pt-10">

      <div className="mx-auto max-w-6xl">

        {/* Hero Banner: Signature Deep Plum & Gold/Rose luxury gradient */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#20111a] via-[#2f1221] to-[#4a172f] px-6 py-8 text-white shadow-[0_24px_60px_rgba(32,17,26,.24)] sm:px-9 sm:py-10">

          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#e11d48]/20 blur-3xl pointer-events-none" />

          <div className="absolute top-1/2 -left-12 h-56 w-56 rounded-full bg-[#d9b36c]/15 blur-3xl pointer-events-none" />

          <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full border-[24px] border-[#d9b36c]/10 pointer-events-none" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_260px] lg:items-end">

            <div>

              <span className="inline-flex items-center gap-2 rounded-full border border-[#f1d18f]/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#f1d18f] backdrop-blur-md">
                <ShieldCheck className="h-4 w-4 text-[#f1d18f]" /> Trust & safety
              </span>

              <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                Make your profile feel safe and genuine.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-rose-100/80">
                Complete these simple checks to help people connect with confidence.
              </p>

            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md shadow-inner">

              <div className="flex items-center gap-4">
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-1"
                  style={{ background: `conic-gradient(#e11d48 ${progress * 3.6}deg, rgba(255,255,255,.14) 0deg)` }}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[#20111a] text-sm font-black text-white shadow-md">
                    {progress}%
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#f1d18f]">Verification progress</p>
                  <p className="mt-1 text-xl font-black text-white">{done} of {steps.length} complete</p>
                </div>
              </div>

            </div>

          </div>

        </section>



        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Checklist Main Section */}
          <section className="rounded-[2rem] border border-[#f0e6ea] bg-white p-5 shadow-sm sm:p-7">

            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#e11d48]">Your journey</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#20111a]">Verification checklist</h2>
              </div>
              {fullyVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e11d48] to-[#be123c] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-rose-500/25">
                  <Check className="h-4 w-4" /> Fully verified
                </span>
              )}
            </div>

            <div className="space-y-3">

              {steps.map((step, index) => {

                const Icon = step.icon;

                const complete = step.status === 'approved';

                const pending = step.status === 'pending';

                const rejected = step.status === 'rejected';

                /* Theme card styling: Rose for verified, Amber for review, Rose-soft for action needed, Neutral for not started */
                const cardAccent = complete
                  ? 'border-rose-100/80 bg-gradient-to-r from-[#fffafd] to-white shadow-[0_2px_10px_rgba(225,29,72,0.03)] hover:border-rose-200'
                  : pending
                  ? 'border-amber-200/80 bg-amber-50/40 shadow-[0_2px_10px_rgba(245,158,11,0.03)]'
                  : rejected
                  ? 'border-rose-300 bg-rose-50/60 shadow-[0_2px_10px_rgba(225,29,72,0.06)]'
                  : 'border-[#f0e6ea] bg-white hover:border-rose-100';

                const iconStyle = complete
                  ? 'bg-gradient-to-br from-[#e11d48] to-[#be123c] text-white shadow-md shadow-rose-500/25'
                  : pending
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : rejected
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-[#faf4f6] text-[#8e3d58] border border-[#f2e4e9]';

                const badgeStyle = complete
                  ? 'bg-[#fff0f4] text-[#e11d48] border border-[#fecdd3]'
                  : pending
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : rejected
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200';

                return (
                  <motion.article
                    key={step.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * .06 }}
                    className={`rounded-2xl border p-4.5 transition-all ${cardAccent}`}
                  >

                    <div className="flex gap-4">
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconStyle}`}>
                        {complete ? <Check className="h-5 w-5 stroke-[2.5]" /> : pending ? <Clock className="h-5 w-5" /> : rejected ? <AlertCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                              Step {String(index + 1).padStart(2, '0')}
                            </p>
                            <h3 className="mt-1 font-bold text-[#20111a]">{step.title}</h3>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeStyle}`}>
                            {documentsError && (step.id === 'selfie' || step.id === 'document') ? 'Unavailable' : statusCopy[step.status]}
                          </span>
                        </div>

                        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.description}</p>

                        {step.id === 'selfie' && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            Your selfie is private and will be reviewed by our team. It is not automatically approved or shown on your public profile.
                          </p>
                        )}

                        {rejected && step.reason && (
                          <p className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 shadow-2xs">
                            {step.reason}
                          </p>
                        )}

                        {complete ? (
                          <button
                            disabled
                            type="button"
                            className="mt-4 inline-flex cursor-default items-center gap-1.5 rounded-xl border border-[#fecdd3] bg-[#fff0f4] px-3.5 py-2 text-xs font-bold text-[#e11d48]"
                          >
                            <Check className="h-4 w-4 stroke-[2.5]" /> Verified
                          </button>
                        ) : pending ? (
                          <button
                            disabled
                            type="button"
                            className="mt-4 inline-flex cursor-default items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800"
                          >
                            <Clock className="h-4 w-4" /> Under review
                          </button>
                        ) : step.id === 'document' ? (
                          <div className="mt-4 space-y-3">
                            <input
                              ref={documentInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={handleGovernmentIdFile}
                              aria-label="Choose a government ID file"
                            />
                            <div className="flex flex-wrap gap-2">
                              <label className="sr-only" htmlFor="government-id-type">Government ID type</label>
                              <select
                                id="government-id-type"
                                value={governmentIdType}
                                onChange={(event) => setGovernmentIdType(event.target.value)}
                                disabled={isUploadingDocument || Boolean(documentsError)}
                                className="min-h-10 rounded-xl border border-[#f0e6ea] bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/10 disabled:opacity-50"
                              >
                                <option value="AADHAAR">Aadhaar Card</option>
                                <option value="PAN">PAN Card</option>
                                <option value="PASSPORT">Passport</option>
                                <option value="DRIVING_LICENCE">Driving Licence</option>
                                <option value="VOTER_ID">Voter ID</option>
                              </select>
                              <button
                                type="button"
                                disabled={isUploadingDocument || Boolean(documentsError)}
                                onClick={() => documentInputRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#e11d48] px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isUploadingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {isUploadingDocument ? 'Submitting…' : 'Upload Government ID'}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              PDF up to 10 MB, or JPEG, PNG, or WebP image up to 5 MB. Your document is private and reviewed by our team.
                            </p>
                            {documentsError && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="alert">
                                Document status is unavailable.{' '}
                                <button type="button" className="font-bold underline" onClick={() => void refetchDocuments()}>Retry</button>
                              </div>
                            )}
                          </div>
                        ) : step.id === 'selfie' ? (
                          <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <button
                              type="button"
                              disabled={isUploadingDocument || cameraStarting || Boolean(documentsError)}
                              onClick={() => void openCamera()}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e11d48] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                              {cameraStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                              {cameraStarting ? 'Opening camera…' : 'Start live verification'}
                            </button>
                            {documentsError && (
                              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="alert">
                                Selfie status is unavailable.{' '}
                                <button type="button" className="font-bold underline" onClick={() => void refetchDocuments()}>Retry</button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Link
                            href={step.href ?? '/profile/edit'}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#e11d48] px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#be123c]"
                          >
                            {rejected ? 'Update details' : step.action}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </div>

                  </motion.article>
                );

              })}

            </div>

          </section>



          {/* Sidebar Info Cards */}
          <aside className="space-y-5">
            {/* Privacy Card: Signature Brand Wine/Rose & Gold Accent */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#20111a] via-[#351525] to-[#541c33] p-6 text-white shadow-xl shadow-rose-950/10">
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[#d9b36c]/15 blur-2xl pointer-events-none" />
              <LockKeyhole className="h-8 w-8 text-[#f1d18f]" />
              <h2 className="mt-5 text-xl font-black">Your data stays private.</h2>
              <p className="mt-3 text-sm leading-relaxed text-rose-100/80">
                Documents and verification details are reviewed securely and are never visible to other members.
              </p>
              <div className="mt-6 border-t border-white/15 pt-5 text-xs font-bold text-rose-100/90">
                Safe matching starts with trusted profiles.
              </div>
            </section>

            {/* Support Help Card */}
            <section className="rounded-[2rem] border border-[#f0e6ea] bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#e11d48]">Need help?</p>
              <h2 className="mt-2 text-lg font-black text-[#20111a]">Talk to our support team</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                We can help if a verification item was rejected or you are unsure what to upload.
              </p>
              <Link
                href="/tickets"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#e11d48] transition hover:text-[#be123c]"
              >
                Contact support <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </aside>

        </div>

      </div>

      {showCamera && portalRoot && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="selfie-camera-title" aria-describedby="selfie-camera-description" className="ui-modal-panel my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,.32)]">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-[#e11d48] border border-rose-100"><Camera className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h2 id="selfie-camera-title" className="text-base font-black text-[#20111a] sm:text-lg">Live photo verification</h2>
                  <p id="selfie-camera-description" className="mt-1 text-xs leading-relaxed text-slate-500">Center your face in the frame, then capture a current selfie.</p>
                </div>
              </div>
              <button type="button" onClick={stopCamera} aria-label="Close camera" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><X className="h-5 w-5" /></button>
            </header>

            <div className="px-5 pt-4 sm:px-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold" aria-live="polite">
                <span className={`h-2 w-2 rounded-full ${cameraReady ? 'bg-[#e11d48]' : 'animate-pulse bg-amber-500'}`} />
                <span className={cameraReady ? 'text-[#e11d48] font-bold' : 'text-amber-700'}>{cameraReady ? 'Camera ready' : 'Connecting to camera…'}</span>
              </div>
              <div className="relative mx-auto aspect-[3/4] max-h-[min(52dvh,30rem)] w-full max-w-[20rem] overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-200">
                <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setCameraReady(true)} onCanPlay={() => setCameraReady(true)} className="h-full w-full scale-x-[-1] object-cover" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-[12%] rounded-[48%] border-2 border-[#e11d48]/80 shadow-[0_0_0_999px_rgba(15,23,42,.3)]" />
                {!cameraReady && <div className="absolute inset-0 grid place-items-center bg-slate-950/35 text-white"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>}
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">Your selfie is private and goes to the verification team for manual review.</p>
            </div>

            <footer className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
              <button type="button" onClick={stopCamera} className="min-h-11 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void captureSelfie()} disabled={!cameraReady || isUploadingDocument} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e11d48] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-50">
                {isUploadingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isUploadingDocument ? 'Submitting selfie…' : 'Capture selfie'}
              </button>
            </footer>
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          </section>
        </div>,
        portalRoot,
      )}

      {toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{toast}</div>}

    </main>

  );

}

