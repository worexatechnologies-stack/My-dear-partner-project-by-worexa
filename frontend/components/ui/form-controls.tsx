'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type FieldProps = { label?: string; hint?: string; error?: string; required?: boolean; id?: string; className?: string };
function Field({ id, label, hint, error, required, children }: FieldProps & { children: ReactNode }) {
  return <div className="space-y-1.5">{label && <label htmlFor={id} className="block text-sm font-bold text-ink">{label}{required && <span className="ml-0.5 text-error">*</span>}</label>}{children}{error ? <p id={`${id}-error`} role="alert" className="text-xs font-medium text-error">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}</div>;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, hint, error, required, id, className = '', children, ...props }, ref) {
  const fieldId = id ?? `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return <Field id={fieldId} label={label} hint={hint} error={error} required={required}><select ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} className={`h-11 w-full rounded-xl border bg-surface px-3 text-sm text-ink shadow-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 ${error ? 'border-error' : 'border-line'} ${className}`} {...props}>{children}</select></Field>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea({ label, hint, error, required, id, className = '', ...props }, ref) {
  const fieldId = id ?? `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return <Field id={fieldId} label={label} hint={hint} error={error} required={required}><textarea ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} className={`min-h-28 w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 ${error ? 'border-error' : 'border-line'} ${className}`} {...props} /></Field>;
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Checkbox({ label, className = '', id, ...props }, ref) {
  const fieldId = id ?? `checkbox-${String(label).toLowerCase().replace(/\s+/g, '-')}`;
  return <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink"><input ref={ref} id={fieldId} type="checkbox" className={`mt-0.5 h-4 w-4 rounded border-line text-rose-500 focus:ring-rose-500 ${className}`} {...props} /><span>{label}</span></label>;
});

export const Radio = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Radio({ label, className = '', id, ...props }, ref) {
  const fieldId = id ?? `radio-${String(label).toLowerCase().replace(/\s+/g, '-')}`;
  return <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink"><input ref={ref} id={fieldId} type="radio" className={`mt-0.5 h-4 w-4 border-line text-rose-500 focus:ring-rose-500 ${className}`} {...props} /><span>{label}</span></label>;
});
