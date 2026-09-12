import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260912100000_dental_chart.sql");

test("odontogram tables use RLS, immutable history, and no client mutations", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.dental_findings enable row level security/i);
  assert.match(sql, /alter table public\.dental_finding_revisions enable row level security/i);
  assert.match(sql, /revoke all on table public\.dental_findings from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.dental_findings to authenticated/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete).*dental_findings/i);
  assert.doesNotMatch(sql, /create policy .*delete/i);
});

test("odontogram RPCs pin identity, parent relationship, and active patient", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /actor_id uuid := auth\.uid\(\)/i);
  assert.match(sql, /patient\.id = target_patient_id and patient\.is_active/gi);
  assert.match(sql, /patient_id = target_patient_id[\s\S]*?and is_active/gi);
  assert.match(sql, /actor_role is distinct from 'doctor'/i);
  assert.doesNotMatch(sql, /target_(created|updated|resolved)_by/i);
});

test("FDI scope, history snapshots, and minimal audit metadata are explicit", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const tooth of [11, 18, 21, 28, 31, 38, 41, 48]) assert.match(sql, new RegExp(`\\b${tooth}\\b`));
  assert.match(sql, /create trigger dental_findings_record_revision/i);
  const audit = sql.match(/insert into public\.audit_logs([\s\S]*?)return new/i)?.[1] ?? "";
  assert.match(audit, /'patient_id'/i);
  assert.match(audit, /'tooth_number'/i);
  assert.doesNotMatch(audit, /new\.(notes|recommendation)/i);
});
