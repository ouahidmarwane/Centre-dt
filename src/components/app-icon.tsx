export type AppIconName = "dashboard" | "patients" | "calendar" | "accounting" | "security" | "plus" | "search";

export function AppIcon({ name, className = "size-5" }: { name: AppIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" {...common}>
      {name === "dashboard" ? <><rect height="7" rx="1.5" width="7" x="3" y="3" /><rect height="11" rx="1.5" width="7" x="14" y="3" /><rect height="7" rx="1.5" width="7" x="14" y="17" /><rect height="11" rx="1.5" width="7" x="3" y="13" /></> : null}
      {name === "patients" ? <><path d="M16 20v-1.6a4.4 4.4 0 0 0-4.4-4.4H7.4A4.4 4.4 0 0 0 3 18.4V20" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.7a4.3 4.3 0 0 0-3.2-4.1" /></> : null}
      {name === "calendar" ? <><rect height="17" rx="2" width="18" x="3" y="4" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></> : null}
      {name === "accounting" ? <><path d="M3 7.5h16.5a1.5 1.5 0 0 1 1.5 1.5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M16 13h5M17.5 13h.01" /></> : null}
      {name === "security" ? <><path d="M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></> : null}
      {name === "plus" ? <path d="M12 5v14M5 12h14" /> : null}
      {name === "search" ? <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></> : null}
    </svg>
  );
}
