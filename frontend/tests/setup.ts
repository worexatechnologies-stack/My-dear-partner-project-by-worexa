import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// The public app defaults the back-office portal on, but the middleware tests
// need a stable paused-state baseline so they can verify the redirect branch.
process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL ??= 'false';

afterEach(() => {
  cleanup();
});
