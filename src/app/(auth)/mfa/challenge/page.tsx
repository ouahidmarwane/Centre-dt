import type { Metadata } from "next";

import { requireMfaPage } from "@/lib/auth/server";

import { MfaFrame } from "../mfa-frame";
import { ChallengeForm } from "./challenge-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Vérification en deux étapes", robots: { index: false, follow: false } };

export default async function MfaChallengePage() {
  const state = await requireMfaPage("challenge");
  if (state.recoveryRequired) {
    return <MfaFrame title="Vérification indisponible" description="Plusieurs authentificateurs vérifiés sont associés à ce compte. Par sécurité, aucun n’a été sélectionné. Contactez l’administration pour une récupération contrôlée."><p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">L’accès aux données du cabinet reste bloqué.</p></MfaFrame>;
  }
  return <MfaFrame title="Confirmez votre identité" description="Entrez le code actuel de votre application d’authentification pour ouvrir votre espace du cabinet."><ChallengeForm /></MfaFrame>;
}
