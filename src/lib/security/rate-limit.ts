export type RateLimitRequest = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

export interface DurableRateLimiter {
  check(request: RateLimitRequest): Promise<RateLimitResult>;
}

export async function enforceRateLimit(
  limiter: DurableRateLimiter,
  request: RateLimitRequest,
): Promise<RateLimitResult> {
  return limiter.check(request);
}

// No process-memory fallback is provided: it would be unreliable on Vercel.
