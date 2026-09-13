import { AccountingDashboard } from "@/components/accounting/accounting-dashboard";
import { PageHeader } from "@/components/page-header";
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
    <>
      <PageHeader
        description="Vue agrégée doctor-only de la production, des encaissements et de l’encours du cabinet."
        eyebrow="Accès docteur"
        title="Pilotage financier"
      />
      <AccountingDashboard data={dashboard} period={period} />
    </>
  );
}
