import Link from "next/link";
import { notFound } from "next/navigation";

import { archivePatientAction } from "@/app/(dashboard)/patients/actions";
import { createDentalFindingAction, resolveDentalFindingAction, updateDentalFindingAction } from "@/app/(dashboard)/patients/[id]/odontogram-actions";
import { cancelInterventionAction, createInterventionAction, recordPaymentAction, reversePaymentAction, updateInterventionAction } from "@/app/(dashboard)/patients/[id]/finance-actions";
import { PatientFinances } from "@/components/finance/patient-finances";
import { Odontogram } from "@/components/odontogram/odontogram";
import { PageHeader } from "@/components/page-header";
import { ArchivePatientButton } from "@/components/patients/archive-patient-button";
import { requirePermission } from "@/lib/auth/server";
import { getPatient } from "@/lib/patients/data";
import { calculateAge, isPatientId } from "@/lib/patients/validation";
import { getDentalChart } from "@/lib/odontogram/data";
import { getPatientFinances } from "@/lib/finance/data";
import { hasPermission } from "@/lib/permissions";
import { getPatientAppointments } from "@/lib/appointments/data";
import { clinicDateValue, formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import { createPrescriptionAction, voidPrescriptionAction } from "@/app/(dashboard)/patients/[id]/prescription-actions";
import { PatientPrescriptions } from "@/components/prescriptions/patient-prescriptions";
import { getPatientPrescriptionSummaries } from "@/lib/prescriptions/data";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

function displayDate(value: string | null) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00.000Z`)) : "Non renseignée";
}

function textOrEmpty(value: string | null, emptyLabel = "Non renseigné") {
  return value ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{value}</p> : <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
}

export default async function PatientDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePermission("patients.read");
  const { id } = await params;
  if (!isPatientId(id)) notFound();
  const patient = await getPatient(id);
  if (!patient) notFound();
  const query = await searchParams;
  const age = calculateAge(patient.date_of_birth);
  const archiveAction = archivePatientAction.bind(null, patient.id);
  const [dentalChart,finances,appointments,prescriptions] = await Promise.all([getDentalChart(patient.id),getPatientFinances(patient.id),getPatientAppointments(patient.id),getPatientPrescriptionSummaries(patient.id)]);
  const now = new Date();

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-3">
            {patient.is_active ? <Link className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/patients/${patient.id}/edit`}>Modifier</Link> : null}
            {patient.is_active && hasPermission(user.role, "patients.archive") ? <ArchivePatientButton action={archiveAction} /> : null}
          </div>
        }
        description={`Dossier patient · ${patient.is_active ? "Actif" : "Archivé"}`}
        eyebrow="Patient"
        title={`${patient.first_name} ${patient.last_name}`}
      />

      {!patient.is_active ? <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Ce dossier est archivé. Il reste consultable mais ne peut plus être modifié.</div> : null}
      {query.error === "archive-failed" ? <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">L’archivage n’a pas pu être effectué.</div> : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <InformationSection title="Identité">
          <Definition label="Prénom" value={patient.first_name} />
          <Definition label="Nom" value={patient.last_name} />
          <Definition label="Date de naissance" value={displayDate(patient.date_of_birth)} />
          <Definition label="Âge" value={age === null ? "Non renseigné" : `${age} ans`} />
        </InformationSection>
        <InformationSection title="Coordonnées">
          <Definition label="Téléphone" value={patient.phone} />
          <Definition label="Profession" value={patient.profession ?? "Non renseignée"} />
          <div className="sm:col-span-2"><p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Adresse</p><div className="mt-1">{textOrEmpty(patient.address, "Aucune adresse renseignée")}</div></div>
        </InformationSection>
        <InformationSection title="Mutuelle">
          <Definition label="Couverture" value={patient.has_mutuelle ? "Oui" : "Non"} />
          <Definition label="Organisme" value={patient.mutuelle_name ?? "Aucune mutuelle"} />
        </InformationSection>
        <InformationSection title="Antécédents médicaux">
          <div className="sm:col-span-2">{patient.has_medical_history ? textOrEmpty(patient.medical_history_notes) : <p className="text-sm text-[var(--muted)]">Aucun antécédent déclaré.</p>}</div>
        </InformationSection>
        <InformationSection title="Allergies">
          <div className="sm:col-span-2">{patient.has_allergies ? textOrEmpty(patient.allergy_notes) : <p className="text-sm text-[var(--muted)]">Aucune allergie déclarée.</p>}</div>
        </InformationSection>
        <InformationSection title="Remarques">
          <div className="sm:col-span-2">{textOrEmpty(patient.general_notes, "Aucune remarque générale.")}</div>
        </InformationSection>
      </div>

      <Odontogram
        createAction={createDentalFindingAction.bind(null, patient.id)}
        findings={dentalChart.findings}
        patientActive={patient.is_active}
        resolveAction={resolveDentalFindingAction.bind(null, patient.id)}
        revisions={dentalChart.revisions}
        role={user.role}
        updateAction={updateDentalFindingAction.bind(null, patient.id)}
      />

      <PatientFinances
        cancelAction={cancelInterventionAction.bind(null,patient.id)}
        createAction={createInterventionAction.bind(null,patient.id)}
        findings={dentalChart.findings}
        interventions={finances.interventions}
        nowLocal={now.toISOString().slice(0,16)}
        patientActive={patient.is_active}
        payments={finances.payments}
        paymentToken={crypto.randomUUID()}
        recordAction={recordPaymentAction.bind(null,patient.id)}
        reverseAction={reversePaymentAction.bind(null,patient.id)}
        role={user.role}
        summary={finances.summary}
        today={now.toISOString().slice(0,10)}
        updateAction={updateInterventionAction.bind(null,patient.id)}
      />

      <PatientPrescriptions createAction={createPrescriptionAction.bind(null,patient.id)} patientActive={patient.is_active} patientId={patient.id} prescriptions={prescriptions} role={user.role} voidAction={voidPrescriptionAction.bind(null,patient.id)}/>

      <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6" aria-labelledby="patient-appointments-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900" id="patient-appointments-title">Rendez-vous</h2><p className="mt-1 text-sm text-[var(--muted)]">Derniers rendez-vous et rendez-vous à venir.</p></div>{patient.is_active?<Link className="rounded-md bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]" href={`/appointments?date=${clinicDateValue(now)}&patient=${patient.id}`}>Planifier</Link>:null}</div>
        <div className="mt-4 grid gap-3">{appointments.map(appointment=><article className="rounded-md border border-slate-200 px-4 py-3" key={appointment.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-slate-900">{appointment.title}</p><span className="text-xs font-semibold text-slate-600">{appointment.status==="scheduled"?"Planifié":appointment.status==="completed"?"Terminé":appointment.status==="cancelled"?"Annulé":"Absent"}</span></div><p className="mt-1 text-sm text-[var(--muted)]">{formatClinicDate(appointment.starts_at)} · {formatClinicTime(appointment.starts_at)}–{formatClinicTime(appointment.ends_at)}</p></article>)}{!appointments.length?<p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">Aucun rendez-vous enregistré.</p>:null}</div>
      </section>

      <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-slate-900">Modules cliniques à venir</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Ordonnances", "Factures"].map((module) => <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500" key={module}>{module} · À venir</span>)}
        </div>
      </section>

      <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--brand-strong)] hover:underline" href="/patients">Retour à la liste</Link>
    </>
  );
}

function InformationSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6"><h2 className="font-semibold text-slate-900">{title}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{children}</dl></section>;
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value}</dd></div>;
}
