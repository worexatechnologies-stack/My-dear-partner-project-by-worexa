'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DeepavaliCelebrationOverlay from './deepavali-celebration-overlay';
import DeepavaliFloatingWidget from './deepavali-floating-widget';

// Central festive toggle - switch to false when the festive season concludes
export const DEEPAVALI_ENABLED = true;

const STORAGE_KEY = 'mdp_deepavali_celebration_shown_2026';

export default function DeepavaliExperience() {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState<boolean>(false);

  useEffect(() => {
    setHasMounted(true);
    if (!DEEPAVALI_ENABLED) return;

    // Only auto-open on the homepage for visitors who haven't seen it yet in this session
    if (isHomepage && typeof window !== 'undefined') {
      const alreadySeen = sessionStorage.getItem(STORAGE_KEY);
      if (!alreadySeen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 650);
        return () => clearTimeout(timer);
      }
    }
  }, [isHomepage]);

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  if (!DEEPAVALI_ENABLED || !hasMounted) return null;

  return (
    <>
      {/* 1. Grand Interactive Deepavali Celebration Overlay */}
      <DeepavaliCelebrationOverlay
        isOpen={isOpen}
        onClose={handleClose}
        onReplay={() => setIsOpen(true)}
      />

      {/* 2. Persistent Floating Diya Replay Widget (when overlay is closed) */}
      {!isOpen && <DeepavaliFloatingWidget onOpenCelebration={handleOpen} />}
    </>
  );
}
