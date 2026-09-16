import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safeQrDataUrl } from "./mfa-qr.ts";

const prefix = "data:image/svg+xml;utf-8,";
// Synthetic shapes only: no enrollment response or authenticator material.
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>50% %20 # &amp; é</text></svg>';

for (const [name, payload] of [
  ["single line", svg],
  ["LF regression", svg.replace("><text", ">\n\t<text")],
  ["CRLF regression", svg.replace("><text", ">\r\n<text")],
  ["XML declaration and comment", `<?xml version="1.0"?>\n<!-- synthetic -->\n${svg}`],
  ["self closing", '<svg xmlns="http://www.w3.org/2000/svg"/>'],
]) {
  test(`QR accepts and URI-encodes ${name}`, () => {
    const result = safeQrDataUrl(prefix + payload);
    assert.equal(result, prefix + encodeURIComponent(payload));
  });
}

test("QR encoded input normalizes once; raw literal percent sequences survive", () => {
  const expected = prefix + encodeURIComponent(svg);
  assert.equal(safeQrDataUrl(prefix + svg), expected);
  assert.equal(safeQrDataUrl(expected), expected);
  assert.equal(safeQrDataUrl(prefix + encodeURIComponent(encodeURIComponent(svg))), null);
});

test("QR rejects unsupported schemes, MIME, prefixes, payloads and controls", () => {
  for (const value of [
    "javascript:alert(1)", "data:text/html,<script></script>",
    "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png,synthetic",
    "https://example.invalid/qr.svg", "http://example.invalid/qr.svg", "blob:synthetic",
    "data:image/svg+xml;utf-8x," + svg, "data:image/svg+xml;charset=utf-8," + svg,
    "DATA:image/svg+xml;utf-8," + svg, " " + prefix + svg,
    "data:image/svg+xml;utf-8;," + svg, prefix, prefix + " \r\n", prefix + "not SVG",
    prefix + "<svg>", prefix + svg.replace("50%", "\u000050%"),
    prefix + encodeURIComponent(svg.replace("50%", "\u000b50%")),
    prefix + "\u000b" + svg, prefix + encodeURIComponent(svg + "\u000c"),
    prefix + svg.replace("50%", "\ud80050%"), undefined, null,
  ]) assert.equal(safeQrDataUrl(value), null);
});

test("QR sink is img only, intended CSP permits data images, and failure cleanup stays narrow", async () => {
  const form = await readFile("src/app/(auth)/mfa/enroll/enrollment-form.tsx", "utf8");
  assert.match(form, /<img[^>]*src=\{state\.enrollment\.qrDataUrl\}/);
  assert.doesNotMatch(form, /dangerouslySetInnerHTML|innerHTML|DOMParser|<iframe|<object|<embed|href=\{state\.enrollment\.qrDataUrl/);
  const policy = await readFile("src/lib/security/response-policy.ts", "utf8");
  assert.match(policy, /img-src 'self' data:/);
  const action = await readFile("src/app/(auth)/mfa/actions.ts", "utf8");
  assert.match(action, /import \{ safeQrDataUrl \}/);
  assert.match(action, /if \(data\?\.id\) await supabase\.auth\.mfa\.unenroll\(\{ factorId: data\.id \}\)/);
  assert.match(action, /factor\.factor_type === "totp" && factor\.status === "unverified"/);
});
