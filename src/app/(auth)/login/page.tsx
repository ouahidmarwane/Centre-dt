import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getLoginDestination } from "@/lib/auth/server";

import { IDLE_REASON } from "@/lib/auth/session-activity";

import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const { raison } = await searchParams;
  const destination = await getLoginDestination();
  if (destination) redirect(destination);

  return (
    <main
      className="grid min-h-screen bg-[var(--brand)] bg-cover bg-center bg-no-repeat lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.72fr)]"
      style={{ backgroundImage: "url('/images/clinic-login.png')" }}
    >
      <section className="hidden bg-[linear-gradient(180deg,rgba(16,44,76,0.35)_0%,rgba(16,44,76,0.15)_35%,rgba(16,44,76,0.88)_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/images/ouahid-logo-transparent.png"
          alt="Ouahid Dental Center"
          width={1774}
          height={887}
          className="h-auto w-64"
          loading="eager"
          sizes="256px"
        />
        <div className="max-w-xl pb-12">
          <p className="text-sm font-semibold tracking-[0.18em] text-teal-100 uppercase">
            Espace professionnel
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold">
            Une gestion sereine au service de chaque sourire.
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-teal-50/85">
            Accès réservé à l’équipe autorisée du cabinet.
          </p>
        </div>
      </section>

      <section className="relative isolate flex items-center justify-center overflow-hidden bg-white/35 px-6 py-12 backdrop-blur-xl sm:px-12">
        <div className={styles.teeth} aria-hidden="true">
          {[0, 1, 2, 3].map((tooth) => (
            <div key={tooth} className={styles.tooth}>
              <Image
                src="/images/floating-tooth.png"
                alt=""
                fill
                sizes="180px"
                className="object-contain"
              />
            </div>
          ))}
        </div>
        <div className="relative z-10 w-full max-w-md">
          <Image
            src="/images/ouahid-logo-transparent.png"
            alt="Ouahid Dental Center"
            width={1774}
            height={887}
            className="mx-auto mb-8 h-auto w-60"
            loading="eager"
            sizes="240px"
          />
          <p className="text-sm font-semibold text-[var(--brand)]">Accès sécurisé</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Connexion
          </h2>
          <p className="mt-3 leading-6 text-[var(--muted)]">
            Utilisez les identifiants fournis par l’administration du cabinet.
          </p>
          {raison === IDLE_REASON ? (
            <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" role="status">
              Votre session a été fermée après 30 minutes d’inactivité. Reconnectez-vous pour continuer.
            </p>
          ) : null}
          <LoginForm />
          <p className="mt-7 text-sm leading-6 text-[var(--muted)]">
            Aucun compte public ne peut être créé depuis cette application.
          </p>
        </div>
      </section>
    </main>
  );
}
