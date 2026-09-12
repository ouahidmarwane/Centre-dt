import Link from "next/link";

import { logoutAction } from "@/app/(dashboard)/actions";
import type { AuthenticatedUser } from "@/lib/auth/server";
import {
  doctorOnlyRoutePermissions,
  hasPermission,
} from "@/lib/permissions";

const operationalNavigation = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/patients", label: "Patients" },
  { href: "/appointments", label: "Rendez-vous" },
] as const;

const doctorNavigation = [
  {
    href: "/accounting",
    label: "Comptabilité",
    permission: doctorOnlyRoutePermissions["/accounting"],
  },
  {
    href: "/security",
    label: "Supervision",
    permission: doctorOnlyRoutePermissions["/security"],
  },
] as const;

function Navigation({ user }: { user: AuthenticatedUser }) {
  return (
    <nav aria-label="Navigation principale" className="grid gap-1">
      {operationalNavigation.map((item) => (
        <Link
          className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
      {doctorNavigation
        .filter((item) => hasPermission(user.role, item.permission))
        .map((item) => (
          <Link
            className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
    </nav>
  );
}

function UserSummary({ user }: { user: AuthenticatedUser }) {
  return (
    <div>
      <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {user.role === "doctor" ? "Docteur" : "Assistant(e)"}
      </p>
    </div>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthenticatedUser;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="hidden border-r border-[var(--border)] bg-white px-4 py-5 md:flex md:flex-col print:!hidden">
        <Link className="flex items-center gap-3 px-2" href="/dashboard">
          <span className="grid size-10 place-items-center rounded-lg bg-[var(--brand)] font-bold text-white">
            O
          </span>
          <span className="text-sm leading-5 font-semibold">Centre Dentaire Ouahid</span>
        </Link>
        <div className="mt-9 flex-1">
          <Navigation user={user} />
        </div>
        <div className="border-t border-[var(--border)] pt-4">
          <UserSummary user={user} />
          <form action={logoutAction} className="mt-3">
            <button
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="submit"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 print:hidden">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Espace clinique</p>
              <p className="hidden text-xs text-[var(--muted)] sm:block">
                Centre Dentaire Ouahid
              </p>
            </div>
            <div className="hidden md:block">
              <UserSummary user={user} />
            </div>
            <details className="relative md:hidden">
              <summary className="cursor-pointer list-none rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Menu
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[var(--border)] bg-white p-3 shadow-xl">
                <UserSummary user={user} />
                <div className="my-3 border-t border-[var(--border)]" />
                <Navigation user={user} />
                <form action={logoutAction} className="mt-3 border-t border-[var(--border)] pt-3">
                  <button
                    className="w-full px-3 py-2 text-left text-sm font-semibold"
                    type="submit"
                  >
                    Se déconnecter
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
