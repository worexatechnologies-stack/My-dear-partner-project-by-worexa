'use client';

import { LazyMotion, domAnimation } from 'framer-motion';
import type { ReactNode } from 'react';
import ErrorBoundary from '@/legacy/components/ErrorBoundary';
import { AuthProvider } from '@/legacy/contexts/AuthContext';
import { ThemeProvider } from '@/legacy/contexts/ThemeContext';
import { ReduxProvider } from '@/store/provider';
import { ToastProvider } from '@/components/ui';

export function Providers({ children }: { children: ReactNode }) {
  return <ErrorBoundary>
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider><LazyMotion features={domAnimation}>{children}</LazyMotion></ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  </ErrorBoundary>;
}
