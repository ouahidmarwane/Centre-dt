import { MainDashboardView } from "@/components/dashboard/main-dashboard";
import { getAccountingDashboard } from "@/lib/accounting/data";
import { requireUser } from "@/lib/auth/server";
import { getMainDashboard } from "@/lib/dashboard/data";
import { resolveDashboardPeriod } from "@/lib/dashboard/period";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const selectedPeriod = resolveDashboardPeriod(query.period);
  const operationalPromise = getMainDashboard();

  if (user.role === "doctor") {
    const sixMonths = resolveDashboardPeriod("six_months");
    const [operational, financial, sixMonthFinancial] = await Promise.all([
      operationalPromise,
      getAccountingDashboard(selectedPeriod.startDate, selectedPeriod.endDate, selectedPeriod.bucket),
      selectedPeriod.key === "six_months"
        ? getAccountingDashboard(selectedPeriod.startDate, selectedPeriod.endDate, selectedPeriod.bucket)
        : getAccountingDashboard(sixMonths.startDate, sixMonths.endDate, sixMonths.bucket),
    ]);
    return <MainDashboardView financial={financial} operational={operational} period={selectedPeriod.key} sixMonthFinancial={sixMonthFinancial} user={user} />;
  }

  return <MainDashboardView operational={await operationalPromise} period={selectedPeriod.key} user={user} />;
}
