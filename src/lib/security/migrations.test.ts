import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");

async function readMigration(name: string) {
  return readFile(path.join(migrationDirectory, name), "utf8");
}

test("every foundation table enables RLS and revokes default client grants", async () => {
  const profiles = await readMigration("20260911190000_profiles_and_roles.sql");
  const security = await readMigration("20260911190100_security_foundation.sql");
  const sql = `${profiles}\n${security}`;

  for (const table of [
    "profiles",
    "audit_logs",
    "security_events",
    "blocked_ips",
    "user_sessions",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`),
    );
  }
});

test("authorization attributes and history have no authenticated client write grant", async () => {
  const profiles = await readMigration("20260911190000_profiles_and_roles.sql");
  const security = await readMigration("20260911190100_security_foundation.sql");

  assert.match(profiles, /grant update \(full_name\) on table public\.profiles/);
  assert.doesNotMatch(profiles, /grant update \([^)]*role/);
  assert.doesNotMatch(profiles, /grant update \([^)]*is_active/);
  assert.doesNotMatch(security, /grant (insert|update|delete).*public\.audit_logs/);
  assert.doesNotMatch(security, /grant (insert|update|delete).*public\.security_events/);
  assert.doesNotMatch(security, /grant (insert|update|delete).*public\.user_sessions/);
});

test("security reads are protected by doctor policies", async () => {
  const policies = await readMigration("20260911190200_security_rls.sql");

  for (const table of ["audit_logs", "security_events", "blocked_ips", "user_sessions"]) {
    assert.match(
      policies,
      new RegExp(
        `create policy ${table}_select_doctor[\\s\\S]*?current_user_role\\(\\)\\) = 'doctor'`,
      ),
    );
  }

  assert.doesNotMatch(policies, /using\s*\(\s*true\s*\)/i);
});
