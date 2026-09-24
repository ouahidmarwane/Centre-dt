"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/app-icon";

export type NavigationItem = { href: string; label: string; icon: AppIconName; group: "cabinet" | "gestion" };

export function ActiveNavigation({ items }: { items: readonly NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="grid gap-1.5">
      {items.map((item, index) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <div key={item.href}>
            {(index === 0 || items[index - 1]?.group !== item.group) ? <p className={`${index === 0 ? "mb-2" : "mt-6 mb-2"} px-3 text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase`}>{item.group === "cabinet" ? "Cabinet" : "Gestion"}</p> : null}
            <Link
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-[15px] px-3 py-2.5 text-sm font-semibold transition-[color,background-color,transform,box-shadow] duration-200 active:scale-[0.99] ${active ? "bg-white/85 text-[var(--navy)] shadow-[0_10px_24px_rgba(35,105,176,0.1)]" : "text-slate-600 hover:bg-white/45 hover:text-[var(--navy)]"}`}
              href={item.href}
            >
              <span aria-hidden="true" className={`grid size-8 place-items-center rounded-[10px] transition-colors duration-200 ${active ? "bg-[var(--blue)] text-white shadow-[0_7px_16px_rgba(23,113,238,0.23)]" : "bg-white/60 text-slate-400 group-hover:bg-white group-hover:text-[var(--blue)]"}`}>
                <AppIcon className="size-[18px]" name={item.icon} />
              </span>
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function RouteTitle() {
  const pathname = usePathname();
  const title = pathname.startsWith("/patients") ? "Patients"
    : pathname.startsWith("/appointments") ? "Rendez-vous"
      : pathname.startsWith("/payments") ? "Recouvrement"
        : pathname.startsWith("/stock") ? "Stock"
          : pathname.startsWith("/statistics") ? "Statistiques"
      : pathname.startsWith("/accounting") ? "Comptabilité"
        : pathname.startsWith("/security") ? "Supervision"
          : "Dashboard";
  return <div><p className="text-[10px] font-medium text-slate-500"><span className="text-slate-400">Pages</span> / {title}</p><p className="mt-1 text-[15px] leading-none font-bold tracking-[-0.02em] text-[var(--navy)]">{title}</p></div>;
}
