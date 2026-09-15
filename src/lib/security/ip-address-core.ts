import { isIP } from "node:net";

function validatedAddress(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.includes("%")) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(candidate);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  const family = isIP(candidate);
  if (family === 0) return null;
  return family === 6 ? normalizeIpv6(candidate) : candidate;
}

function expandIpv6(value: string): string[] | null {
  let input = value.toLowerCase();
  const ipv4 = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(input)?.[1];
  if (ipv4) {
    const bytes = ipv4.split(".").map(Number);
    if (bytes.some((part) => part > 255)) return null;
    input = `${input.slice(0, -ipv4.length)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => group.padStart(4, "0"));
}

function compressIpv6(groups: string[]): string {
  const plain = groups.map((group) => Number.parseInt(group, 16).toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < plain.length;) {
    if (plain[index] !== "0") { index += 1; continue; }
    let end = index;
    while (end < plain.length && plain[end] === "0") end += 1;
    if (end - index > bestLength) { bestStart = index; bestLength = end - index; }
    index = end;
  }
  if (bestLength < 2) return plain.join(":");
  const left = plain.slice(0, bestStart).join(":");
  const right = plain.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`;
}

function normalizeIpv6(value: string): string {
  const groups = expandIpv6(value);
  return groups ? compressIpv6(groups) : value.toLowerCase();
}

export function normalizeIpAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return validatedAddress(value);
}

export function rateLimitIpBucket(value: unknown): string | null {
  const normalized = normalizeIpAddress(value);
  if (!normalized) return null;
  if (isIP(normalized) === 4) return normalized;
  const groups = expandIpv6(normalized);
  return groups ? `${compressIpv6([...groups.slice(0, 4), ...Array(4).fill("0000")])}/64` : null;
}
