"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/server";
import { normalizeIpAddress } from "@/lib/security/ip-address";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const durationMilliseconds = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;

function securityRedirect(notice: string): never {
  redirect(`/security?notice=${encodeURIComponent(notice)}`);
}

export async function createIpPolicyAction(formData: FormData): Promise<void> {
  await requirePermission("security.manage");
  if (formData.get("confirmation") !== "confirmed") securityRedirect("confirmation-required");

  const ipAddress = normalizeIpAddress(formData.get("ipAddress"));
  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
  const duration = formData.get("duration");

  if (
    !ipAddress ||
    reason.length < 3 ||
    reason.length > 500 ||
    typeof duration !== "string" ||
    !(duration in durationMilliseconds)
  ) {
    securityRedirect("invalid-block");
  }

  const expiresAt = new Date(
    Date.now() + durationMilliseconds[duration as keyof typeof durationMilliseconds],
  ).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ip_policy", {
    target_ip: ipAddress,
    target_reason: reason,
    target_expires_at: expiresAt,
  });

  if (error || !data) securityRedirect("policy-refused");
  securityRedirect("policy-added");
}

export async function disableIpPolicyAction(formData: FormData): Promise<void> {
  await requirePermission("security.manage");
  const blockId = formData.get("blockId");
  if (
    formData.get("confirmation") !== "confirmed" ||
    typeof blockId !== "string" ||
    !uuidPattern.test(blockId)
  ) {
    securityRedirect("confirmation-required");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("disable_ip_policy", {
    target_policy_id: blockId,
  });

  if (error || !data) securityRedirect("policy-disable-refused");
  securityRedirect("policy-disabled");
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  await requirePermission("security.manage");
  const userId = formData.get("userId");
  const nextState = formData.get("nextState");

  if (
    formData.get("confirmation") !== "confirmed" ||
    typeof userId !== "string" ||
    !uuidPattern.test(userId) ||
    (nextState !== "active" && nextState !== "inactive")
  ) {
    securityRedirect("confirmation-required");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_user_active", {
    target_user_id: userId,
    target_active: nextState === "active",
  });

  if (error || !data) securityRedirect("user-change-refused");
  securityRedirect(nextState === "active" ? "user-reactivated" : "user-deactivated");
}
