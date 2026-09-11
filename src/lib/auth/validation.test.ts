import assert from "node:assert/strict";
import test from "node:test";

import { validateLoginFields } from "./validation.ts";

test("login validation normalizes a valid email", () => {
  const result = validateLoginFields("  STAFF@CABINET.MA ", "secret");

  assert.deepEqual(result, {
    success: true,
    data: { email: "staff@cabinet.ma", password: "secret" },
  });
});

test("login validation rejects malformed and oversized values", () => {
  assert.deepEqual(validateLoginFields("invalid", "secret"), { success: false });
  assert.deepEqual(validateLoginFields("staff@cabinet.ma", ""), { success: false });
  assert.deepEqual(validateLoginFields("staff@cabinet.ma", "x".repeat(1025)), {
    success: false,
  });
});

test("login validation rejects non-string form entries", () => {
  assert.deepEqual(validateLoginFields(null, "secret"), { success: false });
  assert.deepEqual(validateLoginFields(new File([], "value"), "secret"), {
    success: false,
  });
});
