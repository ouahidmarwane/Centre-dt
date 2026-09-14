import { isIP } from "node:net";

function validatedAddress(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.includes("%")) return null;
  const family = isIP(candidate);
  if (family === 0) return null;
  return family === 6 ? candidate.toLowerCase() : candidate;
}

export function normalizeIpAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return validatedAddress(value);
}
