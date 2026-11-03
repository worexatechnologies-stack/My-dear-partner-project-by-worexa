'use client';

interface NavbarDeepamProps {
  side?: 'left' | 'right';
  className?: string;
}

export default function NavbarDeepam({ side = 'left', className = '' }: NavbarDeepamProps) {
  return (
    <div
      className={`group relative flex items-center justify-center shrink-0 select-none ${className}`}
      title="Deepam - Happy Diwali"
      aria-label="Festive Deepam"
    >
      <style>{`
        @keyframes deepamFlameFlicker {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.96;
          }
          20% {
            transform: scale(1.08, 0.93) rotate(2deg) translateY(-0.5px);
            opacity: 1;
          }
          45% {
            transform: scale(0.94, 1.06) rotate(-1.8deg) translateY(0.4px);
            opacity: 0.92;
          }
          70% {
            transform: scale(1.05, 0.97) rotate(1.2deg);
            opacity: 1;
          }
          85% {
            transform: scale(0.98, 1.02) rotate(-0.8deg);
            opacity: 0.95;
          }
        }
        @keyframes deepamHaloPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.75;
          }
        }
        .deepam-flame-node {
          transform-origin: 18px 20px;
          animation: deepamFlameFlicker 2.1s ease-in-out infinite;
        }
        .deepam-halo-node {
          animation: deepamHaloPulse 2.4s ease-in-out infinite;
        }
      `}</style>

      {/* Warm ambient flame glow halo */}
      <div className="pointer-events-none absolute -top-1 h-9 w-9 rounded-full bg-amber-400/35 blur-md deepam-halo-node transition-opacity duration-300 group-hover:bg-amber-300/60" />

      {/* SVG Deepam (Diya) */}
      <svg
        viewBox="0 0 36 36"
        className={`relative h-7 w-7 sm:h-8 sm:w-8 drop-shadow-[0_2px_8px_rgba(217,119,6,0.35)] transition-transform duration-300 group-hover:scale-115 ${
          side === 'right' ? '-scale-x-100' : ''
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Diya Bowl Gradient - Rich Brass & Terracotta */}
          <linearGradient id={`diyaBowl-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="35%" stopColor="#d97706" />
            <stop offset="70%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Diya Rim Highlight */}
          <linearGradient id={`diyaRim-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Outer Flame Gradient */}
          <linearGradient id={`flameOuter-${side}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="25%" stopColor="#fbbf24" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          {/* Inner Flame Gradient */}
          <linearGradient id={`flameInner-${side}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#fef08a" />
            <stop offset="85%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>

        {/* Diya Stand / Base */}
        <ellipse cx="18" cy="30.5" rx="7.5" ry="2" fill="#78350f" opacity="0.6" />
        <path
          d="M13.5 29 C13.5 31, 22.5 31, 22.5 29 L21.2 27.5 L14.8 27.5 Z"
          fill={`url(#diyaBowl-${side})`}
        />

        {/* Traditional Diya Body / Bowl */}
        <path
          d="M5 23 C5 29, 31 29, 31 23 C31.5 20.5, 29 19.5, 26 20.5 C22 21.8, 14 21.8, 10 20.5 C7 19.5, 4.5 20.5, 5 23 Z"
          fill={`url(#diyaBowl-${side})`}
          stroke="#92400e"
          strokeWidth="0.6"
        />

        {/* Ornamental Carved Rim */}
        <ellipse
          cx="18"
          cy="21.5"
          rx="11"
          ry="2.8"
          fill="none"
          stroke={`url(#diyaRim-${side})`}
          strokeWidth="1.2"
        />

        {/* Oil Pool inside Diya */}
        <ellipse cx="18" cy="22" rx="8.5" ry="1.8" fill="#92400e" opacity="0.75" />

        {/* Cotton Wick tip */}
        <path d="M17.2 21.5 Q18 19 18.8 17.5" stroke="#451a03" strokeWidth="1.2" strokeLinecap="round" />

        {/* ANIMATED FLAME LAYER */}
        <g className="deepam-flame-node">
          {/* Outer Flame Teardrop */}
          <path
            d="M18 4 C14.5 10, 12 15, 18 20 C24 15, 21.5 10, 18 4 Z"
            fill={`url(#flameOuter-${side})`}
            filter="drop-shadow(0 0 4px #f59e0b)"
          />

          {/* Inner Intense Flame */}
          <path
            d="M18 8.5 C15.5 12.5, 14 16, 18 19.5 C22 16, 20.5 12.5, 18 8.5 Z"
            fill={`url(#flameInner-${side})`}
          />

          {/* White-Hot Core */}
          <ellipse cx="18" cy="17" rx="1.5" ry="2" fill="#ffffff" opacity="0.95" />
        </g>
      </svg>
    </div>
  );
}
