import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicDocument } from "@/components/documents/clinic-document";
import { PrintButton } from "@/components/documents/print-button";
import { getPatientAppointments } from "@/lib/appointments/data";
import { formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { getPatientFinances } from "@/lib/finance/data";
import { getDentalChart } from "@/lib/odontogram/data";
import { getOperationalPatient, getPatient, type Patient } from "@/lib/patients/data";
import { calculateAge, isPatientId } from "@/lib/patients/validation";
import { getPatientPrescriptionSummaries } from "@/lib/prescriptions/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PatientPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("patients.read");
  const { id } = await params;
  if (!isPatientId(id)) notFound();
  const patient = user.role === "doctor" ? await getPatient(id) : await getOperationalPatient(id);
  if (!patient) notFound();
  const [appointments, full] = await Promise.all([
    getPatientAppointments(id),
    user.role === "doctor"
      ? Promise.all([getDentalChart(id), getPatientFinances(id), getPatientPrescriptionSummaries(id)])
      : Promise.resolve(null),
  ]);
  const clinicalPatient = full ? patient as Patient : null;
  const age = calculateAge(patient.date_of_birth);

  return <div className="document-page">
    <div className="print:hidden mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-strong)]" href={`/patients/${id}`}>← Retour au patient</Link><PrintButton /></div>
    <ClinicDocument subtitle={user.role === "doctor" ? "Dossier clinique complet" : "Résumé administratif et opérationnel"} title="Dossier patient">
      <Section title="Identité"><Grid><Value label="Patient" value={`${patient.first_name} ${patient.last_name}`} /><Value label="Date de naissance" value={patient.date_of_birth ?? "Non renseignée"} /><Value label="Âge" value={age === null ? "Non renseigné" : `${age} ans`} /><Value label="Téléphone" value={patient.phone} /><Value label="Profession" value={patient.profession ?? "Non renseignée"} /><Value label="Statut" value={patient.is_active ? "Actif" : "Archivé"} /></Grid>{patient.address ? <Text label="Adresse" value={patient.address} /> : null}</Section>
      <Section title="Mutuelle"><p>{patient.has_mutuelle ? patient.mutuelle_name : "Aucune mutuelle déclarée"}</p></Section>
      <Section title="Rendez-vous récents"><List empty="Aucun rendez-vous.">{appointments.map(item => <li key={item.id}>{formatClinicDate(item.starts_at)} à {formatClinicTime(item.starts_at)} — {item.title} ({item.status})</li>)}</List></Section>
      {full && clinicalPatient ? <>
        <Section title="Antécédents et allergies"><Text label="Antécédents médicaux" value={clinicalPatient.has_medical_history ? clinicalPatient.medical_history_notes ?? "Non détaillés" : "Aucun déclaré"} /><Text label="Allergies" value={clinicalPatient.has_allergies ? clinicalPatient.allergy_notes ?? "Non détaillées" : "Aucune déclarée"} /></Section>
        <Section title="Résumé dentaire"><List empty="Aucune constatation.">{full[0].findings.map(item => <li key={item.id}>Dent {item.tooth_number} — {item.condition} — {item.status}</li>)}</List></Section>
        <Section title="Interventions"><List empty="Aucune intervention.">{full[1].interventions.map(item => <li key={item.id}>{item.performed_at} — {item.nature} — {item.status}</li>)}</List><p className="mt-3"><strong>Total:</strong> {full[1].summary.total_due.toFixed(2)} MAD · <strong>Reçu:</strong> {full[1].summary.total_received.toFixed(2)} MAD · <strong>Reste:</strong> {full[1].summary.outstanding.toFixed(2)} MAD</p></Section>
        <Section title="Ordonnances"><List empty="Aucune ordonnance.">{full[2].map(item => <li key={item.id}>{formatClinicDate(item.issued_at)} — Dr {item.prescriber_name_snapshot} — {item.itemCount} élément(s) — {item.status === "voided" ? "Annulée" : "Active"}</li>)}</List></Section>
        {clinicalPatient.general_notes ? <Section title="Remarques"><p className="whitespace-pre-wrap">{clinicalPatient.general_notes}</p></Section> : null}
      </> : <p className="mt-8 border-t border-slate-300 pt-4 text-sm">Les informations médicales, dentaires, financières et les détails d’ordonnance sont exclus de ce résumé opérationnel assistant.</p>}
    </ClinicDocument>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-7 break-inside-avoid"><h2 className="border-b border-slate-300 pb-1 text-lg font-bold">{title}</h2><div className="mt-3">{children}</div></section>; }
function Grid({ children }: { children: React.ReactNode }) { return <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase text-slate-600">{label}</dt><dd>{value}</dd></div>; }
function Text({ label, value }: { label: string; value: string }) { return <div className="mt-3"><p className="text-xs font-bold uppercase text-slate-600">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>; }
function List({ children, empty }: { children: React.ReactNode; empty: string }) { return <ul className="list-disc space-y-1 pl-5">{Array.isArray(children) && children.length === 0 ? <li className="list-none text-slate-600">{empty}</li> : children}</ul>; }
