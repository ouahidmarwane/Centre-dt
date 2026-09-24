"use client";

import { useRouter } from "next/navigation";

// Native date picker that opens the chosen day straight away.
export function DateJump({ date }: { date: string }) {
  const router = useRouter();
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-[#d6e3f0] bg-white px-3 text-sm font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--blue)]">
      <svg aria-hidden="true" className="size-4 text-slate-500" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="16" rx="2.5" width="18" x="3" y="5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      <span>Choisir une date</span>
      <input
        aria-label="Choisir une date"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => { if (event.target.value) router.push(`/appointments?date=${event.target.value}`); }}
        type="date"
        value={date}
      />
    </label>
  );
}
