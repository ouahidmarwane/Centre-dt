export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement du tableau de bord" className="mx-auto max-w-[1500px] animate-pulse space-y-6">
      <div className="space-y-3"><div className="h-4 w-48 rounded bg-slate-200" /><div className="h-9 w-72 rounded bg-slate-200" /><div className="h-4 w-96 max-w-full rounded bg-slate-200" /></div>
      <div className="grid gap-5 xl:grid-cols-12"><div className="h-[440px] rounded-2xl bg-white xl:col-span-8" /><div className="h-[440px] rounded-2xl bg-white xl:col-span-4" /></div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className="h-60 rounded-2xl bg-white" key={index} />)}</div>
    </div>
  );
}
