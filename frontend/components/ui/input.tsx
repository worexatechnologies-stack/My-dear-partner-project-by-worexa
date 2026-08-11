'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-bold text-ink">
            {label}
            {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={`w-full h-11 px-4 rounded-lg border bg-cream-50 text-ink placeholder:text-soft-muted shadow-sm transition-all duration-200 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:outline-none ${
            error ? 'border-error focus:border-error focus:shadow-[0_0_0_4px_rgba(220,38,38,0.1)]' : 'border-line'
          } ${className}`}
          {...props}
        />
        {error && <p id={`${inputId}-error`} className="text-xs font-medium text-error" role="alert">{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="text-xs text-muted">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
