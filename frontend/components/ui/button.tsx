'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const variants = {
  primary: 'bg-[linear-gradient(135deg,#b64a68_0%,#8e3d58_100%)] text-white shadow-[0_10px_24px_rgba(142,61,88,0.30),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_16px_32px_rgba(142,61,88,0.38),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-[1.06] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0',
  secondary: 'bg-[linear-gradient(135deg,#4e4347_0%,#2c2928_100%)] text-white shadow-[0_10px_24px_rgba(32,17,26,0.24),inset_0_1px_0_rgba(255,255,255,0.10)] hover:brightness-[1.08] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0',
  outline: 'border-[1.5px] border-rose-500/25 text-rose-500 bg-white shadow-[0_2px_10px_rgba(67,22,39,0.05)] hover:border-rose-500/60 hover:bg-[#fdf3f6] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0',
  ghost: 'text-muted hover:text-rose-500 hover:bg-rose-500/8 active:scale-[0.97]',
  danger: 'bg-[linear-gradient(135deg,#f87171_0%,#dc2626_100%)] text-white shadow-[0_10px_24px_rgba(220,38,38,0.26),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-[1.06] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0',
  gold: 'bg-[linear-gradient(135deg,#e9bac3_0%,#cf7d8d_100%)] text-plum-800 shadow-[0_10px_24px_rgba(207,125,141,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-[1.04] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0',
};

const sizes = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-base',
  xl: 'h-14 px-10 text-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-[0.035em] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-rose-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
