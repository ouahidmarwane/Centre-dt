import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("effective authority requires AAL2 for assistants and doctors alike", async () => {
  const sql = await readFile(path.join(process.cwd(), "supabase/migrations/20260924150000_assistant_mfa_aal2.sql"), "utf8");
  assert.match(sql, /create or replace function private\.current_user_role\(\)/i);
  assert.match(sql, /active_profile\.role in \('assistant'::public\.app_role, 'doctor'::public\.app_role\)\s*and \(select private\.current_aal\(\)\) = 'aal2'/i);
  assert.match(sql, /else null::public\.app_role/i);
  assert.doesNotMatch(sql, /then 'assistant'::public\.app_role/i);
  assert.match(sql, /security definer\s*set search_path = ''/i);
});
