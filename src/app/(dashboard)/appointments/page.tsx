import { PageHeader, PlaceholderPanel } from "@/components/page-header";

export default function AppointmentsPage() {
  return (
    <>
      <PageHeader
        description="Le planning et les rappels seront implémentés dans un prochain jalon."
        eyebrow="Module opérationnel"
        title="Rendez-vous"
      />
      <PlaceholderPanel>
        <p className="text-sm text-[var(--muted)]">Module en préparation.</p>
      </PlaceholderPanel>
    </>
  );
}
