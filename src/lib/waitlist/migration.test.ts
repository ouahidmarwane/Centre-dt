import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260924090000_appointment_waitlist.sql");

test("waitlist table is read-only for clients and protected by RLS", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.appointment_waitlist enable row level security/i);
  assert.match(sql, /revoke all on table public\.appointment_waitlist from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.appointment_waitlist to authenticated/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*appointment_waitlist/i);
  assert.match(sql, /unique index appointment_waitlist_one_waiting_per_patient[^;]+where status = 'waiting'/i);
});

test("waitlist RPCs are definer functions with fixed search_path, role checks and audit", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const name of ["add_waitlist_entry", "remove_waitlist_entry", "book_waitlist_entry"]) {
    const definition = sql.slice(sql.indexOf(`create function public.${name}`)).split(/\nend \$\$;/)[0];
    assert.match(definition, /security definer set search_path = ''/i, name);
    assert.match(definition, /private\.current_user_role\(\)/i, name);
    assert.match(definition, /raise exception 'Insufficient privilege' using errcode = '42501'/i, name);
    assert.match(definition, /insert into public\.audit_logs/i, name);
  }
  assert.match(sql, /public\.create_appointment\(/i, "booking reuses the appointment rules");
  assert.match(sql, /revoke all on function public\.add_waitlist_entry[^;]+from public, anon/i);
});
