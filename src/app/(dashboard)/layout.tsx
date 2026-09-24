import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { LoginWelcome } from "@/components/auth/login-welcome";
import { requireUser } from "@/lib/auth/server";
import { observeCurrentSession } from "@/lib/security/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await observeCurrentSession();

  return (
    <>
      <AppShell user={user}>{children}</AppShell>
      <Suspense fallback={null}><LoginWelcome role={user.role} /></Suspense>
    </>
  );
}
