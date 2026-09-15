"use client";

import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export function ArchivePatientButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Archiver ce patient ? Le dossier restera conservé et consultable.")) {
          event.preventDefault();
        }
      }}
    >
      <PendingSubmitButton className="min-h-11 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60" pendingLabel="Archivage…">Archiver le patient</PendingSubmitButton>
    </form>
  );
}
