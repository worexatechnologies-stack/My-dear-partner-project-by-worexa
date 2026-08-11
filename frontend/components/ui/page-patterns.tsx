'use client';

import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="mb-7 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-rose-600">{eyebrow}</p><h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}

export function FilterBar({ children, onClear, className = '' }: { children: ReactNode; onClear?: () => void; className?: string }) {
  return <div className={`mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm ${className}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/8 text-rose-600"><SlidersHorizontal className="h-4 w-4" /></span><div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>{onClear && <button type="button" onClick={onClear} className="h-10 px-3 text-sm font-bold text-muted hover:text-ink">Clear</button>}</div>;
}

export function Pagination({ page, totalPages, onPageChange, queryKey = 'page' }: { page: number; totalPages: number; onPageChange?: (page: number) => void; queryKey?: string }) {
  if (totalPages <= 1) return null;
  const changePage = (next: number) => { if (onPageChange) { onPageChange(next); return; } const url = new URL(window.location.href); url.searchParams.set(queryKey, String(next)); window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); };
  return <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination"><p className="text-sm text-muted">Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></nav>;
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm ${className}`}><table className="min-w-full divide-y divide-line text-left text-sm">{children}</table></div>; }
export function TableHead({ children }: { children: ReactNode }) { return <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-[.08em] text-muted">{children}</thead>; }
export function TableBody({ children }: { children: ReactNode }) { return <tbody className="divide-y divide-line text-ink">{children}</tbody>; }

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm action', description, confirmLabel = 'Confirm', loading = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; description: string; confirmLabel?: string; loading?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} size="sm"><p className="text-sm leading-6 text-muted">{description}</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></div></Modal>;
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return <div className="ui-drawer-backdrop fixed inset-0 z-50 bg-slate-950/30" role="presentation" onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} className="ui-drawer-panel absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl"><header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="font-display text-lg font-bold text-ink">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-slate-100" aria-label="Close panel"><X className="h-5 w-5" /></button></header><div className="flex-1 overflow-y-auto p-5">{children}</div></aside></div>;
}
