'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, Volume2, VolumeX } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  twinkle: boolean;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
}

interface FloatingDiya {
  id: number;
  x: number;
  y: number;
  speed: number;
  scale: number;
  opacity: number;
}

export function triggerDeepavaliCelebration() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deepavali:celebrate'));
  }
}

export function DeepavaliBanner() {
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('mdp_deepavali_banner_dismissed_2026');
      if (dismissed === 'true') {
        setShowBanner(false);
      }
    }
  }, []);

  const dismissBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mdp_deepavali_banner_dismissed_2026', 'true');
    }
  };

  if (!showBanner) return null;

  return (
    <div className="mx-auto mb-2 max-w-7xl">
      <div className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-[#7a1428] via-[#b4324f] to-[#d97706] px-3.5 py-1.5 text-xs text-white shadow-[0_4px_20px_rgba(180,50,79,0.25)] border border-amber-300/30 backdrop-blur-md sm:px-5 sm:py-2 sm:text-sm">
        <div className="flex flex-1 items-center justify-center gap-2 font-medium">
          <span className="text-base sm:text-lg animate-bounce" role="img" aria-label="diya">
            🪔
          </span>
          <span className="truncate sm:overflow-visible text-center">
            <strong className="text-amber-200">Shubh Deepavali!</strong> May this festival of lights illuminate your journey to finding your soulmate.
          </span>
          <button
            type="button"
            onClick={triggerDeepavaliCelebration}
            className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-0.5 text-xs font-bold text-[#420a16] shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="h-3 w-3 text-[#420a16]" />
            Celebrate ✨
          </button>
        </div>

        <button
          type="button"
          onClick={dismissBanner}
          title="Dismiss banner"
          className="ml-2 shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white transition cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function DeepavaliEffects() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isCelebrationActive, setIsCelebrationActive] = useState<boolean>(false);
  const [floatingDiyas, setFloatingDiyas] = useState<FloatingDiya[]>([]);
  const [diyaHidden, setDiyaHidden] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rocketsRef = useRef<Rocket[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play pleasant celebratory chime using Web Audio API
  const playFestiveChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Pentatonic celebratory chime sequence
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch {
      // Audio autoplay restrictions
    }
  }, [soundEnabled]);

  // Burst firework particles at given coordinate
  const createExplosion = useCallback((x: number, y: number, count = 65) => {
    const festiveColors = [
      '#FFD700', // Gold
      '#FF8C00', // Deep Orange
      '#FF4500', // Red Orange
      '#FFF8DC', // Warm White
      '#FFA500', // Orange
      '#FF1493', // Deep Pink
      '#00FFCC', // Spark Cyan
      '#FFDF00', // Yellow
      '#E02424', // Crimson
    ];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 1.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: festiveColors[Math.floor(Math.random() * festiveColors.length)],
        size: Math.random() * 3 + 1.2,
        alpha: 1,
        decay: Math.random() * 0.018 + 0.012,
        twinkle: Math.random() > 0.4,
      });
    }
  }, []);

  // Launch a firecracker rocket shooting up from the bottom
  const launchRocket = useCallback((startX?: number, targetY?: number) => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = startX ?? Math.random() * (canvas.width * 0.7) + canvas.width * 0.15;
    const destY = targetY ?? Math.random() * (canvas.height * 0.45) + canvas.height * 0.1;

    rocketsRef.current.push({
      x,
      y: canvas.height,
      targetY: destY,
      vy: -(Math.random() * 4 + 9),
      color: '#FFD700',
    });
  }, []);

  // Subtle click sparkler anywhere on the page
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Don't trigger when clicking form inputs or dialogs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Add 8 golden sparks at click point
      const colors = ['#FFD700', '#FFA500', '#FFF8DC', '#FF69B4'];
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1;
        particlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 2 + 1,
          alpha: 0.9,
          decay: 0.03,
          twinkle: true,
        });
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Update & draw Rockets
      for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
        const rocket = rocketsRef.current[i];
        rocket.y += rocket.vy;

        // Sparkle trail
        particlesRef.current.push({
          x: rocket.x + (Math.random() - 0.5) * 4,
          y: rocket.y + 6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 2 + 1,
          color: '#FFA500',
          size: Math.random() * 2 + 1,
          alpha: 0.8,
          decay: 0.04,
          twinkle: false,
        });

        // Rocket head
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#FFD700';
        ctx.fill();

        if (rocket.y <= rocket.targetY) {
          createExplosion(rocket.x, rocket.y, 80);
          playFestiveChime();
          rocketsRef.current.splice(i, 1);
        }
      }

      // 2. Update & draw Explosion Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.065; // Gravity
        p.vx *= 0.985; // Air resistance
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        const displayAlpha = p.twinkle && Math.random() > 0.4 ? p.alpha * 0.5 : p.alpha;
        ctx.globalAlpha = Math.max(0, displayAlpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [createExplosion, playFestiveChime]);

  // Grand celebration trigger
  const triggerGrandCelebration = useCallback(() => {
    setIsCelebrationActive(true);
    playFestiveChime();

    // Launch multiple celebratory rockets
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        launchRocket(
          window.innerWidth * (0.2 + i * 0.15) + (Math.random() - 0.5) * 80,
          window.innerHeight * (0.2 + Math.random() * 0.25)
        );
      }, i * 350);
    }

    // Spawn floating diyas across the screen
    const newDiyas: FloatingDiya[] = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: (window.innerWidth / 9) * (i + 1) + (Math.random() - 0.5) * 40,
      y: window.innerHeight + Math.random() * 100,
      speed: Math.random() * 1.5 + 1.2,
      scale: Math.random() * 0.4 + 0.8,
      opacity: 1,
    }));
    setFloatingDiyas(newDiyas);

    setTimeout(() => {
      setIsCelebrationActive(false);
      setFloatingDiyas([]);
    }, 8000);
  }, [launchRocket, playFestiveChime]);

  // Listen for the global celebration custom event
  useEffect(() => {
    const handleCelebrateEvent = () => {
      triggerGrandCelebration();
    };
    window.addEventListener('deepavali:celebrate', handleCelebrateEvent);
    return () => window.removeEventListener('deepavali:celebrate', handleCelebrateEvent);
  }, [triggerGrandCelebration]);

  // Floating Diyas upward movement
  useEffect(() => {
    if (!floatingDiyas.length) return;
    const interval = setInterval(() => {
      setFloatingDiyas((prev) =>
        prev
          .map((diya) => ({
            ...diya,
            y: diya.y - diya.speed,
            opacity: diya.y < 120 ? Math.max(0, diya.y / 120) : 1,
          }))
          .filter((diya) => diya.y > -80)
      );
    }, 20);
    return () => clearInterval(interval);
  }, [floatingDiyas]);

  // Gentle welcome rocket on mount
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        launchRocket(window.innerWidth * 0.5, window.innerHeight * 0.32);
      }
    }, 1400);
    return () => clearTimeout(welcomeTimer);
  }, [launchRocket]);

  return (
    <>
      {/* Fullscreen transparent canvas for sparkles & crackers */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[9999]"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Floating Golden Diyas during Celebration Mode (Google Diwali Style) */}
      {isCelebrationActive && floatingDiyas.map((diya) => (
        <div
          key={diya.id}
          className="pointer-events-none fixed z-[9998] transition-opacity duration-300"
          style={{
            left: `${diya.x}px`,
            top: `${diya.y}px`,
            transform: `scale(${diya.scale})`,
            opacity: diya.opacity,
          }}
        >
          <div className="relative flex flex-col items-center">
            {/* Glowing Flame */}
            <div className="relative -mb-1 w-3.5 h-5 rounded-full bg-gradient-to-t from-orange-500 via-amber-300 to-yellow-100 shadow-[0_0_14px_#ff9900] animate-pulse" />
            {/* Diya Base */}
            <div className="w-10 h-5 rounded-b-full bg-gradient-to-b from-amber-700 via-amber-800 to-stone-900 border-t border-amber-400 shadow-md flex items-center justify-center">
              <span className="text-[9px] text-amber-300">✨</span>
            </div>
          </div>
        </div>
      ))}

      {/* Interactive Floating Diya Widget (Bottom Right Corner) */}
      {!diyaHidden && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
          {/* Controls pill: sound & dismiss */}
          <div className="mb-1.5 flex items-center gap-1 rounded-full bg-stone-900/85 px-2 py-0.5 text-[10px] text-amber-300 backdrop-blur-md border border-amber-500/25 shadow-md">
            <span className="font-semibold hidden sm:inline">Light Diya 🪔</span>
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'Mute sound' : 'Enable sound'}
              className="p-0.5 hover:text-white transition cursor-pointer"
              aria-label="Toggle festive sound"
            >
              {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => setDiyaHidden(true)}
              title="Close Diya"
              className="p-0.5 hover:text-white transition cursor-pointer"
              aria-label="Close Diya"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Diya Button */}
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              createExplosion(rect.x + rect.width / 2, rect.y);
              playFestiveChime();
              triggerGrandCelebration();
            }}
            className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
            aria-label="Interactive Deepavali Diya"
            title="Click to light Deepavali fireworks!"
          >
            {/* Ambient Warm Glow */}
            <div className="absolute -inset-4 rounded-full bg-amber-400/20 blur-xl group-hover:bg-amber-400/40 transition-all pointer-events-none" />

            {/* Flickering Flame */}
            <div className="relative -mb-1 flex justify-center items-center">
              <div className="w-5 h-7 rounded-full bg-gradient-to-t from-red-600 via-orange-400 to-amber-200 animate-pulse shadow-[0_0_24px_#ff7700] blur-[0.5px]" />
              <div className="absolute bottom-1 w-2.5 h-4 rounded-full bg-gradient-to-t from-amber-300 to-white" />
            </div>

            {/* Embellished Clay Diya SVG */}
            <svg
              className="w-14 h-8 drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
              viewBox="0 0 64 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 14 C12 2 52 2 60 14 C62 26 50 34 32 34 C14 34 2 26 4 14 Z"
                fill="url(#diyaClayGradient)"
                stroke="#D97706"
                strokeWidth="1.5"
              />
              <ellipse
                cx="32"
                cy="13"
                rx="26"
                ry="7"
                fill="url(#diyaOilGradient)"
                stroke="#F59E0B"
                strokeWidth="1"
              />
              <circle cx="16" cy="19" r="1.5" fill="#FDE68A" />
              <circle cx="24" cy="22" r="1.5" fill="#FDE68A" />
              <circle cx="32" cy="23" r="1.8" fill="#FDE68A" />
              <circle cx="40" cy="22" r="1.5" fill="#FDE68A" />
              <circle cx="48" cy="19" r="1.5" fill="#FDE68A" />

              <defs>
                <linearGradient id="diyaClayGradient" x1="32" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#B45309" />
                  <stop offset="0.6" stopColor="#78350F" />
                  <stop offset="1" stopColor="#451A03" />
                </linearGradient>
                <linearGradient id="diyaOilGradient" x1="32" y1="6" x2="32" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F59E0B" />
                  <stop offset="1" stopColor="#92400E" />
                </linearGradient>
              </defs>
            </svg>

            {/* Sparkle badge */}
            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-[#420a16] shadow-md animate-bounce">
              <Sparkles className="h-3 w-3" />
            </div>
          </button>
        </div>
      )}
    </>
  );
}
