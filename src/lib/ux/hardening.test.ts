import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard routes provide generic loading and error boundaries", () => {
  const loading = read("../../app/(dashboard)/loading.tsx");
  const error = read("../../app/(dashboard)/error.tsx");

  assert.match(loading, /aria-busy="true"/);
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(`${loading}${error}`, /supabase|postgres|credential|token/i);
});

test("appointment editor is only sticky on wide screens", () => {
  const schedule = read("../../components/appointments/schedule.tsx");

  assert.match(schedule, /xl:sticky xl:top-24/);
  assert.doesNotMatch(schedule, /className=.*[^:]sticky top-24/);
});

test("shared form errors are associated with invalid controls", () => {
  const field = read("../../components/ui/form-field.tsx");

  assert.match(field, /"aria-describedby": error \? errorId/);
  assert.match(field, /"aria-invalid": error \? true/);
  assert.match(field, /id=\{errorId\}/);
});

test("destructive financial and appointment actions retain confirmation", () => {
  const finance = read("../../components/finance/patient-finances.tsx");
  const appointments = read("../../components/appointments/schedule.tsx");

  assert.match(finance, /confirm\("Annuler ce paiement/);
  assert.match(finance, /confirm\("Annuler cette intervention/);
  assert.match(appointments, /confirm\("Annuler ce rendez-vous/);
});

test("print styles hide application chrome and protect document blocks", () => {
  const styles = read("../../app/globals.css");
  const shell = read("../../components/app-shell.tsx");

  assert.match(shell, /print:!hidden/);
  assert.match(shell, /print:hidden/);
  assert.match(styles, /break-inside:\s*avoid/);
});
