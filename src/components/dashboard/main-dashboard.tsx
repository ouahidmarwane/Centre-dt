import Image from "next/image";
import Link from "next/link";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import type { AccountingDashboard } from "@/lib/accounting/data";
import type { AuthenticatedUser } from "@/lib/auth/server";
import type { DashboardAppointment, MainDashboard } from "@/lib/dashboard/data";
import type { DashboardPeriodKey } from "@/lib/dashboard/period";
import { formatDashboardMoney, frenchClinicDate } from "@/lib/dashboard/presentation";

const compactNumber = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const appointmentTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });
const appointmentDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Casablanca" });

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

  const metrics: KpiProps[] = financial ? [
    { label: "Encaissements", value: formatDashboardMoney(financial.received), note: periodLabels[period], icon: "accounting" },
    { label: "Rendez-vous aujourd’hui", value: String(operational.appointments.total), note: `${operational.appointments.scheduled} à venir`, icon: "calendar" },
    { label: "Nouveaux patients", value: String(operational.patients.createdThisMonth), note: "Ce mois", icon: "patients" },
    { label: "Encours global", value: formatDashboardMoney(financial.current_outstanding), note: "Calculé en base", icon: "security" },
  ] : [
    { label: "Rendez-vous aujourd’hui", value: String(operational.appointments.total), note: `${operational.appointments.scheduled} à venir`, icon: "calendar" },
    { label: "Patients actifs", value: compactNumber.format(operational.patients.active), note: "Dossiers actifs", icon: "patients" },
    { label: "Nouveaux patients", value: String(operational.patients.createdThisMonth), note: "Ce mois", icon: "plus" },
    { label: "Rappels manuels", value: String(operational.reminderCount), note: "À traiter", icon: "security" },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section aria-label="Indicateurs essentiels" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <KpiCard key={metric.label} {...metric} />)}
      </section>

      <section aria-label="Vue du cabinet" className="grid gap-5 xl:grid-cols-12">
        <WelcomeCard clinicDate={operational.clinicDate} firstName={firstName} />
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`vision-card ${className}`}>{children}</article>;
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

type KpiProps = { label: string; value: string; note: string; icon: AppIconName };

function KpiCard({ label, value, note, icon }: KpiProps) {
  return (
    <Card className="flex min-h-20 items-center justify-between gap-4 !p-4 sm:!px-5">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
        <div className="mt-1 flex min-w-0 items-baseline gap-2">
          <strong className="metric-number truncate text-xl font-extrabold tracking-[-0.035em] text-[var(--navy)]">{value}</strong>
          <span className="hidden shrink-0 text-[10px] font-bold text-[var(--aqua)] 2xl:inline">{note}</span>
        </div>
      </div>
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(145deg,#3b9dff,#1671ee)] text-white shadow-[0_8px_18px_rgba(23,113,238,0.22)]">
        <AppIcon className="size-[21px]" name={icon} />
      </span>
    </Card>
  );
}

function WelcomeCard({ clinicDate, firstName }: { clinicDate: string; firstName: string }) {
  return (
    <Card className="clinic-video-card relative min-h-[304px] overflow-hidden !p-0 xl:col-span-5">
      <Image alt="" aria-hidden="true" className="object-cover object-center" fill priority sizes="(min-width: 1280px) 42vw, 100vw" src="/media/clinic-loop-poster.jpg" />
      <video
        aria-hidden="true"
        autoPlay
        className="clinic-video-motion absolute inset-0 size-full object-cover object-center"
        loop
        muted
        playsInline
        poster="/media/clinic-loop-poster.jpg"
        preload="metadata"
        tabIndex={-1}
      >
        <source src="/media/clinic-loop.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,28,52,0.93)_0%,rgba(7,43,78,0.76)_48%,rgba(8,62,102,0.18)_82%,rgba(9,73,115,0.06)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,22,42,0.08)_30%,rgba(3,24,47,0.58)_100%)]" />
      <div className="relative z-10 flex min-h-[304px] max-w-[78%] flex-col p-6 text-white sm:max-w-[64%] sm:p-7">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/78 uppercase">
          <span aria-hidden="true" className="h-px w-7 bg-[var(--gold-light)]" />
          Centre Dentaire Ouahid
        </div>
        <p className="mt-5 text-xs font-semibold text-white/72">Bienvenue,</p>
        <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-[-0.045em] text-white">Bonjour, {firstName}.</h1>
        <p className="mt-3 text-sm font-semibold text-sky-100">{frenchClinicDate(clinicDate)}</p>
        <p className="mt-2 text-sm leading-6 text-white/76">L’excellence au service de votre sourire.</p>
        <Link className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 text-xs font-bold text-white transition-transform hover:translate-x-1" href={`/appointments?date=${clinicDate}`}>Ouvrir le planning <span aria-hidden="true" className="text-[var(--gold-light)]">→</span></Link>
      </div>
    </Card>
  );
}

function AppointmentGauge({ dashboard }: { dashboard: MainDashboard }) {
  const total = dashboard.appointments.total;
  const completion = total > 0 ? Math.min(100, dashboard.appointments.completed / total * 100) : 0;
  return (
    <Card className="min-h-[304px] xl:col-span-3">
      <CardHeading title="Rythme du jour" subtitle="Progression des rendez-vous" />
      <div className="relative mx-auto mt-7 h-[118px] max-w-[230px]">
        <svg aria-label={`${Math.round(completion)} % des rendez-vous terminés`} className="h-full w-full overflow-visible" role="img" viewBox="0 0 220 120">
          <path d="M25 100a85 85 0 0 1 170 0" fill="none" pathLength="100" stroke="#e7eef7" strokeLinecap="round" strokeWidth="15" />
          <path d="M25 100a85 85 0 0 1 170 0" fill="none" pathLength="100" stroke="url(#appointment-gradient)" strokeDasharray={`${completion} ${100 - completion}`} strokeLinecap="round" strokeWidth="15" />
          <defs><linearGradient id="appointment-gradient"><stop stopColor="#57c6ff" /><stop offset="1" stopColor="#1671ee" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <strong className="metric-number block text-4xl font-extrabold tracking-[-0.05em] text-[var(--navy)]">{total}</strong>
          <span className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">Rendez-vous</span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <SmallStat label="Terminés" value={dashboard.appointments.completed} />
        <SmallStat label="À venir" value={dashboard.appointments.scheduled} />
      </div>
    </Card>
  );
}

function CabinetBalance({ dashboard }: { dashboard: MainDashboard }) {
  const active = dashboard.patients.active;
  const activity = active > 0 ? 100 : 0;
  return (
    <Card className="min-h-[304px] xl:col-span-4">
      <CardHeading title="Équilibre du cabinet" subtitle="Activité clinique en un regard" />
      <div className="mt-7 grid items-center gap-5 sm:grid-cols-[1fr_1.05fr]">
        <div className="grid gap-3">
          <InsetMetric label="Rappels à traiter" value={dashboard.reminderCount} />
          <InsetMetric label="Soins suivis" value={dashboard.treatments.reduce((sum, item) => sum + item.count, 0)} />
        </div>
        <div className="relative mx-auto size-40">
          <svg aria-hidden="true" className="size-full -rotate-[130deg]" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" pathLength="100" r="47" stroke="#eaf1f8" strokeDasharray="78 22" strokeLinecap="round" strokeWidth="10" />
            <circle cx="60" cy="60" fill="none" pathLength="100" r="47" stroke="var(--aqua)" strokeDasharray={`${activity * 0.78} ${100 - activity * 0.78}`} strokeLinecap="round" strokeWidth="10" />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center"><div><span className="text-[10px] font-semibold text-slate-500">Patients actifs</span><strong className="metric-number block text-3xl font-extrabold tracking-tight text-[var(--navy)]">{compactNumber.format(active)}</strong><span className="text-[10px] text-slate-400">dossiers suivis</span></div></div>
        </div>
      </div>
    </Card>
  );
}

function InsetMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[16px] border border-white/80 bg-white/62 px-4 py-3 shadow-[inset_0_1px_0_white,0_9px_24px_rgba(25,93,160,0.06)]"><p className="text-[11px] text-slate-500">{label}</p><p className="metric-number mt-1 text-xl font-extrabold text-[var(--navy)]">{value}</p></div>;
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[13px] bg-[var(--vision-inset)] px-3 py-2.5"><p className="text-slate-500">{label}</p><p className="metric-number mt-1 font-extrabold text-[var(--navy)]">{value}</p></div>;
}

function CashflowCard({ dashboard, period }: { dashboard: AccountingDashboard; period: DashboardPeriodKey }) {
  return (
    <Card className="overflow-hidden xl:col-span-8">
      <CardHeading
        title="Flux financier"
        subtitle={`Production et encaissements · ${periodLabels[period].toLowerCase()}`}
        action={<PeriodNavigation period={period} />}
      />
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <Metric label="Production" value={formatDashboardMoney(dashboard.production)} tone="blue" />
        <Metric label="Encaissements" value={formatDashboardMoney(dashboard.received)} tone="aqua" />
        <Metric label="Solde de période" value={formatDashboardMoney(dashboard.period_net)} />
      </div>
      <CashflowChart dashboard={dashboard} />
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

function CashflowChart({ dashboard }: { dashboard: AccountingDashboard }) {
  const points = dashboard.series;
  const width = 860;
  const height = 260;
  const inset = 16;
  const maximum = Math.max(1, ...points.flatMap((point) => [point.production, point.received]));
  const pathFor = (field: "production" | "received") => points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : inset + index * ((width - inset * 2) / (points.length - 1));
    const y = height - 30 - (point[field] / maximum) * (height - 58);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const hasActivity = points.some((point) => point.production > 0 || point.received > 0);
  const productionPath = pathFor("production");
  const receivedPath = pathFor("received");
  const areaPath = productionPath ? `${productionPath} L${width - inset},${height - 30} L${inset},${height - 30} Z` : "";
  return (
    <div className="relative mt-5 min-h-[260px]">
      <svg aria-label="Évolution de la production et des encaissements" className="h-[260px] w-full overflow-visible" role="img" viewBox={`0 0 ${width} ${height}`}>
        <title>Évolution financière</title>
        <desc>La courbe bleue représente la production, la courbe turquoise les encaissements.</desc>
        {[0.18, 0.38, 0.58, 0.78].map((ratio) => <line key={ratio} stroke="#b9d4ec" strokeDasharray="4 5" strokeOpacity=".6" x1="0" x2={width} y1={height * ratio} y2={height * ratio} />)}
        {hasActivity ? <><defs><linearGradient id="cash-area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#1d8cff" stopOpacity=".34" /><stop offset="1" stopColor="#1d8cff" stopOpacity="0" /></linearGradient></defs><path d={areaPath} fill="url(#cash-area)" /><path d={productionPath} fill="none" stroke="var(--blue)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" /><path d={receivedPath} fill="none" stroke="var(--aqua)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" /></> : <><path d={`M${inset},190 C130,80 210,230 330,132 S540,210 650,104 S770,184 ${width - inset},94`} fill="none" stroke="var(--blue)" strokeLinecap="round" strokeOpacity=".2" strokeWidth="3" /><path d={`M${inset},220 C120,174 240,202 340,180 S540,225 650,178 S780,220 ${width - inset},188`} fill="none" stroke="var(--aqua)" strokeLinecap="round" strokeOpacity=".24" strokeWidth="3" /></>}
      </svg>
      {!hasActivity ? <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="rounded-2xl border border-white bg-white/82 px-5 py-3 text-center shadow-[0_12px_32px_rgba(28,98,168,0.1)] backdrop-blur"><p className="text-sm font-bold text-[var(--navy)]">Aucune activité sur cette période</p><p className="mt-1 text-[11px] text-slate-500">La structure du graphique reste visible sans données fictives.</p></div></div> : null}
      <div className="absolute right-0 bottom-0 flex items-center gap-5 text-[11px] font-semibold text-slate-500"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[var(--blue)]" />Production</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[var(--aqua)]" />Encaissements</span></div>
    </div>
  );
}

function ClinicActivity({ dashboard, financial }: { dashboard: MainDashboard; financial?: AccountingDashboard }) {
  const bars = financial?.series.slice(-9).map((point) => Math.max(point.production, point.received)) ?? [dashboard.appointments.completed, dashboard.appointments.scheduled, dashboard.appointments.cancelled, dashboard.appointments.noShow];
  const maximum = Math.max(1, ...bars);
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
    <Card className="xl:col-span-4">
      <div className="rounded-[17px] border border-white/80 bg-white/56 px-4 py-5 shadow-inner">
        <div aria-label="Mini graphique de l’activité" className="flex h-32 items-end justify-between gap-2">
          {bars.map((value, index) => <span className="w-full max-w-3 rounded-full bg-[linear-gradient(180deg,#57c6ff,#1776ee)] shadow-[0_4px_10px_rgba(23,118,238,0.15)]" key={index} style={{ height: `${Math.max(10, value / maximum * 100)}%` }} />)}
        </div>
      </div>
      <div className="mt-5"><CardHeading title="Activité du cabinet" subtitle="Indicateurs issus des données réelles" /></div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
        {items.map((item) => <div key={item.label}><span className="grid size-7 place-items-center rounded-lg bg-[var(--blue)] text-white"><AppIcon className="size-3.5" name={item.icon} /></span><p className="mt-2 text-[10px] text-slate-500">{item.label}</p><p className="metric-number mt-0.5 text-lg font-extrabold text-[var(--navy)]">{compactNumber.format(item.value)}</p><div className="mt-2 h-0.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full w-2/3 rounded-full bg-[var(--blue)]" /></div></div>)}
      </div>
    </Card>
  );
}

function UpcomingAppointments({ items }: { items: DashboardAppointment[] }) {
  return <Card className="xl:col-span-8"><CardHeading title="Prochains rendez-vous" subtitle="À venir dans le planning" />{items.length ? <AppointmentMiniList items={items.slice(0, 6)} showDay /> : <EmptyState text="Aucun rendez-vous à venir." />}</Card>;
}

function TodayAppointments({ dashboard }: { dashboard: MainDashboard }) {
  return (
    <Card className="xl:col-span-8">
      <CardHeading title="Planning d’aujourd’hui" subtitle="Patients, horaires et statut" action={<Link className="inline-flex min-h-11 items-center text-[11px] font-bold text-[var(--blue-deep)] hover:underline" href={`/appointments?date=${dashboard.clinicDate}`}>Tout afficher</Link>} />
      <div className="mt-6 hidden grid-cols-[110px_minmax(0,1fr)_100px] border-b border-blue-100/80 pb-2 text-[9px] font-bold tracking-[0.1em] text-slate-400 uppercase sm:grid"><span>Heure</span><span>Patient et motif</span><span>Statut</span></div>
      {dashboard.appointments.today.length ? <AppointmentMiniList items={dashboard.appointments.today} table /> : <EmptyState actionHref={`/appointments?date=${dashboard.clinicDate}`} actionLabel="Ouvrir le planning" text="Aucun rendez-vous programmé aujourd’hui." />}
    </Card>
  );
}

function OperationsTimeline({ dashboard, financial }: { dashboard: MainDashboard; financial?: AccountingDashboard }) {
  return (
    <Card className="xl:col-span-4">
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "blue" | "aqua" }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--muted)]">{label}</p><p className={`metric-number mt-1 break-words text-lg font-extrabold ${tone === "blue" ? "text-[var(--blue-deep)]" : tone === "aqua" ? "text-[#008f9f]" : "text-[var(--navy)]"}`}>{value}</p></div>;
}

function EmptyState({ text, actionHref, actionLabel }: { text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="mt-5 flex min-h-[210px] items-center justify-center rounded-[16px] border border-dashed border-blue-200 bg-white/45 px-4 py-8 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-[var(--blue)] text-white shadow-[0_7px_16px_rgba(23,113,238,0.2)]"><AppIcon className="size-5" name="calendar" /></span><p className="mt-3 text-sm font-semibold text-slate-600">{text}</p>{actionHref && actionLabel ? <Link className="mt-3 inline-flex text-xs font-bold text-[var(--blue-deep)] hover:underline" href={actionHref}>{actionLabel}</Link> : null}</div></div>;
}
