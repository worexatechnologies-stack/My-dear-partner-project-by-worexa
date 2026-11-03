'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import DeepavaliDiya from './deepavali-diya';

interface FloatingWidgetProps {
  onOpenCelebration: () => void;
}

export default function DeepavaliFloatingWidget({ onOpenCelebration }: FloatingWidgetProps) {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  if (isDismissed) return null;

  return (
    <aside
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end select-none animate-fade-in"
      aria-label="Deepavali Celebrations widget"
    >
      {/* Floating Tooltip Pill */}
      <div className="mb-2 hidden sm:flex items-center gap-1.5 rounded-full bg-[#200a16]/95 px-3 py-1 text-[11px] font-bold text-amber-200 border border-amber-400/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <span>Celebrate Deepavali</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="ml-1 text-amber-300/60 hover:text-white transition p-0.5"
          title="Hide widget"
          aria-label="Hide Deepavali widget"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Floating Diya Launcher Button */}
      <button
        type="button"
        onClick={onOpenCelebration}
        className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
        title="Click to open Deepavali Celebration!"
        aria-label="Replay Deepavali Celebration"
      >
        {/* Ambient Warm Golden Glow Halo */}
        <div className="absolute -inset-3 rounded-full bg-amber-400/25 blur-xl group-hover:bg-amber-400/40 transition-all pointer-events-none" />

        {/* Diya SVG Component */}
        <DeepavaliDiya size="md" isLit={true} showHalo={true} />

      </button>
    </aside>
  );
}
