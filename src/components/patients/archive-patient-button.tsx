"use client";

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
      <button className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" type="submit">
        Archiver le patient
      </button>
    </form>
  );
}
