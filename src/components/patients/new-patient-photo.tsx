"use client";

import { useState } from "react";
import { resizePatientPhoto } from "./local-photo";

export function NewPatientPhoto({ onChange, onBusy }: { onChange: (photo: string | null) => void; onBusy: (busy: boolean) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function select(file: File | undefined) {
    if (!file) return;
    setBusy(true); onBusy(true); setError("");
    try { const resized = await resizePatientPhoto(file); setPhoto(resized); onChange(resized); }
    catch (error) { setError(error instanceof Error ? error.message : "Impossible de préparer cette photo."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="mb-6 flex flex-col gap-4 rounded-xl bg-blue-50/60 p-4 sm:flex-row sm:items-center">
    {photo ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="Aperçu de la photo du nouveau patient" width={96} height={96} className="size-24 shrink-0 rounded-2xl object-cover" /> : null}
    <div className="min-w-0 flex-1"><label className="block text-sm font-semibold text-slate-700">Photo du patient <span className="font-normal">(facultative)</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { void select(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-blue-200 file:bg-white file:px-3 file:font-semibold file:text-blue-700 hover:file:bg-blue-50" /></label>
      <p className="mt-2 text-xs leading-5 text-slate-600">JPG, PNG ou WebP · 10 Mo maximum. Photo conservée dans ce navigateur sur ce PC.</p>
      {busy ? <p role="status" className="mt-2 text-xs text-blue-700">Préparation de la photo…</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
      {photo ? <button type="button" className="mt-2 min-h-11 rounded-md px-2 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => { setPhoto(null); onChange(null); setError(""); }}>Retirer la photo</button> : null}
    </div>
  </div>;
}
