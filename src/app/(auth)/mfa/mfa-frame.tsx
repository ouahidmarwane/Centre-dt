import { logoutAction } from "@/app/(dashboard)/actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export function MfaFrame({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden px-6 py-12">
      <div
        aria-hidden="true"
        className="absolute -inset-12 -z-10 bg-cover bg-center bg-no-repeat blur-[32px]"
        style={{ backgroundImage: "url('/images/clinic-login.png')" }}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-slate-900/25" />
      <section className="relative isolate w-full max-w-xl overflow-hidden rounded-2xl border border-white/90 bg-white/85 p-6 shadow-xl shadow-blue-900/10 backdrop-blur sm:p-9">
        <div
          aria-hidden="true"
          className="absolute -inset-3 -z-10 bg-cover bg-center bg-no-repeat blur-[3px]"
          style={{ backgroundImage: "url('/images/dental-instruments-card.png')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-white/65" />
        <Image
          src="/images/ouahid-logo-transparent.png"
          alt="Ouahid Dental Center"
          width={1774}
          height={887}
          sizes="256px"
          loading="eager"
          className="mx-auto h-auto w-64"
        />
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
import Image from "next/image";
