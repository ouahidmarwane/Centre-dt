import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260912160000_security_center.sql",
);

async function migration() {
  return readFile(migrationPath, "utf8");
}

test("M09 exposes no anonymous RPC and uses only supportable event claims", async () => {
  const sql = await migration();
  for (const event of [
    "auth.login_succeeded",
    "auth.logout",
    "auth.inactive_account_denied",
    "security.rate_limited",
    "security.ip_policy_added",
    "security.ip_policy_disabled",
    "security.user_deactivated",
    "security.user_reactivated",
  ]) assert.match(sql, new RegExp(event.replace(".", "\\.")));

  for (const unsupported of [
    "auth.login_failed",
    "auth.forbidden_access",
    "security.blocked_ip_denied",
    "security.ip_blocked",
    "security.ip_unblocked",
  ]) assert.doesNotMatch(sql, new RegExp(unsupported.replace(".", "\\.")));

  assert.doesNotMatch(sql, /grant execute[\s\S]*?\bto anon\b/i);
  assert.doesNotMatch(sql, /grant insert on table public\.security_events/i);
});

test("every SECURITY DEFINER function locks search_path and avoids dynamic SQL", async () => {
  const sql = await migration();
  const functions = [...sql.matchAll(/create function ([^(]+)[\s\S]*?\$\$;/gi)]
    .map((match) => match[0])
    .filter((definition) => /security definer/i.test(definition));
  assert.ok(functions.length >= 10);
  for (const definition of functions) assert.match(definition, /set search_path = ''/i);
  assert.doesNotMatch(sql, /execute\s+(?:format|target|query)/i);
  assert.doesNotMatch(sql, /auth\.sessions|auth\.refresh_tokens/i);
});

test("session observation derives signed claims without network metadata", async () => {
  const sql = await migration();
  const observation = sql.match(/create function private\.observe_authenticated_session[\s\S]*?end;\n\$\$;/i)?.[0] ?? "";
  assert.match(observation, /auth\.uid\(\)/i);
  assert.match(observation, /auth\.jwt\(\) ->> 'session_id'/i);
  assert.match(observation, /insert into public\.user_sessions \(auth_session_id, user_id\)/i);
  assert.match(observation, /last_seen_at <= now\(\) - interval '10 minutes'/i);
  assert.doesNotMatch(observation, /ip_address|user_agent|target_(?:session|user)_id/i);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete) on table public\.user_sessions/i);
});

test("IP entries are non-enforcing policies and reject unsafe targets", async () => {
  const sql = await migration();
  for (const network of [
    "127.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "172.16.0.0/12",
    "192.0.2.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "169.254.0.0/16",
    "::ffff:0:0/96",
    "100::/64",
    "2001:db8::/32",
    "fc00::/7",
    "fe80::/10",
    "ff00::/8",
  ]) assert.match(sql, new RegExp(network.replaceAll(".", "\\.")));
  assert.match(sql, /create function public\.create_ip_policy\(\s*target_ip inet,\s*target_reason text,\s*target_expires_at timestamptz/i);
  assert.match(sql, /create function public\.disable_ip_policy\(target_policy_id uuid\)/i);
  assert.doesNotMatch(sql, /current_trusted_ip|check_ip_block|blocked_ip_denied/i);
  assert.match(sql, /revoke insert, delete on table public\.blocked_ips from authenticated/i);
  assert.doesNotMatch(sql, /delete from public\.blocked_ips/i);
});

test("durable rate limits protect authenticated administration only", async () => {
  const sql = await migration();
  assert.match(sql, /create table private\.security_rate_limit_buckets/i);
  assert.match(sql, /on conflict on constraint security_rate_limit_buckets_pkey[\s\S]*?request_count = private\.security_rate_limit_buckets\.request_count \+ 1/i);
  assert.match(sql, /'security\.create_ip_policy'[\s\S]*?6, 300/i);
  assert.match(sql, /'security\.disable_ip_policy'[\s\S]*?6, 300/i);
  assert.match(sql, /'security\.user_state'[\s\S]*?6, 300/i);
  assert.doesNotMatch(sql, /'login\.(?:ip|identity|global)'|login_failed/i);
  assert.match(sql, /expires_at < moment - interval '1 day'/i);
});

test("account state changes lock profiles and preserve an active doctor", async () => {
  const sql = await migration();
  assert.match(sql, /lock table public\.profiles in share row exclusive mode/i);
  assert.match(sql, /target_user_id = actor/i);
  assert.match(sql, /active_doctor_count <= 1/i);
  assert.doesNotMatch(sql, /delete from (?:public\.)?profiles/i);
  assert.doesNotMatch(sql, /set\s+role\s*=/i);
});

test("doctor read model is bounded, privacy-minimized and domain-separated", async () => {
  const sql = await migration();
  const readModel = sql.match(/create function public\.get_security_center[\s\S]*?end;\n\$\$;/i)?.[0] ?? "";
  assert.match(readModel, /current_user_role\(\) is distinct from 'doctor'/i);
  assert.match(readModel, /cutoff := now\(\) - interval '14 days'/i);
  assert.doesNotMatch(readModel, /least\(coalesce\(reference_time/i);
  assert.match(readModel, /limit 50/i);
  assert.doesNotMatch(readModel, /se\.ip_address|se\.user_agent|us\.ip_address|us\.user_agent/i);
  assert.doesNotMatch(readModel, /patients|odontogram|prescription|payment|intervention|invoice/i);
});

test("security event writer never accepts or stores caller network context", async () => {
  const sql = await migration();
  const emitter = sql.match(/create function private\.emit_security_event[\s\S]*?end;\n\$\$;/i)?.[0] ?? "";
  assert.doesNotMatch(emitter, /ip_address_value|user_agent_value/i);
  assert.match(emitter, /ip_address,\s*user_agent[\s\S]*?null,\s*null/i);
  assert.doesNotMatch(sql, /password|refresh_token|access_token|cookie/i);
});
