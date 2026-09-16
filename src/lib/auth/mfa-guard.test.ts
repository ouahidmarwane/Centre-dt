import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./mfa-policy.ts";
import * as permissions from "../permissions/index.ts";

type Scenario = {
  role: "doctor" | "assistant";
  aal: "aal1" | "aal2";
  active?: boolean;
  anonymous?: boolean;
  count?: number;
  lookup?: "error" | "throws" | "malformed";
};

async function mockedGuard(scenario: Scenario) {
  const source = await readFile("src/lib/auth/server.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls = { factors: 0, profiles: 0, mutations: 0 };
  const client = {
    auth: {
      getClaims: async () => ({ data: { claims: scenario.anonymous ? null : { sub: "synthetic-subject" } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: scenario.aal }, error: null }),
        listFactors: async () => {
          calls.factors++;
          if (scenario.lookup === "throws") throw new Error("synthetic lookup failure");
          if (scenario.lookup === "error") return { data: null, error: {} };
          if (scenario.lookup === "malformed") return { data: { totp: null }, error: null };
          return { data: { totp: Array.from({ length: scenario.count ?? 1 }, () => ({ factor_type: "totp", status: "verified" })) }, error: null };
        },
      },
    },
    rpc: () => ({ maybeSingle: async () => ({ data: { role: scenario.role, is_active: scenario.active !== false }, error: null }) }),
    from: () => {
      calls.profiles++;
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
        id: "synthetic-subject", full_name: "Synthetic", role: scenario.role, is_active: scenario.active !== false,
      }, error: null }) }) }) };
    },
  };
  const serverModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: serverModule, exports: serverModule.exports,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "next/navigation") return { redirect: (path: string) => { throw new Error(`redirect:${path}`); } };
      if (name === "@/lib/auth/mfa-policy") return policy;
      if (name === "@/lib/permissions") return permissions;
      if (name === "@/lib/supabase/server") return { createClient: async () => client };
      throw new Error("unexpected test import");
    },
  });
  const guard = serverModule.exports as { requirePermission: (permission: permissions.Permission) => Promise<{ role: string }> };
  const protectedAction = async (permission: permissions.Permission = "patients.write") => {
    const user = await guard.requirePermission(permission);
    calls.mutations++;
    return user;
  };
  return { calls, protectedAction };
}

test("real central requirePermission blocks synthetic AAL2 invalid-factor Server Actions", async () => {
  for (const count of [0, 2, 3]) {
    const { calls, protectedAction } = await mockedGuard({ role: "doctor", aal: "aal2", count });
    await assert.rejects(protectedAction(), /redirect:\/forbidden/);
    assert.deepEqual(calls, { factors: 1, profiles: 0, mutations: 0 });
  }
  const allowed = await mockedGuard({ role: "doctor", aal: "aal2", count: 1 });
  assert.equal((await allowed.protectedAction()).role, "doctor");
  assert.deepEqual(allowed.calls, { factors: 1, profiles: 1, mutations: 1 });
});

test("doctor lookup error, rejection and malformed data fail closed at both assurance levels", async () => {
  for (const aal of ["aal1", "aal2"] as const) {
    for (const lookup of ["error", "throws", "malformed"] as const) {
      const { calls, protectedAction } = await mockedGuard({ role: "doctor", aal, lookup });
      await assert.rejects(protectedAction(), /redirect:\/forbidden/);
      assert.equal(calls.factors, 1);
      assert.equal(calls.mutations, 0);
      assert.equal(calls.profiles, 0);
    }
  }
});

test("doctor AAL1 routes through enrollment/challenge before protected action", async () => {
  for (const count of [0, 1, 2, 3]) {
    const { calls, protectedAction } = await mockedGuard({ role: "doctor", aal: "aal1", count });
    await assert.rejects(protectedAction(), count === 0 ? /redirect:\/mfa\/enroll/ : /redirect:\/mfa\/challenge/);
    assert.equal(calls.mutations, 0);
  }
});

test("assistants bypass doctor enumeration but never gain doctor permissions", async () => {
  for (const aal of ["aal1", "aal2"] as const) {
    const allowed = await mockedGuard({ role: "assistant", aal, lookup: "throws" });
    assert.equal((await allowed.protectedAction()).role, "assistant");
    assert.equal(allowed.calls.factors, 0);
    const denied = await mockedGuard({ role: "assistant", aal });
    await assert.rejects(denied.protectedAction("security.manage"), /redirect:\/forbidden/);
    assert.equal(denied.calls.mutations, 0);
  }
});

test("inactive role/AAL matrix and anonymous are denied before factor enumeration", async () => {
  for (const role of ["doctor", "assistant"] as const) {
    for (const aal of ["aal1", "aal2"] as const) {
      const inactive = await mockedGuard({ role, aal, active: false, count: 1 });
      await assert.rejects(inactive.protectedAction(), /redirect:\/forbidden/);
      assert.deepEqual(inactive.calls, { factors: 0, profiles: 0, mutations: 0 });
    }
  }
  const anonymous = await mockedGuard({ role: "doctor", aal: "aal2", anonymous: true });
  await assert.rejects(anonymous.protectedAction(), /redirect:\/login/);
  assert.deepEqual(anonymous.calls, { factors: 0, profiles: 0, mutations: 0 });
});
