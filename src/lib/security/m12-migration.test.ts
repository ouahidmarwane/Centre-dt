import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260915120000_security_hardening.sql");
const correctiveMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260915120100_fix_intervention_idempotency_ambiguity.sql",
);

test("M12 adds intervention idempotency without rewriting historical identifiers", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.interventions add column idempotency_key uuid/i);
  assert.match(sql, /set idempotency_key = id/i);
  assert.match(sql, /interventions_idempotency_key_key unique \(idempotency_key\)/i);
  assert.doesNotMatch(sql, /delete from public\.interventions|truncate|drop table/i);
});

test("identical replay returns one intervention and conflicting replay is rejected", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /where idempotency_key = target_idempotency_key/i);
  assert.match(sql, /return existing\.id/i);
  assert.match(sql, /Idempotency key conflict[\s\S]*?23505/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /insert into public\.interventions[\s\S]*?target_idempotency_key/i);
});

test("M12 RPC retains auth, relationship checks, grants and safe search path", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /private\.current_user_role\(\)/i);
  assert.match(sql, /p\.is_active[\s\S]*?for update/i);
  assert.match(sql, /f\.patient_id = target_patient_id/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /to authenticated/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*?to anon/i);
});

test("M12 corrective migration removes replay ambiguity without changing semantics", async () => {
  const sql = await readFile(correctiveMigrationPath, "utf8");
  assert.match(sql, /create or replace function public\.create_intervention/i);
  assert.match(sql, /from public\.intervention_teeth it[\s\S]*?where it\.intervention_id = existing\.id/i);
  assert.match(sql, /from public\.intervention_findings inf[\s\S]*?where inf\.intervention_id = existing\.id/i);
  assert.match(sql, /where i\.idempotency_key = target_idempotency_key/i);
  assert.match(sql, /new_intervention_id/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /to authenticated/i);
  assert.doesNotMatch(sql, /alter table|delete from|truncate|drop table|dynamic execute/i);
});
