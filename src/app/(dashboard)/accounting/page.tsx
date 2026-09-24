import { AccountingDashboard } from "@/components/accounting/accounting-dashboard";
import { getAccountingDashboard } from "@/lib/accounting/data";
import { resolveAccountingPeriod } from "@/lib/accounting/periods";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountingPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("accounting.read");
  const period = resolveAccountingPeriod(await searchParams);
  const dashboard = await getAccountingDashboard(period.startDate, period.endDate, period.bucket);

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]" />Réservé au docteur</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-[2.4rem]">Comptabilité</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Ce que le cabinet a réalisé, ce qu’il a encaissé et ce qui reste à recevoir.</p>
      </header>
      <AccountingDashboard data={dashboard} period={period} />
    </div>
  );
}
