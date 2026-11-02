'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
}

const FIREWORK_COLORS = ['#D99B32', '#E6B85C', '#C86A6A', '#F3D69A'];

export function DeepavaliBanner() {
  return (
    <div className="sticky top-0 z-[70] flex h-9 w-full items-center justify-center border-b border-[#eadfcf] bg-[#fffaf2] px-3 text-[#493c32]">
      <p className="truncate text-center text-[11px] sm:text-xs">
        <span className="font-semibold text-[#80502d]">Shubh Deepavali</span>{' '}
        <span className="text-[#6e6257]">Wishing you joy, light, and meaningful connections.</span>
      </p>
    </div>
  );
}

export default function DeepavaliEffects() {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rocketsRef = useRef<Rocket[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const enabled = pathname === '/' || pathname === '/dashboard';

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
        const rocket = rocketsRef.current[i];
        rocket.y -= rocket.speed;

        context.beginPath();
        context.arc(rocket.x, rocket.y, 2, 0, Math.PI * 2);
        context.fillStyle = '#FFF3D5';
        context.shadowBlur = 7;
        context.shadowColor = '#D99B32';
        context.fill();

        if (Math.random() > 0.45) {
          particlesRef.current.push({
            x: rocket.x + (Math.random() - 0.5) * 3,
            y: rocket.y + 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: Math.random() * 1.5 + 0.4,
            color: '#D99B32',
            alpha: 0.65,
            decay: 0.045,
            size: Math.random() * 1.4 + 0.6,
          });
        }

        if (rocket.y <= rocket.targetY) {
          for (let n = 0; n < 32; n++) {
            const angle = (Math.PI * 2 * n) / 32;
            const speed = Math.random() * 2.2 + 1;
            particlesRef.current.push({
              x: rocket.x,
              y: rocket.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
              alpha: 0.9,
              decay: Math.random() * 0.018 + 0.02,
              size: Math.random() * 1.8 + 0.8,
            });
          }
          rocketsRef.current.splice(i, 1);
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const particle = particlesRef.current[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.035;
        particle.vx *= 0.99;
        particle.alpha -= particle.decay;

        if (particle.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        context.globalAlpha = particle.alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frame);
      rocketsRef.current = [];
      particlesRef.current = [];
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      rocketsRef.current.push({
        x: window.innerWidth * (pathname === '/' ? 0.72 : 0.5),
        y: canvas.height,
        targetY: canvas.height * 0.28,
        speed: 10,
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[39]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
