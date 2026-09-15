import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("security route authorizes before loading its bounded server read model", async () => {
  const page = await readFile(path.join(process.cwd(), "src/app/(dashboard)/security/page.tsx"), "utf8");
  const data = await readFile(path.join(process.cwd(), "src/lib/security/data.ts"), "utf8");
  const proxy = await readFile(path.join(process.cwd(), "src/lib/supabase/proxy.ts"), "utf8");
  const layout = await readFile(path.join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
  assert.match(page, /requirePermission\("security\.read"\)[\s\S]*?getSecurityCenter\(\)/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /revalidate = 0/);
  assert.match(page, /robots:[\s\S]*?index: false/);
  assert.match(data, /\.rpc\("get_security_center"/);
  assert.doesNotMatch(data, /\.from\("(?:security_events|user_sessions|blocked_ips|profiles)"\)/);
  assert.match(proxy, /pathname === "\/security"/);
  assert.match(proxy, /X-Robots-Tag/);
  assert.doesNotMatch(proxy, /check_ip_block|observe_current_session/);
  assert.match(layout, /requireUser\(\)[\s\S]*?observeCurrentSession\(/);
});

test("proxy bypasses static media and retains session/CSP coverage for routes", async () => {
  const proxy = await readFile(path.join(process.cwd(), "src/proxy.ts"), "utf8");
  assert.match(proxy, /mp4\|webm\|ogg\|mp3\|wav\|m4a/);
  assert.match(proxy, /refreshSession\(request/);
  assert.match(proxy, /buildContentSecurityPolicy/);
  assert.doesNotMatch(proxy, /x-forwarded-for["']/i);
  assert.doesNotMatch(proxy, /x-real-ip["']/i);
});
