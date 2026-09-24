"use client";

import { startTransition, type FormEvent } from "react";

// React resets a <form action={…}> after every submission, which wipes what the user
// typed when the server answers with an error. Dispatching the action from onSubmit
// keeps the fields as they are; on success the caller remounts the form (e.g. via a new
// key) to clear it.
export function submitKeepingValues(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
