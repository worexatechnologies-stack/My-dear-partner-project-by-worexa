'use client';

import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; tone: ToastTone };
const ToastContext = createContext<{ showToast: (message: string, tone?: ToastTone) => void } | null>(null);
const config = { success: { icon: CheckCircle2, style: 'border-emerald-200 bg-emerald-50 text-emerald-950' }, error: { icon: TriangleAlert, style: 'border-red-200 bg-red-50 text-red-950' }, info: { icon: Info, style: 'border-sky-200 bg-sky-50 text-sky-950' } } as const;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback((message: string, tone: ToastTone = 'info') => { const id = Date.now() + Math.floor(Math.random() * 1000); setToasts((items) => [...items, { id, message, tone }].slice(-4)); window.setTimeout(() => dismiss(id), 5000); }, [dismiss]);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="true">{toasts.map((toast) => { const Icon = config[toast.tone].icon; return <div key={toast.id} role="status" className={`ui-toast-enter pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-lg ${config[toast.tone].style}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><p className="flex-1 text-sm font-semibold leading-5">{toast.message}</p><button type="button" onClick={() => dismiss(toast.id)} className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100" aria-label="Dismiss notification"><X className="h-4 w-4" /></button></div>; })}</div></ToastContext.Provider>;
}
export function useToast() { const context = useContext(ToastContext); if (!context) throw new Error('useToast must be used within ToastProvider'); return context; }
