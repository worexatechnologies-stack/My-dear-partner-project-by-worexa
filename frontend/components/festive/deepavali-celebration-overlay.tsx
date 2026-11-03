'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowRight, RotateCcw } from 'lucide-react';
import SiteLogo from '@/components/branding/site-logo';
import DeepavaliDiya from './deepavali-diya';
import DeepavaliRangoli from './deepavali-rangoli';
import DeepavaliCanvas, { DeepavaliCanvasHandle } from './deepavali-canvas';

interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay?: () => void;
}

export default function DeepavaliCelebrationOverlay({
  isOpen,
  onClose,
  onReplay,
}: CelebrationOverlayProps) {
  // 5 Diyas on the altar (center is pre-lit, 4 side ones can be interactively lit!)
  const [diyasLit, setDiyasLit] = useState<boolean[]>([false, false, true, false, false]);
  const [allLitCelebrated, setAllLitCelebrated] = useState<boolean>(false);

  const canvasRef = useRef<DeepavaliCanvasHandle | null>(null);

  // Launch initial welcome firework on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        canvasRef.current?.launchRocket(window.innerWidth * 0.5, window.innerHeight * 0.28);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle lighting a specific diya
  const handleLightDiya = (index: number, event?: React.MouseEvent) => {
    if (diyasLit[index]) return;

    // Trigger local fireworks burst at the Diya position
    if (event) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      canvasRef.current?.burst(rect.x + rect.width / 2, rect.y);
    } else {
      canvasRef.current?.burst();
    }

    const nextState = [...diyasLit];
    nextState[index] = true;
    setDiyasLit(nextState);

    // Check if all are now lit!
    if (nextState.every(Boolean)) {
      setAllLitCelebrated(true);
      setTimeout(() => {
        canvasRef.current?.grandFinale();
      }, 300);
    }
  };

  // Light all diyas at once
  const lightAllDiyas = () => {
    setDiyasLit([true, true, true, true, true]);
    setAllLitCelebrated(true);
    canvasRef.current?.grandFinale();
  };

  // Reset/Replay
  const handleReset = () => {
    setDiyasLit([false, false, true, false, false]);
    setAllLitCelebrated(false);
    canvasRef.current?.launchRocket(window.innerWidth * 0.5, window.innerHeight * 0.28);
    onReplay?.();
  };

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[115] flex flex-col items-center justify-between overflow-y-auto overflow-x-hidden p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background:
              'radial-gradient(circle at 50% 30%, #351022 0%, #200a16 45%, #12040c 100%)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Happy Deepavali Celebration"
        >
          {/* Animated Background Fireworks & Golden Embers */}
          <DeepavaliCanvas ref={canvasRef} interactiveClick={false} ambientEmbers={true} />

          {/* Golden Rotating Rangoli Mandala Centerpiece */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <DeepavaliRangoli size={680} opacity={0.22} />
          </div>

          {/* Top Bar: Brand & Controls */}
          <header className="relative z-10 w-full max-w-6xl flex items-center justify-between pt-2">
            {/* My Dear Partner Logo & Tagline */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-rose-900/40 p-1.5 shadow-[0_0_20px_rgba(251,191,36,0.25)] border border-amber-300/30 backdrop-blur-md">
                <SiteLogo alt="My Dear Partner" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white drop-shadow">
                  MyDear<span className="text-amber-400">Partner</span>
                </span>
                <p className="text-[10px] sm:text-xs font-semibold tracking-wider text-amber-200/80 uppercase">
                  Festival of Lights Special
                </p>
              </div>
            </div>

            {/* Skip/Close Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                title="Skip and go to website"
                className="flex items-center gap-1 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md border border-white/15 hover:bg-white/25 hover:text-white transition cursor-pointer"
                aria-label="Close celebration"
              >
                <span>Skip</span>
                <X className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </header>

          {/* Center Showcase: Grand Festive Greeting & Interactive Altar */}
          <main className="relative z-10 my-auto flex flex-col items-center text-center max-w-3xl px-2 py-6">
            {/* Shimmering Badge */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 px-4 py-1.5 text-xs font-bold text-amber-200 border border-amber-300/35 shadow-[0_0_20px_rgba(251,191,36,0.2)] backdrop-blur-md mb-4"
            >
              <span>Deepavali Celebrations 2026</span>
            </motion.div>

            {/* Grand Headline: Happy Deepavali in Luxurious Gold Gradient */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.7 }}
              className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFFBEB] via-[#FDE047] to-[#D97706] drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)]"
            >
              Happy Deepavali
            </motion.h1>

            {/* Festive Greeting Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-3 sm:mt-4 text-base sm:text-xl font-medium text-amber-100/90 max-w-xl leading-relaxed"
            >
              May this festival of lights bring happiness, love and new beginnings.
            </motion.p>

            {/* Matrimony Blessing */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6 }}
              className="mt-1 text-xs sm:text-sm text-amber-200/70 max-w-md font-normal"
            >
              May the divine glow illuminate your path to finding your lifelong partner & eternal bond.
            </motion.p>

            {/* Interactive Diya Altar (Row of 5 Diyas) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.7 }}
              className="mt-8 sm:mt-10 flex flex-col items-center"
            >
              <div className="flex items-end justify-center gap-3 sm:gap-6 md:gap-8 p-4 rounded-3xl bg-black/25 backdrop-blur-md border border-amber-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {/* Diya 1 (Left Outer) */}
                <div onClick={(e) => handleLightDiya(0, e)}>
                  <DeepavaliDiya
                    size="md"
                    isLit={diyasLit[0]}
                    interactive={!diyasLit[0]}
                    label="Love"
                    className="hover:scale-110 transition-transform"
                  />
                </div>

                {/* Diya 2 (Left Inner) */}
                <div onClick={(e) => handleLightDiya(1, e)}>
                  <DeepavaliDiya
                    size="lg"
                    isLit={diyasLit[1]}
                    interactive={!diyasLit[1]}
                    label="Joy"
                    className="hover:scale-110 transition-transform"
                  />
                </div>

                {/* Diya 3 (Center Sacred Grand Diya - Always Lit) */}
                <div
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    canvasRef.current?.burst(rect.x + rect.width / 2, rect.y);
                  }}
                  className="cursor-pointer"
                  title="Click for celebratory fireworks!"
                >
                  <DeepavaliDiya
                    size="xl"
                    isLit={diyasLit[2]}
                    interactive={true}
                    label="Happiness"
                    className="hover:scale-105 transition-transform"
                  />
                </div>

                {/* Diya 4 (Right Inner) */}
                <div onClick={(e) => handleLightDiya(3, e)}>
                  <DeepavaliDiya
                    size="lg"
                    isLit={diyasLit[3]}
                    interactive={!diyasLit[3]}
                    label="Peace"
                    className="hover:scale-110 transition-transform"
                  />
                </div>

                {/* Diya 5 (Right Outer) */}
                <div onClick={(e) => handleLightDiya(4, e)}>
                  <DeepavaliDiya
                    size="md"
                    isLit={diyasLit[4]}
                    interactive={!diyasLit[4]}
                    label="Prosperity"
                    className="hover:scale-110 transition-transform"
                  />
                </div>
              </div>

              {/* Interactive prompt & All Lit Message */}
              <div className="mt-4 flex flex-col items-center">
                {!allLitCelebrated ? (
                  <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300 animate-pulse">
                    <span>Click the unlit Diyas to light them up and spread the festive joy!</span>
                  </p>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-4 py-1 text-xs sm:text-sm font-extrabold text-[#3a0815] shadow-lg animate-bounce">
                    <span>All Diyas Illuminated! May Your Life Be Filled with Endless Light & Love!</span>
                  </div>
                )}
              </div>
            </motion.div>
          </main>

          {/* Bottom Action Bar: Enter Website / Quick Fireworks / Replay */}
          <footer className="relative z-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-center gap-3 pb-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-8 py-3.5 text-sm sm:text-base font-extrabold text-[#3a0815] shadow-[0_4px_28px_rgba(245,158,11,0.45)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span>Explore Matches & Begin Your Journey</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {!allLitCelebrated ? (
              <button
                type="button"
                onClick={lightAllDiyas}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-5 py-3.5 text-xs sm:text-sm font-bold text-amber-200 border border-amber-300/30 hover:bg-white/15 hover:text-white transition cursor-pointer"
              >
                <span>Light All Diyas</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-5 py-3.5 text-xs sm:text-sm font-bold text-amber-200 border border-amber-300/30 hover:bg-white/15 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-amber-300" />
                <span>Replay Celebration</span>
              </button>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
