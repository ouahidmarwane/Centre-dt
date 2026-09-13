import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260912150000_accounting_dashboard.sql");

test("accounting RPC is doctor-only, bounded and has a locked search path", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create function public\.get_accounting_dashboard/i);
  assert.match(sql, /security definer\s+stable\s+set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /actor_role is distinct from 'doctor'/i);
  assert.match(sql, /interval '5 years'/i);
  assert.match(sql, /target_bucket not in \('day', 'month'\)/i);
  assert.match(sql, /revoke all on function public\.get_accounting_dashboard\(date, date, text\) from public, anon/i);
  assert.doesNotMatch(sql, /execute\s+format|execute\s+target|accounting\.viewed/i);
});

test("M04 rows remain the sole source of financial totals", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /from public\.interventions i[\s\S]*?i\.status = 'performed'/i);
  assert.match(sql, /from public\.payments p[\s\S]*?p\.status = 'received'/i);
  assert.match(sql, /production - totals\.received|totals\.production - totals\.received/i);
  assert.doesNotMatch(sql, /from public\.(invoices|invoice_items|payment_receipts)/i);
  assert.doesNotMatch(sql, /create table|create materialized view|insert into public\.(interventions|payments)|update public\.(interventions|payments)/i);
});

test("accounting periods use Casablanca boundaries and non-overlapping generated buckets", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /at time zone 'Africa\/Casablanca'/i);
  assert.match(sql, /p\.received_at >= start_at[\s\S]*?p\.received_at < end_at/i);
  assert.match(sql, /i\.performed_at >= target_start_date[\s\S]*?i\.performed_at < target_end_date/i);
  assert.match(sql, /generate_series/i);
  assert.doesNotMatch(sql, /interval '\+?0?1:00'|utc\+?1/i);
});

test("RPC returns aggregates only and adds targeted partial indexes", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /interventions_accounting_performed_date_idx/i);
  assert.match(sql, /payments_accounting_received_date_idx/i);
  assert.match(sql, /where status = 'performed'/i);
  assert.match(sql, /where status = 'received'/i);
  assert.match(sql, /count\(distinct activity\.patient_id\)/i);
  assert.match(sql, /payment_methods jsonb/i);
  assert.doesNotMatch(sql, /patient_(name|address)|medical_history|allerg|notes|reference/i);
});
