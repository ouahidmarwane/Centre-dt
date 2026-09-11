import { PageHeader, PlaceholderPanel } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";

export default async function SecurityPage() {
  await requirePermission("security.read");

  return (
    <>
      <PageHeader
        description="Cet espace est réservé au docteur. La supervision complète sera implémentée dans un prochain jalon."
        eyebrow="Accès docteur"
        title="Supervision"
      />
      <PlaceholderPanel>
        <p className="text-sm text-[var(--muted)]">Fondation de sécurité en place.</p>
      </PlaceholderPanel>
    </>
  );
}
