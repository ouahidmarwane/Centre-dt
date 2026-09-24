import Link from "next/link";

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
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]" />
            Gestion clinique
          </p>
          <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-[2.4rem]">Patients</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500 [text-wrap:pretty]">Retrouvez un dossier en quelques lettres, voyez qui revient bientôt et contactez vos patients sans quitter la liste.</p>
        </div>
        <Link
          className="group inline-flex min-h-12 w-fit shrink-0 items-center gap-2.5 rounded-[14px] bg-[var(--blue)] py-3 pr-5 pl-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(22,119,242,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--blue-deep)] hover:shadow-[0_14px_28px_-10px_rgba(22,119,242,0.75)] active:translate-y-0 active:scale-[0.98]"
          href="/patients/new"
        >
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-[9px] bg-white/18 transition-transform duration-300 group-hover:rotate-90">
            <svg className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          Nouveau patient
        </Link>
      </header>
      <PatientList
        initialState={{
          items: patients,
          query: search.query,
          status: search.status,
          message: validated.success ? null : validated.message,
        }}
      />
    </div>
  );
}
