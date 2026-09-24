"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVITY_COOKIE, IDLE_REASON } from "@/lib/auth/session-activity";

import { createClient } from "@/lib/supabase/server";

export async function logoutAction(formData?: FormData) {
  const supabase = await createClient();
  try {
    await supabase.rpc("record_logout");
  } catch {
    // Logout must still clear the local browser session if telemetry is unavailable.
  }
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVITY_COOKIE);
  redirect(formData?.get("reason") === IDLE_REASON ? `/login?raison=${IDLE_REASON}` : "/login");
}
