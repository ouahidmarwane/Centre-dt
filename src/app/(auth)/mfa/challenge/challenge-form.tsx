"use client";

import { useActionState } from "react";

import { verifyChallengeAction, type VerificationState } from "../actions";
import { TotpInput } from "../totp-input";

const initialState: VerificationState = { error: null };

export function ChallengeForm() {
  const [state, formAction] = useActionState(verifyChallengeAction, initialState);
  return <form action={formAction} className="grid gap-4" noValidate><TotpInput error={state.error} /></form>;
}
