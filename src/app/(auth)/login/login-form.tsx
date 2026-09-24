"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className={`${styles.submit} mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand)] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-65`}
      disabled={pending}
      type="submit"
    >
      <span className={styles.submitLabel}>{pending ? "Connexion…" : "Se connecter"}</span>
      <span className={styles.submitTooth} aria-hidden="true" />
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

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
          placeholder="nom@cabinetouahid.ma"
          required
          type="email"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="password">
          Mot de passe
        </label>
        <div className="relative">
        <input
          autoComplete="current-password"
          className="min-h-11 w-full rounded-md border border-[var(--border)] bg-white pl-3.5 pr-12 text-base shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--brand)] focus:outline-none"
          id="password"
          maxLength={1024}
          name="password"
          placeholder="Saisir votre mot de passe"
          required
          type={showPassword ? "text" : "password"}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--brand)]"
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-controls="password"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {showPassword ? <path d="m3 3 18 18" /> : null}
          </svg>
        </button>
        </div>
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
