import type { ReactNode } from "react";

export function BentoCard({ children, className = "", eyebrow, title }: { children: ReactNode; className?: string; eyebrow?: string; title: string }) {
  return (
    <section className={`clinic-bento ${className}`}>
      <div className="relative z-10">
        {eyebrow ? <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--brand)] uppercase">{eyebrow}</p> : null}
        <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-[var(--navy)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gold" | "green" | "neutral" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    gold: "bg-amber-50 text-amber-800 ring-amber-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-2xl bg-white/72 px-3.5 py-3 ring-1 ring-inset ring-slate-200/75"><dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{value}</dd></div>;
}
