'use client';

import React from 'react';

interface RangoliProps {
  className?: string;
  size?: number;
  opacity?: number;
}

export default function DeepavaliRangoli({
  className = '',
  size = 520,
  opacity = 0.35,
}: RangoliProps) {
  return (
    <div
      className={`pointer-events-none select-none relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size, opacity }}
      aria-hidden="true"
    >
      {/* Ambient golden halo bloom */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.12) 40%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Intricate Sacred Rangoli Mandala Vector */}
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full text-amber-300 transition-transform duration-1000 animate-[spin_120s_linear_infinite]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Concentric Petal Rings */}
        <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.6" />
        <circle cx="200" cy="200" r="172" stroke="currentColor" strokeWidth="1.2" opacity="0.75" />
        <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />

        {/* 16 Outer Floral Petals */}
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          return (
            <g key={`petal-${i}`} transform={`rotate(${angle} 200 200)`}>
              <path
                d="M 200 28 C 215 65 220 110 200 135 C 180 110 185 65 200 28 Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="currentColor"
                fillOpacity="0.04"
              />
              <circle cx="200" cy="42" r="2.5" fill="currentColor" fillOpacity="0.8" />
              <circle cx="200" cy="22" r="1.5" fill="currentColor" />
            </g>
          );
        })}

        {/* 8-pointed Traditional Geometric Star */}
        <polygon
          points="200,45 235,165 355,200 235,235 200,355 165,235 45,200 165,165"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.03"
        />
        <polygon
          points="200,45 235,165 355,200 235,235 200,355 165,235 45,200 165,165"
          transform="rotate(45 200 200)"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.03"
        />

        {/* Mid Concentric Lotus Ring */}
        <circle cx="200" cy="200" r="115" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <circle cx="200" cy="200" r="98" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.65" />

        {/* 8 Inner Lotus Petals with Traditional Diya Motifs */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 360) / 8;
          return (
            <g key={`inner-petal-${i}`} transform={`rotate(${angle} 200 200)`}>
              <path
                d="M 200 102 C 214 125 214 160 200 178 C 186 160 186 125 200 102 Z"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="currentColor"
                fillOpacity="0.07"
              />
              {/* Miniature golden Diya flame symbol at each petal tip */}
              <circle cx="200" cy="115" r="3" fill="currentColor" fillOpacity="0.9" />
            </g>
          );
        })}

        {/* Center Sacred Bindu & Sun Core */}
        <circle cx="200" cy="200" r="62" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
        <circle cx="200" cy="200" r="48" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <circle cx="200" cy="200" r="32" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.1" />
        <circle cx="200" cy="200" r="14" fill="currentColor" fillOpacity="0.5" />
        <circle cx="200" cy="200" r="5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
