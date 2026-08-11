'use client';

import SmartImage from '@/components/shared/smart-image';

import React from 'react';

interface WorexaLogoProps {
  className?: string;
  height?: number | string;
}

export default function WorexaLogo({ className = '', height = 32 }: WorexaLogoProps) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <SmartImage
        src="/images/main-logo.png"
        alt="My Dear Partner"
        className="object-contain"
        style={{
          width: 'auto',
          height,
          // Preserve the supplied logo colors on both light and dark surfaces.
          mixBlendMode: 'normal'
        }}
      />
    </div>
  );
}
