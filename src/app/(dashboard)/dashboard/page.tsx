import { PageHeader, PlaceholderPanel } from "@/components/page-header";
import { requireUser } from "@/lib/auth/server";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        description="La base sécurisée de l’application est prête. Les modules métiers seront ajoutés lors des prochains jalons."
        eyebrow="Vue d’ensemble"
        title={`Bonjour, ${user.fullName}`}
      />
      <PlaceholderPanel>
        <h2 className="font-semibold text-slate-900">Fondation de l’espace clinique</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Authentification, contrôle d’accès et navigation sont actifs. Aucun dossier
          médical ou financier n’est encore géré dans ce jalon.
        </p>
      </PlaceholderPanel>
    </>
  );
}
