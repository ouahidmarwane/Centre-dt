import { normalizeIpAddress, rateLimitIpBucket } from "./ip-address-core.ts";

export type TrustedClientIpEnvironment = {
  vercel?: string;
  vercelEnvironment?: string;
};

export function trustedClientIpFromVercel(
  headers: Pick<Headers, "get">,
  environment: TrustedClientIpEnvironment,
): string | null {
  if (environment.vercel !== "1" || environment.vercelEnvironment !== "production") return null;
  const controlledValue = headers.get("x-vercel-forwarded-for");
  if (!controlledValue || controlledValue.includes(",")) return null;
  return normalizeIpAddress(controlledValue);
}

export function trustedRateLimitIpBucketFromVercel(
  headers: Pick<Headers, "get">,
  environment: TrustedClientIpEnvironment,
): string | null {
  const address = trustedClientIpFromVercel(headers, environment);
  return address ? rateLimitIpBucket(address) : null;
}
