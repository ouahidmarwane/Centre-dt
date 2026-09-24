"use client";

import { useActionState, useState } from "react";

import type { TreatmentPlanActionState } from "@/app/(dashboard)/patients/[id]/treatment-plan-actions";
import { FormField } from "@/components/ui/form-field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Badge, chipClass, Composer, DangerDisclosure, dangerLink, EmptyNote, fieldClass, FormMessage, ghostButton, PanelHeading, panelClass, primaryButton, ReadOnlyNote, type Tone } from "@/components/ui/panel-ui";
import { submitKeepingValues } from "@/components/ui/submit-keeping-values";
import type { TreatmentPlanView } from "@/lib/treatment-plans/data";
import { MAX_TREATMENT_STEPS, remainingToPay, treatmentCategories, treatmentCategoryLabels, treatmentStatusLabels, type TreatmentPlanStatus } from "@/lib/treatment-plans/validation";

type Action = (state: TreatmentPlanActionState, formData: FormData) => Promise<TreatmentPlanActionState>;
type Props = {
  plans: TreatmentPlanView[];
  outstanding: number;
  patientActive: boolean;
  canWrite: boolean;
  canProgress: boolean;
  planToken: string;
  stepTokens: Record<string, string>;
  today: string;
  createAction: Action;
  acceptAction: (planId: string) => Promise<void>;
  completeAction: (stepId: string, state: TreatmentPlanActionState, formData: FormData) => Promise<TreatmentPlanActionState>;
  cancelAction: (planId: string, state: TreatmentPlanActionState, formData: FormData) => Promise<TreatmentPlanActionState>;
};

const initial: TreatmentPlanActionState = { success: false, message: null, fieldErrors: {} };
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const statusTones: Record<TreatmentPlanStatus, Tone> = { proposed: "amber", accepted: "blue", completed: "green", cancelled: "slate" };

export function PatientTreatmentPlans(props: Props) {
  const total = remainingToPay(props.outstanding, props.plans);
  const future = total - props.outstanding;
  const active = props.plans.filter((plan) => plan.status === "proposed" || plan.status === "accepted").length;
  return (
    <section aria-labelledby="treatment-plans-title" className={`mt-6 ${panelClass} p-5 sm:p-7`}>
      <PanelHeading id="treatment-plans-title" subtitle="Soins en plusieurs séances : devis, avancement et reste à payer." title="Plans de traitement" action={<Badge tone={active ? "blue" : "slate"}>{active} en cours</Badge>} />

      {props.plans.some((plan) => plan.status === "accepted") || props.outstanding > 0 ? (
        <div className="mt-5 grid gap-3 rounded-[16px] bg-[#f5f9fd] p-4 sm:grid-cols-3">
          <Figure label="Reste à payer au total" strong value={total} />
          <Figure label="Déjà facturé, non réglé" value={props.outstanding} />
          <Figure label="Séances à venir (devis acceptés)" value={future} />
        </div>
      ) : null}

      <ul className="mt-5 space-y-4">
        {props.plans.map((plan) => <PlanCard key={plan.id} plan={plan} {...props} />)}
      </ul>
      {!props.plans.length ? <div className="mt-4"><EmptyNote text="Aucun plan de traitement pour ce patient." /></div> : null}

      {!props.patientActive ? <ReadOnlyNote text="Lecture seule : dossier patient archivé." />
        : props.canWrite ? <Composer label="Nouveau plan de traitement"><PlanForm action={props.createAction} key={props.planToken} token={props.planToken} /></Composer>
          : null}
    </section>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div><p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</p><p className={`metric-number mt-1 ${strong ? "text-xl font-bold text-[#b4541a]" : "text-base font-semibold text-[var(--navy)]"}`}>{money.format(value)}</p></div>;
}

function PlanCard({ plan, patientActive, canWrite, canProgress, stepTokens, today, acceptAction, completeAction, cancelAction }: Props & { plan: TreatmentPlanView }) {
  const { summary } = plan;
  const progress = summary.stepsTotal ? Math.round((summary.stepsDone / summary.stepsTotal) * 100) : 0;
  const nextStepId = plan.steps.find((step) => !step.done)?.id;
  return (
    <li className="overflow-hidden rounded-[16px] border border-[#e3ebf3] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--navy)]">{plan.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{treatmentCategoryLabels[plan.category]} · créé le {shortDate.format(new Date(plan.createdAt))}{plan.acceptedAt ? ` · devis accepté le ${shortDate.format(new Date(plan.acceptedAt))}` : ""}</p>
        </div>
        <Badge tone={statusTones[plan.status]}>{treatmentStatusLabels[plan.status]}</Badge>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y border-[#eef3f8] bg-[#fafcfe] px-4 py-3 sm:px-5">
        <div><dt className="text-[11px] text-slate-500">Devis</dt><dd className="metric-number text-sm font-semibold text-[var(--navy)]">{money.format(summary.quote)}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Réalisé</dt><dd className="metric-number text-sm font-semibold text-[#0e7c6d]">{money.format(summary.realised)}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Reste à réaliser</dt><dd className="metric-number text-sm font-semibold text-[var(--navy)]">{money.format(summary.toRealise)}</dd></div>
      </dl>

      <div className="px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full rounded-full bg-[#19a996] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
          <p className="text-xs font-semibold text-slate-600">{summary.stepsDone}/{summary.stepsTotal} séance{summary.stepsTotal > 1 ? "s" : ""}</p>
        </div>

        <ol className="mt-3 space-y-1.5">
          {plan.steps.map((step) => (
            <li className="rounded-[12px] px-2 py-2" key={step.id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${step.done ? "bg-[#19a996] text-white" : "bg-[#eef3f8] text-slate-500"}`}>{step.done ? "✓" : step.position}</span>
                <span className={`min-w-0 flex-1 text-sm ${step.done ? "text-slate-500" : "font-medium text-[var(--navy)]"}`}>
                  {step.label}
                  <span className="ml-2 text-xs text-slate-400">{step.done && step.completedAt ? `réalisée le ${shortDate.format(new Date(step.completedAt))}` : step.plannedDate ? `prévue le ${shortDate.format(new Date(`${step.plannedDate}T00:00:00Z`))}` : ""}</span>
                </span>
                <span className="metric-number text-sm font-semibold text-slate-700">{money.format(step.amount)}</span>
              </div>
              {patientActive && canProgress && !step.done && (plan.status === "accepted" || plan.status === "completed") && step.id === nextStepId ? (
                <CompleteStepForm action={completeAction.bind(null, step.id)} label={step.label} today={today} token={stepTokens[step.id]} />
              ) : null}
            </li>
          ))}
        </ol>

        {plan.notes ? <p className="mt-2 border-l-2 border-[#dbe6f1] pl-2.5 text-xs leading-5 text-slate-500">{plan.notes}</p> : null}
        {plan.status === "cancelled" && plan.cancellationReason ? <p className="mt-2 text-xs text-slate-500">Motif d’annulation : {plan.cancellationReason}</p> : null}

        {patientActive && (plan.status === "proposed" || plan.status === "accepted") ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef3f8] pt-3">
            {plan.status === "proposed" && canProgress ? (
              <form action={acceptAction.bind(null, plan.id)} onSubmit={(event) => { if (!confirm(`Le patient accepte le devis de ${money.format(summary.quote)} ?`)) event.preventDefault(); }}>
                <PendingSubmitButton className={`${primaryButton} min-h-10 px-4`} pendingLabel="Enregistrement…">Le patient accepte le devis</PendingSubmitButton>
              </form>
            ) : <span />}
            {canWrite ? <DangerDisclosure label="Annuler le plan"><CancelPlanForm action={cancelAction.bind(null, plan.id)} /></DangerDisclosure> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function CompleteStepForm({ action, label, today, token }: { action: Action; label: string; today: string; token: string }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="mt-2 ml-9 flex flex-wrap items-end gap-2" onSubmit={(event) => { if (!confirm(`Valider la séance « ${label} » ? Le montant sera ajouté au compte du patient.`)) event.preventDefault(); }}>
      <input name="idempotencyKey" type="hidden" value={token} />
      <label className="text-xs font-medium text-slate-600">Date de la séance<input className={`${fieldClass} mt-1 min-h-10 w-40 py-1.5`} defaultValue={today} max={today} name="performedAt" required type="date" /></label>
      <PendingSubmitButton className={`${ghostButton} min-h-10 border-[#19a996] text-[#0e7c6d] hover:border-[#0e7c6d] hover:text-[#0e7c6d]`} pendingLabel="Validation…">✓ Valider cette séance</PendingSubmitButton>
      {state.message && !state.success ? <p className="w-full text-xs text-red-700" role="alert">{state.message}</p> : null}
    </form>
  );
}

function CancelPlanForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-2">
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.reason} label="Motif d’annulation">
        <input className={fieldClass} maxLength={500} minLength={5} name="reason" placeholder="Ex. Le patient renonce au traitement" required />
      </FormField>
      <p className="text-xs text-slate-500">Les séances déjà réalisées restent facturées.</p>
      <button className={`${dangerLink} w-fit border border-red-200 bg-white`} disabled={pending} type="submit">{pending ? "Annulation…" : "Confirmer l’annulation du plan"}</button>
      <FormMessage state={state} />
    </form>
  );
}

function PlanForm({ action, token }: { action: Action; token: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState(() => [0, 1]);
  const [nextRow, setNextRow] = useState(2);
  const [quote, setQuote] = useState(0);

  function recompute(form: HTMLFormElement) {
    const cents = new FormData(form).getAll("stepAmount").reduce<number>((sum, value) => {
      const amount = Number(String(value).replace(",", "."));
      return sum + (Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0);
    }, 0);
    setQuote(cents / 100);
  }

  return (
    <form action={formAction} className="grid gap-4" onInput={(event) => recompute(event.currentTarget)} onSubmit={submitKeepingValues(formAction)}>
      <input name="idempotencyKey" type="hidden" value={token} />
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.title} label="Titre du plan">
        <input className={fieldClass} maxLength={120} name="title" placeholder="Ex. Implant 36, Orthodontie adulte" required />
      </FormField>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Spécialité</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{treatmentCategories.map((category) => <label className={chipClass} key={category}><input className="sr-only" defaultChecked={category === "implant"} name="category" type="radio" value={category} />{treatmentCategoryLabels[category]}</label>)}</div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Séances prévues (le devis est la somme des séances)</legend>
        <div className="mt-2 space-y-2">
          {rows.map((row, index) => (
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_7.5rem_9.5rem_2rem] items-center gap-2 max-sm:grid-cols-[1.5rem_minmax(0,1fr)_2rem] max-sm:[&>input:nth-of-type(n+2)]:col-start-2" key={row}>
              <span className="text-center text-xs font-bold text-slate-400">{index + 1}</span>
              <input aria-label={`Séance ${index + 1} : libellé`} className={`${fieldClass} mt-0`} maxLength={120} name="stepLabel" placeholder="Ex. Pose de l’implant" />
              <input aria-label={`Séance ${index + 1} : montant en MAD`} className={`${fieldClass} mt-0 text-right tabular-nums`} inputMode="decimal" name="stepAmount" placeholder="MAD" />
              <input aria-label={`Séance ${index + 1} : date prévue (facultative)`} className={`${fieldClass} mt-0`} name="stepDate" type="date" />
              <button aria-label={`Retirer la séance ${index + 1}`} className="grid size-8 place-items-center rounded-[9px] text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30" disabled={rows.length === 1} onClick={(event) => { const form = event.currentTarget.form; setRows((current) => current.filter((value) => value !== row)); if (form) window.setTimeout(() => recompute(form), 0); }} type="button">×</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button className={ghostButton} disabled={rows.length >= MAX_TREATMENT_STEPS} onClick={() => { setRows((current) => [...current, nextRow]); setNextRow((value) => value + 1); }} type="button">+ Ajouter une séance</button>
          <p className="text-sm text-slate-600">Devis total : <strong className="metric-number text-[var(--navy)]">{money.format(quote)}</strong></p>
        </div>
        {state.fieldErrors.steps ? <p className="mt-1 text-xs text-red-700" role="alert">{state.fieldErrors.steps}</p> : null}
      </fieldset>

      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.notes} label="Notes (facultatif)">
        <textarea className={fieldClass} maxLength={2000} name="notes" placeholder="Ex. Greffe osseuse à prévoir selon le scanner" rows={2} />
      </FormField>
      <FormMessage state={state} />
      <button className={primaryButton} disabled={pending} type="submit">{pending ? "Enregistrement…" : "Enregistrer le plan et le devis"}</button>
    </form>
  );
}
