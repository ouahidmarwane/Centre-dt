import type { AppRole } from "@/lib/permissions";

export type AssuranceLevel = "aal1" | "aal2";
export type MfaRouteTarget = "application" | "login" | "enroll" | "challenge";

export type RoutingIdentity =
  | { status: "anonymous" }
  | { status: "denied" }
  | {
      status: "active";
      role: AppRole;
      aal: AssuranceLevel;
      verifiedTotpCount: number;
    };

export type RouteDecision =
  | { action: "allow" }
  | { action: "redirect"; destination: "/login" | "/forbidden" | "/dashboard" | "/mfa/enroll" | "/mfa/challenge" }
  | { action: "recovery" };

export function validateTotpCode(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

export function verifiedTotpCountFromResult(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const response = result as { error?: unknown; data?: { totp?: unknown } | null };
  if (response.error || !Array.isArray(response.data?.totp)) return null;
  // The supported SDK's totp array contains verified TOTP factors only.
  if (!response.data.totp.every((factor: unknown) =>
    factor !== null && typeof factor === "object" &&
    (factor as { factor_type?: unknown }).factor_type === "totp" &&
    (factor as { status?: unknown }).status === "verified",
  )) return null;
  return response.data.totp.length;
}

export function decideMfaRoute(identity: RoutingIdentity, target: MfaRouteTarget): RouteDecision {
  if (identity.status === "anonymous") {
    return target === "login" ? { action: "allow" } : { action: "redirect", destination: "/login" };
  }
  if (identity.status === "denied") {
    return { action: "redirect", destination: "/forbidden" };
  }

  // Every clinic role (doctor and assistant) needs exactly one verified TOTP factor and AAL2.
  if (!Number.isSafeInteger(identity.verifiedTotpCount) || identity.verifiedTotpCount < 0) {
    return { action: "redirect", destination: "/forbidden" };
  }

  if (identity.aal === "aal2") {
    if (identity.verifiedTotpCount !== 1) {
      return { action: "redirect", destination: "/forbidden" };
    }
    return target === "application"
      ? { action: "allow" }
      : { action: "redirect", destination: "/dashboard" };
  }

  if (identity.verifiedTotpCount > 1) {
    return target === "challenge" ? { action: "recovery" } : { action: "redirect", destination: "/mfa/challenge" };
  }

  const destination = identity.verifiedTotpCount === 0 ? "/mfa/enroll" : "/mfa/challenge";
  const expectedTarget = identity.verifiedTotpCount === 0 ? "enroll" : "challenge";
  return target === expectedTarget
    ? { action: "allow" }
    : { action: "redirect", destination };
}
