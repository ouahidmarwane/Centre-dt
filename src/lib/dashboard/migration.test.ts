import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260912170000_main_dashboard.sql");

test("dashboard RPC is authenticated, active-user protected and has a locked search path", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create function public\.get_main_dashboard\(reference_time timestamptz default now\(\)\)/i);
  assert.match(sql, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(sql, /actor uuid := auth\.uid\(\)/i);
  assert.match(sql, /actor_role public\.app_role := private\.current_user_role\(\)/i);
  assert.match(sql, /actor is null or actor_role is null/i);
  assert.match(sql, /revoke all on function public\.get_main_dashboard\(timestamptz\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.get_main_dashboard\(timestamptz\) to authenticated/i);
});

test("operational dashboard contains bounded rows and no financial or sensitive patient fields", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /limit 7/i);
  assert.match(sql, /limit 5/i);
  assert.doesNotMatch(sql, /amount_due|payments|current_outstanding|medical_history|allergy|phone|notes|address/i);
  assert.doesNotMatch(sql, /audit_logs|security_events|blocked_ips|session/i);
});

test("clinic day and treatment aggregation retain explicit source semantics", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /at time zone 'Africa\/Casablanca'/i);
  assert.match(sql, /i\.status = 'performed'/i);
  assert.match(sql, /group by lower\(btrim\(i\.nature\)\)/i);
  assert.match(sql, /get_due_appointment_reminders\(reference_time\)/i);
});
