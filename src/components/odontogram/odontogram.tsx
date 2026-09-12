"use client";

import { useActionState, useState } from "react";

import type { DentalActionState } from "@/app/(dashboard)/patients/[id]/odontogram-actions";
import type { DentalFinding, DentalRevision } from "@/lib/odontogram/data";
import {
  conditionLabels,
  dentalConditions,
  editableDentalStatuses,
  statusLabels,
  toothQuadrants,
  type DentalStatus,
  type PermanentTooth,
} from "@/lib/odontogram/validation";
import type { AppRole } from "@/lib/permissions";

type Props = {
  patientActive: boolean;
  role: AppRole;
  findings: DentalFinding[];
  revisions: DentalRevision[];
  createAction: (state: DentalActionState, formData: FormData) => Promise<DentalActionState>;
  updateAction: (findingId: string, state: DentalActionState, formData: FormData) => Promise<DentalActionState>;
  resolveAction: (findingId: string) => Promise<void>;
};

const initialState: DentalActionState = { success: false, message: null, fieldErrors: {} };
const eventLabels = { created: "Créée", updated: "Modifiée", status_changed: "Statut modifié", resolved: "Résolue" } as const;
const statusCodes: Record<DentalStatus, string> = { untreated: "NT", monitoring: "SURV", treated: "TR", resolved: "RÉS" };

export function Odontogram({ patientActive, role, findings, revisions, createAction, updateAction, resolveAction }: Props) {
  const initialTooth = (findings[0]?.tooth_number ?? 16) as PermanentTooth;
  const [selectedTooth, setSelectedTooth] = useState<PermanentTooth>(initialTooth);
  const selectedFindings = findings.filter((finding) => finding.tooth_number === selectedTooth);
  const selectedHistory = revisions.filter((revision) => revision.tooth_number === selectedTooth);

  return (
    <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6" aria-labelledby="odontogram-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-slate-900" id="odontogram-title">Odontogramme</h2><p className="mt-1 text-sm text-[var(--muted)]">Dentition permanente · numérotation FDI</p></div>
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-strong)]">{findings.length} constatation{findings.length === 1 ? "" : "s"} active{findings.length === 1 ? "" : "s"}</span>
      </div>
      {!patientActive ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Lecture seule : ce dossier patient est archivé.</p> : null}

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="mx-auto grid min-w-[720px] gap-4" aria-label="Arcades dentaires">
          <DentalRow quadrants={[toothQuadrants[0], toothQuadrants[1]]} selected={selectedTooth} findings={findings} onSelect={setSelectedTooth} />
          <div className="mx-auto h-px w-3/4 bg-slate-200" />
          <DentalRow quadrants={[toothQuadrants[2], toothQuadrants[3]]} selected={selectedTooth} findings={findings} onSelect={setSelectedTooth} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-[var(--border)] pt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <div>
          <h3 className="font-semibold text-slate-900">Dent {selectedTooth}</h3>
          <div className="mt-4 space-y-4">
            {selectedFindings.map((finding) => (
              <FindingEditor key={finding.id} finding={finding} patientActive={patientActive} role={role} updateAction={updateAction.bind(null, finding.id)} resolveAction={resolveAction.bind(null, finding.id)} />
            ))}
            {selectedFindings.length === 0 ? <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">Aucune constatation active pour cette dent.</p> : null}
          </div>
          {patientActive ? <NewFindingForm key={selectedTooth} tooth={selectedTooth} role={role} action={createAction} /> : null}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Historique clinique</h3>
          <ol className="mt-4 space-y-3">
            {selectedHistory.map((revision) => (
              <li className="border-l-2 border-teal-200 pl-3 text-sm" key={revision.id}>
                <p className="font-medium text-slate-800">{eventLabels[revision.event_type]} · {conditionLabels[revision.condition]}</p>
                <p className="text-[var(--muted)]">{statusLabels[revision.status]} · {revision.changed_by_role === "doctor" ? "Médecin" : "Assistant"}</p>
                <time className="text-xs text-slate-500" dateTime={revision.changed_at}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.changed_at))}</time>
              </li>
            ))}
            {selectedHistory.length === 0 ? <li className="text-sm text-[var(--muted)]">Aucun historique pour cette dent.</li> : null}
          </ol>
        </div>
      </div>
    </section>
  );
}

function DentalRow({ quadrants, selected, findings, onSelect }: { quadrants: readonly [readonly PermanentTooth[], readonly PermanentTooth[]]; selected: PermanentTooth; findings: DentalFinding[]; onSelect: (tooth: PermanentTooth) => void }) {
  return <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3"><div className="flex justify-end gap-1.5">{quadrants[0].map(renderTooth)}</div><span aria-hidden="true" className="mb-7 h-10 w-px bg-slate-300" /><div className="flex gap-1.5">{quadrants[1].map(renderTooth)}</div></div>;
  function renderTooth(tooth: PermanentTooth) {
    const toothFindings = findings.filter((finding) => finding.tooth_number === tooth);
    const statuses = [...new Set(toothFindings.map((finding) => statusLabels[finding.status]))];
    const codes = [...new Set(toothFindings.map((finding) => statusCodes[finding.status]))];
    const label = `Dent ${tooth}${toothFindings.length ? ` — ${toothFindings.length} constatation(s) — ${statuses.join(", ")}` : " — aucune constatation"}`;
    return <button aria-label={label} aria-pressed={selected === tooth} className={`group flex w-10 flex-col items-center gap-1 rounded-md px-0.5 py-1 transition ${selected === tooth ? "bg-[var(--brand-soft)]" : "hover:bg-slate-50"}`} key={tooth} onClick={() => onSelect(tooth)} type="button"><span className={`relative h-12 w-8 rounded-[45%_45%_35%_35%] border-2 ${toothFindings.length ? "border-amber-500 bg-amber-50" : "border-slate-300 bg-white"}`} aria-hidden="true">{toothFindings.length ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">{toothFindings.length}</span> : null}</span><span className="text-xs font-semibold text-slate-700">{tooth}</span><span className="h-3 text-[8px] font-bold tracking-tight text-slate-600" aria-hidden="true">{codes.join("/")}</span></button>;
  }
}

function NewFindingForm({ tooth, role, action }: { tooth: PermanentTooth; role: AppRole; action: Props["createAction"] }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4"><h4 className="text-sm font-semibold text-slate-900">Ajouter une constatation</h4><input name="toothNumber" type="hidden" value={tooth} /><FindingFields role={role} state={state} /><ActionMessage state={state} /><button className="mt-4 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Enregistrement…" : "Ajouter"}</button></form>;
}

function FindingEditor({ finding, patientActive, role, updateAction, resolveAction }: { finding: DentalFinding; patientActive: boolean; role: AppRole; updateAction: (state: DentalActionState, formData: FormData) => Promise<DentalActionState>; resolveAction: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  if (!patientActive) return <article className="rounded-md border border-slate-200 p-4"><p className="font-medium">{conditionLabels[finding.condition]} · {statusLabels[finding.status]}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{finding.notes ?? "Aucune note."}</p>{finding.recommendation ? <p className="mt-2 text-sm text-slate-600">Recommandation : {finding.recommendation}</p> : null}</article>;
  return <form action={formAction} className="rounded-md border border-slate-200 p-4"><input name="toothNumber" type="hidden" value={finding.tooth_number} /><FindingFields finding={finding} role={role} state={state} /><ActionMessage state={state} /><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-md border border-[var(--brand)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)] disabled:opacity-60" disabled={pending} type="submit">{pending ? "Mise à jour…" : "Mettre à jour"}</button>{role === "doctor" ? <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" formAction={resolveAction}>Marquer comme résolue</button> : null}</div></form>;
}

function FindingFields({ finding, role, state }: { finding?: DentalFinding; role: AppRole; state: DentalActionState }) {
  const statuses = role === "doctor" ? editableDentalStatuses : editableDentalStatuses.filter((status) => status !== "treated");
  const inputClass = "mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm";
  return <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">État<select className={inputClass} defaultValue={finding?.condition ?? "caries"} name="condition">{dentalConditions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}</select><FieldError value={state.fieldErrors.condition} /></label><label className="text-sm font-medium text-slate-700">Statut<select className={inputClass} defaultValue={finding?.status ?? "untreated"} name="status">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status as DentalStatus]}</option>)}</select><FieldError value={state.fieldErrors.status} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea className={inputClass} defaultValue={finding?.notes ?? ""} maxLength={4000} name="notes" rows={3} /><FieldError value={state.fieldErrors.notes} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Recommandation<textarea className={inputClass} defaultValue={finding?.recommendation ?? ""} maxLength={2000} name="recommendation" rows={2} /><FieldError value={state.fieldErrors.recommendation} /></label></div>;
}

function FieldError({ value }: { value?: string }) { return value ? <span className="mt-1 block text-sm text-red-700">{value}</span> : null; }
function ActionMessage({ state }: { state: DentalActionState }) { return state.message ? <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null; }
