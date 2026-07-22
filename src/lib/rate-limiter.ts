type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInMinutes: number;
};

// Global in-memory storage for sliding window timestamps
const rateLimitStore = new Map<string, number[]>();

// Periodically clean up entries older than 1 hour to prevent memory leaks
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else if (validTimestamps.length !== timestamps.length) {
      rateLimitStore.set(key, validTimestamps);
    }
  }
}

/**
 * Checks and updates rate limit for a given key (IP address or user ID).
 * @param key Unique key identifying guest IP or logged-in user ID
 * @param limit Maximum allowed requests per hour (e.g. 5 for guest, 20 for logged-in user)
 */
export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();

  // Run lightweight cleanup occasionally (e.g., when store grows large)
  if (rateLimitStore.size > 500) {
    cleanupExpiredEntries();
  }

  const timestamps = rateLimitStore.get(key) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (validTimestamps.length >= limit) {
    const oldestTimestamp = validTimestamps[0];
    const resetMs = oldestTimestamp + WINDOW_MS - now;
    const resetInMinutes = Math.max(1, Math.ceil(resetMs / (60 * 1000)));

    return {
      allowed: false,
      remaining: 0,
      resetInMinutes,
    };
  }

  validTimestamps.push(now);
  rateLimitStore.set(key, validTimestamps);

  return {
    allowed: true,
    remaining: limit - validTimestamps.length,
    resetInMinutes: 60,
  };
}
