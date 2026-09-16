"use client";

import { useFormStatus } from "react-dom";

export function TotpInput({ error }: { error: string | null }) {
  const { pending } = useFormStatus();
  return (
    <>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="mfa-code">Code à 6 chiffres</label>
        <input
          aria-describedby={error ? "mfa-code-error" : "mfa-code-help"}
          aria-invalid={Boolean(error)}
          autoComplete="one-time-code"
          autoFocus
          className="min-h-12 rounded-md border border-[var(--border)] bg-white px-3.5 text-center text-xl tracking-[0.3em] shadow-xs focus:border-[var(--brand)] focus:outline-none"
          disabled={pending}
          id="mfa-code"
          inputMode="numeric"
          maxLength={6}
          name="code"
          pattern="[0-9]{6}"
          required
        />
        <p className="text-sm text-[var(--muted)]" id="mfa-code-help">Saisissez le code actuel de votre application d’authentification.</p>
      </div>
      {error ? <p aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[var(--danger)]" id="mfa-code-error" role="alert" tabIndex={-1}>{error}</p> : null}
      <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand)] px-5 font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-65" disabled={pending} type="submit">
        {pending ? "Vérification…" : "Vérifier"}
      </button>
    </>
  );
}
