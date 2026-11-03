'use client';

import { useEffect, useRef } from 'react';

// Color palettes for skyshots with high contrast against light backgrounds
const CRACKER_PALETTES = [
  // Royal Diwali Gold & Crimson
  ['#dc2626', '#f59e0b', '#d97706', '#ef4444', '#fef08a'],
  // Emerald & Saffron
  ['#059669', '#10b981', '#ea580c', '#f59e0b', '#34d399'],
  // Electric Blue & Magenta
  ['#0284c7', '#38bdf8', '#c026d3', '#e879f9', '#ffffff'],
  // Imperial Violet & Gold
  ['#7c3aed', '#a855f7', '#f59e0b', '#fbbf24', '#ffffff'],
  // Multi-color Celebration
  ['#dc2626', '#f59e0b', '#059669', '#0284c7', '#7c3aed'],
];

interface RocketCracker {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  palette: string[];
  type: 'rocket' | 'skyshot';
  color: string;
  trail: { x: number; y: number; alpha: number; size: number }[];
  angle: number;
}

interface StarParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  decay: number;
  gravity: number;
  drag: number;
  trail: { x: number; y: number; alpha: number }[];
  isCrackle?: boolean;
  crackleDelay?: number;
}

interface BlastFlash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export default function NavbarDiwaliEffects() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const rockets: RocketCracker[] = [];
    const stars: StarParticle[] = [];
    const flashes: BlastFlash[] = [];

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const newWidth = Math.max(rect.width, parent.offsetWidth, 300);
      const newHeight = Math.max(rect.height, parent.offsetHeight, 64);

      if (newWidth !== width || newHeight !== height) {
        width = newWidth;
        height = newHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();

    // Use ResizeObserver for accurate container dimensions
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', updateSize);

    // Detonate a Skyshot into firework stars
    const detonateSkyshot = (x: number, y: number, palette: string[], isRocket: boolean) => {
      // 1. Shockwave blast flash
      flashes.push({
        x,
        y,
        radius: 3,
        maxRadius: isRocket ? 22 : 18,
        color: palette[0],
        alpha: 0.9,
      });

      // 2. Star burst particles
      const starCount = isRocket ? 26 : 22;
      for (let i = 0; i < starCount; i++) {
        const angle = (Math.PI * 2 * i) / starCount + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * (isRocket ? 3.0 : 2.5) + 1.0;
        const color = palette[Math.floor(Math.random() * palette.length)];

        stars.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.85, // slightly oval to fill navbar width
          color,
          alpha: 1,
          size: Math.random() * 2.2 + 1.8,
          decay: Math.random() * 0.025 + 0.02,
          gravity: 0.045,
          drag: 0.965,
          trail: [],
        });
      }

      // 3. Crackle stars (delayed secondary mini pops)
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.8 + 0.6;
        stars.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ffffff',
          alpha: 1,
          size: 1.5,
          decay: 0.035,
          gravity: 0.03,
          drag: 0.96,
          trail: [],
          isCrackle: true,
          crackleDelay: Math.floor(Math.random() * 10) + 12,
        });
      }
    };

    // Launch a Rocket cracker (distinct conical missile with fiery fuse)
    const launchRocket = (customX?: number) => {
      updateSize();
      if (width <= 0) width = window.innerWidth || 800;
      if (height <= 0) height = 64;

      const x = customX ?? (Math.random() * (width - 160) + 80);
      const targetY = Math.random() * (height * 0.4) + 8; // reaches upper navbar area
      const palette = CRACKER_PALETTES[Math.floor(Math.random() * CRACKER_PALETTES.length)];
      const vx = (Math.random() - 0.5) * 1.2;
      const vy = -(Math.random() * 1.5 + 4.2);

      rockets.push({
        x,
        y: height + 8,
        vx,
        vy,
        targetY,
        palette,
        type: 'rocket',
        color: palette[0],
        trail: [],
        angle: Math.atan2(vy, vx) + Math.PI / 2,
      });
    };

    // Launch a Skyshot mortar shell (rapid-fire comet shell)
    const launchSkyshot = (customX?: number) => {
      updateSize();
      if (width <= 0) width = window.innerWidth || 800;
      if (height <= 0) height = 64;

      const x = customX ?? (Math.random() * (width - 160) + 80);
      const targetY = Math.random() * (height * 0.45) + 10;
      const palette = CRACKER_PALETTES[Math.floor(Math.random() * CRACKER_PALETTES.length)];
      const vx = (Math.random() - 0.5) * 0.8;
      const vy = -(Math.random() * 1.2 + 3.8);

      rockets.push({
        x,
        y: height + 6,
        vx,
        vy,
        targetY,
        palette,
        type: 'skyshot',
        color: palette[1] || '#f59e0b',
        trail: [],
        angle: 0,
      });
    };

    // Rapid-fire Skyshot barrage (3 shots in rapid succession)
    const fireSkyshotBarrage = () => {
      updateSize();
      const baseX = Math.random() * (width - 240) + 120;
      launchSkyshot(baseX - 35);
      setTimeout(() => launchSkyshot(baseX), 180);
      setTimeout(() => launchSkyshot(baseX + 35), 360);
    };

    // Welcome barrage on initial page load: 2 rockets & 1 skyshot barrage
    const initTimers = [
      setTimeout(() => launchRocket(width * 0.22 || 180), 200),
      setTimeout(() => launchRocket(width * 0.78 || 650), 500),
      setTimeout(() => fireSkyshotBarrage(), 900),
    ];

    // Recurring cracker show every 1.8 - 2.8s
    let crackerShowTimer: NodeJS.Timeout | null = null;
    const scheduleNextCracker = () => {
      const delay = Math.random() * 1000 + 1800;
      crackerShowTimer = setTimeout(() => {
        if (!document.hidden) {
          const mode = Math.random();
          if (mode < 0.45) {
            // Launch single or twin rockets
            launchRocket();
            if (Math.random() > 0.5) {
              setTimeout(() => launchRocket(), 220);
            }
          } else if (mode < 0.8) {
            // Rapid-fire skyshot barrage
            fireSkyshotBarrage();
          } else {
            // Combined rocket + skyshot
            launchRocket();
            setTimeout(() => launchSkyshot(), 250);
          }
        }
        scheduleNextCracker();
      }, delay);
    };

    scheduleNextCracker();

    // Main animation loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw and update Blast Flashes
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.radius += (f.maxRadius - f.radius) * 0.35 + 0.8;
        f.alpha *= 0.78;

        if (f.alpha <= 0.05 || f.radius >= f.maxRadius) {
          flashes.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = f.alpha * 0.6;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glowing core
        ctx.globalAlpha = f.alpha * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Draw and update Rockets & Skyshots in flight
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;

        // Exhaust trail
        r.trail.push({ x: r.x, y: r.y, alpha: 1, size: r.type === 'rocket' ? 3.5 : 2.8 });
        if (r.trail.length > 10) r.trail.shift();

        // Render dense fiery exhaust tail
        for (let j = 0; j < r.trail.length; j++) {
          const pt = r.trail[j];
          pt.alpha *= 0.82;
          const ratio = j / r.trail.length;
          ctx.save();
          ctx.globalAlpha = pt.alpha * 0.95;
          ctx.fillStyle = j % 2 === 0 ? '#ea580c' : '#fbbf24';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(pt.x + (Math.random() - 0.5) * 1.5, pt.y, ratio * pt.size + 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(r.x, r.y);

        if (r.type === 'rocket') {
          // Draw distinct Rocket body
          ctx.rotate(r.angle || 0);

          // Rocket stick / tail fuse
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, 9);
          ctx.stroke();

          // Rocket red cylindrical body
          ctx.fillStyle = '#dc2626';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 6;
          ctx.fillRect(-2, -7, 4, 7);

          // Rocket golden nose cone
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-2.5, -7);
          ctx.lineTo(0, -12);
          ctx.lineTo(2.5, -7);
          ctx.closePath();
          ctx.fill();

          // Thruster flame at base
          ctx.fillStyle = '#fef08a';
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(-1.5, 0);
          ctx.lineTo(0, Math.random() * 5 + 4);
          ctx.lineTo(1.5, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw Skyshot luminous comet sphere
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = r.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = r.color;
          ctx.beginPath();
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Check if rocket reached apex
        if (r.y <= r.targetY || r.vy >= 0) {
          detonateSkyshot(r.x, r.y, r.palette, r.type === 'rocket');
          rockets.splice(i, 1);
        }
      }

      // 3. Draw and update Star Particles from bursts
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];

        // Handle delayed crackle burst
        if (s.isCrackle && s.crackleDelay !== undefined) {
          s.crackleDelay--;
          if (s.crackleDelay <= 0) {
            // Mini crackle pop flash
            flashes.push({
              x: s.x,
              y: s.y,
              radius: 1,
              maxRadius: 7,
              color: '#ffffff',
              alpha: 0.9,
            });
            stars.splice(i, 1);
            continue;
          }
        }

        // Apply physical drag and gravity
        s.x += s.vx;
        s.y += s.vy;
        s.vy += s.gravity;
        s.vx *= s.drag;
        s.vy *= s.drag;
        s.alpha -= s.decay;

        if (s.alpha <= 0) {
          stars.splice(i, 1);
          continue;
        }

        // Store trail
        s.trail.push({ x: s.x, y: s.y, alpha: s.alpha });
        if (s.trail.length > 4) s.trail.shift();

        // Draw star trail
        for (let j = 0; j < s.trail.length; j++) {
          const t = s.trail[j];
          ctx.save();
          ctx.globalAlpha = t.alpha * 0.45;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(t.x, t.y, (j / s.trail.length) * (s.size * 0.7), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw vibrant star core
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Hot white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) resizeObserver.disconnect();
      initTimers.forEach(clearTimeout);
      if (crackerShowTimer) clearTimeout(crackerShowTimer);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
