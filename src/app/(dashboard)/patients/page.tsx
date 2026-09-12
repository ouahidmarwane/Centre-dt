import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { PatientList } from "@/components/patients/patient-list";
import { requirePermission } from "@/lib/auth/server";
import { listPatients } from "@/lib/patients/data";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  await requirePermission("patients.read");
  const patients = await listPatients("", "active");

  return (
    <>
      <PageHeader
        action={
          <Link
            className="rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
            href="/patients/new"
          >
            Nouveau patient
          </Link>
        }
        description="Recherchez, consultez et tenez à jour les dossiers de la patientèle."
        eyebrow="Gestion clinique"
        title="Patients"
      />
      <PatientList
        initialState={{
          items: patients,
          query: "",
          status: "active",
          message: null,
        }}
      />
    </>
  );
}
