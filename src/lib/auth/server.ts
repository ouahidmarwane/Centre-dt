import "server-only";

import { redirect } from "next/navigation";

import { hasPermission, isAppRole, type AppRole, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
};

type AuthState =
  | { status: "anonymous" }
  | { status: "inactive" }
  | { status: "authenticated"; user: AuthenticatedUser };

type ProfileRecord = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

function isProfileRecord(value: unknown): value is ProfileRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === "string" &&
    typeof profile.full_name === "string" &&
    typeof profile.role === "string" &&
    typeof profile.is_active === "boolean"
  );
}

export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    return { status: "anonymous" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (
    profileError ||
    !isProfileRecord(profile) ||
    !profile.is_active ||
    !isAppRole(profile.role)
  ) {
    return { status: "inactive" };
  }

  return {
    status: "authenticated",
    user: {
      id: profile.id,
      email: typeof claims.email === "string" ? claims.email : null,
      fullName: profile.full_name,
      role: profile.role,
    },
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const authState = await getAuthState();

  if (authState.status === "anonymous") {
    redirect("/login");
  }

  if (authState.status === "inactive") {
    redirect("/forbidden");
  }

  return authState.user;
}

export async function requirePermission(
  permission: Permission,
): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (!hasPermission(user.role, permission)) {
    redirect("/forbidden");
  }

  return user;
}

export async function requireRole(role: AppRole): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (user.role !== role) {
    redirect("/forbidden");
  }

  return user;
}
