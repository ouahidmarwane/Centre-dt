import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("accounting route authorizes before loading aggregates and remains private", async () => {
  const page = await readFile(path.join(process.cwd(), "src/app/(dashboard)/accounting/page.tsx"), "utf8");
  const proxy = await readFile(path.join(process.cwd(), "src/lib/supabase/proxy.ts"), "utf8");
  assert.match(page, /requirePermission\("accounting\.read"\)/);
  assert.match(page, /export default async function[\s\S]*?requirePermission\("accounting\.read"\)[\s\S]*?getAccountingDashboard\(/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /revalidate = 0/);
  assert.match(proxy, /pathname === "\/accounting"/);
  assert.match(proxy, /private, no-store, max-age=0/);
  assert.match(proxy, /X-Robots-Tag/);
});

test("accounting server loader uses one aggregate RPC and no raw finance reads", async () => {
  const data = await readFile(path.join(process.cwd(), "src/lib/accounting/data.ts"), "utf8");
  assert.match(data, /\.rpc\("get_accounting_dashboard"/);
  assert.doesNotMatch(data, /\.from\("(?:interventions|payments|invoices|payment_receipts)"\)/);
});
