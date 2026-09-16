import assert from "node:assert/strict";
import test from "node:test";
import { validateSupabaseEnvironment } from "./env.ts";

// Synthetic configuration only, never a real project or API credential.
const url = "https://synthetic-project.supabase.co";
const publishableKey = "sb_publishable_synthetic_placeholder";

test("production accepts only a canonical hosted Supabase origin and public key format", () => {
  assert.deepEqual(validateSupabaseEnvironment({ url, publishableKey }, true), { url, publishableKey });
  assert.equal(validateSupabaseEnvironment({ url: url + "/", publishableKey }, true).url, url);
});

test("production rejects absent, malformed, non-Supabase and credential-bearing origins", () => {
  for (const badUrl of [undefined, "", "invalid", " " + url, url + "\n", "http://synthetic-project.supabase.co", "https://example.invalid", url + ".example.invalid", "https://supabase.co", url + ":444", url + "/rest/v1", url + "/%2f", url + "?query=synthetic", url + "#fragment", "https://synthetic:synthetic@synthetic-project.supabase.co", "http://localhost:54321", "javascript:synthetic"]) {
    assert.throws(() => validateSupabaseEnvironment({ url: badUrl, publishableKey }, true), /configuration is missing or invalid/);
  }
});

test("missing, secret, legacy JWT and malformed keys fail without reflecting values", () => {
  for (const key of [undefined, "", "sb_secret_synthetic", "synthetic.jwt.placeholder", "sb_publishable_", " sb_publishable_synthetic", "sb_publishable_synthetic\n", "sb_publishable_synthetic<script>"]) {
    try { validateSupabaseEnvironment({ url, publishableKey: key }, true); assert.fail("invalid configuration accepted"); }
    catch (error) { assert.ok(error instanceof Error); assert.equal(error.message, "Supabase configuration is missing or invalid. Check the documented public environment variables."); }
  }
});

test("loopback HTTP is development-only; arbitrary LAN or external origins remain denied", () => {
  for (const local of ["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"]) {
    assert.equal(validateSupabaseEnvironment({ url: local, publishableKey }, false).url, local);
  }
  assert.throws(() => validateSupabaseEnvironment({ url: "http://192.0.2.1:54321", publishableKey }, false));
});
