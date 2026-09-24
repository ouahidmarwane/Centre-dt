"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AppointmentActionState } from "@/app/(dashboard)/appointments/actions";
import { SpotlightSurface } from "@/components/dashboard/spotlight-surface";
import { WhatsAppGlyph } from "@/components/patients/patient-list";
import { FormField } from "@/components/ui/form-field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Badge, chipClass, Composer, EmptyNote, fieldClass, FormMessage, panelClass, primaryButton } from "@/components/ui/panel-ui";
import { submitKeepingValues } from "@/components/ui/submit-keeping-values";
import type { PatientOption } from "@/lib/appointments/data";
import { formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import type { FreedSlotSuggestion } from "@/lib/waitlist/data";
import { bookingTokenKey, waitlistDurations, waitlistPeriodLabels, waitlistPeriods, type WaitlistEntry } from "@/lib/waitlist/validation";

type Action = (state: AppointmentActionState, formData: FormData) => Promise<AppointmentActionState>;
type Props = {
  entries: WaitlistEntry[];
  freedSlots: FreedSlotSuggestion[];
  patients: PatientOption[];
  bookingTokens: Record<string, string>;
  formToken: string;
  addAction: Action;
  removeAction: (entryId: string) => Promise<void>;
  bookAction: (entryId: string, startsAt: string, state: AppointmentActionState, formData: FormData) => Promise<AppointmentActionState>;
};

const initial: AppointmentActionState = { success: false, message: null, fieldErrors: {} };
const durationLabel = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}` : `${minutes} min`);

export function WaitlistPanel(props: Props) {
  return (
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
      <FreedSlots {...props} />
      <Waitlist {...props} />
    </div>
  );
}

function FreedSlots({ freedSlots, bookingTokens, bookAction }: Props) {
  return (
    <SpotlightSurface className={`kpi-rise relative ${panelClass}`} texture="calendar">
      <section aria-labelledby="freed-slots-title" className="p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="freed-slots-title">Créneaux libérés</h2>
        <p className="mt-0.5 text-xs text-slate-500">Rendez-vous annulés des 14 prochains jours, avec les patients en attente qui correspondent.</p>
        {freedSlots.length ? (
          <ul className="rise-list mt-4 space-y-3">
            {freedSlots.map((slot) => (
              <li className="rounded-[14px] border border-[#e3ebf3] bg-white p-4" key={slot.startsAt}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--navy)] first-letter:uppercase">{formatClinicDate(slot.startsAt)}</p>
                  <p className="metric-number text-sm font-semibold text-[var(--blue-deep)]">{formatClinicTime(slot.startsAt)} – {formatClinicTime(slot.endsAt)}</p>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">Libéré par l’annulation : {slot.cancelledTitle}</p>
                {slot.candidates.length ? (
                  <ul className="mt-3 space-y-2">
                    {slot.candidates.map((candidate) => (
                      <Candidate bookAction={bookAction.bind(null, candidate.id, slot.startsAt)} candidate={candidate} key={candidate.id} token={bookingTokens[bookingTokenKey(slot.startsAt, candidate.id)]} />
                    ))}
                  </ul>
                ) : <p className="mt-3 text-xs text-slate-500">Aucun patient en attente ne correspond à ce créneau (durée ou préférence horaire).</p>}
              </li>
            ))}
          </ul>
        ) : <div className="mt-4"><EmptyNote text="Aucun créneau libéré à proposer pour le moment." /></div>}
      </section>
    </SpotlightSurface>
  );
}

function Candidate({ candidate, token, bookAction }: { candidate: FreedSlotSuggestion["candidates"][number]; token: string; bookAction: Action }) {
  const [state, formAction] = useActionState(bookAction, initial);
  return (
    <li className="rounded-[12px] bg-[#f7fafd] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--blue-deep)]" href={`/patients/${candidate.patientId}`}>{candidate.patientName}</Link>
          <p className="text-xs text-slate-500">{candidate.reason} · {durationLabel(candidate.durationMinutes)}{candidate.isUrgent ? " · " : ""}{candidate.isUrgent ? <span className="font-semibold text-red-700">Urgent</span> : null}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.whatsappUrl ? (
            <a className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] bg-[#128c7e] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0d7166]" href={candidate.whatsappUrl} rel="noopener noreferrer" target="_blank" title="Ouvre WhatsApp avec la proposition de créneau déjà écrite"><WhatsAppGlyph className="size-3.5" />Proposer</a>
          ) : <Link className="inline-flex min-h-9 items-center rounded-[9px] bg-amber-50 px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset" href={`/patients/${candidate.patientId}/edit`}>Numéro à corriger</Link>}
          <form action={formAction} onSubmit={(event) => { if (!confirm(`Réserver ce créneau pour ${candidate.patientName} ?`)) event.preventDefault(); }}>
            <input name="idempotencyKey" type="hidden" value={token} />
            <PendingSubmitButton className="inline-flex min-h-9 items-center rounded-[9px] bg-[var(--brand)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] disabled:opacity-60" pendingLabel="Réservation…">Réserver</PendingSubmitButton>
          </form>
        </div>
      </div>
      {state.message && !state.success ? <p className="mt-2 text-xs text-red-700" role="alert">{state.message}</p> : null}
    </li>
  );
}

function Waitlist({ entries, patients, formToken, addAction, removeAction }: Props) {
  return (
    <SpotlightSurface className={`kpi-rise relative ${panelClass}`} texture="people">
      <section aria-labelledby="waitlist-title" className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="waitlist-title">Liste d’attente</h2>
            <p className="mt-0.5 text-xs text-slate-500">Patients qui souhaitent un rendez-vous plus tôt. Les urgents passent en premier.</p>
          </div>
          <Badge tone={entries.length ? "blue" : "slate"}>{entries.length} en attente</Badge>
        </div>
        {entries.length ? (
          <ul className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#e3ebf3] bg-white px-3.5 py-2.5" key={entry.id}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                    <Link className="hover:text-[var(--blue-deep)]" href={`/patients/${entry.patientId}`}>{entry.patientName}</Link>
                    {entry.isUrgent ? <Badge tone="red">Urgent</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">{entry.reason} · {durationLabel(entry.durationMinutes)} · {waitlistPeriodLabels[entry.preferredPeriod]} · depuis le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(entry.createdAt))}</p>
                  {entry.notes ? <p className="mt-0.5 text-xs text-slate-400">{entry.notes}</p> : null}
                </div>
                <form action={removeAction.bind(null, entry.id)} onSubmit={(event) => { if (!confirm(`Retirer ${entry.patientName} de la liste d’attente ?`)) event.preventDefault(); }}>
                  <PendingSubmitButton className="inline-flex min-h-9 items-center rounded-[9px] px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60" pendingLabel="…">Retirer</PendingSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : <div className="mt-4"><EmptyNote text="Personne n’attend un créneau pour le moment." /></div>}
        <Composer label="Ajouter un patient à la liste d’attente">
          <AddForm action={addAction} key={formToken} patients={patients} waitingIds={entries.map((entry) => entry.patientId)} />
        </Composer>
      </section>
    </SpotlightSurface>
  );
}

function AddForm({ action, patients, waitingIds }: { action: Action; patients: PatientOption[]; waitingIds: string[] }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const available = patients.filter((patient) => !waitingIds.includes(patient.id));
  return (
    <form action={formAction} className="grid gap-3" onSubmit={submitKeepingValues(formAction)}>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.patientId} label="Patient">
        <select className={fieldClass} defaultValue="" name="patientId" required><option disabled value="">Choisir le patient…</option>{available.map((patient) => <option key={patient.id} value={patient.id}>{patient.last_name} {patient.first_name}</option>)}</select>
      </FormField>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.reason} label="Motif">
        <input className={fieldClass} maxLength={160} name="reason" placeholder="Ex. Détartrage, douleur…" required />
      </FormField>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Préférence horaire</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{waitlistPeriods.map((period) => <label className={chipClass} key={period}><input className="sr-only" defaultChecked={period === "any"} name="preferredPeriod" type="radio" value={period} />{waitlistPeriodLabels[period]}</label>)}</div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Durée nécessaire</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{waitlistDurations.map((minutes) => <label className={chipClass} key={minutes}><input className="sr-only" defaultChecked={minutes === 30} name="durationMinutes" type="radio" value={minutes} />{durationLabel(minutes)}</label>)}</div>
        {state.fieldErrors.durationMinutes ? <p className="mt-1 text-xs text-red-700">{state.fieldErrors.durationMinutes}</p> : null}
      </fieldset>
      <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input className="size-4 accent-red-600" name="isUrgent" type="checkbox" />Urgent (passe en premier)</label>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.notes} label="Note (facultatif)">
        <input className={fieldClass} maxLength={1000} name="notes" placeholder="Ex. Disponible uniquement le samedi" />
      </FormField>
      <FormMessage state={state} />
      <button className={primaryButton} disabled={pending || !available.length} type="submit">{pending ? "Enregistrement…" : "Ajouter à la liste d’attente"}</button>
    </form>
  );
}
