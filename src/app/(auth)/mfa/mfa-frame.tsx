import { logoutAction } from "@/app/(dashboard)/actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export function MfaFrame({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-white/90 bg-white/85 p-6 shadow-xl shadow-blue-900/10 backdrop-blur sm:p-9">
        <div className="flex items-center gap-3 font-semibold text-slate-950">
          <span className="grid size-11 place-items-center rounded-lg bg-[var(--brand)] text-xl font-bold text-white">O</span>
          Centre Dentaire Ouahid
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wide text-[var(--brand)] uppercase">Vérification renforcée</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">{description}</p>
        <div className="mt-7">{children}</div>
        <form action={logoutAction} className="mt-7 border-t border-[var(--border)] pt-5">
          <PendingSubmitButton className="min-h-11 text-sm font-semibold text-[var(--muted)] underline decoration-slate-300 underline-offset-4 disabled:opacity-60" pendingLabel="Déconnexion…">
            Se déconnecter
          </PendingSubmitButton>
        </form>
      </section>
    </main>
  );
}
