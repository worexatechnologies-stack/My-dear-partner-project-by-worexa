'use client';

import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, CircleAlert, Inbox,
  LoaderCircle, LockKeyhole, X, Zap, Shield, TrendingUp, Users, BarChart3,
  Clock, CheckCircle, AlertCircle, Search, Filter, Download, Plus, Edit2, Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  showBackButton = false,
  backFallback = '/admin/dashboard',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
  backFallback?: string;
}) {
  const navigate = useNavigate();
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-ui-page-header mb-8"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {showBackButton && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(backFallback);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              <ChevronLeft size={18} /> Back
            </motion.button>
          )}
          <div>
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-1">
                {eyebrow}
              </p>
            )}
            <h1 className="text-4xl font-bold text-gray-900">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-lg text-gray-600">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </motion.header>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`admin-ui-panel bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="border-b border-gray-200 px-6 py-5 flex items-center justify-between">
          <div>
            {title && <h2 className="text-xl font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </motion.section>
  );
}

const positiveStatus = ['active', 'approved', 'paid', 'resolved', 'verified', 'success', 'successful', 'completed'];
const warningStatus = ['pending', 'under review', 'open', 'waiting', 'unverified'];
const dangerStatus = ['blocked', 'rejected', 'failed', 'suspended', 'deactivated', 'cancelled'];
const infoStatus = ['assigned', 'in progress', 'premium', 'contacted'];

const statusColorMap = {
  success: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' },
  info: { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100' },
  neutral: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100' },
};

export function AdminStatusBadge({ status }: { status?: string | null }) {
  const value = status || 'Unknown';
  const normalized = value.replaceAll('_', ' ').toLowerCase();
  const tone = positiveStatus.includes(normalized)
    ? 'success'
    : warningStatus.includes(normalized)
      ? 'warning'
      : dangerStatus.includes(normalized)
        ? 'danger'
        : infoStatus.includes(normalized)
          ? 'info'
          : 'neutral';
  
  const colors = statusColorMap[tone as keyof typeof statusColorMap];
  
  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors.badge} ${colors.text}`}
    >
      {tone === 'success' && <Check size={14} className="mr-1" />}
      {tone === 'warning' && <Clock size={14} className="mr-1" />}
      {tone === 'danger' && <AlertCircle size={14} className="mr-1" />}
      {value.replaceAll('_', ' ')}
    </motion.span>
  );
}

export function AdminLoading({ label = 'Loading secure workspace…' }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4"
      role="status"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="mb-4"
      >
        <LoaderCircle className="w-12 h-12 text-rose-600" />
      </motion.div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{label}</h3>
      <p className="text-gray-600">Please wait while the latest data is being secured...</p>
    </motion.div>
  );
}

export function AdminEmptyState({
  title = 'Nothing here yet',
  description = 'There are no records matching this view.',
  action,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mb-4"
      >
        <Icon className="w-8 h-8 text-rose-600" />
      </motion.div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center max-w-sm mb-6">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

export function AdminErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
      role="alert"
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-2xl flex items-center justify-center mb-4"
      >
        <CircleAlert className="w-8 h-8 text-red-600" />
      </motion.div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Couldn't load this view</h3>
      <p className="text-gray-600 text-center max-w-sm mb-6">{message}</p>
      <div className="flex gap-3">
        {onRetry && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onRetry}
            className="px-6 py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors"
          >
            Try Again
          </motion.button>
        )}
        <Link 
          to="/" 
          className="px-6 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors inline-flex items-center"
        >
          Go Back
        </Link>
      </div>
    </motion.div>
  );
}

export function AdminSkeleton({ rows = 5, cols = 4, type = 'table' }: { rows?: number; cols?: number; type?: 'table' | 'cards' | 'chart' }) {
  const shimmerClasses = 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse';
  
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: rows }).map((_, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
          >
            <div className={`h-6 w-2/3 rounded-lg ${shimmerClasses}`} />
            <div className={`h-4 w-full rounded-lg ${shimmerClasses}`} />
            <div className={`h-4 w-4/5 rounded-lg ${shimmerClasses}`} />
          </motion.div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl border border-gray-200 p-6"
      >
        <div className={`h-6 w-32 rounded-lg mb-6 ${shimmerClasses}`} />
        <div className="flex items-end gap-2 h-40">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 rounded-t-lg ${shimmerClasses}`}
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      <div className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={`h-4 rounded-lg ${shimmerClasses}`}
                style={{ flex: cIdx === 0 ? 2 : 1 }}
              />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function AdminAccessDenied() {
  const { user } = useAuth();
  
  // Resolve correct return path
  let dashboardPath = '/admin/dashboard';
  if (user?.account_type === 'SUPER_ADMIN') {
    dashboardPath = '/super-admin/dashboard';
  } else if (user?.admin_role === 'ADMIN') {
    dashboardPath = '/staff/dashboard';
  }

  return (
    <div className="admin-access-denied" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
      <span className="admin-state-icon" style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(195, 68, 78, 0.1)', color: 'var(--admin-red, #c3444e)', borderRadius: '50%', marginBottom: '1.5rem' }}><LockKeyhole size={48} /></span>
      <p className="admin-eyebrow" style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.15em', fontWeight: 'bold', color: 'var(--admin-red, #c3444e)', marginBottom: '0.5rem' }}>403 Â· Restricted</p>
      <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--admin-ink, #211a20)' }}>This area is outside your role.</h1>
      <p style={{ maxWidth: '460px', color: 'var(--admin-muted, #766d74)', marginBottom: '2rem', fontSize: '0.95rem' }}>Your account does not have the required permission. If this appears incorrect, contact a Super Admin.</p>
      <Link to={dashboardPath} className="admin-btn admin-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
        Return to Dashboard
      </Link>
    </div>
  );
}

export function AdminPermissionGate({
  anyOf = [],
  children,
  fallback = null,
}: {
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user, hasAnyAdminPermission } = useAuth();
  if (user?.admin_role === 'SUPER_ADMIN' || hasAnyAdminPermission(...anyOf)) return <>{children}</>;
  return <>{fallback}</>;
}

export function AdminPagination({
  page,
  count,
  pageSize = 20,
  onPageChange,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="admin-pagination" aria-label="Pagination">
      <p>Page <strong>{page}</strong> of <strong>{pages}</strong> &middot; {count} records</p>
      <div>
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /></button>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}><ChevronRight /></button>
      </div>
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm action',
  dangerous = true,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  dangerous?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onCancel()}>
      <div className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title">
        <span className={`admin-confirm-icon ${dangerous ? 'danger' : ''}`}><AlertTriangle /></span>
        <h2 id="admin-confirm-title">{title}</h2>
        <div style={{ margin: '0.5rem 0 1rem', fontSize: '0.85rem', color: 'var(--admin-muted)' }}>{description}</div>
        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={`admin-btn ${dangerous ? 'admin-btn-danger' : 'admin-btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy && <LoaderCircle className="admin-spinner" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
        <header>
          <div>
            <p className="admin-eyebrow">Secure action</p>
            <h2 id="admin-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="admin-icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function AdminToast({
  message,
  tone = 'success',
  onClose,
}: {
  message: string;
  tone?: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`admin-toast admin-toast-${tone}`} role="status">
      <span>{tone === 'success' ? <Check /> : <CircleAlert />}</span>
      <p>{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss"><X /></button>
    </div>
  );
}

export const formatAdminDate = (value?: string | null, includeTime = false) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
};

export const formatAdminMoney = (value?: string | number | null) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Number(value || 0));

