import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260912140000_financial_documents.sql");

test("financial documents use relational immutable snapshots and exact money", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const table of ["invoices", "invoice_items", "payment_receipts"]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /subtotal numeric\(12,2\)/i);
  assert.match(sql, /amount_snapshot numeric\(12,2\)/i);
  assert.match(sql, /description_snapshot text not null/i);
  assert.match(sql, /payment_id uuid not null unique references public\.payments/i);
  assert.match(sql, /invoice_items_protect_history/i);
  assert.match(sql, /payment_receipts_protect_history/i);
  assert.doesNotMatch(sql, /paid_total|remaining_total|balance numeric/i);
});

test("numbering, idempotency and active intervention allocation are concurrency safe", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /on conflict \(document_kind, document_year\) do update/i);
  assert.match(sql, /FAC-[^']*|target_kind \|\| '-' /i);
  assert.match(sql, /idempotency_key uuid not null unique/gi);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /active_invoice_interventions/i);
  assert.match(sql, /intervention_id uuid primary key/i);
  assert.match(sql, /delete from private\.active_invoice_interventions where invoice_id = target_invoice_id/i);
  assert.doesNotMatch(sql, /max\s*\([^)]*invoice_number/i);
});

test("RPCs derive all financial values and actors from trusted rows", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const fn of ["create_invoice", "void_invoice", "create_payment_receipt"]) {
    const body = sql.match(new RegExp(`create function public\\.${fn}[\\s\\S]*?end \\$\\$;`, "i"))?.[0] ?? "";
    assert.match(body, /security definer set search_path = ''/i);
    assert.match(body, /auth\.uid\(\)/i);
  }
  assert.match(sql, /status = 'performed'/i);
  assert.match(sql, /payment_record\.status is distinct from 'received'/i);
  assert.match(sql, /sum\(amount_due\)/i);
  assert.doesNotMatch(sql, /target_(subtotal|total|amount|number)/i);
  assert.doesNotMatch(sql, /execute\s+format|execute\s+target/i);
});

test("clients have select-only RLS and minimal audit metadata", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /grant (insert|update|delete) on table public\.(invoices|invoice_items|payment_receipts)/i);
  assert.doesNotMatch(sql, /create policy [^\n]+ for (insert|update|delete|all)/i);
  const metadata = [...sql.matchAll(/jsonb_build_object\(([^)]*)\)/gi)].map((match) => match[1]).join("\n");
  assert.match(metadata, /patient_id/i);
  assert.doesNotMatch(metadata, /amount|address|description|reference|reason|first_name|last_name/i);
});
