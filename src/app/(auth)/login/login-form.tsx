"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand)] px-4 font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-65"
      disabled={pending}
      type="submit"
    >
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 grid gap-5" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          autoComplete="username"
          className="min-h-11 rounded-md border border-[var(--border)] bg-white px-3.5 text-base shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--brand)] focus:outline-none"
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          placeholder="nom@cabinet.ma"
          required
          type="email"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="password">
          Mot de passe
        </label>
        <input
          autoComplete="current-password"
          className="min-h-11 rounded-md border border-[var(--border)] bg-white px-3.5 text-base shadow-xs transition-colors hover:border-slate-400 focus:border-[var(--brand)] focus:outline-none"
          id="password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p
          aria-live="polite"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[var(--danger)]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
