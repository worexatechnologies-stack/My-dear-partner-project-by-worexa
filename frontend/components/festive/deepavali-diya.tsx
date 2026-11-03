'use client';

import React from 'react';

interface DiyaProps {
  isLit?: boolean;
  onLight?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showHalo?: boolean;
  interactive?: boolean;
  label?: string;
}

export default function DeepavaliDiya({
  isLit = true,
  onLight,
  size = 'md',
  className = '',
  showHalo = true,
  interactive = false,
  label,
}: DiyaProps) {
  const sizeMap = {
    sm: { w: 48, h: 28, flameW: 10, flameH: 16 },
    md: { w: 64, h: 36, flameW: 14, flameH: 22 },
    lg: { w: 88, h: 48, flameW: 18, flameH: 30 },
    xl: { w: 120, h: 64, flameW: 24, flameH: 40 },
  };

  const dim = sizeMap[size];

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${
        interactive ? 'cursor-pointer group' : ''
      } ${className}`}
      onClick={interactive && !isLit ? onLight : interactive ? onLight : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLight?.();
              }
            }
          : undefined
      }
      aria-label={label || (isLit ? 'Glowing Diya lamp' : 'Unlit Diya lamp - click to light')}
    >
      {/* Ambient warm radial glow halo when lit */}
      {isLit && showHalo && (
        <div
          className="absolute -top-3 rounded-full pointer-events-none transition-all duration-700 animate-pulse"
          style={{
            width: dim.w * 1.5,
            height: dim.h * 1.6,
            background:
              'radial-gradient(circle, rgba(255,170,0,0.35) 0%, rgba(255,100,0,0.15) 50%, transparent 75%)',
            filter: 'blur(10px)',
          }}
        />
      )}

      {/* Realistic Multi-layered Flickering Flame */}
      <div
        className="relative flex justify-center items-end"
        style={{ height: dim.flameH + 4, marginBottom: -dim.h * 0.12 }}
      >
        {isLit ? (
          <div className="relative flex flex-col items-center">
            {/* Outer flickering flame */}
            <div
              className="rounded-full bg-gradient-to-t from-red-600 via-orange-500 to-amber-200 transition-transform duration-150"
              style={{
                width: dim.flameW,
                height: dim.flameH,
                boxShadow: '0 0 16px rgba(255, 140, 0, 0.9), 0 0 32px rgba(255, 80, 0, 0.5)',
                animation: 'diyaFlicker 1.8s infinite ease-in-out',
                borderRadius: '50% 50% 35% 35% / 80% 80% 25% 25%',
              }}
            />
            {/* Middle luminous yellow core */}
            <div
              className="absolute bottom-0.5 rounded-full bg-gradient-to-t from-amber-400 via-yellow-200 to-white"
              style={{
                width: dim.flameW * 0.6,
                height: dim.flameH * 0.7,
                borderRadius: '50% 50% 35% 35% / 80% 80% 25% 25%',
                animation: 'diyaInnerFlicker 1.2s infinite ease-in-out',
              }}
            />
            {/* Blue-white hot spark base */}
            <div
              className="absolute bottom-0 rounded-full bg-cyan-200/90"
              style={{
                width: dim.flameW * 0.25,
                height: dim.flameH * 0.2,
                filter: 'blur(0.5px)',
              }}
            />
          </div>
        ) : (
          /* Unlit wick with gentle prompt pulse */
          <div className="flex flex-col items-center pb-0.5">
            <div className="w-1 h-3 rounded-t-full bg-stone-700" />
            <span className="text-[10px] text-amber-300 font-bold tracking-tight opacity-75 group-hover:opacity-100 transition-opacity">
              Tap to light
            </span>
          </div>
        )}
      </div>

      {/* Terracotta Clay Lamp with Gold Embellishments (High Definition SVG) */}
      <svg
        width={dim.w}
        height={dim.h}
        viewBox="0 0 64 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-transform duration-300 ${interactive ? 'group-hover:scale-105 group-active:scale-95' : ''}`}
      >
        {/* Shadow under clay base */}
        <ellipse cx="32" cy="33" rx="24" ry="3" fill="#000000" fillOpacity="0.4" />

        {/* Terracotta Clay Body */}
        <path
          d="M4 14 C12 2 52 2 60 14 C62 26 50 34 32 34 C14 34 2 26 4 14 Z"
          fill="url(#clayGrad)"
          stroke="#D97706"
          strokeWidth="1.2"
        />

        {/* Oil Basin Interior */}
        <ellipse
          cx="32"
          cy="13"
          rx="26"
          ry="7"
          fill="url(#oilGrad)"
          stroke="#F59E0B"
          strokeWidth="0.8"
        />

        {/* Inner Liquid Oil Glow */}
        {isLit && (
          <ellipse
            cx="32"
            cy="13.5"
            rx="18"
            ry="4.5"
            fill="url(#litOilGlow)"
            opacity="0.95"
          />
        )}

        {/* Sacred Traditional Golden Filigree Dot Pattern on Rim */}
        <circle cx="14" cy="18" r="1.3" fill="#FDE68A" />
        <circle cx="20" cy="21" r="1.3" fill="#FDE68A" />
        <circle cx="26" cy="23" r="1.4" fill="#FDE68A" />
        <circle cx="32" cy="23.5" r="1.6" fill="#FDE68A" />
        <circle cx="38" cy="23" r="1.4" fill="#FDE68A" />
        <circle cx="44" cy="21" r="1.3" fill="#FDE68A" />
        <circle cx="50" cy="18" r="1.3" fill="#FDE68A" />

        <defs>
          <linearGradient id="clayGrad" x1="32" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B45309" />
            <stop offset="0.5" stopColor="#78350F" />
            <stop offset="1" stopColor="#3E1504" />
          </linearGradient>
          <linearGradient id="oilGrad" x1="32" y1="6" x2="32" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#78350F" />
          </linearGradient>
          <radialGradient id="litOilGlow" cx="32" cy="13.5" r="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FEF08A" stopOpacity="0.9" />
            <stop offset="0.6" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="1" stopColor="#B45309" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Optional Label below Diya */}
      {label && (
        <span className="mt-1 text-[11px] font-semibold text-amber-200 tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
