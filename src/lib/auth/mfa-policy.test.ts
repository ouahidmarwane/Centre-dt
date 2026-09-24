import assert from "node:assert/strict";
import test from "node:test";

import { decideMfaRoute, validateTotpCode, verifiedTotpCountFromResult } from "./mfa-policy.ts";

test("TOTP validation accepts exactly six digits with edge whitespace", () => {
  assert.equal(validateTotpCode("123456"), "123456");
  assert.equal(validateTotpCode(" 123456\n"), "123456");
});

test("TOTP validation rejects malformed input", () => {
  for (const value of [null, "", "12345", "1234567", "12a456", "12 456", "123-456"]) {
    assert.equal(validateTotpCode(value), null, String(value));
  }
  assert.equal(validateTotpCode(new File([], "code")), null);
});

test("routing matrix has no MFA loops and applies the same TOTP rules to assistants", () => {
  const assistant = { status: "active", role: "assistant", aal: "aal1", verifiedTotpCount: 0 } as const;
  assert.deepEqual(decideMfaRoute(assistant, "application"), { action: "redirect", destination: "/mfa/enroll" });
  assert.deepEqual(decideMfaRoute(assistant, "enroll"), { action: "allow" });
  const enrolledAssistant = { ...assistant, verifiedTotpCount: 1 } as const;
  assert.deepEqual(decideMfaRoute(enrolledAssistant, "application"), { action: "redirect", destination: "/mfa/challenge" });
  assert.deepEqual(decideMfaRoute(enrolledAssistant, "challenge"), { action: "allow" });

  const unenrolledDoctor = { status: "active", role: "doctor", aal: "aal1", verifiedTotpCount: 0 } as const;
  assert.deepEqual(decideMfaRoute(unenrolledDoctor, "application"), { action: "redirect", destination: "/mfa/enroll" });
  assert.deepEqual(decideMfaRoute(unenrolledDoctor, "enroll"), { action: "allow" });
  assert.deepEqual(decideMfaRoute(unenrolledDoctor, "challenge"), { action: "redirect", destination: "/mfa/enroll" });

  const enrolledDoctor = { ...unenrolledDoctor, verifiedTotpCount: 1 } as const;
  assert.deepEqual(decideMfaRoute(enrolledDoctor, "application"), { action: "redirect", destination: "/mfa/challenge" });
  assert.deepEqual(decideMfaRoute(enrolledDoctor, "enroll"), { action: "redirect", destination: "/mfa/challenge" });
  assert.deepEqual(decideMfaRoute(enrolledDoctor, "challenge"), { action: "allow" });

  const aal2Doctor = { ...enrolledDoctor, aal: "aal2" } as const;
  assert.deepEqual(decideMfaRoute(aal2Doctor, "application"), { action: "allow" });
  assert.deepEqual(decideMfaRoute(aal2Doctor, "challenge"), { action: "redirect", destination: "/dashboard" });

  const aal2Assistant = { ...enrolledAssistant, aal: "aal2" } as const;
  assert.deepEqual(decideMfaRoute(aal2Assistant, "application"), { action: "allow" });
  assert.deepEqual(decideMfaRoute({ ...assistant, aal: "aal2" }, "application"), { action: "redirect", destination: "/forbidden" });
});

test("anonymous, inactive and multiple-factor states fail closed", () => {
  assert.deepEqual(decideMfaRoute({ status: "anonymous" }, "application"), { action: "redirect", destination: "/login" });
  assert.deepEqual(decideMfaRoute({ status: "anonymous" }, "login"), { action: "allow" });
  assert.deepEqual(decideMfaRoute({ status: "denied" }, "challenge"), { action: "redirect", destination: "/forbidden" });
  const multiple = { status: "active", role: "doctor", aal: "aal1", verifiedTotpCount: 2 } as const;
  assert.deepEqual(decideMfaRoute(multiple, "application"), { action: "redirect", destination: "/mfa/challenge" });
  assert.deepEqual(decideMfaRoute(multiple, "challenge"), { action: "recovery" });
});

test("exact regression: doctor AAL2 with two verified factors fails closed", () => {
  assert.deepEqual(decideMfaRoute({ status: "active", role: "doctor", aal: "aal2", verifiedTotpCount: 2 }, "application"),
    { action: "redirect", destination: "/forbidden" });
});

test("complete doctor AAL/factor matrix rejects anomalous and multiple-factor access", () => {
  for (const aal of ["aal1", "aal2"] as const) {
    for (const count of [0, 1, 2, 3, 10]) {
      const identity = { status: "active", role: "doctor", aal, verifiedTotpCount: count } as const;
      const result = decideMfaRoute(identity, "application");
      if (aal === "aal2") assert.deepEqual(result, count === 1 ? { action: "allow" } : { action: "redirect", destination: "/forbidden" });
      else assert.deepEqual(result, { action: "redirect", destination: count === 0 ? "/mfa/enroll" : "/mfa/challenge" });
      if (count > 1 && aal === "aal1") assert.deepEqual(decideMfaRoute(identity, "challenge"), { action: "recovery" });
    }
  }
  for (const count of [-1, NaN, Infinity, 1.5]) assert.deepEqual(
    decideMfaRoute({ status: "active", role: "doctor", aal: "aal2", verifiedTotpCount: count }, "application"),
    { action: "redirect", destination: "/forbidden" },
  );
});

test("factor response counts only the supported verified TOTP category and rejects invalid lookup", () => {
  const verified = { factor_type: "totp", status: "verified" };
  assert.equal(verifiedTotpCountFromResult({ error: null, data: { totp: [verified], all: [verified, { factor_type: "totp", status: "unverified" }, { factor_type: "phone", status: "verified" }] } }), 1);
  assert.equal(verifiedTotpCountFromResult({ error: null, data: { totp: [] } }), 0);
  for (const result of [null, {}, { error: {}, data: { totp: [verified] } }, { data: null }, { data: { totp: "invalid" } },
    { data: { totp: [null] } }, { data: { totp: [{ factor_type: "totp", status: "unverified" }] } },
    { data: { totp: [{ factor_type: "phone", status: "verified" }] } }]) assert.equal(verifiedTotpCountFromResult(result), null);
});
