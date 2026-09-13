import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const invoicePrint = path.join(process.cwd(), "src/app/(dashboard)/patients/[id]/invoices/[invoiceId]/print/page.tsx");
const receiptPrint = path.join(process.cwd(), "src/app/(dashboard)/patients/[id]/receipts/[receiptId]/print/page.tsx");

test("financial print routes independently authorize, validate and avoid caching", async () => {
  const pages = await Promise.all([readFile(invoicePrint, "utf8"), readFile(receiptPrint, "utf8")]);
  assert.match(pages[0], /requirePermission\("invoices\.print"\)/);
  assert.match(pages[1], /requirePermission\("receipts\.print"\)/);
  for (const page of pages) {
    assert.match(page, /isPatientId\(id\)/);
    assert.match(page, /isFinancialDocumentId/);
    assert.match(page, /dynamic = "force-dynamic"/);
    assert.match(page, /revalidate = 0/);
    assert.doesNotMatch(page, /dangerouslySetInnerHTML|https?:\/\/|medical_history|allerg|odontogram|prescription|audit_logs|security_events|user_sessions/i);
  }
});

test("document lookups enforce patient-document and payment relationships", async () => {
  const data = await readFile(path.join(process.cwd(), "src/lib/financial-documents/data.ts"), "utf8");
  assert.match(data, /\.eq\("id", invoiceId\)[\s\S]*?\.eq\("patient_id", patientId\)/);
  assert.match(data, /\.eq\("id", receiptId\)[\s\S]*?\.eq\("patient_id", patientId\)/);
  assert.match(data, /\.eq\("id", receiptResult\.data\.payment_id\)[\s\S]*?\.eq\("patient_id", patientId\)/);
});

test("invoice and receipt history queries remain document-scoped", async () => {
  const data = await readFile(path.join(process.cwd(), "src/lib/financial-documents/data.ts"), "utf8");
  const history = data.match(/getPatientFinancialDocuments[\s\S]*?export async function getInvoice/)?.[0] ?? "";
  assert.doesNotMatch(history, /select\("\*"\)|medical_history|allerg|notes|reference|reversal_reason/i);
});

test("reversed receipt display preserves the amount snapshot", async () => {
  const receipt = await readFile(receiptPrint, "utf8");
  assert.match(receipt, /PAIEMENT EXTOURNÉ/);
  assert.match(receipt, /amount_snapshot/);
  assert.doesNotMatch(receipt, /payment\.amount/);
});
