import Link from "next/link";
import Image from "next/image";
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
import { clinicDateTimeValue, clinicDateValue, formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import { createPrescriptionAction, voidPrescriptionAction } from "@/app/(dashboard)/patients/[id]/prescription-actions";
import { PatientPrescriptions } from "@/components/prescriptions/patient-prescriptions";
import { getPatientPrescriptionSummaries } from "@/lib/prescriptions/data";
import { createInvoiceAction, createReceiptAction, voidInvoiceAction } from "@/app/(dashboard)/patients/[id]/financial-document-actions";
import { FinancialDocuments } from "@/components/finance/financial-documents";
import { getPatientFinancialDocuments } from "@/lib/financial-documents/data";
import { BentoCard, DataRow, StatusPill } from "@/components/ui/clinic-ui";

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
  const [dentalChart,finances,appointments,prescriptions,financialDocuments] = await Promise.all([getDentalChart(patient.id),getPatientFinances(patient.id),getPatientAppointments(patient.id),getPatientPrescriptionSummaries(patient.id),getPatientFinancialDocuments(patient.id)]);
  const now = new Date();
  const interventionToken = crypto.randomUUID();
  const prescriptionToken = crypto.randomUUID();
  const receiptTokens = Object.fromEntries(finances.payments.map((payment) => [payment.id, crypto.randomUUID()]));

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-3">
            {patient.is_active ? <Link className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/patients/${patient.id}/edit`}>Modifier</Link> : null}
            {patient.is_active && hasPermission(user.role, "patients.archive") ? <ArchivePatientButton action={archiveAction} /> : null}
          </div>
        }
        description={`Dossier patient · ${patient.is_active ? "Actif" : "Archivé"}`}
        eyebrow="Patient"
        title={`${patient.first_name} ${patient.last_name}`}
      />

      {!patient.is_active ? <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Ce dossier est archivé. Il reste consultable mais ne peut plus être modifié.</div> : null}
      {query.error === "archive-failed" ? <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">L’archivage n’a pas pu être effectué.</div> : null}

      <div className="mt-6 grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-12">
        <BentoCard className="min-h-64 bg-[linear-gradient(145deg,#fff_25%,#eef7ff)] md:col-span-2 xl:col-span-7" eyebrow="Vue d’ensemble" title="Identité">
          <div className="relative z-10 mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="relative flex size-28 shrink-0 items-center justify-center rounded-[30px] bg-[var(--navy)] text-3xl font-bold text-white shadow-[0_16px_28px_rgba(16,44,76,.22)]">
              {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
              <span className="absolute -right-2 -top-2 size-5 rounded-full border-4 border-white bg-[var(--gold)]" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-bold tracking-[-0.035em] text-[var(--navy)]">{patient.first_name} {patient.last_name}</h3><StatusPill tone={patient.is_active ? "green" : "neutral"}>{patient.is_active ? "● Dossier actif" : "○ Archivé"}</StatusPill></div>
              <p className="mt-2 text-sm text-slate-500">{age === null ? "Âge non renseigné" : `${age} ans`} · Né(e) le {displayDate(patient.date_of_birth)}</p>
              <dl className="mt-5 grid gap-2 sm:grid-cols-2"><DataRow label="Prénom" value={patient.first_name} /><DataRow label="Nom" value={patient.last_name} /></dl>
            </div>
          </div>
          <Image alt="" aria-hidden="true" className="absolute -right-3 bottom-1 h-auto w-24 rotate-[-12deg] opacity-[.06]" height={96} src="/assets/dentist-app/tooth-16.svg" width={96} />
        </BentoCard>

        <BentoCard className="bg-[linear-gradient(160deg,#fff,#f8fbff)] xl:col-span-5" eyebrow="Contact" title="Coordonnées">
          <dl className="relative z-10 mt-5 grid gap-2">
            <DataRow label="Téléphone" value={patient.phone} />
            <DataRow label="Profession" value={patient.profession ?? "Non renseignée"} />
            <div className="rounded-2xl bg-[var(--navy)] px-4 py-3 text-white"><dt className="text-[10px] font-bold tracking-[0.12em] text-blue-200 uppercase">Adresse</dt><dd className="mt-1 text-sm leading-6">{patient.address ?? "Aucune adresse renseignée"}</dd></div>
          </dl>
        </BentoCard>

        <BentoCard className="xl:col-span-4" eyebrow="Couverture" title="Mutuelle">
          <div className="relative z-10 mt-6 flex items-center gap-4">
            <div className={`grid size-20 shrink-0 place-items-center rounded-full border-[7px] ${patient.has_mutuelle ? "border-blue-100 border-t-[var(--brand)]" : "border-slate-100"}`}><span className="text-xs font-extrabold text-[var(--navy)]">{patient.has_mutuelle ? "OUI" : "NON"}</span></div>
            <div><StatusPill tone={patient.has_mutuelle ? "blue" : "neutral"}>{patient.has_mutuelle ? "Couverture déclarée" : "Sans couverture"}</StatusPill><p className="mt-3 text-sm font-semibold text-slate-700">{patient.mutuelle_name ?? "Aucun organisme"}</p></div>
          </div>
        </BentoCard>

        <BentoCard className="bg-[linear-gradient(145deg,#102c4c,#163d68)] text-white xl:col-span-8" eyebrow="Contexte clinique" title="Antécédents médicaux">
          <div className="relative z-10 mt-6 max-w-2xl rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 [&_p]:text-blue-50">{patient.has_medical_history ? textOrEmpty(patient.medical_history_notes) : <p className="text-sm">Aucun antécédent déclaré.</p>}</div>
          <div className="absolute bottom-5 right-5 hidden h-14 w-24 items-end gap-1 opacity-50 sm:flex" aria-hidden="true">{[35,55,42,70,50,82,62].map((height,index)=><span className="w-2 rounded-full bg-blue-300" key={index} style={{height}} />)}</div>
        </BentoCard>

        <BentoCard className={`xl:col-span-5 ${patient.has_allergies ? "bg-[linear-gradient(145deg,#fff,#fff8e8)]" : ""}`} eyebrow="Vigilance" title="Allergies">
          <div className="relative z-10 mt-5"><StatusPill tone={patient.has_allergies ? "gold" : "green"}>{patient.has_allergies ? "! Attention requise" : "✓ Rien de déclaré"}</StatusPill><div className="mt-4 rounded-2xl border border-amber-100/70 bg-white/75 p-4">{patient.has_allergies ? textOrEmpty(patient.allergy_notes) : <p className="text-sm text-[var(--muted)]">Aucune allergie déclarée.</p>}</div></div>
        </BentoCard>

        <BentoCard className="xl:col-span-7" eyebrow="Note au dossier" title="Remarques">
          <div className="relative z-10 mt-5 min-h-28 rounded-[18px] border-l-4 border-[var(--gold)] bg-[var(--gold-soft)]/55 p-5 before:absolute before:right-6 before:top-4 before:text-5xl before:font-serif before:text-[var(--gold)]/20 before:content-['”']">{textOrEmpty(patient.general_notes, "Aucune remarque générale.")}</div>
        </BentoCard>
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
        interventionToken={interventionToken}
        nowLocal={clinicDateTimeValue(now)}
        patientActive={patient.is_active}
        payments={finances.payments}
        paymentToken={crypto.randomUUID()}
        recordAction={recordPaymentAction.bind(null,patient.id)}
        reverseAction={reversePaymentAction.bind(null,patient.id)}
        role={user.role}
        summary={finances.summary}
        today={clinicDateValue(now)}
        updateAction={updateInterventionAction.bind(null,patient.id)}
      />

      <PatientPrescriptions createAction={createPrescriptionAction.bind(null,patient.id)} patientActive={patient.is_active} patientId={patient.id} prescriptionToken={prescriptionToken} prescriptions={prescriptions} role={user.role} voidAction={voidPrescriptionAction.bind(null,patient.id)}/>

      <FinancialDocuments
        activeInvoicedInterventionIds={financialDocuments.activeInvoicedInterventionIds}
        createInvoiceAction={createInvoiceAction.bind(null,patient.id)}
        createReceiptAction={createReceiptAction.bind(null,patient.id)}
        invoiceToken={crypto.randomUUID()}
        invoices={financialDocuments.invoices}
        interventions={finances.interventions}
        patientActive={patient.is_active}
        patientId={patient.id}
        payments={finances.payments}
        receiptTokens={receiptTokens}
        receipts={financialDocuments.receipts}
        role={user.role}
        voidInvoiceAction={voidInvoiceAction.bind(null,patient.id)}
      />

      <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6" aria-labelledby="patient-appointments-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900" id="patient-appointments-title">Rendez-vous</h2><p className="mt-1 text-sm text-[var(--muted)]">Derniers rendez-vous et rendez-vous à venir.</p></div>{patient.is_active?<Link className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]" href={`/appointments?date=${clinicDateValue(now)}&patient=${patient.id}`}>Planifier</Link>:null}</div>
        <div className="mt-4 grid gap-3">{appointments.map(appointment=><article className="rounded-md border border-slate-200 px-4 py-3" key={appointment.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-slate-900">{appointment.title}</p><span className="text-xs font-semibold text-slate-600">{appointment.status==="scheduled"?"Planifié":appointment.status==="completed"?"Terminé":appointment.status==="cancelled"?"Annulé":"Absent"}</span></div><p className="mt-1 text-sm text-[var(--muted)]">{formatClinicDate(appointment.starts_at)} · {formatClinicTime(appointment.starts_at)}–{formatClinicTime(appointment.ends_at)}</p></article>)}{!appointments.length?<p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">Aucun rendez-vous enregistré.</p>:null}</div>
      </section>

      <Link className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-strong)] hover:underline" href="/patients">Retour à la liste</Link>
    </>
  );
}
