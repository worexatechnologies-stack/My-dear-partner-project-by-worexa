'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const variants = {
  primary: 'bg-rose-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:bg-rose-600 hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] active:scale-[0.97]',
  secondary: 'bg-plum-800 text-white hover:bg-plum-700 active:scale-[0.97]',
  outline: 'border border-line text-plum-700 bg-transparent hover:border-rose-500 hover:text-rose-500 hover:bg-rose-500/5 active:scale-[0.97]',
  ghost: 'text-muted hover:text-ink hover:bg-rose-500/5 active:scale-[0.97]',
  danger: 'bg-error text-white hover:bg-red-700 active:scale-[0.97]',
  gold: 'bg-gold-400 text-plum-800 shadow-[0_4px_14px_rgba(251,191,36,0.3)] hover:bg-gold-500 hover:shadow-[0_8px_24px_rgba(245,158,11,0.35)] active:scale-[0.97]',
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
