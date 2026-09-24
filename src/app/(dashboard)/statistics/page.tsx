import type { Metadata } from "next";
import Link from "next/link";

import { CareTypeBars, MonthlyColumns, type ColumnPoint } from "@/components/statistics/statistics-charts";
import { panelClass } from "@/components/ui/panel-ui";
import { clinicDateValue } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { formatDashboardMoney } from "@/lib/dashboard/presentation";
import { getMonthlyStatistics } from "@/lib/statistics/data";
import { groupByCareType, monthLabel, noShowRate, parseStatisticsMonth, relativeChange, shiftMonth, type MonthFigures } from "@/lib/statistics/presentation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Statistiques" };

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const signedPercent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const empty: MonthFigures = { month: "", production: 0, received: 0, newPatients: 0, completed: 0, noShow: 0, cancelled: 0, scheduled: 0 };

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("statistics.read");
  const currentMonth = clinicDateValue(new Date()).slice(0, 7);
  const month = parseStatisticsMonth((await searchParams).month, currentMonth);
  const { months, natures } = await getMonthlyStatistics(month);
  const current = months.find((item) => item.month === month) ?? { ...empty, month };
  const previous = months.find((item) => item.month === shiftMonth(month, -1)) ?? { ...empty, month: shiftMonth(month, -1) };
  const careTypes = groupByCareType(natures);
  const rate = noShowRate(current), previousRate = noShowRate(previous);
  const points = (value: (item: MonthFigures) => number | null): ColumnPoint[] => months.map((item) => ({ key: item.month, label: monthLabel(item.month, "short").replace(".", "").slice(0, 4), longLabel: monthLabel(item.month), value: value(item) }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]" />Statistiques mensuelles</p>
          <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] first-letter:uppercase sm:text-[2.4rem]">{monthLabel(month)}</h1>
          <p className="mt-1 text-sm text-slate-500">Comparé à {monthLabel(previous.month)}. Heures et dates du cabinet (Casablanca).</p>
        </div>
        <nav aria-label="Changer de mois" className="flex items-center gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-[12px] border border-[#d6e3f0] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:border-[var(--blue)]" href={`/statistics?month=${shiftMonth(month, -1)}`}>‹ Mois précédent</Link>
          {month < currentMonth ? <Link className="inline-flex min-h-11 items-center rounded-[12px] border border-[#d6e3f0] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:border-[var(--blue)]" href={`/statistics?month=${shiftMonth(month, 1)}`}>Mois suivant ›</Link> : null}
          {month !== currentMonth ? <Link className="inline-flex min-h-11 items-center rounded-[12px] bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" href="/statistics">Ce mois-ci</Link> : null}
        </nav>
      </header>

      <dl className="kpi-rise mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi change={relativeChange(current.production, previous.production)} label="Chiffre d’affaires (soins réalisés)" value={formatDashboardMoney(current.production)} />
        <Kpi change={relativeChange(current.received, previous.received)} label="Encaissements" value={formatDashboardMoney(current.received)} />
        <Kpi change={relativeChange(current.newPatients, previous.newPatients)} label="Nouveaux patients" value={String(current.newPatients)} />
        <Kpi detail={`${current.noShow} absent${current.noShow > 1 ? "s" : ""} sur ${current.completed + current.noShow} rendez-vous passés · ${current.cancelled} annulé${current.cancelled > 1 ? "s" : ""}`} goodWhenDown label="Rendez-vous manqués" pointChange={rate !== null && previousRate !== null ? rate - previousRate : null} value={rate === null ? "—" : percent.format(rate)} />
      </dl>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="care-types-title" className={`kpi-rise ${panelClass} p-5 sm:p-6`}>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="care-types-title">Chiffre d’affaires par type de soin</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-500">Soins réalisés en {monthLabel(month)}, regroupés d’après leur intitulé.</p>
          <CareTypeBars items={careTypes} />
        </section>

        <section aria-labelledby="trend-title" className={`kpi-rise ${panelClass} p-5 sm:p-6`}>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="trend-title">Évolution sur 12 mois</h2>
          <p className="mt-0.5 text-xs text-slate-500">Survolez ou parcourez au clavier une colonne pour lire sa valeur.</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <MonthlyColumns highlightKey={month} points={points((item) => item.production)} title="Chiffre d’affaires" unit="money" />
            <MonthlyColumns highlightKey={month} points={points((item) => item.newPatients)} title="Nouveaux patients" unit="count" />
            <MonthlyColumns highlightKey={month} points={points((item) => noShowRate(item))} title="Taux de rendez-vous manqués" unit="percent" />
            <MonthlyColumns highlightKey={month} points={points((item) => item.received)} title="Encaissements" unit="money" />
          </div>
          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--blue-deep)] hover:underline">Voir les chiffres en tableau</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-1.5 pr-2" scope="col">Mois</th><th className="py-1.5 pr-2 text-right" scope="col">Chiffre d’affaires</th><th className="py-1.5 pr-2 text-right" scope="col">Encaissements</th><th className="py-1.5 pr-2 text-right" scope="col">Nouveaux patients</th><th className="py-1.5 pr-2 text-right" scope="col">Venus</th><th className="py-1.5 pr-2 text-right" scope="col">Absents</th><th className="py-1.5 text-right" scope="col">Taux d’absence</th></tr></thead>
                <tbody className="divide-y divide-[#eef3f8]">
                  {[...months].reverse().map((item) => {
                    const itemRate = noShowRate(item);
                    return <tr key={item.month}><th className="py-1.5 pr-2 font-medium text-[var(--navy)] first-letter:uppercase" scope="row">{monthLabel(item.month)}</th><td className="metric-number py-1.5 pr-2 text-right">{formatDashboardMoney(item.production)}</td><td className="metric-number py-1.5 pr-2 text-right">{formatDashboardMoney(item.received)}</td><td className="py-1.5 pr-2 text-right">{item.newPatients}</td><td className="py-1.5 pr-2 text-right">{item.completed}</td><td className="py-1.5 pr-2 text-right">{item.noShow}</td><td className="py-1.5 text-right">{itemRate === null ? "—" : percent.format(itemRate)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, change = null, pointChange = null, goodWhenDown = false, detail }: { label: string; value: string; change?: number | null; pointChange?: number | null; goodWhenDown?: boolean; detail?: string }) {
  const delta = pointChange ?? change;
  const good = delta === null || delta === 0 ? null : goodWhenDown ? delta < 0 : delta > 0;
  const text = pointChange !== null ? `${pointChange > 0 ? "+" : pointChange < 0 ? "−" : ""}${Math.abs(Math.round(pointChange * 1000) / 10).toLocaleString("fr-FR")} pt` : change !== null ? signedPercent.format(change) : null;
  return (
    <div className={`${panelClass} px-5 py-4`}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="metric-number mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--navy)]">{value}</dd>
      <dd className="mt-1 text-xs text-slate-500">
        {text ? <span className={`mr-1.5 font-semibold ${good === null ? "text-slate-500" : good ? "text-[#0e7c6d]" : "text-[#b4541a]"}`}>{delta === null || delta === 0 ? "" : delta > 0 ? "▲ " : "▼ "}{text}</span> : null}
        {detail ?? (text ? "par rapport au mois précédent" : "Pas de donnée le mois précédent")}
      </dd>
    </div>
  );
}
