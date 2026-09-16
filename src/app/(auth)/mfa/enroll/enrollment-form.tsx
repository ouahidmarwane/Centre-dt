"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { beginTotpEnrollmentAction, verifyEnrollmentAction, type EnrollmentState, type VerificationState } from "../actions";
import { TotpInput } from "../totp-input";

const initialEnrollment: EnrollmentState = { status: "idle", error: null };
const initialVerification: VerificationState = { error: null };

function StartButton() {
  const { pending } = useFormStatus();
  return <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand)] px-5 font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-65" disabled={pending} type="submit">{pending ? "Préparation…" : "Commencer la configuration"}</button>;
}

function VerificationForm({ factorId }: { factorId: string }) {
  const action = verifyEnrollmentAction.bind(null, factorId);
  const [state, formAction] = useActionState(action, initialVerification);
  return <form action={formAction} className="mt-6 grid gap-4" noValidate><TotpInput error={state.error} /></form>;
}

export function EnrollmentForm() {
  const [state, formAction] = useActionState(beginTotpEnrollmentAction, initialEnrollment);
  if (state.status !== "ready") {
    return (
      <form action={formAction} className="grid gap-4">
        <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-slate-700">
          <li>Ouvrez votre application d’authentification.</li><li>Préparez-vous à scanner le QR code.</li><li>Saisissez ensuite le code à 6 chiffres.</li>
        </ol>
        {state.error ? <p aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[var(--danger)]" role="alert">{state.error}</p> : null}
        <StartButton />
      </form>
    );
  }

  return (
    <div>
      <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-slate-700">
        <li>Ouvrez votre application d’authentification.</li><li>Scannez le QR code ou entrez la clé manuellement.</li><li>Saisissez le code à 6 chiffres généré.</li><li>Validez pour activer la protection.</li>
      </ol>
      <div className="mt-5 grid gap-5 rounded-xl border border-[var(--border)] bg-slate-50 p-5 sm:grid-cols-[180px_1fr] sm:items-center">
        {/* Supabase supplies an SVG data image; it is never injected as markup. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR code de configuration de l’authentificateur" className="mx-auto size-44 rounded-md bg-white p-2" height="176" src={state.enrollment.qrDataUrl} width="176" />
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">Clé de configuration manuelle</p><p className="mt-2 break-all rounded-md bg-white p-3 font-mono text-sm text-slate-900">{state.enrollment.secret}</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Cette clé n’est affichée que pendant cette configuration. Ne la partagez pas.</p></div>
      </div>
      <VerificationForm factorId={state.enrollment.factorId} />
    </div>
  );
}
