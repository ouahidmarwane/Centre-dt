import Link from "next/link";

import type { AccountingDashboard as DashboardData } from "@/lib/accounting/data";
import {
  inclusiveEndDate,
  type AccountingPeriod,
  type AccountingPreset,
} from "@/lib/accounting/periods";

const presetLabels: Record<Exclude<AccountingPreset, "custom">, string> = {
  current_week: "Cette semaine",
  current_month: "Ce mois",
  current_year: "Cette année",
  previous_week: "Semaine précédente",
  previous_month: "Mois précédent",
  previous_year: "Année précédente",
};

const methodLabels = {
  cash: "Espèces",
  card: "Carte",
  bank_transfer: "Virement",
  cheque: "Chèque",
  other: "Autre",
} as const;

const money = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Africa/Casablanca",
});

const month = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "Africa/Casablanca",
});

function displayDate(value: string, monthly = false) {
  const safeMidday = new Date(`${value}T12:00:00Z`);
  return (monthly ? month : date).format(safeMidday);
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function AccountingDashboard({
  data,
  period,
}: {
  data: DashboardData;
  period: AccountingPeriod;
}) {
  const scale = Math.max(0, ...data.series.flatMap((point) => [point.production, point.received]));
  const methodScale = Math.max(0, ...data.payment_methods.map((entry) => entry.amount));
  const presets = Object.entries(presetLabels) as [Exclude<AccountingPreset, "custom">, string][];

  return (
    <>
      <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6" aria-labelledby="accounting-period-title">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950" id="accounting-period-title">Période analysée</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Du {displayDate(period.startDate)} au {displayDate(inclusiveEndDate(period))}, dates incluses — heure du cabinet.
            </p>
            {period.usedFallback ? <p className="mt-2 text-sm font-medium text-amber-700">Filtre invalide remplacé par le mois courant.</p> : null}
          </div>
          <nav aria-label="Périodes comptables" className="flex max-w-4xl flex-wrap gap-2">
            {presets.map(([preset, label]) => (
              <Link
                aria-current={period.preset === preset ? "page" : undefined}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${period.preset === preset ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)] text-slate-700 hover:bg-slate-50"}`}
                href={`/accounting?period=${preset}`}
                key={preset}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <form action="/accounting" className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" method="get">
          <input name="period" type="hidden" value="custom" />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Du
            <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2" defaultValue={period.preset === "custom" ? period.startDate : ""} max="9999-12-31" min="2020-01-01" name="from" required type="date" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Au
            <input className="rounded-md border border-[var(--border)] bg-white px-3 py-2" defaultValue={period.preset === "custom" ? inclusiveEndDate(period) : ""} max="9999-12-31" min="2020-01-01" name="to" required type="date" />
          </label>
          <button className="rounded-md bg-[var(--brand-strong)] px-4 py-2 font-semibold text-white hover:bg-[var(--brand)]" type="submit">Appliquer</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Plage personnalisée maximale: cinq ans. Les bornes utilisent l’intervalle technique [début, fin).</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs financiers">
        <Kpi label="Production de la période" value={money.format(data.production)} detail="Interventions au statut réalisé uniquement." />
        <Kpi label="Encaissements de la période" value={money.format(data.received)} detail="Paiements actuellement reçus, hors extournes." />
        <Kpi label="Net de la période" value={money.format(data.period_net)} detail="Production moins encaissements sur la période; ce n’est pas la dette globale." />
        <Kpi label="Encours total actuel" value={money.format(data.current_outstanding)} detail="Toutes périodes: production réalisée moins paiements reçus." />
        <Kpi label="Patients actifs sur la période" value={String(data.active_patient_count)} detail="Patients distincts avec une intervention réalisée ou un paiement reçu." />
        <Kpi label="Interventions réalisées" value={String(data.intervention_count)} detail="Nombre d’interventions contribuant à la production." />
        <Kpi label="Paiements reçus" value={String(data.payment_count)} detail="Nombre de paiements contribuant aux encaissements." />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6" aria-labelledby="accounting-trend-title">
          <h2 className="font-semibold text-slate-950" id="accounting-trend-title">Production et encaissements</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Flux par {period.bucket === "day" ? "jour" : "mois"}; les barres ne représentent pas l’encours cumulé.</p>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[620px] space-y-3">
              {data.series.map((point) => (
                <div className="grid grid-cols-[100px_minmax(0,1fr)_110px] items-center gap-3 text-sm" key={point.bucket_start}>
                  <span className="text-slate-600">{displayDate(point.bucket_start, period.bucket === "month")}</span>
                  <div className="grid gap-1" aria-hidden="true">
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[var(--brand)]" style={{ width: `${scale ? Math.max(0, point.production / scale) * 100 : 0}%` }} /></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${scale ? Math.max(0, point.received / scale) * 100 : 0}%` }} /></div>
                  </div>
                  <span className="text-right text-xs leading-5 text-slate-600"><strong className="text-[var(--brand-strong)]">{money.format(point.production)}</strong><br />{money.format(point.received)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-xs font-medium text-slate-600"><span><i className="mr-2 inline-block size-2 rounded-full bg-[var(--brand)]" />Production</span><span><i className="mr-2 inline-block size-2 rounded-full bg-sky-500" />Encaissements</span></div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6" aria-labelledby="payment-methods-title">
          <h2 className="font-semibold text-slate-950" id="payment-methods-title">Modes de paiement</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Répartition des paiements reçus sur la période.</p>
          <div className="mt-5 space-y-4">
            {data.payment_methods.map((entry) => (
              <div key={entry.method}>
                <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{methodLabels[entry.method]}</span><span className="text-right"><strong>{money.format(entry.amount)}</strong><span className="ml-2 text-xs text-slate-500">({entry.payment_count})</span></span></div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${methodScale ? Math.max(0, entry.amount / methodScale) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <p><strong className="text-slate-800">Lecture des chiffres.</strong> Les factures et reçus sont des documents historiques et ne calculent aucun total. Les paiements extournés sont exclus selon leur état actuel; ce tableau ne reconstitue pas un journal historique des flux d’extourne.</p>
      </section>
    </>
  );
}
