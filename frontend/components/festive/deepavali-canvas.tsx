'use client';

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface DeepavaliCanvasHandle {
  burst: (x?: number, y?: number, colorSet?: string[]) => void;
  launchRocket: (startX?: number, targetY?: number) => void;
  grandFinale: () => void;
}

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
  gravity: number;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
}

interface AmbientEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

const FESTIVE_PALETTE = [
  '#FFD700', // Royal Gold
  '#FFA500', // Saffron Amber
  '#FF4500', // Marigold Orange
  '#FF1493', // Royal Ruby / Rose
  '#FFF8DC', // Shimmering Warm White
  '#00FFCC', // Festive Cyan
  '#34D399', // Emerald
  '#E02424', // Crimson
  '#FBBF24', // Yellow Gold
];

const DeepavaliCanvas = forwardRef<DeepavaliCanvasHandle, { interactiveClick?: boolean; ambientEmbers?: boolean }>(
  ({ interactiveClick = true, ambientEmbers = true }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const rocketsRef = useRef<Rocket[]>([]);
    const embersRef = useRef<AmbientEmber[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const isPausedRef = useRef<boolean>(false);
    const reducedMotionRef = useRef<boolean>(false);

    // Create explosion burst
    const burst = useCallback((x?: number, y?: number, colorSet = FESTIVE_PALETTE) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const originX = x ?? Math.random() * (canvas.width * 0.7) + canvas.width * 0.15;
      const originY = y ?? Math.random() * (canvas.height * 0.45) + canvas.height * 0.12;
      const count = reducedMotionRef.current ? 25 : 65;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5.5 + 1.2;
        particlesRef.current.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colorSet[Math.floor(Math.random() * colorSet.length)],
          size: Math.random() * 2.8 + 1.2,
          alpha: 1,
          decay: Math.random() * 0.016 + 0.012,
          twinkle: Math.random() > 0.45,
          gravity: 0.055,
        });
      }
    }, []);

    // Launch rocket
    const launchRocket = useCallback((startX?: number, targetY?: number) => {
      if (reducedMotionRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const x = startX ?? Math.random() * (canvas.width * 0.7) + canvas.width * 0.15;
      const destY = targetY ?? Math.random() * (canvas.height * 0.4) + canvas.height * 0.12;

      rocketsRef.current.push({
        x,
        y: canvas.height,
        targetY: destY,
        vy: -(Math.random() * 3.5 + 8.5),
        color: '#FFD700',
      });
    }, []);

    // Grand celebratory finale
    const grandFinale = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const count = reducedMotionRef.current ? 2 : 6;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const x = (canvas.width / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 60;
          launchRocket(x, canvas.height * (0.15 + Math.random() * 0.25));
        }, i * 320);
      }
    }, [launchRocket]);

    useImperativeHandle(ref, () => ({
      burst,
      launchRocket,
      grandFinale,
    }));

    // Initialize ambient embers
    useEffect(() => {
      if (!ambientEmbers) return;
      const count = 30;
      const embers: AmbientEmber[] = [];
      const w = window.innerWidth;
      const h = window.innerHeight;

      for (let i = 0; i < count; i++) {
        embers.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(Math.random() * 0.6 + 0.3),
          size: Math.random() * 2.2 + 0.8,
          alpha: Math.random() * 0.6 + 0.2,
          pulseSpeed: Math.random() * 0.03 + 0.01,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
      embersRef.current = embers;
    }, [ambientEmbers]);

    // Canvas render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Check reduced motion
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionRef.current = mediaQuery.matches;

      const handleResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      // Handle visibility changes to pause during inactive tab
      const handleVisibilityChange = () => {
        isPausedRef.current = document.hidden;
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      let lastTime = performance.now();

      const render = (time: number) => {
        animFrameRef.current = requestAnimationFrame(render);
        if (isPausedRef.current) return;

        // Skip excessive frames
        const delta = time - lastTime;
        if (delta < 12) return; // Cap at ~80fps
        lastTime = time;

        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        // 1. Draw Ambient Golden Embers
        if (ambientEmbers) {
          const embers = embersRef.current;
          for (let i = 0; i < embers.length; i++) {
            const e = embers[i];
            e.y += e.vy;
            e.x += e.vx + Math.sin(time * 0.001 + e.pulsePhase) * 0.3;
            e.pulsePhase += e.pulseSpeed;

            // Wrap around bottom
            if (e.y < -10) {
              e.y = h + 10;
              e.x = Math.random() * w;
            }

            const currentAlpha = Math.max(0.1, e.alpha * (0.6 + Math.sin(e.pulsePhase) * 0.4));
            ctx.save();
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = currentAlpha;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#FFA500';
            ctx.fill();
            ctx.restore();
          }
        }

        // 2. Rockets update & draw
        const rockets = rocketsRef.current;
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.y += r.vy;

          // Sparkle tail
          particlesRef.current.push({
            x: r.x + (Math.random() - 0.5) * 3,
            y: r.y + 4,
            vx: (Math.random() - 0.5) * 1.2,
            vy: Math.random() * 2 + 1,
            color: '#FFA500',
            size: Math.random() * 1.8 + 0.8,
            alpha: 0.85,
            decay: 0.04,
            twinkle: false,
            gravity: 0.02,
          });

          // Rocket head
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#FFD700';
          ctx.fill();

          if (r.y <= r.targetY) {
            burst(r.x, r.y);
            rockets.splice(i, 1);
          }
        }

        // 3. Explosion Particles
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.985;
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.beginPath();
          const displayAlpha = p.twinkle && Math.random() > 0.45 ? p.alpha * 0.45 : p.alpha;
          ctx.globalAlpha = Math.max(0, displayAlpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      };

      animFrameRef.current = requestAnimationFrame(render);

      return () => {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }, [burst, ambientEmbers]);

    // Optional click burst on screen
    useEffect(() => {
      if (!interactiveClick) return;

      const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('button') ||
          target.closest('a')
        ) {
          return;
        }

        // 10 sparkling micro-stars at click point
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          particlesRef.current.push({
            x: e.clientX,
            y: e.clientY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.4,
            color: FESTIVE_PALETTE[Math.floor(Math.random() * FESTIVE_PALETTE.length)],
            size: Math.random() * 2.2 + 1,
            alpha: 0.95,
            decay: 0.028,
            twinkle: true,
            gravity: 0.04,
          });
        }
      };

      window.addEventListener('pointerdown', handlePointerDown);
      return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [interactiveClick]);

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[120]"
        style={{ width: '100vw', height: '100vh' }}
      />
    );
  }
);

DeepavaliCanvas.displayName = 'DeepavaliCanvas';
export default DeepavaliCanvas;
