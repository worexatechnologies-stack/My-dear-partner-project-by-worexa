'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import SiteLogo from '@/components/branding/site-logo';

const SEEN_KEY = 'mdp.welcome-seen';

export default function WelcomeSplash() {
  const [open, setOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const reduceMotion = useReducedMotion();

  const close = () => {
    window.sessionStorage.setItem(SEEN_KEY, 'true');
    setOpen(false);
  };

  useEffect(() => {
    if (window.sessionStorage.getItem(SEEN_KEY)) return;
    setOpen(true);
    return undefined;
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#2c2928]/35 px-4 py-6 backdrop-blur-sm sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
        >
          <motion.section
            className="relative w-full max-w-4xl overflow-hidden border border-[#eaded8] bg-[#fffefd] shadow-[0_28px_70px_rgba(64,52,43,.22)]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <div className="grid lg:grid-cols-[.92fr_1.08fr]">
              <div className="relative hidden min-h-[455px] overflow-hidden bg-[#dce4d5] lg:block">
                <Image src="/images/welcome-couple-garden.png" alt="A couple walking together in a garden" fill sizes="(max-width: 1024px) 0vw, 390px" className="object-cover object-center" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-[#4e453c]/45 via-transparent to-white/10" />
                <div className="absolute inset-x-7 bottom-7 border-l-2 border-[#f0c4c5] pl-4 text-white">
                  <p className="font-display text-2xl font-light leading-tight">Every story begins with a hello.</p>
                </div>
              </div>

              <div className="relative bg-[#fffefd] px-7 py-11 sm:px-12 sm:py-14">
                <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 bg-[#f7e7e2] [clip-path:polygon(100%_0,0_0,100%_100%)]" />
                <div className="relative">
                  <SiteLogo alt="My Dear Partner" className="h-11 w-11 object-contain" />
                  <p className="mt-8 font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Welcome to My Dear Partner</p>
                  <h1 id="welcome-title" className="mt-4 max-w-md font-display text-4xl font-light leading-[.94] tracking-[-.055em] text-[#2c2928] sm:text-5xl">
                    Your next chapter can start with a <em className="font-serif font-normal text-[#bd6970]">simple hello.</em>
                  </h1>
                  <p className="mt-6 max-w-md text-[15px] leading-7 text-stone-600">A thoughtful place to meet verified people who share your values, hopes and idea of a lasting partnership.</p>

                  <label className="mt-8 flex cursor-pointer items-start gap-3 border-y border-[#eaded8] py-4 text-xs leading-5 text-stone-600">
                    <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#bd6970]" />
                    <span>I agree to the <Link href="/terms" className="font-bold text-[#a8525c] underline underline-offset-2 hover:text-[#7d3a44]">Terms &amp; Conditions</Link> and acknowledge the <Link href="/privacy" className="font-bold text-[#a8525c] underline underline-offset-2 hover:text-[#7d3a44]">Privacy Policy</Link>.</span>
                  </label>

                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4">
                    <button type="button" onClick={close} disabled={!acceptedTerms} className="inline-flex items-center gap-3 border border-[#bd6970] bg-[#bd6970] px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-white transition hover:bg-[#a8525c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd6970] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-200 disabled:text-stone-400">
                      Begin your story <ArrowRight className="h-4 w-4" />
                    </button>
                    <span className="inline-flex items-center gap-2 text-xs text-stone-500"><ShieldCheck className="h-4 w-4 text-[#bd6970]" /> Private and verified</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
