'use client';

import { setupListeners } from '@reduxjs/toolkit/query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@/legacy/store';
import { baseApi } from '@/legacy/services/baseApi';

export function ReduxProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  useEffect(() => {
    const unsubscribe = setupListeners(storeRef.current!.dispatch);
    const resetPrivateCache = () => storeRef.current?.dispatch(baseApi.util.resetApiState());
    window.addEventListener('auth:cache-clear', resetPrivateCache);
    return () => {
      unsubscribe();
      window.removeEventListener('auth:cache-clear', resetPrivateCache);
    };
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
