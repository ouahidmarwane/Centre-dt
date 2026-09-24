import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import type { Metadata } from "next";
import Link from "next/link";

import { SpotlightSurface } from "@/components/dashboard/spotlight-surface";
import { WhatsAppGlyph } from "@/components/patients/patient-list";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Badge, EmptyNote, panelClass } from "@/components/ui/panel-ui";
import { clinicDateValue } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { formatDashboardMoney } from "@/lib/dashboard/presentation";
import { getPaymentFollowup, type PaymentFollowupItem } from "@/lib/payment-followup/data";
import { daysBetween, PAYMENT_GRACE_DAYS, PAYMENT_REMINDER_INTERVAL_DAYS, reminderRankLabel } from "@/lib/payment-followup/validation";
import { hasPermission } from "@/lib/permissions";

import { markPaymentReminderAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recouvrement" };

const shortDate = new ClinicDateTimeFormat("fr-FR", { dateStyle: "medium" });
const calendarDate = (value: string) => shortDate.format(new Date(`${value}T12:00:00Z`));

export default async function PaymentsFollowupPage() {
  const user = await requirePermission("payments.read");
  const items = await getPaymentFollowup();
  const today = clinicDateValue(new Date());
  const due = items.filter((item) => item.isDue);
  const total = items.reduce((sum, item) => sum + Math.round(item.outstanding * 100), 0) / 100;
  const canRemind = hasPermission(user.role, "payments.reminders");

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]" />Suivi des soldes patients</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-[2.4rem]">Recouvrement</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Une relance est proposée quand un solde reste impayé depuis {PAYMENT_GRACE_DAYS} jours, puis au plus tous les {PAYMENT_REMINDER_INTERVAL_DAYS} jours.</p>
      </header>

      <dl className="kpi-rise mt-5 grid gap-3 sm:grid-cols-3">
        <Kpi label="Reste à encaisser" value={formatDashboardMoney(total)} />
        <Kpi label="Patients avec un solde" value={String(items.length)} />
        <Kpi alert={due.length > 0} label="Relances à envoyer" value={String(due.length)} />
      </dl>

      <SpotlightSurface className={`kpi-rise relative mt-5 ${panelClass}`} texture="people">
        <section aria-labelledby="due-reminders-title" className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#e7f6f3] text-[#128c7e]"><WhatsAppGlyph className="size-5" /></span>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="due-reminders-title">Relances à envoyer</h2>
              <p className="mt-0.5 text-xs text-slate-500">Pour chaque patient : ouvrez WhatsApp, envoyez le message, puis confirmez ici.</p>
            </div>
          </div>
          {due.length ? (
            <ul className="rise-list mt-4 grid gap-2 md:grid-cols-2">
              {due.map((item) => <DueReminder canRemind={canRemind} item={item} key={item.patientId} today={today} />)}
            </ul>
          ) : <div className="mt-4"><EmptyNote text="Aucune relance à envoyer aujourd’hui." /></div>}
          {due.length ? <p className="mt-3 text-[11px] text-slate-400">Ouvrir WhatsApp ne suffit pas : la relance n’est enregistrée que lorsque vous cliquez sur « C’est envoyé ».</p> : null}
        </section>
      </SpotlightSurface>

      <section aria-labelledby="balances-title" className={`kpi-rise mt-5 ${panelClass} p-5 sm:p-6`}>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="balances-title">Tous les soldes en cours</h2>
        {items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                <tr><th className="py-2 pr-3" scope="col">Patient</th><th className="py-2 pr-3 text-right" scope="col">Solde</th><th className="py-2 pr-3" scope="col">Impayé depuis</th><th className="py-2 pr-3" scope="col">Dernier paiement</th><th className="py-2 pr-3" scope="col">Dernière relance</th><th className="py-2" scope="col">État</th></tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f8]">
                {items.map((item) => (
                  <tr key={item.patientId}>
                    <td className="py-2.5 pr-3"><Link className="font-semibold text-[var(--navy)] hover:text-[var(--blue-deep)]" href={`/patients/${item.patientId}`}>{item.name}</Link></td>
                    <td className="metric-number py-2.5 pr-3 text-right font-semibold text-[#b4541a]">{formatDashboardMoney(item.outstanding)}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{item.unpaidSince ? `${calendarDate(item.unpaidSince)} (${daysBetween(item.unpaidSince, today)} j)` : "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{item.lastPaymentAt ? shortDate.format(new Date(item.lastPaymentAt)) : "Aucun"}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{item.lastReminderAt ? `${shortDate.format(new Date(item.lastReminderAt))} · ${item.reminderCount} au total` : "Jamais"}</td>
                    <td className="py-2.5">{item.isDue ? <Badge tone="amber">À relancer</Badge> : <Badge tone="slate">En attente</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="mt-4"><EmptyNote text="Aucun solde en cours : tous les comptes patients sont soldés." /></div>}
      </section>
    </div>
  );
}

function Kpi({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`${panelClass} px-5 py-4`}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`metric-number mt-1 text-2xl font-semibold tracking-[-0.02em] ${alert ? "text-[#b4541a]" : "text-[var(--navy)]"}`}>{value}</dd></div>;
}

function DueReminder({ item, today, canRemind }: { item: PaymentFollowupItem; today: string; canRemind: boolean }) {
  return (
    <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link className="truncate text-sm font-semibold text-[var(--navy)] hover:text-[var(--blue-deep)]" href={`/patients/${item.patientId}`}>{item.name}</Link>
          <p className="mt-0.5 text-xs text-slate-500">{item.unpaidSince ? `Impayé depuis ${daysBetween(item.unpaidSince, today)} jours` : "Solde en cours"}{item.lastReminderAt ? ` · dernière relance le ${shortDate.format(new Date(item.lastReminderAt))}` : ""}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="metric-number text-sm font-semibold text-[#b4541a]">{formatDashboardMoney(item.outstanding)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#0f5fc5]">{reminderRankLabel(item.reminderCount)}</p>
        </div>
      </div>
      {canRemind ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.whatsappUrl
            ? <a className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#128c7e] px-3 text-xs font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0d7166]" href={item.whatsappUrl} rel="noopener noreferrer" target="_blank"><span className="grid size-4 place-items-center rounded-full bg-white/25 text-[10px]">1</span>Ouvrir WhatsApp</a>
            : <Link className="inline-flex min-h-10 items-center rounded-[10px] bg-amber-50 px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100" href={`/patients/${item.patientId}/edit`}>Numéro à corriger</Link>}
          <form action={markPaymentReminderAction.bind(null, item.patientId)}>
            <PendingSubmitButton className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#d6e3f0] bg-white px-3 text-xs font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] hover:text-[var(--blue-deep)] disabled:opacity-60" pendingLabel="Enregistrement…"><span className="grid size-4 place-items-center rounded-full bg-[#eef3f8] text-[10px]">2</span>C’est envoyé ✓</PendingSubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}
