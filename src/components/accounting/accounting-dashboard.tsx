import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import Link from "next/link";

import { SpotlightSurface, type SpotlightTexture } from "@/components/dashboard/spotlight-surface";
import { panelClass } from "@/components/ui/panel-ui";
import type { AccountingDashboard as DashboardData } from "@/lib/accounting/data";
import {
  inclusiveEndDate,
  type AccountingPeriod,
  type AccountingPreset,
} from "@/lib/accounting/periods";

import { CollectionGauge, CountUp, FlowChart, PRODUCTION_COLOR, RECEIVED_COLOR, type FlowPoint } from "./accounting-charts";
import styles from "./accounting.module.css";

const presetLabels: Record<Exclude<AccountingPreset, "custom">, string> = {
  current_week: "Cette semaine",
  current_month: "Ce mois",
  current_year: "Cette année",
  previous_week: "Semaine précédente",
  previous_month: "Mois précédent",
  previous_year: "Année précédente",
};

// Lower-case wording used inside the summary sentence.
const presetPhrases: Record<Exclude<AccountingPreset, "custom">, string> = {
  current_week: "Cette semaine",
  current_month: "Ce mois-ci",
  current_year: "Cette année",
  previous_week: "La semaine dernière",
  previous_month: "Le mois dernier",
  previous_year: "L’année dernière",
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

const date = new ClinicDateTimeFormat("fr-FR", { dateStyle: "medium" });
const month = new ClinicDateTimeFormat("fr-FR", { month: "short", year: "numeric" });
const shortMonth = new ClinicDateTimeFormat("fr-FR", { month: "short" });
const dayNumber = new ClinicDateTimeFormat("fr-FR", { day: "numeric" });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function displayDate(value: string, monthly = false) {
  const safeMidday = new Date(`${value}T12:00:00Z`);
  return (monthly ? month : date).format(safeMidday);
}

export function AccountingDashboard({
  data,
  period,
}: {
  data: DashboardData;
  period: AccountingPeriod;
}) {
  const presets = Object.entries(presetLabels) as [Exclude<AccountingPreset, "custom">, string][];
  const monthly = period.bucket === "month";
  const rangeLabel = `du ${displayDate(period.startDate)} au ${displayDate(inclusiveEndDate(period))}`;
  const phrase = period.preset === "custom" ? `Du ${displayDate(period.startDate)} au ${displayDate(inclusiveEndDate(period))}` : presetPhrases[period.preset];
  const rate = data.production > 0 ? data.received / data.production : null;
  const points: FlowPoint[] = data.series.map((point) => {
    const midday = new Date(`${point.bucket_start}T12:00:00Z`);
    return {
      label: monthly ? shortMonth.format(midday).replace(".", "") : dayNumber.format(midday),
      longLabel: displayDate(point.bucket_start, monthly),
      production: point.production,
      received: point.received,
    };
  });
  const methods = [...data.payment_methods].sort((a, b) => b.amount - a.amount);
  const methodTotal = methods.reduce((sum, entry) => sum + entry.amount, 0);
  const methodMax = Math.max(0, ...methods.map((entry) => entry.amount));

  return (
    <div className="mt-5 space-y-5">
      {/* Period: presets in one row, custom range folded away. */}
      <section aria-labelledby="accounting-period-title" className={`kpi-rise ${panelClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--navy)]" id="accounting-period-title">Période analysée</h2>
            <p className="mt-0.5 text-xs text-slate-500">{rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}, dates incluses — heure du cabinet.</p>
            {period.usedFallback ? <p className="mt-1 text-xs font-medium text-amber-700">Filtre invalide remplacé par le mois courant.</p> : null}
          </div>
          <nav aria-label="Périodes comptables" className="flex flex-wrap gap-1 rounded-[14px] bg-[#eef3f8] p-1">
            {presets.map(([preset, label]) => (
              <Link
                aria-current={period.preset === preset ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-[10px] px-3 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] ${period.preset === preset ? "bg-white text-[var(--navy)] shadow-[0_1px_3px_rgba(16,44,76,0.16)]" : "text-slate-500 hover:bg-white/70 hover:text-[var(--navy)]"}`}
                href={`/accounting?period=${preset}`}
                key={preset}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <details className="group/custom mt-3 border-t border-[#e6edf5] pt-3" open={period.preset === "custom"}>
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[var(--blue-deep)] hover:underline">
            <span aria-hidden="true" className="transition-transform group-open/custom:rotate-90">›</span>Choisir des dates précises
          </summary>
          <form action="/accounting" className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" method="get">
            <input name="period" type="hidden" value="custom" />
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Du
              <input className="min-h-11 rounded-[12px] border border-[#d7e2ee] bg-white px-3 text-sm text-[var(--navy)] outline-none focus:border-[var(--blue)] focus-visible:outline-none" defaultValue={period.preset === "custom" ? period.startDate : ""} max="9999-12-31" min="2020-01-01" name="from" required type="date" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Au
              <input className="min-h-11 rounded-[12px] border border-[#d7e2ee] bg-white px-3 text-sm text-[var(--navy)] outline-none focus:border-[var(--blue)] focus-visible:outline-none" defaultValue={period.preset === "custom" ? inclusiveEndDate(period) : ""} max="9999-12-31" min="2020-01-01" name="to" required type="date" />
            </label>
            <button className="min-h-11 rounded-[12px] bg-[var(--navy)] px-5 text-sm font-semibold text-white transition-all hover:bg-[#1b3d63] active:scale-[0.98]" type="submit">Afficher</button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">Plage personnalisée maximale : cinq ans.</p>
        </details>
      </section>

      {/* Headline: one sentence and the collection gauge. */}
      <SpotlightSurface className={`kpi-rise relative overflow-hidden ${panelClass}`} texture="money">
        <section aria-label="Résumé de la période" className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center">
          <div className="relative grid shrink-0 place-items-center self-center">
            <CollectionGauge rate={rate} />
            <div className="absolute text-center">
              <p className="text-[26px] leading-none font-semibold tracking-[-0.03em] text-[var(--navy)]">{rate === null ? "—" : <CountUp format="percent" value={rate * 100} />}</p>
              <p className="mt-1 text-[11px] text-slate-500">encaissé</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Taux d’encaissement</p>
            <p className="mt-1.5 text-lg leading-8 text-slate-600 [text-wrap:pretty] sm:text-xl">
              {phrase}, le cabinet a réalisé <strong className="font-semibold text-[var(--navy)]">{money.format(data.production)}</strong> de soins
              et encaissé <strong className="font-semibold text-[#0e7c6d]">{money.format(data.received)}</strong>
              {rate !== null ? <>, soit <strong className="font-semibold text-[var(--navy)]">{percent.format(rate)}</strong> de la production.</> : "."}
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
              <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${rate === null ? "bg-slate-300" : rate >= 0.9 ? "bg-[#19a996]" : rate >= 0.6 ? "bg-[var(--blue)]" : "bg-[#d9822b]"}`} />
              {rate === null
                ? "Aucun soin réalisé sur cette période : le taux ne peut pas être calculé."
                : rate >= 1 ? "Tout ce qui a été réalisé est payé (des paiements d’anciens soins peuvent aussi être comptés)."
                : rate >= 0.9 ? "Très bon niveau : presque tous les soins de la période sont payés."
                : rate >= 0.6 ? "Correct : une partie des soins reste à encaisser."
                : "À surveiller : moins de 60 % des soins de la période sont payés."}
            </p>
          </div>
        </section>
      </SpotlightSurface>

      {/* Main figures. */}
      <section aria-label="Indicateurs financiers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi color={PRODUCTION_COLOR} detail="Soins marqués « réalisés » sur la période." label="Production" texture="tooth" value={data.production} />
        <Kpi color={RECEIVED_COLOR} detail="Paiements reçus sur la période, hors paiements annulés." label="Encaissements" texture="money" value={data.received} />
        <Kpi
          detail={data.period_net > 0 ? "Soins de la période pas encore payés." : data.period_net < 0 ? "Vous avez encaissé plus que réalisé (paiements d’anciens soins)." : "Production et encaissements s’équilibrent."}
          label="Écart de la période"
          texture="pulse"
          tone={data.period_net > 0 ? "amber" : "neutral"}
          value={data.period_net}
        />
        <Kpi detail="Tout ce que les patients doivent encore, toutes périodes confondues." label="Encours total actuel" texture="people" tone={data.current_outstanding > 0 ? "amber" : "green"} value={data.current_outstanding} />
      </section>

      <section aria-label="Activité" className="kpi-rise grid grid-cols-3 overflow-hidden rounded-[18px] border border-[#dbe6f1] bg-white/85">
        <Count label="Patients concernés" value={data.active_patient_count} hint="avec un soin ou un paiement" />
        <Count label="Soins réalisés" value={data.intervention_count} hint="comptés dans la production" />
        <Count label="Paiements reçus" value={data.payment_count} hint="comptés dans les encaissements" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section aria-labelledby="accounting-trend-title" className={`kpi-rise ${panelClass} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="accounting-trend-title">Production et encaissements</h2>
              <p className="mt-0.5 text-xs text-slate-500">Par {monthly ? "mois" : "jour"} · survolez une colonne pour voir les montants.</p>
            </div>
            <ul aria-label="Légende" className="flex flex-wrap gap-3 text-xs font-medium text-slate-600">
              <li className="flex items-center gap-1.5"><Swatch color={PRODUCTION_COLOR} />Production</li>
              <li className="flex items-center gap-1.5"><Swatch color={RECEIVED_COLOR} />Encaissements</li>
            </ul>
          </div>
          <div className="mt-4 overflow-x-auto"><div className="min-w-[560px]"><FlowChart points={points} /></div></div>
          <details className="group/table mt-3 border-t border-[#eef3f8] pt-3">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[var(--blue-deep)] hover:underline"><span aria-hidden="true" className="transition-transform group-open/table:rotate-90">›</span>Voir les chiffres exacts</summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-[12px] border border-[#e3ebf3]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#f5f8fb] text-xs text-slate-500"><tr><th className="px-3 py-2 text-left font-medium" scope="col">{monthly ? "Mois" : "Jour"}</th><th className="px-3 py-2 text-right font-medium" scope="col">Production</th><th className="px-3 py-2 text-right font-medium" scope="col">Encaissements</th></tr></thead>
                <tbody className="divide-y divide-[#eef3f8]">
                  {data.series.map((point) => <tr key={point.bucket_start}><td className="px-3 py-2 text-slate-600">{displayDate(point.bucket_start, monthly)}</td><td className="metric-number px-3 py-2 text-right text-[var(--navy)]">{money.format(point.production)}</td><td className="metric-number px-3 py-2 text-right text-[var(--navy)]">{money.format(point.received)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section aria-labelledby="payment-methods-title" className={`kpi-rise ${panelClass} p-5 sm:p-6`}>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="payment-methods-title">Modes de paiement</h2>
          <p className="mt-0.5 text-xs text-slate-500">Comment les patients ont payé sur la période.</p>
          {methods.length && methodTotal > 0 ? (
            <ul className={`${styles.methods} mt-5 space-y-4`}>
              {methods.map((entry) => (
                <li key={entry.method}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-[var(--navy)]">{methodLabels[entry.method]}</span>
                    <span className="text-right"><strong className="metric-number font-semibold text-[var(--navy)]">{money.format(entry.amount)}</strong><span className="ml-2 text-xs text-slate-500">{percent.format(entry.amount / methodTotal)} · {entry.payment_count} paiement{entry.payment_count > 1 ? "s" : ""}</span></span>
                  </div>
                  <svg aria-hidden="true" className="mt-2 block h-2.5 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <rect fill="#edf2f7" height="10" rx="5" width="100" />
                    <rect className={styles.growX} fill={RECEIVED_COLOR} height="10" rx="5" width={methodMax ? Math.max(2, (entry.amount / methodMax) * 100) : 0} />
                  </svg>
                </li>
              ))}
            </ul>
          ) : <p className="mt-5 rounded-[14px] border border-dashed border-[#d3e1ef] px-4 py-6 text-center text-sm text-slate-500">Aucun paiement reçu sur cette période.</p>}
        </section>
      </div>

      <section aria-labelledby="reading-title" className="kpi-rise rounded-[20px] border border-[#dbe6f1] bg-[#f7fafd] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--navy)]" id="reading-title">Comment lire ces chiffres</h2>
        <dl className="mt-3 grid gap-4 text-sm leading-6 sm:grid-cols-2">
          <Definition term="Production">La valeur des soins réalisés pendant la période, qu’ils soient payés ou non.</Definition>
          <Definition term="Encaissements">L’argent réellement reçu pendant la période. Un paiement annulé n’est pas compté.</Definition>
          <Definition term="Écart de la période">Production moins encaissements sur la période. Ce n’est pas la dette totale des patients.</Definition>
          <Definition term="Encours total">Ce que les patients doivent encore aujourd’hui, en additionnant toutes les périodes.</Definition>
        </dl>
        <p className="mt-4 border-t border-[#e3ebf3] pt-3 text-xs leading-5 text-slate-500">Les factures et reçus sont des documents historiques et ne calculent aucun total. Les paiements annulés sont exclus selon leur état actuel ; ce tableau ne reconstitue pas un journal historique des annulations.</p>
      </section>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <svg aria-hidden="true" className="size-2.5" viewBox="0 0 10 10"><rect fill={color} height="10" rx="2.5" width="10" /></svg>;
}

function Kpi({ label, value, detail, texture, color, tone = "neutral" }: { label: string; value: number; detail: string; texture: SpotlightTexture; color?: string; tone?: "neutral" | "amber" | "green" }) {
  const valueTone = tone === "amber" ? "text-[#b4541a]" : tone === "green" ? "text-[#0e7c6d]" : "text-[var(--navy)]";
  return (
    <SpotlightSurface className={`kpi-rise relative flex flex-col p-5 transition-transform duration-200 hover:-translate-y-0.5 ${panelClass}`} texture={texture}>
      <p className="flex items-center gap-2 text-[13px] font-medium text-slate-600">{color ? <Swatch color={color} /> : null}{label}</p>
      <p className={`mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] ${valueTone}`}><CountUp format="money" value={value} /></p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </SpotlightSurface>
  );
}

function Count({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="border-[#e6edf5] px-4 py-3.5 not-first:border-l sm:px-6">
      <p className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-[var(--navy)]"><CountUp format="number" value={value} /></p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="hidden text-[11px] text-slate-400 sm:block">{hint}</p>
    </div>
  );
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return <div><dt className="font-semibold text-[var(--navy)]">{term}</dt><dd className="text-slate-600">{children}</dd></div>;
}
