const supabaseQrPrefix = "data:image/svg+xml;utf-8,";
const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

function isSvgPayload(value: string): boolean {
  // Shape check only, not a sanitizer. The result must remain an img source.
  return /^(?:<\?xml\s[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|\/?>)/.test(value) &&
    (value.endsWith("</svg>") || /^<svg\b[^<>]*\/>$/.test(value));
}

export function safeQrDataUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(supabaseQrPrefix)) return null;
  let payload = value.slice(supabaseQrPrefix.length);
  if (forbiddenControls.test(payload)) return null;
  payload = payload.trim();
  // The installed SDK supplies raw XML: preserve literal percent sequences.
  // Also normalize a fully URI-encoded XML representation exactly once.
  if (!isSvgPayload(payload)) {
    try {
      payload = decodeURIComponent(payload);
      if (forbiddenControls.test(payload)) return null;
      payload = payload.trim();
    } catch {
      return null;
    }
  }
  if (!isSvgPayload(payload)) return null;
  try {
    return `${supabaseQrPrefix}${encodeURIComponent(payload)}`;
  } catch {
    return null;
  }
}
