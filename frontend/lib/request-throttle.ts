/**
 * Frontend request throttle utility
 * Prevents rapid-fire requests and respects backend Retry-After headers.
 * Production-ready for 10k+ users.
 */

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

const endpointThrottles = new Map<string, ThrottleEntry>();

// Cooldown tracking for sensitive actions
const cooldowns = new Map<string, number>();

/**
 * Check if an endpoint is currently throttled on the client side.
 * This prevents sending requests we know will be rejected.
 */
export function isEndpointThrottled(endpoint: string): boolean {
  const entry = endpointThrottles.get(endpoint);
  if (!entry) return false;
  if (Date.now() >= entry.resetAt) {
    endpointThrottles.delete(endpoint);
    return false;
  }
  return entry.count >= getMaxAttempts(endpoint);
}

/**
 * Record an attempt for an endpoint.
 */
export function recordAttempt(endpoint: string): void {
  const now = Date.now();
  const entry = endpointThrottles.get(endpoint);
  const windowMs = 60000; // 1 minute window

  if (!entry || now >= entry.resetAt) {
    endpointThrottles.set(endpoint, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count += 1;
  }
}

/**
 * Get max attempts allowed per window for an endpoint.
 */
function getMaxAttempts(endpoint: string): number {
  if (endpoint.includes('/login/')) return 5;
  if (endpoint.includes('/otp/')) return 3;
  if (endpoint.includes('/register/')) return 3;
  if (endpoint.includes('/reset-password/')) return 3;
  if (endpoint.includes('/contact-enquiry/')) return 5;
  return 30; // general API calls
}

/**
 * Apply a cooldown to a specific action (e.g., OTP button).
 */
export function setCooldown(key: string, durationMs: number): void {
  cooldowns.set(key, Date.now() + durationMs);
}

/**
 * Check if an action is in cooldown.
 */
export function isOnCooldown(key: string): boolean {
  const until = cooldowns.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(key);
    return false;
  }
  return true;
}

/**
 * Get remaining cooldown time in seconds.
 */
export function getCooldownRemaining(key: string): number {
  const until = cooldowns.get(key);
  if (!until) return 0;
  const remaining = Math.ceil((until - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Parse Retry-After header and apply cooldown.
 */
export function applyRetryAfter(key: string, retryAfterValue: string | number | null | undefined): void {
  if (retryAfterValue === undefined || retryAfterValue === null) return;
  const seconds = typeof retryAfterValue === 'string' ? parseInt(retryAfterValue, 10) : retryAfterValue;
  if (Number.isFinite(seconds) && seconds > 0) {
    setCooldown(key, seconds * 1000);
  }
}

/**
 * Debounce utility - limits how often a function can be called.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delayMs);
  };
}

/**
 * Throttle utility - ensures a function is called at most once per interval.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timer = null;
      }, remaining);
    }
  };
}

/**
 * Reset all throttles (useful for testing or logout).
 */
export function resetAllThrottles(): void {
  endpointThrottles.clear();
  cooldowns.clear();
}