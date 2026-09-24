"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVITY_COOKIE, activityCookieOptions, encodeActivity } from "@/lib/auth/session-activity";

import { getLoginDestination } from "@/lib/auth/server";
import { validateLoginFields } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

const genericLoginError =
  "Connexion impossible. Vérifiez vos informations et réessayez.";

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const fields = validateLoginFields(
    formData.get("email"),
    formData.get("password"),
  );

  if (!fields.success) {
    return { error: genericLoginError };
  }

  let destination: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(fields.data);

    if (error || !data.user) {
      return { error: genericLoginError };
    }

    await supabase.rpc("observe_current_session");
    // Starts the inactivity window checked by the proxy on every request.
    (await cookies()).set(ACTIVITY_COOKIE, encodeActivity(new Date()), activityCookieOptions(process.env.NODE_ENV === "production"));
    destination = await getLoginDestination();
    if (!destination || destination === "/login") {
      await supabase.auth.signOut({ scope: "local" });
      return { error: genericLoginError };
    }
  } catch {
    return { error: genericLoginError };
  }

  redirect(destination);
}
