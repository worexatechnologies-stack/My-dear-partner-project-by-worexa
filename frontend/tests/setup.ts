import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// The public app defaults the back-office portal on, but the middleware tests
// need a stable paused-state baseline so they can verify the redirect branch.
process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL ??= 'false';

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
  get length() { return Object.keys(this.store).length; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
}

if (typeof window !== 'undefined') {
  try {
    if (!window.localStorage || typeof window.localStorage.clear !== 'function') {
      Object.defineProperty(window, 'localStorage', { value: new MockStorage(), writable: true });
    }
    if (!window.sessionStorage || typeof window.sessionStorage.clear !== 'function') {
      Object.defineProperty(window, 'sessionStorage', { value: new MockStorage(), writable: true });
    }
  } catch {
    // ignore
  }
}

afterEach(() => {
  cleanup();
});
