import { PageHeader, PlaceholderPanel } from "@/components/page-header";

export default function PatientsPage() {
  return (
    <>
      <PageHeader
        description="La gestion des dossiers patients sera implémentée dans un prochain jalon."
        eyebrow="Module opérationnel"
        title="Patients"
      />
      <PlaceholderPanel>
        <p className="text-sm text-[var(--muted)]">Module en préparation.</p>
      </PlaceholderPanel>
    </>
  );
}
