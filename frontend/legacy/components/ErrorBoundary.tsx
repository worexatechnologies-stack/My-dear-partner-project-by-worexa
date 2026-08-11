'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from '@/lib/router-compat';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // If the error is an AbortError from an aborted fetch due to logout or navigation,
    // we should ideally just swallow it or show nothing, but we'll flag it as an error to be safe.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error?.name === 'AbortError') {
        // An aborted request is normally harmless (for example, during a
        // route transition), but rendering `null` here removes the entire
        // application and leaves the user with a white screen. Keep a small,
        // actionable recovery view instead.
        return (
          <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Loading was interrupted</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Your session is still active. Please reload the dashboard to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Reload dashboard
            </button>
          </div>
        );
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-rose-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            We encountered an unexpected error while loading this page. Please try refreshing or return to the homepage.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-semibold"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
