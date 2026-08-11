'use client';

import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  helperText,
  className = '',
  required,
  id,
  disabled,
  ...props
}) => {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label 
          htmlFor={selectId} 
          className="text-xs font-extrabold uppercase tracking-wider text-gray-500"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={`
            w-full px-4 py-3 bg-white text-gray-900 border rounded-xl outline-none transition-all duration-200 cursor-pointer
            ${error 
              ? 'border-red-500 focus:ring-2 focus:ring-red-100' 
              : 'border-gray-200 focus:border-[var(--theme-primary-500)] focus:ring-4 focus:ring-[var(--theme-primary-500)]/10'
            }
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            ${className}
          `}
          {...props}
        >
          <option value="" disabled className="text-gray-400">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-gray-900">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-red-500 text-xs font-bold mt-1 flex items-center gap-1">
          âœ• {error}
        </p>
      ) : helperText ? (
        <p className="text-gray-400 text-[11px] font-medium leading-normal">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
