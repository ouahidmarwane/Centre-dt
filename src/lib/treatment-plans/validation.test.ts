import assert from "node:assert/strict";
import test from "node:test";

import { remainingToPay, summarizePlan, validateTreatmentPlanForm } from "./validation.ts";

const token = "5b2c8f4e-1d3a-4c6b-9e7f-0a1b2c3d4e5f";
function form(fields: [string, string][]) { const data = new FormData(); for (const [key, value] of fields) data.append(key, value); return data; }

test("plan form keeps ordered steps and ignores fully empty rows", () => {
  const result = validateTreatmentPlanForm(form([
    ["title", " Implant 36 "], ["category", "implant"], ["notes", ""], ["idempotencyKey", token],
    ["stepLabel", "Pose"], ["stepAmount", "6000"], ["stepDate", "2026-11-02"],
    ["stepLabel", ""], ["stepAmount", ""], ["stepDate", ""],
    ["stepLabel", "Couronne"], ["stepAmount", "4000,50"], ["stepDate", ""],
  ]));
  assert.deepEqual(result, { success: true, data: { title: "Implant 36", category: "implant", notes: null, idempotencyKey: token, steps: [
    { label: "Pose", amount: 6000, planned_date: "2026-11-02" },
    { label: "Couronne", amount: 4000.5, planned_date: null },
  ] } });
});

test("plan form reports the first invalid step and requires one step", () => {
  const invalid = validateTreatmentPlanForm(form([["title", "X"], ["category", "implant"], ["idempotencyKey", token], ["stepLabel", "Pose"], ["stepAmount", "12.345"], ["stepDate", ""]]));
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.match(invalid.fieldErrors.steps ?? "", /Séance 1/);
  const badDate = validateTreatmentPlanForm(form([["title", "X"], ["category", "implant"], ["idempotencyKey", token], ["stepLabel", "Pose"], ["stepAmount", "10"], ["stepDate", "2026-02-30"]]));
  assert.equal(badDate.success, false);
  const empty = validateTreatmentPlanForm(form([["title", "X"], ["category", "magic"], ["idempotencyKey", "nope"]]));
  assert.equal(empty.success, false);
  if (!empty.success) assert.deepEqual(Object.keys(empty.fieldErrors).sort(), ["category", "idempotencyKey", "steps"]);
});

test("plan summary adds money exactly and counts progress", () => {
  const summary = summarizePlan([{ amount: 0.1, done: true }, { amount: 0.2, done: true }, { amount: 4000.5, done: false }]);
  assert.deepEqual(summary, { quote: 4000.8, realised: 0.3, toRealise: 4000.5, stepsDone: 2, stepsTotal: 3 });
});

test("remaining to pay = unpaid balance + sessions left in accepted plans only", () => {
  const accepted = { status: "accepted" as const, summary: summarizePlan([{ amount: 6000, done: true }, { amount: 4000, done: false }]) };
  const proposed = { status: "proposed" as const, summary: summarizePlan([{ amount: 900, done: false }]) };
  const cancelled = { status: "cancelled" as const, summary: summarizePlan([{ amount: 700, done: false }]) };
  assert.equal(remainingToPay(1500, [accepted, proposed, cancelled]), 5500);
  assert.equal(remainingToPay(0, []), 0);
});
