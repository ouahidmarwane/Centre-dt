// Shared visual pieces for the billing area of the patient file (interventions, payments,
// invoices, receipts, prescriptions). Presentation only: no data or actions live here.

export const panelClass = "rounded-[20px] border border-[#dbe6f1] bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)]";
export const fieldClass = "mt-1.5 min-h-11 w-full rounded-[12px] border border-[#d7e2ee] bg-white px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:shadow-[0_0_0_4px_rgba(22,119,242,0.12)] focus-visible:outline-none";
export const chipClass = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#dbe6f1] bg-white px-3 text-xs font-semibold text-slate-600 transition-all hover:border-[#bfd3e8] hover:text-[var(--navy)] active:scale-[0.97] has-[:checked]:border-[var(--navy)] has-[:checked]:bg-[var(--navy)] has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--blue)]";
export const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(22,119,242,0.7)] transition-all hover:-translate-y-px hover:bg-[var(--brand-strong)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50";
export const ghostButton = "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#d6e3f0] bg-white px-3 text-xs font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] hover:text-[var(--blue-deep)] active:scale-[0.98]";
export const dangerLink = "inline-flex min-h-9 items-center rounded-[10px] px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60";

export type Tone = "green" | "amber" | "blue" | "slate" | "red";
const tones: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: "bg-[#e9f8f4] text-[#0e7c6d]", dot: "bg-[#19a996]" },
  amber: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  blue: { pill: "bg-[#eef6ff] text-[#0f5fc5]", dot: "bg-[var(--blue)]" },
  slate: { pill: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  red: { pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tones[tone].pill}`}><span className={`size-1.5 rounded-full ${tones[tone].dot}`} />{children}</span>;
}

export function PanelHeading({ id, title, subtitle, action }: { id?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id={id}>{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

// A "+ Action" button that unfolds its form in place.
export function Composer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/composer mt-4 rounded-[16px] border border-dashed border-[#cddcec] bg-[#f8fbfe] open:border-solid open:bg-white open:shadow-[0_10px_30px_-22px_rgba(16,44,76,0.45)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 text-sm font-semibold text-[var(--blue-deep)] transition-colors hover:text-[var(--brand-strong)]">
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-[8px] bg-[#e3f0ff] text-base leading-none transition-transform duration-300 group-open/composer:rotate-45">+</span>
        {label}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

// Folded destructive action: the reason field only shows once asked for.
export function DangerDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/danger">
      <summary className={`${dangerLink} cursor-pointer list-none`}>{label}</summary>
      <div className="mt-2 rounded-[12px] border border-red-100 bg-red-50/40 p-3">{children}</div>
    </details>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-[14px] border border-dashed border-[#d3e1ef] bg-white/60 px-4 py-5 text-center text-sm text-slate-500">{text}</p>;
}

export function FormMessage({ state }: { state: { success: boolean; message: string | null } }) {
  return state.message ? <p aria-live="polite" className={`mt-3 rounded-[10px] px-3 py-2 text-sm ${state.success ? "bg-[#e9f8f4] text-[#0e7c6d]" : "bg-red-50 text-red-700"}`} role={state.success ? "status" : "alert"}>{state.success ? "✓ " : ""}{state.message}</p> : null;
}

export function ReadOnlyNote({ text }: { text: string }) {
  return <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{text}</p>;
}
