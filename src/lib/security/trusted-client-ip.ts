import "server-only";

import {
  trustedClientIpFromVercel,
  trustedRateLimitIpBucketFromVercel,
  type TrustedClientIpEnvironment,
} from "./trusted-client-ip-core";

export type { TrustedClientIpEnvironment };

export function trustedClientIp(
  headers: Pick<Headers, "get">,
  environment: TrustedClientIpEnvironment = {
    vercel: process.env.VERCEL,
    vercelEnvironment: process.env.VERCEL_ENV,
  },
): string | null {
  return trustedClientIpFromVercel(headers, environment);
}

export function trustedRateLimitIpBucket(
  headers: Pick<Headers, "get">,
  environment?: TrustedClientIpEnvironment,
): string | null {
  return trustedRateLimitIpBucketFromVercel(headers, environment ?? {
    vercel: process.env.VERCEL,
    vercelEnvironment: process.env.VERCEL_ENV,
  });
}
