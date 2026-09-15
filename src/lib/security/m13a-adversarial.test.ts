import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildWhatsAppReminderUrl,
  normalizeWhatsAppPhone,
} from "../appointments/validation.ts";
import { hasPermission } from "../permissions/index.ts";

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

test("[UNIT] assistant authority excludes escalation and doctor-only operations", () => {
  for (const permission of [
    "patients.archive",
    "interventions.cancel",
    "payments.reverse",
    "prescriptions.create",
    "prescriptions.void",
    "invoices.create",
    "invoices.void",
    "accounting.read",
    "accounting.write",
    "security.read",
    "security.manage",
  ] as const) {
    assert.equal(hasPermission("assistant", permission), false, permission);
  }
});

test("[UNIT] WhatsApp input cannot control scheme, host or query structure", () => {
  for (const maliciousPhone of [
    "javascript:alert(1)",
    "//evil.example/212612345678",
    "+212612345678?text=stolen",
    "+212612345678#fragment",
  ]) {
    assert.equal(normalizeWhatsAppPhone(maliciousPhone), null);
  }

  const url = buildWhatsAppReminderUrl({
    phone: "0612345678",
    firstName: "</text>&redirect=https://evil.example",
    startsAt: "2026-09-20T09:00:00Z",
    type: "day_before",
  });
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "wa.me");
  assert.equal(parsed.pathname, "/212612345678");
  assert.equal(parsed.searchParams.has("text"), true);
  assert.equal([...parsed.searchParams.keys()].length, 1);
});

test("[STATIC SECURITY INVARIANT] production rendering has no unsafe HTML or code sinks", async () => {
  const files = await sourceFiles(path.join(process.cwd(), "src"));
  const productionFiles = files.filter((file) => !file.endsWith(".test.ts"));
  for (const file of productionFiles) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(
      contents,
      /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|\beval\s*\(|new Function\s*\(/,
      path.relative(process.cwd(), file),
    );
  }
});

test("[UNIT] stored clinical text remains escaped by the rendering boundary", () => {
  const payload = '<img src=x onerror="globalThis.compromised=true">';
  const markup = renderToStaticMarkup(createElement("p", null, payload));
  assert.doesNotMatch(markup, /<img/i);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /&quot;globalThis\.compromised=true&quot;/);
});

test("[STATIC SECURITY INVARIANT] document lookups bind document IDs to patient IDs", async () => {
  const [prescriptions, financialDocuments] = await Promise.all([
    source("src/lib/prescriptions/data.ts"),
    source("src/lib/financial-documents/data.ts"),
  ]);
  assert.match(prescriptions, /\.eq\("id",prescriptionId\)\.eq\("patient_id",patientId\)/);
  assert.match(financialDocuments, /\.eq\("id", invoiceId\)[\s\S]*?\.eq\("patient_id", patientId\)/);
  assert.match(financialDocuments, /\.eq\("id", receiptId\)[\s\S]*?\.eq\("patient_id", patientId\)/);
  assert.match(financialDocuments, /\.eq\("id", receiptResult\.data\.payment_id\)[\s\S]*?\.eq\("patient_id", patientId\)/);
});

test("[STATIC SECURITY INVARIANT] state-changing actions authorize independently", async () => {
  const actionFiles = [
    "src/app/(dashboard)/appointments/actions.ts",
    "src/app/(dashboard)/patients/actions.ts",
    "src/app/(dashboard)/patients/[id]/finance-actions.ts",
    "src/app/(dashboard)/patients/[id]/financial-document-actions.ts",
    "src/app/(dashboard)/patients/[id]/odontogram-actions.ts",
    "src/app/(dashboard)/patients/[id]/prescription-actions.ts",
    "src/app/(dashboard)/security/actions.ts",
  ];
  for (const actionFile of actionFiles) {
    const contents = await source(actionFile);
    assert.match(contents, /["']use server["']/);
    assert.match(contents, /requirePermission\(/, actionFile);
  }
});

test("[STATIC SECURITY INVARIANT] sensitive responses keep nonce CSP and no-store", async () => {
  const [policy, proxy] = await Promise.all([
    source("src/lib/security/response-policy.ts"),
    source("src/lib/supabase/proxy.ts"),
  ]);
  assert.match(policy, /script-src[\s\S]*?nonce-/);
  assert.doesNotMatch(policy, /script-src[^\n]*unsafe-inline/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(proxy, /private, no-store, max-age=0/);
});
