import Link from "next/link";

import { createPatientAction } from "@/app/(dashboard)/patients/actions";
import { PageHeader } from "@/components/page-header";
import { PatientForm } from "@/components/patients/patient-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  await requirePermission("patients.write");

  return (
    <>
      <PageHeader
        action={
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 hover:text-slate-900" href="/patients">
            Retour à la liste
          </Link>
        }
        description="Renseignez les informations d’admission. Les champs marqués d’un astérisque sont obligatoires."
        eyebrow="Nouveau dossier"
        title="Créer un patient"
      />
      <div className="mt-6 max-w-4xl">
        <PatientForm action={createPatientAction} submitLabel="Créer le dossier" photoOnCreate />
      </div>
    </>
  );
}
