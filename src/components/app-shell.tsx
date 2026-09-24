import Link from "next/link";
import Image from "next/image";

import { logoutAction } from "@/app/(dashboard)/actions";
import { AppIcon } from "@/components/app-icon";
import { ActiveNavigation, RouteTitle, type NavigationItem } from "@/components/app-navigation";
import { LiveClock } from "@/components/live-clock";
import { SidebarTeeth } from "@/components/sidebar-teeth";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import type { AuthenticatedUser } from "@/lib/auth/server";
import {
  doctorOnlyRoutePermissions,
  hasPermission,
} from "@/lib/permissions";

const operationalNavigation = [
  { href: "/dashboard", label: "Tableau de bord", icon: "dashboard", group: "cabinet" },
  { href: "/patients", label: "Patients", icon: "patients", group: "cabinet" },
  { href: "/appointments", label: "Rendez-vous", icon: "calendar", group: "cabinet" },
] as const;

const doctorNavigation = [
  {
    href: "/accounting",
    label: "Comptabilité",
    icon: "accounting",
    group: "gestion",
    permission: doctorOnlyRoutePermissions["/accounting"],
  },
  {
    href: "/security",
    label: "Supervision",
    icon: "security",
    group: "gestion",
    permission: doctorOnlyRoutePermissions["/security"],
  },
] as const;

function Navigation({ user }: { user: AuthenticatedUser }) {
  const items: NavigationItem[] = [
    ...operationalNavigation,
    ...doctorNavigation.filter((item) => hasPermission(user.role, item.permission)),
  ];
  return <ActiveNavigation items={items} />;
}

function UserSummary({ user }: { user: AuthenticatedUser }) {
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CD";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-[11px] font-bold text-[var(--navy)] ring-1 ring-[var(--gold-light)]/30">{initials}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{user.fullName}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{user.role === "doctor" ? "Docteur" : "Assistant(e)"}</p>
      </div>
    </div>
  );
}

// Live clock in clinic time; the whole card opens today's schedule.
function ClinicShortcut() {
  return (
    <Link aria-label="Heure du cabinet — ouvrir le planning du jour" href="/appointments" className="group relative my-4 block w-full shrink-0 overflow-hidden rounded-[14px] shadow-[0_8px_20px_rgba(32,104,177,0.12)] outline-none transition-shadow hover:shadow-[0_10px_24px_rgba(32,104,177,0.2)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2">
      <Image alt="" aria-hidden="true" className="object-cover" fill sizes="220px" src="/assets/vision-ui/help-abstract.jpeg" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(29,121,244,0.22),rgba(5,42,102,0.74))]" />
      <div className="relative z-10 p-3 text-white">
        <LiveClock />
        <p className="mt-2.5 flex items-center justify-between border-t border-white/15 pt-2 text-[11px] text-blue-50">
          <span>Heure de Casablanca</span>
          <span className="font-semibold text-white transition-transform duration-200 group-hover:translate-x-0.5">Planning →</span>
        </p>
      </div>
    </Link>
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
    <div className="vision-canvas min-h-screen p-2 sm:p-3 xl:p-4 print:p-0">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-[1900px] gap-3 md:grid md:grid-cols-[264px_minmax(0,1fr)] print:block">
      <aside className="vision-sidebar relative isolate hidden overflow-y-auto rounded-[22px] px-4 py-6 md:sticky md:top-3 md:flex md:h-[calc(100vh-1.5rem)] md:flex-col md:self-start print:!hidden">
        <SidebarTeeth />
        <Link className="flex items-center gap-3 px-2" href="/dashboard">
          <Image
            src="/images/ouahid-logo-navy.png"
            alt="Ouahid Dental Center"
            width={1774}
            height={887}
            sizes="216px"
            className="h-auto w-full"
            loading="eager"
          />
        </Link>
        <div className="mt-7 flex-1">
          <Navigation user={user} />
        </div>
        <ClinicShortcut />
        <div className="border-t border-white/80 pt-4">
          <UserSummary user={user} />
          <form action={logoutAction} className="mt-3">
            <PendingSubmitButton className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-[var(--navy)] disabled:opacity-60" pendingLabel="Déconnexion…">Se déconnecter</PendingSubmitButton>
          </form>
        </div>
      </aside>

      <div className="min-w-0 overflow-hidden rounded-[22px] bg-white/18">
        <header className="sticky top-0 z-20 bg-[rgba(239,248,255,0.78)] px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-7 print:hidden">
          <div className="flex min-h-12 items-center gap-5">
            <div className="min-w-44"><RouteTitle /></div>
            <form action="/patients" className="relative ml-auto hidden w-full max-w-xs md:block" method="get" role="search">
              <label className="sr-only" htmlFor="global-patient-search">Rechercher un patient</label>
              <AppIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" name="search" />
              <input className="w-full rounded-[15px] border border-white/90 bg-white/58 py-2.5 pr-4 pl-11 text-xs text-slate-900 shadow-[inset_0_1px_0_white,0_7px_20px_rgba(29,100,170,0.06)] outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-blue-300 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgb(147_197_253)] focus-visible:outline-none" id="global-patient-search" maxLength={80} name="query" placeholder="Rechercher..." />
            </form>
            <details className="group relative hidden sm:block">
              <summary aria-label="Créer" className="grid size-11 cursor-pointer list-none place-items-center rounded-[13px] bg-[var(--blue)] text-white shadow-[0_8px_18px_rgba(36,107,253,0.24)] transition-[transform,background-color] duration-200 hover:bg-[var(--blue-deep)] active:scale-95"><AppIcon name="plus" /></summary>
              <div className="absolute right-0 z-30 mt-3 w-52 rounded-xl border border-[var(--hairline)] bg-white p-2 shadow-[0_16px_36px_rgba(16,44,76,0.14)]">
                <Link className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--blue-soft)] hover:text-[var(--navy)]" href="/patients/new">Nouveau patient</Link>
                <Link className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--blue-soft)] hover:text-[var(--navy)]" href="/appointments">Nouveau rendez-vous</Link>
              </div>
            </details>
            <div className="hidden md:block">
              <UserSummary user={user} />
            </div>
            <details className="relative md:hidden">
              <summary aria-label="Ouvrir le menu principal" className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Menu
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[var(--border)] bg-white p-3 shadow-xl">
                <UserSummary user={user} />
                <form action="/patients" className="mt-3" method="get" role="search">
                  <label className="sr-only" htmlFor="mobile-patient-search">Rechercher un patient</label>
                  <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white" id="mobile-patient-search" maxLength={80} name="query" placeholder="Rechercher un patient..." />
                </form>
                <div className="my-3 border-t border-[var(--border)]" />
                <Navigation user={user} />
                <form action={logoutAction} className="mt-3 border-t border-[var(--border)] pt-3">
                  <PendingSubmitButton className="min-h-11 w-full px-3 py-2 text-left text-sm font-semibold disabled:opacity-60" pendingLabel="Déconnexion…">Se déconnecter</PendingSubmitButton>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="min-h-[calc(100vh-5rem)] px-4 pt-3 pb-7 sm:px-6 lg:px-7 lg:pb-8 print:p-0">{children}</main>
      </div>
      </div>
    </div>
  );
}
