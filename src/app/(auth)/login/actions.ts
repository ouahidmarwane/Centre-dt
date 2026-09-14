"use server";

import { redirect } from "next/navigation";

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

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(fields.data);

    if (error || !data.user) {
      return { error: genericLoginError };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile?.is_active) {
      if (!profileError && profile?.is_active === false) {
        await supabase.rpc("record_inactive_account_denied");
      }
      await supabase.auth.signOut({ scope: "local" });
      return { error: genericLoginError };
    }

    await supabase.rpc("observe_current_session");
  } catch {
    return { error: genericLoginError };
  }

  redirect("/dashboard");
}
