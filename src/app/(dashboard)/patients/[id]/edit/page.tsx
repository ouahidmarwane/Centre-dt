import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updatePatientAction } from "@/app/(dashboard)/patients/actions";
import { PageHeader } from "@/components/page-header";
import { PatientForm } from "@/components/patients/patient-form";
import { requirePermission } from "@/lib/auth/server";
import { getPatient } from "@/lib/patients/data";
import { isPatientId, type PatientInput } from "@/lib/patients/validation";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("patients.write");
  const { id } = await params;
  if (!isPatientId(id)) notFound();
  const patient = await getPatient(id);
  if (!patient) notFound();
  if (!patient.is_active) redirect(`/patients/${patient.id}`);

  const initialValues: PatientInput = {
    firstName: patient.first_name,
    lastName: patient.last_name,
    dateOfBirth: patient.date_of_birth,
    phone: patient.phone,
    profession: patient.profession,
    address: patient.address,
    hasMutuelle: patient.has_mutuelle,
    mutuelleName: patient.mutuelle_name,
    hasMedicalHistory: patient.has_medical_history,
    medicalHistoryNotes: patient.medical_history_notes,
    hasAllergies: patient.has_allergies,
    allergyNotes: patient.allergy_notes,
    generalNotes: patient.general_notes,
  };
  const updateAction = updatePatientAction.bind(null, patient.id);

  return (
    <>
      <PageHeader
        action={<Link className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 hover:text-slate-900" href={`/patients/${patient.id}`}>Annuler</Link>}
        description="Les modifications sont historisées sans recopier les données sensibles dans le journal d’audit."
        eyebrow="Dossier patient"
        title={`Modifier ${patient.first_name} ${patient.last_name}`}
      />
      <div className="mt-6 max-w-4xl"><PatientForm action={updateAction} initialValues={initialValues} submitLabel="Enregistrer les modifications" /></div>
    </>
  );
}
