'use client';

import React from 'react';
import { HelpCircle, RefreshCw, AlertTriangle, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from '@/lib/router-compat';

// Skeleton Shimmer Box
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-150 animate-pulse rounded-2xl ${className}`} />
);

// Empty State View component
interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionLink?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'ðŸŽ«',
  title,
  description,
  actionText,
  onAction,
  actionLink
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-gray-100 text-3xl select-none">
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h3 className="text-lg font-black text-gray-800 font-display mb-1">{title}</h3>
      <p className="text-gray-400 text-xs leading-normal max-w-sm mt-1 mb-6">{description}</p>
      
      {actionText && (
        <>
          {actionLink ? (
            <Link
              to={actionLink}
              className="inline-flex py-2.5 px-6 bg-[var(--theme-primary-600)] text-white hover:bg-[var(--theme-primary-700)] rounded-full text-xs font-bold transition-all shadow-sm"
            >
              {actionText}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex py-2.5 px-6 bg-[var(--theme-primary-600)] text-white hover:bg-[var(--theme-primary-700)] rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {actionText}
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Error State View component
interface ErrorStateProps {
  title?: string;
  reason: string;
  onRetry?: () => void;
  supportLink?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  reason,
  onRetry,
  supportLink = '/support'
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50/30 rounded-3xl border border-red-100 shadow-inner max-w-md mx-auto">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4 border border-red-100/50 text-red-500">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-md font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-500 text-xs leading-normal max-w-sm mt-1 mb-6">{reason}</p>
      
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 py-2 px-5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Load
          </button>
        )}
        <Link
          to={supportLink}
          className="inline-flex items-center gap-1.5 py-2 px-5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full text-xs font-bold transition-all bg-white"
        >
          <HelpCircle className="w-3.5 h-3.5 text-gray-500" /> Support Desk
        </Link>
      </div>
    </div>
  );
};

// Permission Denied / Upgrade Prompt View
interface PermissionDeniedProps {
  isUpgradePrompt?: boolean;
  requiredTier?: string;
  reason?: string;
  currentAccountType?: string;
  requiredAccess?: string;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  isUpgradePrompt = false,
  requiredTier = 'Gold',
  reason,
  currentAccountType,
  requiredAccess
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[2rem] border border-gray-100 shadow-sm max-w-md mx-auto relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r gradient-primary" />
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4 border border-amber-100/50 text-amber-500">
        <ShieldAlert className="w-8 h-8" />
      </div>
      
      <h3 className="text-lg font-black text-gray-800 font-display mb-1">
        {isUpgradePrompt ? 'Premium Feature Locked' : 'Access Restricted'}
      </h3>
      <p className="text-gray-400 text-xs leading-relaxed max-w-xs mt-1 mb-4">
        {reason || (isUpgradePrompt 
          ? `This premium feature is restricted to ${requiredTier} and higher subscription tiers. Upgrade your account today.` 
          : 'You do not have administrative privileges to view this section. Please contact your system owner.')}
      </p>

      {/* Audit data logs for access control verification */}
      {!isUpgradePrompt && (currentAccountType || requiredAccess) && (
        <div className="w-full text-left bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 space-y-1.5 text-xs text-gray-500">
          {currentAccountType && (
            <div>
              <span className="font-bold text-gray-600">Your Account:</span> {currentAccountType}
            </div>
          )}
          {requiredAccess && (
            <div>
              <span className="font-bold text-gray-600">Required Role:</span> {requiredAccess}
            </div>
          )}
        </div>
      )}
      
      {isUpgradePrompt ? (
        <Link
          to="/membership"
          className="py-2.5 px-6 bg-gradient-to-r gradient-primary text-slate-900 font-bold rounded-full text-xs transition-all shadow-md shadow-[var(--theme-primary-500)]/15"
        >
          Upgrade Membership
        </Link>
      ) : (
        <Link
          to="/dashboard"
          className="py-2.5 px-6 bg-[var(--theme-primary-600)] text-white hover:bg-[var(--theme-primary-700)] rounded-full text-xs font-bold transition-all shadow-sm"
        >
          Back to Dashboard
        </Link>
      )}
    </div>
  );
};

// Confirmation Popups Dialogue
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-gray-100 text-center animate-fade-in-up">
        <h3 className="text-md font-bold text-gray-900 font-display mb-2">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-6">{message}</p>
        
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="py-2 px-5 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="py-2 px-5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-red-600/10"
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
