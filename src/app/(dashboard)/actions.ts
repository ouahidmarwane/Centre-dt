"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createClient();
  try {
    await supabase.rpc("record_logout");
  } catch {
    // Logout must still clear the local browser session if telemetry is unavailable.
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
