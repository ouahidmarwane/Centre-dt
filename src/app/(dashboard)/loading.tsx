export default function DashboardAreaLoading() {
  return (
    <section aria-busy="true" aria-label="Chargement de la page" className="space-y-5">
      <span className="sr-only">Chargement en cours…</span>
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200/80" />
      <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-[20px] bg-white/75" />
        <div className="h-48 animate-pulse rounded-[20px] bg-white/75" />
      </div>
    </section>
  );
}
