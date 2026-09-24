import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import Image from "next/image";
import Link from "next/link";
import { ClinicVideo } from "./clinic-video";
import { CashflowAreaChart } from "./cashflow-area-chart";
import { DistributionChart } from "./distribution-chart";
import { InteractiveCard } from "./interactive-card";
import { SpotlightSurface, type SpotlightTexture } from "./spotlight-surface";

import { AppIcon } from "@/components/app-icon";
import type { AccountingDashboard } from "@/lib/accounting/data";
import type { AuthenticatedUser } from "@/lib/auth/server";
import type { DashboardAppointment, MainDashboard } from "@/lib/dashboard/data";
import type { DashboardPeriodKey } from "@/lib/dashboard/period";
import { formatDashboardMoney, frenchClinicDate, hourlyQuote } from "@/lib/dashboard/presentation";
import { clinicDateValue, clinicTimeValue } from "@/lib/appointments/validation";
import { HourlyQuote } from "./hourly-quote";

const plainNumber = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const appointmentTime = new ClinicDateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const appointmentDay = new ClinicDateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

const periodLabels: Record<DashboardPeriodKey, string> = {
  week: "Semaine",
  month: "Mois",
  six_months: "6 mois",
  year: "Année",
};

const statusLabels = { scheduled: "À venir", completed: "Terminé", cancelled: "Annulé", no_show: "Absent" } as const;
const statusClasses = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
  no_show: "bg-amber-50 text-amber-700",
} as const;

type Props = {
  user: AuthenticatedUser;
  operational: MainDashboard;
  period: DashboardPeriodKey;
  financial?: AccountingDashboard;
  sixMonthFinancial?: AccountingDashboard;
};

export function MainDashboardView({ user, operational, period, financial, sixMonthFinancial }: Props) {
  const rawFirstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const firstName = /^membre$/i.test(rawFirstName) ? (user.role === "doctor" ? "Docteur" : "à vous") : rawFirstName;

  const planningHref = `/appointments?date=${operational.clinicDate}`;
  const scheduledNote = operational.appointments.scheduled === 1 ? "1 encore à venir" : `${operational.appointments.scheduled} encore à venir`;
  const { appointments, patients } = operational;
  const appointmentsDetail = <AppointmentsDetail dashboard={operational} />;
  const newPatientsDetail = <ShareDetail part={patients.createdThisMonth} whole={patients.active} caption={`des ${plainNumber.format(patients.active)} dossiers actifs`} />;
  const metrics: KpiProps[] = financial ? [
    { label: "Encaissements", value: plainNumber.format(financial.received), unit: "MAD", note: `Période · ${periodLabels[period].toLowerCase()}`, href: "/accounting", action: "Voir la comptabilité", texture: "money", toolbar: <PeriodChips period={period} />, detail: <ReceivedDetail dashboard={financial} /> },
    { label: "Rendez-vous aujourd’hui", value: String(appointments.total), note: scheduledNote, href: planningHref, action: "Ouvrir le planning", texture: "clock", detail: appointmentsDetail },
    { label: "Nouveaux patients", value: String(patients.createdThisMonth), note: "Depuis le 1er du mois", href: "/patients", action: "Voir les patients", texture: "people", detail: newPatientsDetail },
    { label: "Encours global", value: plainNumber.format(financial.current_outstanding), unit: "MAD", note: "Reste à encaisser", href: "/payments", action: "Suivre les impayés", texture: "money", detail: <OutstandingDetail dashboard={financial} /> },
  ] : [
    { label: "Rendez-vous aujourd’hui", value: String(appointments.total), note: scheduledNote, href: planningHref, action: "Ouvrir le planning", texture: "clock", detail: appointmentsDetail },
    { label: "Patients actifs", value: compactNumber.format(patients.active), note: "Dossiers ouverts", href: "/patients", action: "Voir les patients", texture: "people", detail: <DetailLine>dont {patients.createdThisMonth} créés ce mois</DetailLine> },
    { label: "Nouveaux patients", value: String(patients.createdThisMonth), note: "Depuis le 1er du mois", href: "/patients", action: "Voir les patients", texture: "people", detail: newPatientsDetail },
    { label: "Rappels manuels", value: String(operational.reminderCount), note: "À traiter", href: planningHref, action: "Traiter les rappels", texture: "clock", detail: <DetailLine>{operational.reminderCount ? "Patients à rappeler par téléphone" : "Aucun rappel en attente"}</DetailLine> },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <WelcomeCard clinicDate={operational.clinicDate} firstName={firstName} />
      <KpiStrip metrics={metrics} />

      <section aria-label="Vue du cabinet" className="grid gap-5 xl:grid-cols-12">
        <AppointmentGauge dashboard={operational} />
        <CabinetBalance dashboard={operational} />
      </section>

      <section aria-label="Analyse et activité" className="grid gap-5 xl:grid-cols-12">
        {financial ? (
          <CashflowCard dashboard={financial} period={period} />
        ) : (
          <UpcomingAppointments items={operational.appointments.upcoming} />
        )}
        <ClinicActivity dashboard={operational} financial={sixMonthFinancial} />
      </section>

      <section aria-label="Planning et suivi" className="grid gap-5 xl:grid-cols-12">
        <TodayAppointments dashboard={operational} />
        <OperationsTimeline dashboard={operational} financial={financial} />
      </section>
    </div>
  );
}

function Card({ children, className = "", title, details, texture }: { children: React.ReactNode; className?: string; title?: string; details?: React.ReactNode; texture?: SpotlightTexture }) {
  return <InteractiveCard className={className} title={title} details={details} texture={texture}>{children}</InteractiveCard>;
}

function CardHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[17px] leading-6 font-bold tracking-[-0.025em] text-[var(--navy)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

type KpiProps = { label: string; value: string; unit?: string; note: string; href: string; action: string; texture: SpotlightTexture; detail?: React.ReactNode; toolbar?: React.ReactNode };

// One ledger-style surface split by hairlines instead of four floating tiles.
// The lead figure gets extra width so the row reads left to right, not as a uniform grid.
function KpiStrip({ metrics }: { metrics: KpiProps[] }) {
  return (
    <section aria-label="Indicateurs essentiels" className="overflow-hidden rounded-[18px] border border-[#dbe6f1] bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)]">
      <ul className="grid divide-y divide-[#e6edf5] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        {metrics.map((metric, index) => (
          <li className={`kpi-rise min-w-0 border-[#e6edf5] ${index % 2 ? "sm:border-l" : ""} ${index > 1 ? "sm:border-t xl:border-t-0" : ""} ${index === 2 ? "xl:border-l" : ""}`} key={metric.label}>
            <KpiCell lead={index === 0} {...metric} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// The whole cell is clickable through a stretched link on the label. The overlay needs
// z-[1] so hover/press transforms below it can't steal the click; the period buttons
// sit above it (z-10) so they stay independently selectable.
function KpiCell({ label, value, unit, note, href, action, texture, lead, detail, toolbar }: KpiProps & { lead: boolean }) {
  return (
    <SpotlightSurface className="group relative flex h-full cursor-pointer flex-col px-5 pt-4 pb-5 transition-colors duration-200 active:bg-[#edf3fa] has-[a:focus-visible]:shadow-[inset_0_0_0_2px_var(--blue)] sm:px-6" texture={texture}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[var(--blue)] transition-transform duration-300 ease-out group-hover:scale-x-100 group-has-[a:focus-visible]:scale-x-100" />
      <Link aria-label={`${label} : ${value}${unit ? ` ${unit}` : ""}. ${action}`} className="truncate text-[13px] font-medium text-slate-600 outline-none after:absolute after:inset-0 after:z-[1] after:content-['']" href={href}>{label}</Link>
      <span className="mt-3 flex items-baseline gap-1.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5">
        <strong className={`metric-number leading-none font-semibold tracking-[-0.03em] text-[var(--navy)] transition-colors duration-200 group-hover:text-[var(--blue-deep)] ${lead ? "text-[34px]" : "text-[30px]"}`}>{value}</strong>
        {unit ? <span className="text-xs font-medium text-slate-400">{unit}</span> : null}
      </span>
      <span className="mt-2.5 text-xs text-slate-500">{note}</span>
      {toolbar ? <div className="relative z-10 mt-3">{toolbar}</div> : null}
      <span className="mt-auto block pt-4">
        {detail ? <span className="block border-t border-dashed border-[#e1e9f2] pt-3">{detail}</span> : null}
        <span aria-hidden="true" className="mt-4 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#d6e3f0] bg-white px-3 text-[11px] font-semibold text-[var(--blue-deep)] shadow-[0_1px_2px_rgba(16,44,76,0.06)] transition-all duration-200 group-hover:border-[var(--blue)] group-hover:bg-[var(--blue)] group-hover:text-white group-hover:shadow-[0_6px_14px_-6px_rgba(22,119,242,0.6)] group-active:scale-[0.97]">
          {action}
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </span>
      </span>
    </SpotlightSurface>
  );
}

function PeriodChips({ period }: { period: DashboardPeriodKey }) {
  return (
    <nav aria-label="Changer la période des encaissements" className="inline-flex flex-wrap gap-1 rounded-[10px] bg-[#eef3f8] p-0.5">
      {(Object.keys(periodLabels) as DashboardPeriodKey[]).map((key) => (
        <Link aria-current={period === key ? "page" : undefined} className={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 active:scale-95 ${period === key ? "bg-white text-[var(--navy)] shadow-[0_1px_3px_rgba(16,44,76,0.14)]" : "text-slate-500 hover:bg-white/70 hover:text-[var(--navy)]"}`} href={`/dashboard?period=${key}`} key={key} scroll={false}>{periodLabels[key]}</Link>
      ))}
    </nav>
  );
}

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const ratio = (part: number, whole: number) => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0);

function DetailLine({ children }: { children: React.ReactNode }) {
  return <span className="block truncate text-[11px] text-slate-500">{children}</span>;
}

// Bars are drawn in SVG because the CSP blocks inline style attributes.
function Meter({ value, tone = "#1677f2" }: { value: number; tone?: string }) {
  return (
    <svg aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full" preserveAspectRatio="none" viewBox="0 0 100 4">
      <rect fill="#edf2f7" height="4" width="100" />
      <rect fill={tone} height="4" width={Math.round(value * 100)} />
    </svg>
  );
}

function ReceivedDetail({ dashboard }: { dashboard: AccountingDashboard }) {
  const values = dashboard.series.map((point) => point.received);
  const max = Math.max(...values, 0);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${28 - (max ? value / max : 0) * 24}`).join(" ");
  return (
    <span className="block">
      {values.length > 1 ? (
        <svg aria-hidden="true" className="mb-2 block h-7 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
          <polyline fill="none" points={points} stroke="#1677f2" strokeLinejoin="round" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      <DetailLine>
        {dashboard.payment_count} paiement{dashboard.payment_count === 1 ? "" : "s"}
        {dashboard.production > 0 ? ` · ${percent.format(ratio(dashboard.received, dashboard.production))} de la production` : ""}
      </DetailLine>
    </span>
  );
}

function AppointmentsDetail({ dashboard }: { dashboard: MainDashboard }) {
  const { total, completed, scheduled, cancelled, noShow, today } = dashboard.appointments;
  const segments = [
    { label: "terminés", value: completed, color: "#19a996" },
    { label: "à venir", value: scheduled, color: "#1677f2" },
    { label: "absents", value: noShow, color: "#d9a13b" },
    { label: "annulés", value: cancelled, color: "#c3ccd7" },
  ].filter((segment) => segment.value > 0);
  const now = new Date(dashboard.generatedAt).getTime();
  const next = today.filter((item) => item.status === "scheduled" && new Date(item.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (!total) return <DetailLine>Journée libre dans le planning</DetailLine>;
  return (
    <span className="block space-y-2">
      <svg aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full" preserveAspectRatio="none" viewBox="0 0 100 4">
        {segments.map((segment, index) => {
          const before = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
          return <rect fill={segment.color} height="4" key={segment.label} width={Math.max(0, (segment.value / total) * 100 - (index < segments.length - 1 ? 0.6 : 0))} x={(before / total) * 100} />;
        })}
      </svg>
      <DetailLine>{segments.map((segment) => `${segment.value} ${segment.label}`).join(" · ")}</DetailLine>
      {next ? <DetailLine>Prochain <span className="metric-number font-semibold text-[var(--navy)]">{appointmentTime.format(new Date(next.startsAt))}</span> · {next.patientName}</DetailLine> : null}
    </span>
  );
}

function ShareDetail({ part, whole, caption }: { part: number; whole: number; caption: string }) {
  return (
    <span className="block space-y-2">
      <Meter value={ratio(part, whole)} tone="#c7a45d" />
      <DetailLine><span className="metric-number font-semibold text-[var(--navy)]">{percent.format(ratio(part, whole))}</span> {caption}</DetailLine>
    </span>
  );
}

function OutstandingDetail({ dashboard }: { dashboard: AccountingDashboard }) {
  const owed = dashboard.current_outstanding;
  const collected = ratio(dashboard.received, dashboard.received + owed);
  if (owed <= 0) return <DetailLine>Aucun impayé en cours</DetailLine>;
  return (
    <span className="block space-y-2">
      <Meter value={collected} tone="#19a996" />
      <DetailLine>
        <span className="metric-number font-semibold text-[var(--navy)]">{percent.format(collected)}</span> réglé · {percent.format(1 - collected)} en attente
      </DetailLine>
    </span>
  );
}

function WelcomeCard({ clinicDate, firstName }: { clinicDate: string; firstName: string }) {
  return (
    <Card className="clinic-video-card relative min-h-[360px] overflow-hidden !p-0 sm:min-h-[420px]">
      <Image alt="" aria-hidden="true" className="object-cover object-center" fill loading="eager" sizes="100vw" src="/media/clinic-loop-poster.jpg" />
      <ClinicVideo />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,28,52,0.93)_0%,rgba(7,43,78,0.76)_48%,rgba(8,62,102,0.18)_82%,rgba(9,73,115,0.06)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,22,42,0.08)_30%,rgba(3,24,47,0.58)_100%)]" />
      <div className="relative z-10 flex min-h-[360px] max-w-[90%] flex-col p-6 text-white sm:min-h-[420px] sm:max-w-[60%] sm:p-10 lg:p-12">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/78 uppercase">
          <span aria-hidden="true" className="h-px w-7 bg-[var(--gold-light)]" />
          Centre Dentaire Ouahid
        </div>
        <p className="mt-5 text-xs font-semibold text-white/72">Bienvenue,</p>
        <h1 className="mt-1 text-4xl leading-tight font-extrabold tracking-[-0.03em] text-white sm:text-5xl">Bonjour, {firstName}.</h1>
        <p className="mt-3 text-sm font-semibold text-sky-100">{frenchClinicDate(clinicDate)}</p>
        <HourlyQuote className="mt-5 max-w-md border-l-2 border-[var(--gold-light)] pl-4 text-xl leading-snug font-semibold tracking-[-0.01em] text-white drop-shadow-[0_2px_8px_rgba(3,22,42,0.55)] sm:text-2xl" initial={hourlyQuote(clinicDateValue(new Date()), Number(clinicTimeValue(new Date()).slice(0, 2)))} />
        <Link className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 text-xs font-bold text-white transition-transform hover:translate-x-1" href={`/appointments?date=${clinicDate}`}>Ouvrir le planning <span aria-hidden="true" className="text-[var(--gold-light)]">→</span></Link>
      </div>
    </Card>
  );
}

function AppointmentGauge({ dashboard }: { dashboard: MainDashboard }) {
  return (
    <Card className="xl:col-span-6" texture="clock" title="Rythme du jour">
      <CardHeading title="Rythme du jour" subtitle="Répartition des rendez-vous aujourd’hui" />
      <DistributionChart unit="rendez-vous" emptyLabel="Aucun rendez-vous aujourd’hui." items={[
        { label: "À venir", value: dashboard.appointments.scheduled, color: "#1677f2" },
        { label: "Terminés", value: dashboard.appointments.completed, color: "#19cbb5" },
        { label: "Annulés", value: dashboard.appointments.cancelled, color: "#f28b6b" },
        { label: "Absents", value: dashboard.appointments.noShow, color: "#8d82db" },
      ]} />
    </Card>
  );
}

function CabinetBalance({ dashboard }: { dashboard: MainDashboard }) {
  const colors = ["#19cbb5", "#1677f2", "#8d82db", "#f28b6b", "#c7a45d"];
  const treatments = [...dashboard.treatments].sort((a, b) => b.count - a.count);
  const items = treatments.slice(0, 4).map((item, index) => ({ ...item, value: item.count, color: colors[index] }));
  if (treatments.length > 4) items.push({ label: "Autres soins", count: 0, value: treatments.slice(4).reduce((sum, item) => sum + item.count, 0), color: colors[4] });
  return (
    <Card className="xl:col-span-6" texture="tooth" title="Équilibre du cabinet" details={dashboard.treatments.length ? <table><caption className="mb-3 text-left font-semibold text-[var(--navy)]">Tous les soins réalisés</caption><thead><tr><th scope="col">Soin</th><th scope="col">Nombre exact</th></tr></thead><tbody>{dashboard.treatments.map((item) => <tr key={item.label}><td>{item.label}</td><td>{new Intl.NumberFormat("fr-FR").format(item.count)}</td></tr>)}</tbody></table> : null}>
      <CardHeading title="Équilibre du cabinet" subtitle="Répartition des soins réalisés · six derniers mois" />
      <DistributionChart unit="soins réalisés" emptyLabel="Aucun soin réalisé sur cette période." items={items} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <SmallStat label="Patients actifs" value={dashboard.patients.active} />
        <SmallStat label="Rappels à traiter" value={dashboard.reminderCount} />
      </div>
    </Card>
  );
}
function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[13px] bg-[var(--vision-inset)] px-3 py-2.5"><p className="text-slate-500">{label}</p><p className="metric-number mt-1 font-extrabold text-[var(--navy)]">{value}</p></div>;
}

function CashflowCard({ dashboard, period }: { dashboard: AccountingDashboard; period: DashboardPeriodKey }) {
  return (
    <Card className="overflow-hidden !bg-white !p-0 xl:col-span-8" texture="money" title="Flux financier" details={<FinancialResultsTable dashboard={dashboard} />}>
      <div className="px-6 pt-6">
      <CardHeading
        title="Flux financier"
        subtitle={`Production et encaissements · ${periodLabels[period].toLowerCase()}`}
        action={<PeriodNavigation period={period} />}
      />
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <Metric label="Production" value={formatDashboardMoney(dashboard.production)} tone="violet" />
        <Metric label="Encaissements" value={formatDashboardMoney(dashboard.received)} tone="coral" />
        <Metric label="Solde de période" value={formatDashboardMoney(dashboard.period_net)} />
      </div>
      </div>
      <CashflowAreaChart dashboard={dashboard} />
    </Card>
  );
}

function PeriodNavigation({ period }: { period: DashboardPeriodKey }) {
  return (
    <nav aria-label="Période financière" className="hidden flex-wrap gap-1 rounded-xl border border-white/90 bg-white/55 p-1 shadow-sm sm:flex">
      {(Object.keys(periodLabels) as DashboardPeriodKey[]).map((key) => (
        <Link aria-current={period === key ? "page" : undefined} className={`rounded-[9px] px-2.5 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${period === key ? "bg-[var(--blue)] text-white shadow-[0_5px_12px_rgba(23,113,238,0.2)]" : "text-slate-500 hover:bg-white hover:text-[var(--navy)]"}`} href={`/dashboard?period=${key}`} key={key}>{periodLabels[key]}</Link>
      ))}
    </nav>
  );
}

function FinancialResultsTable({ dashboard }: { dashboard: AccountingDashboard }) {
  return <table>
    <caption className="mb-3 text-left font-semibold text-[var(--navy)]">Montants exacts par période</caption>
    <thead><tr><th scope="col">Période</th><th scope="col">Production</th><th scope="col">Encaissements</th></tr></thead>
    <tbody>{dashboard.series.map((point) => <tr key={point.bucket_start}><td>{appointmentDay.format(new Date(point.bucket_start))}</td><td>{formatDashboardMoney(point.production)}</td><td>{formatDashboardMoney(point.received)}</td></tr>)}</tbody>
    <tfoot><tr className="font-bold"><td>Total</td><td>{formatDashboardMoney(dashboard.production)}</td><td>{formatDashboardMoney(dashboard.received)}</td></tr></tfoot>
  </table>;
}

function ClinicActivity({ dashboard, financial }: { dashboard: MainDashboard; financial?: AccountingDashboard }) {
  const chartPoints = financial ? financial.series.map((point) => ({
    label: appointmentDay.format(new Date(point.bucket_start)),
    first: point.production,
    second: point.received,
  })) : [{ label: "Aujourd’hui", first: dashboard.appointments.completed, second: dashboard.appointments.scheduled }];
  const maximum = Math.max(1, ...chartPoints.flatMap((point) => [point.first, point.second]));
  const valueLabel = (value: number) => financial ? formatDashboardMoney(value) : String(value);
  const items = financial ? [
    { label: "Interventions", value: financial.intervention_count, icon: "calendar" as const },
    { label: "Paiements", value: financial.payment_count, icon: "accounting" as const },
    { label: "Patients", value: dashboard.patients.active, icon: "patients" as const },
    { label: "Rappels", value: dashboard.reminderCount, icon: "security" as const },
  ] : [
    { label: "Terminés", value: dashboard.appointments.completed, icon: "calendar" as const },
    { label: "À venir", value: dashboard.appointments.scheduled, icon: "plus" as const },
    { label: "Patients", value: dashboard.patients.active, icon: "patients" as const },
    { label: "Rappels", value: dashboard.reminderCount, icon: "security" as const },
  ];
  return (
    <Card className="!bg-white xl:col-span-4" texture="pulse" title="Activité du cabinet" details={financial ? <FinancialResultsTable dashboard={financial} /> : null}>
      <CardHeading title="Activité du cabinet" subtitle={financial ? "Vue des six derniers mois" : "Journée en cours"} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        {items.slice(0, 2).map((item, index) => <div key={item.label}>
          <strong className={`metric-number block text-2xl font-extrabold ${index === 0 ? "text-[#1686ef]" : "text-[#df604c]"}`}>{new Intl.NumberFormat("fr-FR").format(item.value)}</strong>
          <p className="mt-1 text-xs text-[var(--muted)]">{item.label}</p>
        </div>)}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#1686ef]" />{financial ? "Production · MAD" : "Terminés"}</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#ff826f]" />{financial ? "Encaissements · MAD" : "À venir"}</span>
      </div>
      <svg className="mt-3 h-44 w-full" viewBox="0 0 360 180" role="img" aria-label={financial ? "Production et encaissements par période, en dirhams" : "Rendez-vous terminés et à venir"}>
        <line x1="8" x2="352" y1="164" y2="164" stroke="#e9edf3" />
        {chartPoints.map((point, index) => {
          const x = 16 + (index + 0.5) * 328 / chartPoints.length;
          const firstY = 164 - point.first / maximum * 140;
          const secondY = 164 - point.second / maximum * 140;
          return <g key={`${point.label}-${index}`}>
            <title>{`${point.label} : ${financial ? "Production" : "Terminés"} ${valueLabel(point.first)}, ${financial ? "Encaissements" : "À venir"} ${valueLabel(point.second)}`}</title>
            <line x1={x - 3} x2={x - 3} y1={firstY} y2="164" stroke="#1686ef" strokeOpacity="0.23" />
            <line x1={x + 3} x2={x + 3} y1={secondY} y2="164" stroke="#ff826f" strokeOpacity="0.3" />
            <circle cx={x - 3} cy={firstY} r="3" fill="#1686ef" />
            <circle cx={x + 3} cy={secondY} r="3" fill="#ff826f" />
          </g>;
        })}
      </svg>
      <div className="flex justify-between gap-3 text-[10px] text-[var(--muted)]">
        <span>{chartPoints[0]?.label}</span><span>{chartPoints.length > 1 ? chartPoints[chartPoints.length - 1]?.label : ""}</span>
      </div>
      {!chartPoints.some((point) => point.first || point.second) ? <p className="mt-2 text-xs text-[var(--muted)]">Aucune activité sur cette période.</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        {items.slice(2).map((item) => <div key={item.label}><p className="text-xs text-[var(--muted)]">{item.label}</p><strong className="metric-number mt-1 block text-lg text-[var(--navy)]">{new Intl.NumberFormat("fr-FR").format(item.value)}</strong></div>)}
      </div>
    </Card>
  );
}

function UpcomingAppointments({ items }: { items: DashboardAppointment[] }) {
  return <Card className="xl:col-span-8" texture="calendar"><CardHeading title="Prochains rendez-vous" subtitle="À venir dans le planning" />{items.length ? <AppointmentMiniList items={items.slice(0, 6)} showDay /> : <EmptyState text="Aucun rendez-vous à venir." />}</Card>;
}

function TodayAppointments({ dashboard }: { dashboard: MainDashboard }) {
  return (
    <Card className="xl:col-span-8" texture="calendar">
      <CardHeading title="Planning d’aujourd’hui" subtitle="Patients, horaires et statut" action={<Link className="inline-flex min-h-11 items-center text-[11px] font-bold text-[var(--blue-deep)] hover:underline" href={`/appointments?date=${dashboard.clinicDate}`}>Tout afficher</Link>} />
      <div className="mt-6 hidden grid-cols-[110px_minmax(0,1fr)_100px] border-b border-blue-100/80 pb-2 text-[9px] font-bold tracking-[0.1em] text-slate-400 uppercase sm:grid"><span>Heure</span><span>Patient et motif</span><span>Statut</span></div>
      {dashboard.appointments.today.length ? <AppointmentMiniList items={dashboard.appointments.today} table /> : <EmptyState actionHref={`/appointments?date=${dashboard.clinicDate}`} actionLabel="Ouvrir le planning" text="Aucun rendez-vous programmé aujourd’hui." />}
    </Card>
  );
}

function OperationsTimeline({ dashboard, financial }: { dashboard: MainDashboard; financial?: AccountingDashboard }) {
  return (
    <Card className="xl:col-span-4" texture="people">
      <CardHeading title="Vue opérationnelle" subtitle="Suivi rapide du cabinet" />
      <ol className="mt-6 space-y-5">
        <TimelineItem color="blue" label="Rendez-vous à venir" value={dashboard.appointments.scheduled} />
        <TimelineItem color="aqua" label="Rappels manuels à traiter" value={dashboard.reminderCount} />
        <TimelineItem color="slate" label="Patients actifs" value={dashboard.patients.active} />
        {financial ? <TimelineItem color="blue" label="Paiements sur la période" value={financial.payment_count} /> : null}
      </ol>
      <div className="mt-7 border-t border-white/90 pt-5">
        <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">Soins populaires</p>
        {dashboard.treatments.length ? <ol className="mt-3 space-y-3">{dashboard.treatments.slice(0, 3).map((item, index) => <li className="flex items-center gap-3" key={item.label}><span className="metric-number text-[10px] font-bold text-[var(--blue)]">0{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{item.label}</span><strong className="metric-number text-xs text-[var(--navy)]">{item.count}</strong></li>)}</ol> : <p className="mt-3 text-xs leading-5 text-slate-500">Aucun soin réalisé sur les six derniers mois.</p>}
      </div>
    </Card>
  );
}

function TimelineItem({ color, label, value }: { color: "blue" | "aqua" | "slate"; label: string; value: number }) {
  const colors = { blue: "bg-[var(--blue)]", aqua: "bg-[var(--aqua)]", slate: "bg-slate-300" };
  return <li className="relative flex items-center gap-4 pl-1 before:absolute before:top-8 before:bottom-[-1.4rem] before:left-[0.72rem] before:w-px before:bg-blue-100 last:before:hidden"><span className={`relative z-10 size-5 rounded-full border-[5px] border-white shadow-sm ${colors[color]}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-600">{label}</p><p className="metric-number mt-1 text-lg font-extrabold text-[var(--navy)]">{value}</p></div></li>;
}

function AppointmentMiniList({ items, showDay = false, table = false }: { items: DashboardAppointment[]; showDay?: boolean; table?: boolean }) {
  return <ul className={`mt-5 ${table ? "divide-y divide-blue-100/70" : "divide-y divide-blue-100/70"}`}>{items.map((item) => <li className="group grid gap-3 py-3.5 first:pt-0 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center" key={item.id}><time className="metric-number shrink-0 text-xs font-bold text-[var(--blue-deep)]" dateTime={item.startsAt}>{showDay ? appointmentDay.format(new Date(item.startsAt)) : appointmentTime.format(new Date(item.startsAt))}</time><div className="min-w-0"><Link className="flex min-h-11 items-center truncate text-sm font-bold text-[var(--navy)] transition-colors group-hover:text-[var(--blue)]" href={`/patients/${item.patientId}`}>{item.patientName}</Link><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{item.title}</p></div>{item.status ? <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span> : <span className="metric-number text-xs font-semibold text-slate-500">{appointmentTime.format(new Date(item.startsAt))}</span>}</li>)}</ul>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "blue" | "aqua" | "violet" | "coral" }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--muted)]">{label}</p><p className={`metric-number mt-1 break-words text-lg font-extrabold ${tone === "violet" ? "text-[#5548bd]" : tone === "coral" ? "text-[#ad4739]" : tone === "blue" ? "text-[var(--blue-deep)]" : tone === "aqua" ? "text-[#008f9f]" : "text-[var(--navy)]"}`}>{value}</p></div>;
}

function EmptyState({ text, actionHref, actionLabel }: { text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="mt-5 flex min-h-[210px] items-center justify-center rounded-[16px] border border-dashed border-blue-200 bg-white/45 px-4 py-8 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-[var(--blue)] text-white shadow-[0_7px_16px_rgba(23,113,238,0.2)]"><AppIcon className="size-5" name="calendar" /></span><p className="mt-3 text-sm font-semibold text-slate-600">{text}</p>{actionHref && actionLabel ? <Link className="mt-3 inline-flex text-xs font-bold text-[var(--blue-deep)] hover:underline" href={actionHref}>{actionLabel}</Link> : null}</div></div>;
}
