import "server-only";

import { isIP } from "node:net";

export function getVercelClientIp(headers: Headers): string | null {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  const forwarded = headers.get("x-vercel-forwarded-for");
  const candidate = forwarded?.split(",", 1)[0]?.trim();

  return candidate && isIP(candidate) !== 0 ? candidate : null;
}
