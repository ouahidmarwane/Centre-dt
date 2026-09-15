import assert from "node:assert/strict";
import test from "node:test";

import { buildContentSecurityPolicy, isPrivateNoStorePath } from "./response-policy.ts";

test("production CSP is nonce-based, origin-bounded and restrictive", () => {
  const policy = buildContentSecurityPolicy({ nonce: "MTIzNDU2Nzg5MDEyMzQ1Ng==", supabaseUrl: "https://project-ref.supabase.co/path" });
  for (const directive of [
    "default-src 'self'", "script-src 'self' 'nonce-MTIzNDU2Nzg5MDEyMzQ1Ng==' 'strict-dynamic'",
    "connect-src 'self' https://project-ref.supabase.co", "media-src 'self'", "frame-src 'none'",
    "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ]) assert.ok(policy.includes(directive), directive);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(policy, /\*/);
});

test("unsafe eval is development-only", () => {
  const options = { nonce: "MTIzNDU2Nzg5MDEyMzQ1Ng==", supabaseUrl: "https://project-ref.supabase.co" };
  assert.doesNotMatch(buildContentSecurityPolicy(options), /unsafe-eval/);
  assert.match(buildContentSecurityPolicy({ ...options, development: true }), /script-src[^;]*'unsafe-eval'/);
});

test("auth-aware routes are private no-store", () => {
  for (const path of ["/", "/login", "/forbidden", "/dashboard", "/patients/abc", "/appointments", "/accounting", "/security"]) {
    assert.equal(isPrivateNoStorePath(path), true, path);
  }
  assert.equal(isPrivateNoStorePath("/media/clinic-loop.mp4"), false);
});
