import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessDoctorRoute,
  hasPermission,
  isAppRole,
} from "./index.ts";

test("only supported application roles are accepted", () => {
  assert.equal(isAppRole("doctor"), true);
  assert.equal(isAppRole("assistant"), true);
  assert.equal(isAppRole("admin"), false);
  assert.equal(isAppRole(null), false);
});

test("assistant permissions exclude accounting and security", () => {
  assert.equal(hasPermission("assistant", "patients.read"), true);
  assert.equal(hasPermission("assistant", "patients.archive"), false);
  assert.equal(hasPermission("assistant", "appointments.write"), true);
  assert.equal(hasPermission("assistant", "accounting.read"), false);
  assert.equal(hasPermission("assistant", "security.read"), false);
  assert.equal(canAccessDoctorRoute("assistant", "/accounting"), false);
  assert.equal(canAccessDoctorRoute("assistant", "/security"), false);
});

test("doctor permissions include protected modules", () => {
  assert.equal(hasPermission("doctor", "patients.archive"), true);
  assert.equal(canAccessDoctorRoute("doctor", "/accounting"), true);
  assert.equal(canAccessDoctorRoute("doctor", "/security"), true);
});
