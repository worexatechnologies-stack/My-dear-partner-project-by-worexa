'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  text?: string;
  fullScreen?: boolean;
}

export default function PageLoader({ text = 'Loading...', fullScreen = true }: Props) {
  const containerClass = fullScreen 
    ? "min-h-screen flex flex-col items-center justify-center bg-slate-50"
    : "w-full py-16 flex flex-col items-center justify-center";

  return (
    <div className={containerClass}>
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="text-slate-500 font-medium">{text}</p>
    </div>
  );
}
