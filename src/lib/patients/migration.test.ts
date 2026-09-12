import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260912090000_patients_foundation.sql",
);

test("patient migration enables RLS and provides no client hard delete", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.patients enable row level security/i);
  assert.match(sql, /revoke all on table public\.patients from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant delete on table public\.patients/i);
  assert.doesNotMatch(sql, /create policy patients_delete/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("patient actor and archive fields are not directly client-writable", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const updateGrant = sql.match(/grant update \(([\s\S]*?)\) on table public\.patients/i)?.[1] ?? "";
  for (const protectedColumn of [
    "is_active",
    "archived_at",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
  ]) {
    assert.doesNotMatch(updateGrant, new RegExp(`\\b${protectedColumn}\\b`));
  }
  assert.match(sql, /new\.created_by := actor_id/i);
  assert.match(sql, /new\.updated_by := actor_id/i);
});

test("patient archive is doctor-only and audit metadata excludes sensitive fields", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /current_user_role\(\)\) is distinct from 'doctor'/i);
  assert.match(sql, /'patient\.created'/i);
  assert.match(sql, /'patient\.updated'/i);
  assert.match(sql, /'patient\.archived'/i);
  assert.match(sql, /'\{\}'::jsonb/i);

  const auditFunction = sql.match(/create function private\.audit_patient_change\(\)([\s\S]*?)create trigger patients_audit_change/i)?.[1] ?? "";
  assert.doesNotMatch(auditFunction, /medical_history_notes|allergy_notes|address|phone/i);
});
