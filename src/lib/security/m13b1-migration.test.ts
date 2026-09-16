import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260915140000_doctor_mfa_aal2.sql",
);

async function migration() {
  return readFile(migrationPath, "utf8");
}

async function allMigrationSql() {
  const directory = path.join(process.cwd(), "supabase/migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  return (await Promise.all(files.map((file) => readFile(path.join(directory, file), "utf8")))).join("\n");
}

function latestPublicFunction(sql: string, name: string) {
  const matches = [...sql.matchAll(
    new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "gi"),
  )];
  return matches.at(-1)?.[0] ?? "";
}

test("M13B.1 derives doctor assurance only from the PostgreSQL JWT context", async () => {
  const sql = await migration();
  assert.match(sql, /create function private\.current_aal\(\)/i);
  assert.match(sql, /auth\.jwt\(\)\s*-\u003e\u003e\s*'aal'\s*=\s*'aal2'/i);
  assert.match(sql, /else 'aal1'/i);
  assert.doesNotMatch(sql, /target_aal|aal_parameter|set_config\s*\(/i);
});

test("effective authority preserves assistant AAL1 and requires doctor AAL2", async () => {
  const sql = await migration();
  assert.match(sql, /profile\.id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /profile\.is_active = true/i);
  assert.match(sql, /active_profile\.role = 'assistant'[\s\S]*?then 'assistant'/i);
  assert.match(sql, /active_profile\.role = 'doctor'[\s\S]*?private\.current_aal\(\)[\s\S]*?= 'aal2'[\s\S]*?then 'doctor'/i);
  assert.match(sql, /else null::public\.app_role/i);
});

test("private AAL building blocks remain unavailable as direct application APIs", async () => {
  const sql = await migration();
  for (const helper of ["current_aal", "current_active_profile_role"]) {
    assert.match(
      sql,
      new RegExp(`revoke all on function private\\.${helper}\\(\\)[\\s\\S]*?from public, anon, authenticated`, "i"),
    );
    assert.doesNotMatch(
      sql,
      new RegExp(`grant execute on function private\\.${helper}\\(\\)`, "i"),
    );
  }
});

test("RLS wrappers retain only the technically required authenticated execute", async () => {
  const sql = await migration();
  for (const helper of ["current_user_role", "is_active_user"]) {
    assert.match(
      sql,
      new RegExp(`revoke all on function private\\.${helper}\\(\\)[\\s\\S]*?from public, anon, authenticated`, "i"),
    );
    assert.match(
      sql,
      new RegExp(`grant execute on function private\\.${helper}\\(\\) to authenticated`, "i"),
    );
  }
});

test("pre-MFA telemetry checks active profile without restoring clinic authority", async () => {
  const sql = await migration();
  const telemetry = sql.match(
    /create or replace function private\.observe_authenticated_session[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";
  assert.match(telemetry, /private\.current_active_profile_role\(\) is null/i);
  assert.doesNotMatch(telemetry, /private\.current_user_role\(\)/i);
  assert.match(telemetry, /auth_session_id = session_identifier[\s\S]*?user_id = actor/i);
});

test("new SECURITY DEFINER helpers lock search_path and avoid dynamic SQL", async () => {
  const sql = await migration();
  for (const helper of ["current_aal", "current_active_profile_role", "current_user_role", "observe_authenticated_session"]) {
    const definition = sql.match(
      new RegExp(`create(?: or replace)? function private\\.${helper}[\\s\\S]*?\\n\\$\\$;`, "i"),
    )?.[0] ?? "";
    assert.match(definition, /security definer/i, helper);
    assert.match(definition, /set search_path = ''/i, helper);
    assert.doesNotMatch(definition, /\bexecute\s+(?:format|immediate)|\bformat\s*\(/i, helper);
  }
});

test("M13B.1 is transactional and does not rewrite policies or M13A", async () => {
  const sql = await migration();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /alter policy|create policy|drop policy/i);
  assert.doesNotMatch(sql, /create_prescription|idempotency_key|prescriptions_idempotency_key_key/i);
});

test("every doctor-only authenticated RPC still depends on the effective doctor role", async () => {
  const sql = await allMigrationSql();
  const doctorOnly = [
    "archive_patient",
    "cancel_intervention",
    "create_invoice",
    "create_ip_policy",
    "create_prescription",
    "disable_ip_policy",
    "get_accounting_dashboard",
    "get_security_center",
    "resolve_dental_finding",
    "reverse_payment",
    "set_user_active",
    "void_invoice",
    "void_prescription",
  ];
  for (const name of doctorOnly) {
    const definition = latestPublicFunction(sql, name);
    assert.ok(definition, name);
    assert.match(definition, /private\.current_user_role\(\)/i, name);
    assert.match(definition, /doctor/i, name);
  }
});

test("every shared SECURITY DEFINER RPC still derives authority from the effective staff role", async () => {
  const sql = await allMigrationSql();
  const shared = [
    "cancel_appointment",
    "create_appointment",
    "create_dental_finding",
    "create_intervention",
    "create_payment_receipt",
    "get_due_appointment_reminders",
    "get_main_dashboard",
    "get_patient_financial_summary",
    "mark_appointment_reminder_handled",
    "record_payment",
    "set_appointment_status",
    "update_appointment",
    "update_dental_finding",
    "update_intervention",
  ];
  for (const name of shared) {
    const definition = latestPublicFunction(sql, name);
    assert.ok(definition, name);
    assert.match(definition, /private\.(?:current_user_role|is_active_user)\(\)/i, name);
  }
});

test("all authenticated RLS policies remain anchored to assurance-aware wrappers", async () => {
  const sql = await allMigrationSql();
  const policies = [...sql.matchAll(/create policy\s+[^;]+;/gi)]
    .map((match) => match[0])
    .filter((policy) => /to authenticated/i.test(policy));
  assert.equal(policies.length, 26);
  for (const policy of policies) {
    assert.match(
      policy,
      /private\.(?:current_user_role|is_active_user)\(\)/i,
      policy.match(/create policy\s+(\S+)/i)?.[1],
    );
  }
});

test("only the three narrow telemetry RPCs are exempt from clinic AAL authority", async () => {
  const sql = await allMigrationSql();
  for (const name of [
    "observe_current_session",
    "record_inactive_account_denied",
    "record_logout",
  ]) {
    const definition = latestPublicFunction(sql, name);
    assert.ok(definition, name);
    assert.match(definition, /security definer/i, name);
    assert.match(definition, /set search_path\s*=\s*''/i, name);
  }
});
