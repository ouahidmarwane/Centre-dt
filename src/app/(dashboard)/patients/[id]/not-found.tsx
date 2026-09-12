import Link from "next/link";

export default function PatientNotFound() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Patient introuvable</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Ce dossier n’existe pas ou n’est pas accessible.</p>
      <Link className="mt-5 inline-flex font-semibold text-[var(--brand-strong)]" href="/patients">Retour aux patients</Link>
    </div>
  );
}
