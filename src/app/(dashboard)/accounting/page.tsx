import { PageHeader, PlaceholderPanel } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";

export default async function AccountingPage() {
  await requirePermission("accounting.read");

  return (
    <>
      <PageHeader
        description="Cet espace est réservé au docteur. Les fonctions comptables seront ajoutées ultérieurement."
        eyebrow="Accès docteur"
        title="Comptabilité"
      />
      <PlaceholderPanel>
        <p className="text-sm text-[var(--muted)]">Module protégé en préparation.</p>
      </PlaceholderPanel>
    </>
  );
}
