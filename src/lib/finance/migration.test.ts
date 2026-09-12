import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const migrationPath=path.join(process.cwd(),"supabase/migrations/20260912110000_interventions_payments.sql");

test("financial tables use exact money and RPC-only writes",async()=>{
  const sql=await readFile(migrationPath,"utf8");
  assert.match(sql,/amount_due numeric\(12,2\)/i); assert.match(sql,/amount numeric\(12,2\)/i);
  for(const table of ["interventions","intervention_teeth","intervention_findings","intervention_revisions","payments"]) assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,`i`));
  assert.doesNotMatch(sql,/grant (insert|update|delete) on table public\.(interventions|payments)/i);
  assert.doesNotMatch(sql,/create policy .* (insert|update|delete|all)/i);
});
test("financial integrity is serialized, derived and idempotent",async()=>{
  const sql=await readFile(migrationPath,"utf8");
  assert.match(sql,/for update/gi); assert.match(sql,/idempotency_key uuid not null unique/i);
  assert.match(sql,/status='performed'/i); assert.match(sql,/status='received'/i);
  assert.match(sql,/target_amount > due_total - received_total/i);
  assert.doesNotMatch(sql,/amount_paid|remaining_balance/i);
});
test("security definer functions lock search path, actors and audit payload",async()=>{
  const sql=await readFile(migrationPath,"utf8");
  assert.match(sql,/security definer[^$]*set search_path = ''/gi); assert.match(sql,/auth\.uid\(\)/gi);
  assert.match(sql,/actor_role is distinct from 'doctor'/gi);
  const audits=[...sql.matchAll(/insert into public\.audit_logs([\s\S]*?)return new/gi)].map(m=>m[1]).join("\n");
  assert.doesNotMatch(audits,/new\.(notes|reference|reversal_reason|amount)/i);
});
