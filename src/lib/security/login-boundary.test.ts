import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const loginActionPath = path.join(
  process.cwd(),
  "src/app/(auth)/login/actions.ts",
);

test("login failures retain one generic non-enumerating response", async () => {
  const source = await readFile(loginActionPath, "utf8");

  assert.match(source, /const genericLoginError\s*=/);
  assert.match(source, /if \(!fields\.success\)[\s\S]*?genericLoginError/);
  assert.match(source, /if \(error \|\| !data\.user\)[\s\S]*?genericLoginError/);
  assert.match(source, /destination = await getLoginDestination\(\)/);
  assert.match(source, /if \(!destination \|\| destination === "\/login"\)[\s\S]*?signOut[\s\S]*?genericLoginError/);
  assert.match(source, /catch \{[\s\S]*?genericLoginError/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)|service[_-]?role/i);
});
