import assert from "node:assert/strict";
import test from "node:test";

import { isDentalFindingId, validateDentalFindingForm } from "./validation.ts";

function findingForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ toothNumber: "16", condition: "caries", status: "untreated", notes: "", recommendation: "", ...overrides })) {
    formData.set(key, value);
  }
  return formData;
}

test("accepts a valid permanent FDI finding and trims optional text", () => {
  const result = validateDentalFindingForm(findingForm({ notes: "  occlusale  " }));
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.notes, "occlusale");
});

test("rejects invalid FDI numbers, enums, and direct resolution", () => {
  const invalidCases: Record<string, string>[] = [
    { toothNumber: "19" },
    { toothNumber: "51" },
    { condition: "unknown" },
    { status: "resolved" },
  ];
  for (const overrides of invalidCases) assert.equal(validateDentalFindingForm(findingForm(overrides)).success, false);
});

test("requires notes for other and enforces clinical text limits", () => {
  assert.equal(validateDentalFindingForm(findingForm({ condition: "other" })).success, false);
  assert.equal(validateDentalFindingForm(findingForm({ notes: "x".repeat(4001) })).success, false);
  assert.equal(validateDentalFindingForm(findingForm({ recommendation: "x".repeat(2001) })).success, false);
});

test("validates finding UUIDs", () => {
  assert.equal(isDentalFindingId("f47ac10b-58cc-4372-a567-0e02b2c3d479"), true);
  assert.equal(isDentalFindingId("not-a-uuid"), false);
});
