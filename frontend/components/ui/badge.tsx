import type { ReactNode } from 'react';

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'premium';

const tones: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
  premium: 'bg-gold-100 text-gold-600 border-gold-300',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, tone = 'neutral', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold border rounded-full ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      } ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
