import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("server auth uses trusted bootstrap and Supabase AAL without treating bootstrap as permission", async () => {
  const server = await read("src/lib/auth/server.ts");
  assert.match(server, /rpc\("get_mfa_bootstrap_profile"\)/);
  assert.match(server, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(server, /BOOTSTRAP ROLE != AUTHORIZATION/);
  assert.match(server, /requirePermission[\s\S]*requireUser\(\)[\s\S]*hasPermission/);
  assert.doesNotMatch(server, /user_metadata|app_metadata/);
});

test("MFA actions use official APIs, strict factor cardinality and explicit AAL2 confirmation", async () => {
  const actions = await read("src/app/(auth)/mfa/actions.ts");
  assert.match(actions, /mfa\.enroll\(\{[\s\S]*factorType: "totp"[\s\S]*issuer: "Centre Dentaire Ouahid"/);
  assert.match(actions, /mfa\.challengeAndVerify/);
  assert.match(actions, /currentLevel === "aal2"/);
  assert.match(actions, /factors\.totp\.length !== 1/);
  assert.doesNotMatch(actions, /setTimeout|sleep|console\./);
});

test("enrollment secrets stay transient and have no unsafe rendering or persistence sink", async () => {
  const files = await Promise.all([
    read("src/app/(auth)/mfa/actions.ts"),
    read("src/app/(auth)/mfa/enroll/enrollment-form.tsx"),
    read("src/app/(auth)/mfa/challenge/challenge-form.tsx"),
  ]);
  const contents = files.join("\n");
  assert.doesNotMatch(contents, /localStorage|sessionStorage|document\.cookie|cookies\(|security_events|audit metadata|console\./);
  assert.doesNotMatch(contents, /dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|\beval\(|new Function/);
  assert.doesNotMatch(contents, /totp\.uri/);
});

test("MFA pages are guarded, noindex and logout remains available", async () => {
  const pages = await Promise.all([
    read("src/app/(auth)/mfa/enroll/page.tsx"),
    read("src/app/(auth)/mfa/challenge/page.tsx"),
  ]);
  for (const page of pages) {
    assert.match(page, /requireMfaPage/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
    assert.match(page, /force-dynamic/);
  }
  const frame = await read("src/app/(auth)/mfa/mfa-frame.tsx");
  assert.match(frame, /logoutAction/);
  const proxy = await read("src/lib/supabase/proxy.ts");
  assert.match(proxy, /pathname\.startsWith\("\/mfa\/"\)/);
  assert.match(proxy, /X-Robots-Tag/);
});
