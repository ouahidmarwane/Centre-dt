import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { PatientList } from "@/components/patients/patient-list";
import { requirePermission } from "@/lib/auth/server";
import { listPatients } from "@/lib/patients/data";
import { validatePatientSearch } from "@/lib/patients/validation";

export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ query?: string | string[]; status?: string | string[] }> }) {
  await requirePermission("patients.read");
  const query = await searchParams;
  const validated = validatePatientSearch(query.query, query.status);
  const search = validated.success ? validated.data : { query: "", status: "active" as const };
  const patients = await listPatients(search.query, search.status);

  return (
    <>
      <PageHeader
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
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
          query: search.query,
          status: search.status,
          message: validated.success ? null : validated.message,
        }}
      />
    </>
  );
}
