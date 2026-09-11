import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/server";

export default async function Home() {
  const authState = await getAuthState();

  redirect(authState.status === "authenticated" ? "/dashboard" : "/login");
}
