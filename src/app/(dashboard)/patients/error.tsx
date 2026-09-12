"use client";

export default function PatientsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-semibold text-red-900">Dossiers momentanément indisponibles</h1>
      <p className="mt-2 text-sm text-red-800">La demande n’a pas pu aboutir. Aucune donnée n’a été modifiée.</p>
      <button className="mt-4 rounded-md bg-red-800 px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">Réessayer</button>
    </div>
  );
}
