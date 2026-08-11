'use client';

import React from 'react';

// Input Field
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  required,
  ...props
}) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        required={required}
        className={`
          w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl outline-none transition-all duration-200
          focus:border-[var(--theme-primary-500)] focus:ring-4 focus:ring-[var(--theme-primary-500)]/10
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-100' : ''}
          ${className}
        `}
        {...props}
      />
      {error ? (
        <p className="text-red-500 text-xs font-bold mt-1">âœ• {error}</p>
      ) : helperText ? (
        <p className="text-gray-400 text-[11px] font-medium leading-normal">{helperText}</p>
      ) : null}
    </div>
  );
};

// Textarea Field
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  required,
  ...props
}) => {
  const areaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label htmlFor={areaId} className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={areaId}
        required={required}
        className={`
          w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl outline-none transition-all duration-200 resize-y
          focus:border-[var(--theme-primary-500)] focus:ring-4 focus:ring-[var(--theme-primary-500)]/10
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-100' : ''}
          ${className}
        `}
        {...props}
      />
      {error ? (
        <p className="text-red-500 text-xs font-bold mt-1">âœ• {error}</p>
      ) : helperText ? (
        <p className="text-gray-400 text-[11px] font-medium leading-normal">{helperText}</p>
      ) : null}
    </div>
  );
};

// Checkbox Field
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const checkId = id || `check-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={checkId}
          className={`
            h-4 w-4 rounded border-gray-300 text-[var(--theme-primary-600)] focus:ring-[var(--theme-primary-500)] cursor-pointer
            ${className}
          `}
          {...props}
        />
        <label htmlFor={checkId} className="text-sm font-semibold text-gray-700 cursor-pointer">
          {label}
        </label>
      </div>
      {error && <p className="text-red-500 text-xs font-bold">âœ• {error}</p>}
    </div>
  );
};

// Radio Field
interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  className = '',
  id,
  ...props
}) => {
  const radioId = id || `radio-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id={radioId}
        className={`
          h-4 w-4 border-gray-300 text-[var(--theme-primary-600)] focus:ring-[var(--theme-primary-500)] cursor-pointer
          ${className}
        `}
        {...props}
      />
      <label htmlFor={radioId} className="text-sm font-semibold text-gray-700 cursor-pointer">
        {label}
      </label>
    </div>
  );
};

// Switch Toggle Field
interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onCheckedChange,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <label className="flex items-center space-x-3 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-[var(--theme-primary-600)]' : 'bg-gray-200'}`} />
        <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${checked ? 'translate-x-4' : ''}`} />
      </div>
      {label && <span className="text-sm font-bold text-gray-700">{label}</span>}
    </label>
  );
};
