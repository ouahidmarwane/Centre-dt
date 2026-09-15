"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmitButton({
  children,
  className,
  disabled = false,
  formAction,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button aria-disabled={pending || disabled} className={className} disabled={pending || disabled} formAction={formAction} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
