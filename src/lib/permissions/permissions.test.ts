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
  assert.equal(hasPermission("assistant", "odontogram.read"), true);
  assert.equal(hasPermission("assistant", "odontogram.write"), true);
  assert.equal(hasPermission("assistant", "odontogram.resolve"), false);
  assert.equal(hasPermission("assistant", "interventions.write"), true);
  assert.equal(hasPermission("assistant", "interventions.cancel"), false);
  assert.equal(hasPermission("assistant", "payments.record"), true);
  assert.equal(hasPermission("assistant", "payments.reverse"), false);
  assert.equal(hasPermission("assistant", "payments.reminders"), true);
  assert.equal(hasPermission("assistant", "appointments.write"), true);
  assert.equal(hasPermission("assistant", "appointments.cancel"), true);
  assert.equal(hasPermission("assistant", "appointments.status"), true);
  assert.equal(hasPermission("assistant", "appointments.reminders"), true);
  assert.equal(hasPermission("assistant", "treatment_plans.read"), true);
  assert.equal(hasPermission("assistant", "treatment_plans.progress"), true);
  assert.equal(hasPermission("assistant", "treatment_plans.write"), false);
  assert.equal(hasPermission("assistant", "prescriptions.read"), true);
  assert.equal(hasPermission("assistant", "prescriptions.print"), true);
  assert.equal(hasPermission("assistant", "prescriptions.create"), false);
  assert.equal(hasPermission("assistant", "prescriptions.void"), false);
  assert.equal(hasPermission("assistant", "invoices.read"), true);
  assert.equal(hasPermission("assistant", "invoices.print"), true);
  assert.equal(hasPermission("assistant", "invoices.create"), false);
  assert.equal(hasPermission("assistant", "invoices.void"), false);
  assert.equal(hasPermission("assistant", "receipts.read"), true);
  assert.equal(hasPermission("assistant", "receipts.create"), true);
  assert.equal(hasPermission("assistant", "receipts.print"), true);
  assert.equal(hasPermission("assistant", "stock.read"), true);
  assert.equal(hasPermission("assistant", "stock.write"), true);
  assert.equal(hasPermission("assistant", "stock.archive"), false);
  assert.equal(hasPermission("assistant", "accounting.read"), false);
  assert.equal(hasPermission("assistant", "security.read"), false);
  assert.equal(canAccessDoctorRoute("assistant", "/accounting"), false);
  assert.equal(canAccessDoctorRoute("assistant", "/security"), false);
  assert.equal(hasPermission("assistant", "statistics.read"), false);
  assert.equal(canAccessDoctorRoute("assistant", "/statistics"), false);
});

test("doctor permissions include protected modules", () => {
  assert.equal(hasPermission("doctor", "patients.archive"), true);
  assert.equal(hasPermission("doctor", "odontogram.resolve"), true);
  assert.equal(hasPermission("doctor", "interventions.cancel"), true);
  assert.equal(hasPermission("doctor", "payments.reverse"), true);
  assert.equal(hasPermission("doctor", "treatment_plans.write"), true);
  assert.equal(hasPermission("doctor", "prescriptions.create"), true);
  assert.equal(hasPermission("doctor", "prescriptions.void"), true);
  assert.equal(hasPermission("doctor", "invoices.create"), true);
  assert.equal(hasPermission("doctor", "invoices.void"), true);
  assert.equal(hasPermission("doctor", "receipts.create"), true);
  assert.equal(canAccessDoctorRoute("doctor", "/accounting"), true);
  assert.equal(canAccessDoctorRoute("doctor", "/security"), true);
  assert.equal(canAccessDoctorRoute("doctor", "/statistics"), true);
});
