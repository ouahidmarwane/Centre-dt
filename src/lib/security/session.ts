import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function observeCurrentSession(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("observe_current_session");
  } catch {
    // Session observation is telemetry and cannot grant application access.
  }
}
