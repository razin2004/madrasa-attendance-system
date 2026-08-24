interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
}

export interface RateLimitResult {
  isBlocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const lockoutMs = options.lockoutMs ?? 15 * 60 * 1000;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      isBlocked: false,
      remainingAttempts: maxAttempts,
    };
  }

  // Check if currently locked out
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Check if window has expired
  if (entry.resetAt <= now) {
    rateLimitStore.delete(key);
    return {
      isBlocked: false,
      remainingAttempts: maxAttempts,
    };
  }

  // Check attempts within window
  if (entry.count >= maxAttempts) {
    entry.blockedUntil = now + lockoutMs;
    const retryAfterSeconds = Math.ceil(lockoutMs / 1000);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    isBlocked: false,
    remainingAttempts: Math.max(0, maxAttempts - entry.count),
  };
}

export function recordRateLimitAttempt(
  key: string,
  isSuccess: boolean = false,
  options: RateLimitOptions = {}
): void {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxAttempts = options.maxAttempts ?? 5;
  const lockoutMs = options.lockoutMs ?? 15 * 60 * 1000;
  const now = Date.now();

  if (isSuccess) {
    rateLimitStore.delete(key);
    return;
  }

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
  } else {
    entry.count += 1;
    if (entry.count >= maxAttempts) {
      entry.blockedUntil = now + lockoutMs;
    }
  }

  rateLimitStore.set(key, entry);
}
