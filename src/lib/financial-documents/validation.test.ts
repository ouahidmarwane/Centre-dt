import assert from "node:assert/strict";
import test from "node:test";

import { isFinancialDocumentId, validateDocumentReason, validateInvoiceRequest } from "./validation.ts";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

test("financial document identifiers are strict UUIDs", () => {
  assert.equal(isFinancialDocumentId(first), true);
  assert.equal(isFinancialDocumentId("not-an-id"), false);
});

test("invoice requests require unique intervention IDs and an idempotency key", () => {
  const valid = new FormData();
  valid.append("interventionIds", first);
  valid.append("interventionIds", second);
  valid.set("idempotencyKey", first);
  assert.equal(validateInvoiceRequest(valid).success, true);
  const duplicate = new FormData();
  duplicate.append("interventionIds", first);
  duplicate.append("interventionIds", first);
  duplicate.set("idempotencyKey", first);
  assert.equal(validateInvoiceRequest(duplicate).success, false);
});

test("invoice void reasons are bounded", () => {
  assert.equal(validateDocumentReason(" correction nécessaire "), "correction nécessaire");
  assert.equal(validateDocumentReason("non"), null);
  assert.equal(validateDocumentReason("x".repeat(501)), null);
});
