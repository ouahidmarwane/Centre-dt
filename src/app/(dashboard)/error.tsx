"use client";

export default function DashboardAreaError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
      <p className="text-xs font-bold tracking-[0.13em] text-red-700 uppercase">Page momentanément indisponible</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Les informations n’ont pas pu être chargées.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Aucune donnée n’a été modifiée. Vous pouvez réessayer en toute sécurité.</p>
      <button className="mt-6 min-h-11 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-strong)]" onClick={reset} type="button">Réessayer</button>
    </section>
  );
}
