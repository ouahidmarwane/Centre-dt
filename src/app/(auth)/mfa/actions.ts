"use server";

import { redirect } from "next/navigation";

import { requireMfaPage } from "@/lib/auth/server";
import { validateTotpCode } from "@/lib/auth/mfa-policy";
import { safeQrDataUrl } from "@/lib/auth/mfa-qr";
import { createClient } from "@/lib/supabase/server";

const genericMfaError = "Vérification impossible. Vérifiez le code et réessayez.";
const genericEnrollmentError = "Configuration impossible. Réessayez en toute sécurité.";

export type EnrollmentState =
  | { status: "idle"; error: null }
  | { status: "error"; error: string }
  | {
      status: "ready";
      error: null;
      enrollment: { factorId: string; qrDataUrl: string; secret: string };
    };

export type VerificationState = { error: string | null };

async function confirmedAal2() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

export async function beginTotpEnrollmentAction(
  _previousState: EnrollmentState,
): Promise<EnrollmentState> {
  void _previousState;
  await requireMfaPage("enroll");
  const supabase = await createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors || factors.totp.length !== 0) {
    return { status: "error", error: genericEnrollmentError };
  }

  const staleFactors = factors.all.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified",
  );
  for (const factor of staleFactors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { status: "error", error: genericEnrollmentError };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Centre Dentaire Ouahid",
    friendlyName: "Cabinet - authentificateur principal",
  });
  const qrDataUrl = data ? safeQrDataUrl(data.totp.qr_code) : null;
  if (error || !data || !qrDataUrl || !data.totp.secret) {
    if (data?.id) await supabase.auth.mfa.unenroll({ factorId: data.id });
    return { status: "error", error: genericEnrollmentError };
  }

  return {
    status: "ready",
    error: null,
    enrollment: { factorId: data.id, qrDataUrl, secret: data.totp.secret },
  };
}

export async function verifyEnrollmentAction(
  factorId: string,
  _previousState: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  await requireMfaPage("enroll");
  const code = validateTotpCode(formData.get("code"));
  if (!code) return { error: genericMfaError };

  const supabase = await createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  const ownedUnverified = factors?.all.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified" && factor.id === factorId,
  );
  if (factorsError || !factors || factors.totp.length !== 0 || ownedUnverified?.length !== 1) {
    return { error: genericMfaError };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error || !(await confirmedAal2())) return { error: genericMfaError };
  redirect("/dashboard");
}

export async function verifyChallengeAction(
  _previousState: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const route = await requireMfaPage("challenge");
  if (route.recoveryRequired || route.verifiedTotpCount !== 1) return { error: genericMfaError };
  const code = validateTotpCode(formData.get("code"));
  if (!code) return { error: genericMfaError };

  const supabase = await createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors || factors.totp.length !== 1) return { error: genericMfaError };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factors.totp[0].id, code });
  if (error || !(await confirmedAal2())) return { error: genericMfaError };
  redirect("/dashboard");
}
