import Link from "next/link";

import { logoutAction } from "@/app/(dashboard)/actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-white p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-[var(--brand)]">Accès refusé</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Autorisation insuffisante
        </h1>
        <p className="mt-3 leading-6 text-[var(--muted)]">
          Votre compte n’est pas autorisé à consulter cette page. Contactez
          l’administration du cabinet si cela semble incorrect.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-[var(--brand)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--brand-strong)]"
          href="/dashboard"
        >
          Retour au tableau de bord
        </Link>
        <form action={logoutAction} className="mt-3">
          <PendingSubmitButton className="min-h-11 px-3 text-sm font-semibold text-[var(--muted)] underline decoration-slate-300 underline-offset-4 disabled:opacity-60" pendingLabel="Déconnexion…">Se déconnecter</PendingSubmitButton>
        </form>
      </section>
    </main>
  );
}
