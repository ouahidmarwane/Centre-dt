import "server-only";

import { redirect } from "next/navigation";

import { decideMfaRoute, verifiedTotpCountFromResult, type AssuranceLevel, type MfaRouteTarget, type RoutingIdentity } from "@/lib/auth/mfa-policy";
import { hasPermission, isAppRole, type AppRole, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  aal: AssuranceLevel;
};

type ProfileRecord = { id: string; full_name: string; role: string; is_active: boolean };
type AuthSnapshot = { identity: RoutingIdentity; subject: string | null; email: string | null };

function isAssuranceLevel(value: unknown): value is AssuranceLevel {
  return value === "aal1" || value === "aal2";
}

function isProfileRecord(value: unknown): value is ProfileRecord {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return typeof profile.id === "string" && typeof profile.full_name === "string" &&
    typeof profile.role === "string" && typeof profile.is_active === "boolean";
}

async function getAuthSnapshot(): Promise<AuthSnapshot> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    return { identity: { status: "anonymous" }, subject: null, email: null };
  }

  // BOOTSTRAP ROLE != AUTHORIZATION. This self-only result is used solely for
  // MFA/inactive routing. Effective DB role, RLS, business RPCs and
  // requirePermission remain the authorization boundary.
  const { data: bootstrap, error: bootstrapError } = await supabase
    .rpc("get_mfa_bootstrap_profile")
    .maybeSingle();
  const email = typeof claims.email === "string" ? claims.email : null;

  if (bootstrapError || !bootstrap || !isAppRole(bootstrap.role) ||
      typeof bootstrap.is_active !== "boolean" || !bootstrap.is_active) {
    return { identity: { status: "denied" }, subject: claims.sub, email };
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = assurance?.currentLevel;
  if (assuranceError || !isAssuranceLevel(aal)) {
    return { identity: { status: "denied" }, subject: claims.sub, email };
  }

  let verifiedTotpCount: number;
  try {
    const count = verifiedTotpCountFromResult(await supabase.auth.mfa.listFactors());
    if (count === null) {
      return { identity: { status: "denied" }, subject: claims.sub, email };
    }
    verifiedTotpCount = count;
  } catch {
    return { identity: { status: "denied" }, subject: claims.sub, email };
  }

  return {
    identity: { status: "active", role: bootstrap.role, aal, verifiedTotpCount },
    subject: claims.sub,
    email,
  };
}

function enforceRoute(identity: RoutingIdentity, target: MfaRouteTarget) {
  const decision = decideMfaRoute(identity, target);
  if (decision.action === "redirect") redirect(decision.destination);
  return decision;
}

export async function getLoginDestination(): Promise<string | null> {
  const { identity } = await getAuthSnapshot();
  const decision = decideMfaRoute(identity, "login");
  return decision.action === "redirect" ? decision.destination : null;
}

export async function requireMfaPage(target: "enroll" | "challenge") {
  const snapshot = await getAuthSnapshot();
  const decision = enforceRoute(snapshot.identity, target);
  if (snapshot.identity.status !== "active" || snapshot.identity.aal !== "aal1") {
    redirect("/forbidden");
  }
  return {
    recoveryRequired: decision.action === "recovery",
    verifiedTotpCount: snapshot.identity.verifiedTotpCount,
  };
}

async function loadActiveUser(snapshot: AuthSnapshot): Promise<AuthenticatedUser | null> {
  if (snapshot.identity.status !== "active" || !snapshot.subject) return null;
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", snapshot.subject)
    .maybeSingle();

  if (profileError || !isProfileRecord(profile) || !profile.is_active ||
      profile.role !== snapshot.identity.role) {
    return null;
  }

  return {
    id: profile.id,
    email: snapshot.email,
    fullName: profile.full_name,
    role: snapshot.identity.role,
    aal: snapshot.identity.aal,
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const snapshot = await getAuthSnapshot();
  enforceRoute(snapshot.identity, "application");
  const user = await loadActiveUser(snapshot);
  if (!user) redirect("/forbidden");
  return user;
}

// Same checks as requireUser without redirects, for route handlers answering JSON.
export async function getAuthorizedUser(): Promise<AuthenticatedUser | null> {
  const snapshot = await getAuthSnapshot();
  if (decideMfaRoute(snapshot.identity, "application").action !== "allow") return null;
  return loadActiveUser(snapshot);
}

export async function requirePermission(permission: Permission): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect("/forbidden");
  return user;
}

export async function requireRole(role: AppRole): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.role !== role) redirect("/forbidden");
  return user;
}
