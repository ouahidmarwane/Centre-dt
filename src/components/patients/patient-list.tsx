"use client";

import Link from "next/link";
import { useActionState } from "react";

import { searchPatientsAction, type PatientSearchState } from "@/app/(dashboard)/patients/actions";
import { calculateAge } from "@/lib/patients/validation";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

function ageLabel(dateOfBirth: string | null) {
  const age = calculateAge(dateOfBirth);
  return age === null ? "Non renseignée" : `${age} ans`;
}

export function PatientList({ initialState }: { initialState: PatientSearchState }) {
  const [state, formAction, pending] = useActionState(searchPatientsAction, initialState);

  return (
    <div className="mt-6 space-y-4">
      <form action={formAction} className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4 sm:grid-cols-[minmax(220px,1fr)_180px_auto] sm:items-end">
        <label className="text-sm font-medium text-slate-700">
          Rechercher un patient
          <input className="mt-1.5 w-full rounded-md border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-100" defaultValue={state.query} maxLength={80} name="query" placeholder="Nom, prénom ou téléphone" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Statut
          <select className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-sm" defaultValue={state.status} name="status">
            <option value="active">Actifs</option>
            <option value="archived">Archivés</option>
            <option value="all">Tous</option>
          </select>
        </label>
        <button className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {state.message ? <p aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p> : null}

      {state.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-white px-6 py-12 text-center">
          <h2 className="font-semibold text-slate-900">{state.query ? "Aucun résultat" : "Aucun patient dans cette vue"}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{state.query ? "Vérifiez la recherche ou modifiez le filtre de statut." : "Créez un dossier patient pour commencer."}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Âge</th><th className="px-4 py-3">Mutuelle</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Mise à jour</th><th className="px-4 py-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {state.items.map((patient) => (
                  <tr className="hover:bg-slate-50" key={patient.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{patient.first_name} {patient.last_name}</td>
                    <td className="px-4 py-3 text-slate-700">{patient.phone}</td>
                    <td className="px-4 py-3 text-slate-700">{ageLabel(patient.date_of_birth)}</td>
                    <td className="px-4 py-3 text-slate-700">{patient.has_mutuelle ? patient.mutuelle_name : "Aucune"}</td>
                    <td className="px-4 py-3"><StatusBadge active={patient.is_active} /></td>
                    <td className="px-4 py-3 text-slate-600">{dateFormatter.format(new Date(patient.updated_at))}</td>
                    <td className="px-4 py-3 text-right"><Link className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-strong)] hover:underline" href={`/patients/${patient.id}`}>Consulter</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {state.items.map((patient) => (
              <article className="rounded-lg border border-[var(--border)] bg-white p-4" key={patient.id}>
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{patient.first_name} {patient.last_name}</h2><p className="mt-1 text-sm text-slate-600">{patient.phone}</p></div><StatusBadge active={patient.is_active} /></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[var(--muted)]">Âge</dt><dd>{ageLabel(patient.date_of_birth)}</dd></div><div><dt className="text-[var(--muted)]">Mutuelle</dt><dd>{patient.has_mutuelle ? patient.mutuelle_name : "Aucune"}</dd></div></dl>
                <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--brand-strong)]" href={`/patients/${patient.id}`}>Consulter le dossier</Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{active ? "Actif" : "Archivé"}</span>;
}
