const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkAuthRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  let bucket = buckets.get(clientKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(clientKey, bucket);
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Prefer Express `req.ip` (honors `trust proxy`) over spoofable X-Forwarded-For. */
export function authClientKeyFromRequest(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}
