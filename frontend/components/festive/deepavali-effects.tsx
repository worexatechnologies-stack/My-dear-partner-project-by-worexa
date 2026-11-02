'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { usePathname } from 'next/navigation';

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
            Celebrate
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
  const pathname = usePathname();
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isCelebrationActive, setIsCelebrationActive] = useState<boolean>(false);
  const [floatingDiyas, setFloatingDiyas] = useState<FloatingDiya[]>([]);
  const [diyaHidden, setDiyaHidden] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rocketsRef = useRef<Rocket[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      audioCtxRef.current ??= new AudioCtx();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playRocketLaunchSound = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = 'triangle';
    whistle.frequency.setValueAtTime(380, now);
    whistle.frequency.exponentialRampToValueAtTime(1180, now + 0.85);
    whistle.frequency.exponentialRampToValueAtTime(720, now + 1.05);
    whistleGain.gain.setValueAtTime(0.0001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.035, now + 0.08);
    whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
    whistle.connect(whistleGain).connect(ctx.destination);
    whistle.start(now);
    whistle.stop(now + 1.1);

    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.05), ctx.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.8);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.02);
    source.connect(filter).connect(noiseGain).connect(ctx.destination);
    source.start(now);
    source.stop(now + 1.05);
  }, [getAudioContext, soundEnabled]);

  const playFireworkExplosion = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const duration = 0.72;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    const burst = ctx.createBufferSource();
    const lowPass = ctx.createBiquadFilter();
    const burstGain = ctx.createGain();
    burst.buffer = buffer;
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(5200, now);
    lowPass.frequency.exponentialRampToValueAtTime(180, now + duration);
    burstGain.gain.setValueAtTime(0.0001, now);
    burstGain.gain.exponentialRampToValueAtTime(0.24, now + 0.012);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    burst.connect(lowPass).connect(burstGain).connect(ctx.destination);
    burst.start(now);
    burst.stop(now + duration);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(105, now);
    boom.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.32, now + 0.01);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    boom.connect(boomGain).connect(ctx.destination);
    boom.start(now);
    boom.stop(now + 0.48);
  }, [getAudioContext, soundEnabled]);

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
    playRocketLaunchSound();
  }, [playRocketLaunchSound]);

  useEffect(() => {
    if (!soundEnabled) return;
    const unlockAudio = () => {
      const ctx = getAudioContext();
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, [getAudioContext, soundEnabled]);

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
          playFireworkExplosion();
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
  }, [createExplosion, playFireworkExplosion]);

  // Grand celebration trigger
  const triggerGrandCelebration = useCallback(() => {
    setIsCelebrationActive(true);
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
  }, [launchRocket]);

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

  // A gentle firework on each route keeps the celebration visible throughout the app.
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        launchRocket(window.innerWidth * 0.5, window.innerHeight * 0.32);
      }
    }, 700);
    return () => clearTimeout(welcomeTimer);
  }, [launchRocket, pathname]);

  return (
    <>
      {/* Fullscreen transparent canvas for fireworks */}
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
              <span className="h-1 w-4 rounded-full bg-amber-300/80" />
            </div>
          </div>
        </div>
      ))}

      {/* Interactive Floating Diya Widget (Bottom Right Corner) */}
      {!diyaHidden && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-50 flex flex-col items-end sm:bottom-5 sm:right-5">
          {/* Controls pill: sound & dismiss */}
          <div className="mb-1.5 flex items-center gap-1 rounded-full bg-stone-900/85 px-2 py-0.5 text-[10px] text-amber-300 backdrop-blur-md border border-amber-500/25 shadow-md">
            <span className="font-semibold hidden sm:inline">Light Diya 🪔</span>
            <button
              type="button"
              onClick={() => {
                if (!soundEnabled) {
                  const ctx = getAudioContext();
                  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
                }
                setSoundEnabled((v) => !v);
              }}
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

          </button>
        </div>
      )}
    </>
  );
}
