/** Client-side cooldown state for server-issued Retry-After responses. */
const cooldowns = new Map<string, number>();

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
  cooldowns.clear();
}
