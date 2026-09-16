import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260915140100_mfa_bootstrap_profile.sql");
const sql = await readFile(migrationPath, "utf8");

test("bootstrap RPC is no-argument, self-only and returns only routing fields", () => {
  assert.match(sql, /create function public\.get_mfa_bootstrap_profile\(\)/i);
  assert.match(sql, /returns table\s*\(\s*role public\.app_role,\s*is_active boolean\s*\)/i);
  assert.match(sql, /profile\.id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /auth\.uid\(\) is not null/i);
  assert.doesNotMatch(sql, /\(\s*(?:user_id|profile_id|email|factor_id)\s/i);
  assert.doesNotMatch(sql, /full_name|created_at|updated_at|session|metadata/i);
});

test("bootstrap RPC locks its definer boundary and exact grants", () => {
  assert.match(sql, /security definer\s+set search_path\s*=\s*''/i);
  assert.match(sql, /revoke all on function public\.get_mfa_bootstrap_profile\(\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_mfa_bootstrap_profile\(\)\s+to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|all).*profiles/i);
  assert.doesNotMatch(sql, /(?:create|alter) policy|disable row level security/i);
});

test("bootstrap routing identity is explicitly separated from authorization", () => {
  assert.match(sql, /BOOTSTRAP ROLE != AUTHORIZATION/i);
  const body = sql.match(/as \$\$([\s\S]*?)\$\$;/i)?.[1] ?? "";
  assert.doesNotMatch(body, /current_user_role|is_active_user/i);
  assert.doesNotMatch(sql, /dynamic|execute\s+format|service_role/i);
});
