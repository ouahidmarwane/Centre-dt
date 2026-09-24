import Link from "next/link";
import { notFound } from "next/navigation";

import { archivePatientAction } from "@/app/(dashboard)/patients/actions";
import { createDentalFindingAction, resolveDentalFindingAction, updateDentalFindingAction } from "@/app/(dashboard)/patients/[id]/odontogram-actions";
import { cancelInterventionAction, createInterventionAction, recordPaymentAction, reversePaymentAction, updateInterventionAction } from "@/app/(dashboard)/patients/[id]/finance-actions";
import { PatientFinances } from "@/components/finance/patient-finances";
import { PatientTreatmentPlans } from "@/components/treatment-plans/patient-treatment-plans";
import { acceptTreatmentPlanAction, cancelTreatmentPlanAction, completeTreatmentStepAction, createTreatmentPlanAction } from "@/app/(dashboard)/patients/[id]/treatment-plan-actions";
import { getPatientTreatmentPlans } from "@/lib/treatment-plans/data";
import { remainingToPay } from "@/lib/treatment-plans/validation";
import { Odontogram } from "@/components/odontogram/odontogram";
import { SpotlightSurface } from "@/components/dashboard/spotlight-surface";
import { formatDashboardMoney } from "@/lib/dashboard/presentation";
import { ArchivePatientButton } from "@/components/patients/archive-patient-button";
import { PrintablePatientFile } from "@/components/patients/printable-patient-file";
import { PatientPhoto } from "@/components/patients/patient-photo";
import { photoIdentity } from "@/components/patients/local-photo";
import { requirePermission } from "@/lib/auth/server";
import { getPatient } from "@/lib/patients/data";
import { calculateAge, isPatientId } from "@/lib/patients/validation";
import { getDentalChart } from "@/lib/odontogram/data";
import { getPatientFinances } from "@/lib/finance/data";
import { hasPermission } from "@/lib/permissions";
import { getPatientAppointments } from "@/lib/appointments/data";
import { buildWhatsAppAppointmentUrl, clinicDateTimeValue, clinicDateValue, formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import { WhatsAppGlyph } from "@/components/patients/patient-list";
import { createPrescriptionAction, voidPrescriptionAction } from "@/app/(dashboard)/patients/[id]/prescription-actions";
import { PatientPrescriptions } from "@/components/prescriptions/patient-prescriptions";
import { getPatientPrescriptionSummaries } from "@/lib/prescriptions/data";
import { createInvoiceAction, createReceiptAction, voidInvoiceAction } from "@/app/(dashboard)/patients/[id]/financial-document-actions";
import { FinancialDocuments } from "@/components/finance/financial-documents";
import { getPatientFinancialDocuments } from "@/lib/financial-documents/data";

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
  const [dentalChart,finances,appointments,prescriptions,financialDocuments,treatmentPlans] = await Promise.all([getDentalChart(patient.id),getPatientFinances(patient.id),getPatientAppointments(patient.id),getPatientPrescriptionSummaries(patient.id),getPatientFinancialDocuments(patient.id),getPatientTreatmentPlans(patient.id).catch(() => null)]);
  const stepTokens = Object.fromEntries((treatmentPlans ?? []).flatMap((plan) => plan.steps.filter((step) => !step.done).map((step) => [step.id, crypto.randomUUID()])));
  const totalRemaining = remainingToPay(finances.summary.outstanding, treatmentPlans ?? []);
  const now = new Date();
  const interventionToken = crypto.randomUUID();
  const prescriptionToken = crypto.randomUUID();
  const receiptTokens = Object.fromEntries(finances.payments.map((payment) => [payment.id, crypto.randomUUID()]));

  const fullName = `${patient.first_name} ${patient.last_name}`;
  const nextAppointment = appointments
    .filter((appointment) => appointment.status === "scheduled" && new Date(appointment.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const whatsappReminder = nextAppointment ? buildWhatsAppAppointmentUrl({ phone: patient.phone, firstName: patient.first_name, startsAt: nextAppointment.starts_at }) : null;
  const facts = [
    { label: "Prochain rendez-vous", value: nextAppointment ? formatClinicDate(nextAppointment.starts_at) : "Aucun", note: nextAppointment ? `à ${formatClinicTime(nextAppointment.starts_at)} · ${nextAppointment.title}` : "Rien de planifié", texture: "calendar" as const },
    { label: "Reste à payer", value: formatDashboardMoney(finances.summary.outstanding), note: totalRemaining > finances.summary.outstanding ? `+ ${formatDashboardMoney(totalRemaining - finances.summary.outstanding)} de séances à venir` : finances.summary.outstanding > 0 ? "À régulariser" : "Compte soldé", texture: "money" as const, alert: finances.summary.outstanding > 0 },
    { label: "Total réglé", value: formatDashboardMoney(finances.summary.total_received), note: `sur ${formatDashboardMoney(finances.summary.total_due)} facturés`, texture: "money" as const },
    { label: "Soins enregistrés", value: String(finances.interventions.length), note: `${dentalChart.findings.length} constat${dentalChart.findings.length > 1 ? "s" : ""} dentaire${dentalChart.findings.length > 1 ? "s" : ""}`, texture: "tooth" as const },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      <Link className="group inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--navy)]" href="/patients">
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">←</span> Patients
      </Link>

      {!patient.is_active ? <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-200/70 text-xs font-bold">!</span>Ce dossier est archivé. Il reste consultable mais ne peut plus être modifié.</div> : null}
      {query.error === "archive-failed" ? <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">L’archivage n’a pas pu être effectué.</div> : null}

      {/* Profile: identity, clinical flags, actions and key figures in one surface. */}
      <section aria-label="Profil du patient" className={`kpi-rise mt-3 overflow-hidden ${panel}`}>
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center">
          <PatientPhoto key={patient.id} patientId={patient.id} name={fullName} initials={`${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`} identity={photoIdentity(patient.first_name, patient.last_name, patient.phone, patient.date_of_birth)} createdAt={patient.created_at} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-[2.3rem]">{fullName}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${patient.is_active ? "bg-[#e9f8f4] text-[#0e7c6d]" : "bg-slate-100 text-slate-500"}`}>
                <span className={`size-1.5 rounded-full ${patient.is_active ? "bg-[#19a996]" : "bg-slate-400"}`} />{patient.is_active ? "Dossier actif" : "Archivé"}
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span>{age === null ? "Âge non renseigné" : `${age} ans`}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Né(e) le {displayDate(patient.date_of_birth)}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <a className="font-medium text-slate-700 tabular-nums hover:text-[var(--blue-deep)] hover:underline" href={`tel:${patient.phone.replace(/[^0-9+]/g, "")}`}>{patient.phone}</a>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {patient.has_allergies ? (
                <a className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset transition-colors hover:bg-amber-100" href="#dossier-medical">
                  <AlertIcon /> Allergies déclarées
                </a>
              ) : null}
              {patient.has_medical_history ? <a className="inline-flex items-center gap-1.5 rounded-lg bg-[#eef6ff] px-2.5 py-1.5 text-xs font-semibold text-[#0f5fc5] transition-colors hover:bg-[#e1efff]" href="#dossier-medical">Antécédents médicaux</a> : null}
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${patient.has_mutuelle ? "bg-[#eef6ff] text-[#0f5fc5]" : "bg-slate-100 text-slate-500"}`}>
                <ShieldIcon /> {patient.has_mutuelle ? patient.mutuelle_name ?? "Mutuelle déclarée" : "Sans mutuelle"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <PrintablePatientFile patient={patient} age={age} interventions={finances.interventions} payments={finances.payments} summary={finances.summary} findings={dentalChart.findings} />
            {patient.is_active ? (
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[#d6e3f0] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy)] transition-all hover:-translate-y-px hover:border-[var(--blue)] hover:text-[var(--blue-deep)] active:translate-y-0" href={`/patients/${patient.id}/edit`}>
                <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
                Modifier
              </Link>
            ) : null}
            {nextAppointment && patient.is_active ? (
              whatsappReminder
                ? <a className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[#128c7e] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(18,140,126,0.8)] transition-all hover:-translate-y-px hover:bg-[#0d7166] active:translate-y-0 active:scale-[0.98]" href={whatsappReminder} rel="noopener noreferrer" target="_blank" title="Ouvre WhatsApp avec le message de rappel déjà écrit"><WhatsAppGlyph />Rappel WhatsApp</a>
                : <Link className="inline-flex min-h-11 items-center rounded-[12px] bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100" href={`/patients/${patient.id}/edit`} title="Le numéro n’est pas reconnu par WhatsApp">Numéro WhatsApp à corriger</Link>
            ) : null}
            {patient.is_active && hasPermission(user.role, "patients.archive") ? <ArchivePatientButton action={archiveAction} /> : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-[#e6edf5] lg:grid-cols-4">
          {facts.map((fact, index) => (
            <SpotlightSurface className={`relative border-[#e6edf5] px-5 py-4 sm:px-7 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`} key={fact.label} texture={fact.texture}>
              <dt className="text-[13px] font-medium text-slate-500">{fact.label}</dt>
              <dd className={`metric-number mt-1.5 truncate text-xl font-semibold tracking-[-0.02em] ${fact.alert ? "text-[#b4541a]" : "text-[var(--navy)]"}`}>{fact.value}</dd>
              <dd className="mt-1 truncate text-xs text-slate-500">{fact.note}</dd>
            </SpotlightSurface>
          ))}
        </dl>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        {/* Clinical record: the three free-text fields read top to bottom, allergies first. */}
        <SpotlightSurface className={`kpi-rise relative self-start xl:col-span-8 ${panel}`} texture="tooth">
          <section aria-labelledby="dossier-medical" className="p-5 sm:p-7">
            <PanelHeading id="dossier-medical" subtitle="Informations déclarées par le patient" title="Dossier médical" />
            <div className="mt-5 divide-y divide-[#eef3f8]">
              <MedicalRow icon={<AlertIcon />} label="Allergies" tone={patient.has_allergies ? "alert" : "calm"}>
                {patient.has_allergies ? (
                  <div className="rounded-[12px] border border-amber-200 bg-amber-50/70 px-4 py-3 [&_p]:text-amber-950">{textOrEmpty(patient.allergy_notes, "Allergie déclarée, sans précision.")}</div>
                ) : <p className="flex items-center gap-2 text-sm text-slate-500"><span className="size-1.5 rounded-full bg-[#19a996]" />Aucune allergie déclarée</p>}
              </MedicalRow>
              <MedicalRow icon={<PulseIcon />} label="Antécédents" tone={patient.has_medical_history ? "info" : "calm"}>
                {patient.has_medical_history ? textOrEmpty(patient.medical_history_notes, "Antécédent déclaré, sans précision.") : <p className="flex items-center gap-2 text-sm text-slate-500"><span className="size-1.5 rounded-full bg-[#19a996]" />Aucun antécédent déclaré</p>}
              </MedicalRow>
              <MedicalRow icon={<NoteIcon />} label="Remarques" tone="calm">
                {patient.general_notes ? <blockquote className="border-l-2 border-[var(--gold)] pl-4">{textOrEmpty(patient.general_notes)}</blockquote> : <p className="text-sm text-slate-500">Aucune remarque générale.</p>}
              </MedicalRow>
            </div>
          </section>
        </SpotlightSurface>

        <div className="grid content-start gap-5 xl:col-span-4">
          <SpotlightSurface className={`kpi-rise relative ${panel}`} texture="people">
            <section aria-labelledby="patient-contact-title" className="p-5 sm:p-6">
              <PanelHeading id="patient-contact-title" title="Coordonnées" />
              <dl className="mt-4 space-y-1">
                <ContactRow icon={<PhoneIcon />} label="Téléphone"><a className="font-medium text-[var(--navy)] tabular-nums hover:text-[var(--blue-deep)] hover:underline" href={`tel:${patient.phone.replace(/[^0-9+]/g, "")}`}>{patient.phone}</a></ContactRow>
                <ContactRow icon={<PinIcon />} label="Adresse">{patient.address ?? <span className="text-slate-400">Aucune adresse renseignée</span>}</ContactRow>
                <ContactRow icon={<BriefcaseIcon />} label="Profession">{patient.profession ?? <span className="text-slate-400">Non renseignée</span>}</ContactRow>
                <ContactRow icon={<ShieldIcon />} label="Mutuelle">{patient.has_mutuelle ? patient.mutuelle_name ?? "Déclarée" : <span className="text-slate-400">Sans couverture</span>}</ContactRow>
              </dl>
            </section>
          </SpotlightSurface>

          <SpotlightSurface className={`kpi-rise relative ${panel}`} texture="calendar">
            <section aria-labelledby="patient-appointments-title" className="p-5 sm:p-6">
              <PanelHeading
                action={patient.is_active ? <Link className="relative z-10 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[10px] whitespace-nowrap bg-[var(--blue)] px-3 text-xs font-semibold text-white shadow-[0_6px_14px_-6px_rgba(22,119,242,0.6)] transition-all hover:-translate-y-px hover:bg-[var(--blue-deep)] active:translate-y-0" href={`/appointments?date=${clinicDateValue(now)}&patient=${patient.id}`}>+ Planifier</Link> : null}
                id="patient-appointments-title"
                subtitle="Derniers rendez-vous et rendez-vous à venir"
                title="Rendez-vous"
              />
              {appointments.length ? (
                <ol className="mt-5 space-y-0">
                  {appointments.map((appointment) => {
                    const status = appointmentStatus[appointment.status as keyof typeof appointmentStatus] ?? appointmentStatus.no_show;
                    return (
                      <li className="relative flex gap-3 pb-4 pl-1 before:absolute before:top-4 before:bottom-0 before:left-[0.53rem] before:w-px before:bg-[#e3ebf3] last:pb-0 last:before:hidden" key={appointment.id}>
                        <span aria-hidden="true" className={`relative z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_#dbe6f1] ${status.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--navy)]">{appointment.title}</p>
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${status.badge}`}>{status.label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{formatClinicDate(appointment.starts_at)} · {formatClinicTime(appointment.starts_at)}–{formatClinicTime(appointment.ends_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="mt-4 rounded-[12px] bg-[#f5f8fb] px-4 py-3 text-sm text-slate-500">Aucun rendez-vous enregistré.</p>}
            </section>
          </SpotlightSurface>
        </div>
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

      {hasPermission(user.role, "treatment_plans.read") && !treatmentPlans ? (
        <p className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Les plans de traitement sont momentanément indisponibles. Le reste du dossier est à jour.</p>
      ) : null}
      {hasPermission(user.role, "treatment_plans.read") && treatmentPlans ? (
        <PatientTreatmentPlans
          acceptAction={acceptTreatmentPlanAction.bind(null, patient.id)}
          canProgress={hasPermission(user.role, "treatment_plans.progress")}
          canWrite={hasPermission(user.role, "treatment_plans.write")}
          cancelAction={cancelTreatmentPlanAction.bind(null, patient.id)}
          completeAction={completeTreatmentStepAction.bind(null, patient.id)}
          createAction={createTreatmentPlanAction.bind(null, patient.id)}
          outstanding={finances.summary.outstanding}
          patientActive={patient.is_active}
          planToken={crypto.randomUUID()}
          plans={treatmentPlans}
          stepTokens={stepTokens}
          today={clinicDateValue(now)}
        />
      ) : null}

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

      <Link className="group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--navy)]" href="/patients">
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">←</span> Retour à la liste
      </Link>
    </div>
  );
}

const panel = "rounded-[20px] border border-[#dbe6f1] bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)]";

const appointmentStatus = {
  scheduled: { label: "Planifié", dot: "bg-[var(--blue)]", badge: "bg-[#eef6ff] text-[#0f5fc5]" },
  completed: { label: "Terminé", dot: "bg-[#19a996]", badge: "bg-[#e9f8f4] text-[#0e7c6d]" },
  cancelled: { label: "Annulé", dot: "bg-slate-300", badge: "bg-slate-100 text-slate-500" },
  no_show: { label: "Absent", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-800" },
} as const;

function PanelHeading({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id={id}>{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MedicalRow({ icon, label, tone, children }: { icon: React.ReactNode; label: string; tone: "alert" | "info" | "calm"; children: React.ReactNode }) {
  const iconTone = tone === "alert" ? "bg-amber-100 text-amber-700" : tone === "info" ? "bg-[#eef6ff] text-[#0f5fc5]" : "bg-[#f1f5f9] text-slate-500";
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
      <p className="flex items-center gap-2.5 text-sm font-semibold text-[var(--navy)]">
        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${iconTone}`}>{icon}</span>
        {label}
      </p>
      <div className="min-w-0 self-center">{children}</div>
    </div>
  );
}

function ContactRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-[#f5f9fd]">
      <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9] text-slate-500">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm leading-6 break-words text-[var(--navy)]">{children}</dd>
      </div>
    </div>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return <svg className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{children}</svg>;
}
const AlertIcon = () => <Glyph><path d="M12 4 3 20h18z" /><path d="M12 10v4M12 17h.01" /></Glyph>;
const PulseIcon = () => <Glyph><path d="M3 12h4l2-5 4 10 2-5h6" /></Glyph>;
const NoteIcon = () => <Glyph><path d="M6 3h9l4 4v14H6z" /><path d="M9 11h7M9 15h5" /></Glyph>;
const PhoneIcon = () => <Glyph><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1" /></Glyph>;
const PinIcon = () => <Glyph><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Glyph>;
const BriefcaseIcon = () => <Glyph><rect height="12" rx="2" width="18" x="3" y="7" /><path d="M9 7V5h6v2M3 12h18" /></Glyph>;
const ShieldIcon = () => <Glyph><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></Glyph>;
