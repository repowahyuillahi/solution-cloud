/**
 * Simple in-memory rate limiter (per IP).
 *
 * Not suitable for multi-instance deployments — for that, use Redis or
 * a similar shared store. For single-instance deployments this is sufficient
 * to prevent brute-force attacks against login endpoints.
 *
 * Usage:
 *   const result = checkRateLimit('login:127.0.0.1', { max: 5, windowMs: 60000 });
 *   if (!result.allowed) return 429;
 */

interface RateLimitOptions {
  /** Max requests allowed in the window. */
  max: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

// Periodic cleanup to avoid unbounded memory growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const entries = Array.from(buckets.entries());
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
}

ensureCleanupTimer();

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, options.max - existing.count),
    retryAfterMs: 0,
  };
}

/**
 * Extract the client IP from a Next.js request headers.
 * Falls back to a placeholder if no IP can be determined.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/** Reset a specific rate limit key (useful after successful login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
