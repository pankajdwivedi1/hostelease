/**
 * 🔥 REQUEST RATE LIMITER FOR M0 OPTIMIZATION
 * Prevents connection exhaustion during peak attendance times
 * Implements per-student throttling with exponential backoff
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  backoffMultiplier: number;
}

// In-memory store for rate limiting (shared across all requests in Node.js)
const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_SIZE = 10000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 2; // Max 2 requests per student per 10 seconds
const BACKOFF_MULTIPLIER = 1.5;

/**
 * Check if a student has exceeded rate limit
 * @param studentId - The student's ID
 * @returns { allowed: boolean, retryAfter: number (ms) }
 */
export function checkRateLimit(studentId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const key = `student_${studentId}`;

  let entry = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!entry || now >= entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + WINDOW_SIZE,
      backoffMultiplier: 1,
    });
    return { allowed: true, retryAfter: 0 };
  }

  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil(entry.resetTime - now);
    console.log(`⚠️ Rate limit exceeded for student ${studentId}. Retry after ${retryAfter}ms`);
    
    // Increase backoff multiplier for next window
    entry.backoffMultiplier = Math.min(entry.backoffMultiplier * BACKOFF_MULTIPLIER, 5);
    
    return { allowed: false, retryAfter };
  }

  // Increment counter
  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

/**
 * Get current rate limit status for a student
 */
export function getRateLimitStatus(studentId: string) {
  const key = `student_${studentId}`;
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return { remaining: MAX_REQUESTS_PER_WINDOW, resetTime: Date.now() + WINDOW_SIZE };
  }

  return {
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count),
    resetTime: entry.resetTime,
    timeUntilReset: Math.max(0, entry.resetTime - Date.now()),
  };
}

/**
 * Cleanup old entries to prevent memory leak
 * Run this periodically (e.g., every 5 minutes)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime + WINDOW_SIZE * 2) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Rate limit store cleanup: removed ${cleaned} expired entries`);
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

export default checkRateLimit;
