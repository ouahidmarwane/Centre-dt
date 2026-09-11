import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  const authState = await getAuthState();

  if (authState.status === "authenticated") {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.72fr)]">
      <section className="hidden bg-[var(--brand)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 font-semibold">
          <span className="grid size-11 place-items-center rounded-lg bg-white text-xl font-bold text-[var(--brand)]">
            O
          </span>
          Centre Dentaire Ouahid
        </div>
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

      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 font-semibold lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--brand)] text-lg font-bold text-white">
              O
            </span>
            Centre Dentaire Ouahid
          </div>
          <p className="text-sm font-semibold text-[var(--brand)]">Accès sécurisé</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Connexion
          </h2>
          <p className="mt-3 leading-6 text-[var(--muted)]">
            Utilisez les identifiants fournis par l’administration du cabinet.
          </p>
          <LoginForm />
          <p className="mt-7 text-sm leading-6 text-[var(--muted)]">
            Aucun compte public ne peut être créé depuis cette application.
          </p>
        </div>
      </section>
    </main>
  );
}
