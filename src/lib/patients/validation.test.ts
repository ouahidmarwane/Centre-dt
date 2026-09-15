import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAge,
  isPatientId,
  validatePatientForm,
  validatePatientSearch,
} from "./validation.ts";

function validForm() {
  const form = new FormData();
  form.set("firstName", "  Amine  ");
  form.set("lastName", "El Idrissi");
  form.set("dateOfBirth", "1990-05-18");
  form.set("phone", "+212 6 00 00 00 00");
  return form;
}

test("patient validation trims identity and accepts Moroccan contact formatting", () => {
  const result = validatePatientForm(validForm());
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.firstName, "Amine");
    assert.equal(result.data.phone, "+212 6 00 00 00 00");
    assert.equal(result.data.hasMutuelle, false);
    assert.equal(result.data.mutuelleName, null);
  }
});

test("patient validation rejects future and impossible dates", () => {
  const future = validForm();
  future.set("dateOfBirth", "2999-01-01");
  assert.equal(validatePatientForm(future).success, false);

  const impossible = validForm();
  impossible.set("dateOfBirth", "2020-02-31");
  assert.equal(validatePatientForm(impossible).success, false);
});

test("conditional intake fields are required when enabled and cleared when disabled", () => {
  const missing = validForm();
  missing.set("hasMutuelle", "on");
  missing.set("hasMedicalHistory", "on");
  missing.set("hasAllergies", "on");
  const invalid = validatePatientForm(missing);
  assert.equal(invalid.success, false);

  const disabled = validForm();
  disabled.set("mutuelleName", "Should be discarded");
  disabled.set("medicalHistoryNotes", "Should be discarded");
  disabled.set("allergyNotes", "Should be discarded");
  const result = validatePatientForm(disabled);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.mutuelleName, null);
    assert.equal(result.data.medicalHistoryNotes, null);
    assert.equal(result.data.allergyNotes, null);
  }
});

test("search validation bounds terms and accepts only known status filters", () => {
  assert.deepEqual(validatePatientSearch("  idrissi ", "archived"), {
    success: true,
    data: { query: "idrissi", status: "archived" },
  });
  assert.equal(validatePatientSearch("a", "active").success, false);
  assert.equal(validatePatientSearch("%", "active").success, false);
  assert.equal(validatePatientSearch("amine", "deleted").success, false);
});

test("patient identifiers and derived age are validated", () => {
  assert.equal(isPatientId("9f2f29d4-9db5-4d86-bbcb-2b719ad61bb0"), true);
  assert.equal(isPatientId("../../patients"), false);
  assert.equal(calculateAge("2000-09-13", new Date("2026-09-12T12:00:00Z")), 25);
  assert.equal(calculateAge("2000-09-12", new Date("2026-09-12T12:00:00Z")), 26);
  assert.equal(calculateAge("2000-09-13", new Date("2026-09-12T23:30:00Z")), 26);
  assert.equal(calculateAge(null), null);
});
