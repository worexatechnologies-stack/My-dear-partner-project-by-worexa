'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, PenLine, X } from 'lucide-react';

interface SelectWithOtherProps {
  /** The current committed value (what gets sent to state/API) */
  value: string;
  /** List of pre-defined options (should include "Other" as the last item) */
  options: string[];
  /** Called whenever the effective value changes */
  onChange: (value: string) => void;
  /** Placeholder shown when nothing is selected */
  placeholder?: string;
  /** Extra class names for the outer wrapper div */
  className?: string;
  /** Tailwind class string applied to the <select> and text <input> elements */
  inputClassName?: string;
  /** If true the field is required */
  required?: boolean;
  /** Optional id forwarded to the <select> */
  id?: string;
  /** Whether to disable the inputs */
  disabled?: boolean;
}

/**
 * SelectWithOther
 * ───────────────
 * A drop-in replacement for a plain <select> that automatically reveals a
 * free-text input whenever the user picks "Other".
 *
 * Behaviour:
 * - If the stored `value` is not in `options` and is non-empty, it is treated
 *   as a custom value and pre-populates the text field.
 * - The text field value is committed via `onChange` on every keystroke.
 * - Clearing the text field (X button) resets back to empty selection.
 */
export function SelectWithOther({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  inputClassName,
  required,
  id,
  disabled,
}: SelectWithOtherProps) {
  // If value is set but not in options list → it's a custom "other" value
  const isCustomValue = value !== '' && value !== 'Other' && !options.includes(value);

  const selectValue = isCustomValue ? 'Other' : value;
  const showOtherInput = selectValue === 'Other';

  const [otherText, setOtherText] = useState(isCustomValue ? value : '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (isCustomValue) {
      setOtherText(value);
    } else if (value !== 'Other') {
      setOtherText('');
    }
  }, [value, isCustomValue]);

  // Auto-focus text input when it appears
  useEffect(() => {
    if (showOtherInput) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [showOtherInput]);

  const base =
    inputClassName ??
    'h-10 w-full rounded-xl border border-[#efefef] bg-[#f9fafb] px-3.5 text-xs font-semibold text-[#0f0f10] outline-none transition-all placeholder:text-[#a8989f] hover:border-[#dfd8dc] focus:border-[#e11d48] focus:bg-white focus:ring-2 focus:ring-[#e11d48]/10';

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === 'Other') {
      setOtherText('');
      onChange('Other');
    } else {
      setOtherText('');
      onChange(v);
    }
  }

  function handleOtherChange(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value;
    setOtherText(t);
    // commit live — if blank keep "Other" so select stays highlighted
    onChange(t || 'Other');
  }

  function handleClear() {
    setOtherText('');
    onChange('');
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Main dropdown */}
      <div className="relative">
        <select
          id={id}
          value={selectValue}
          onChange={handleSelectChange}
          required={required && !showOtherInput}
          disabled={disabled}
          className={`${base} appearance-none cursor-pointer pr-8`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c7a82]" />
      </div>

      {/* Free-text input shown only when "Other" is selected */}
      {showOtherInput && (
        <div className="relative">
          <PenLine className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e11d48]" />
          <input
            ref={inputRef}
            type="text"
            value={otherText}
            onChange={handleOtherChange}
            placeholder="Please specify…"
            required={required}
            disabled={disabled}
            className={`${base} pl-9 pr-8 border-[#e11d48]/40 focus:border-[#e11d48] ring-1 ring-[#e11d48]/10`}
          />
          {otherText && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#8c7a82] hover:text-[#e11d48] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
