"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pendingPhotoKey, resizePatientPhoto } from "./local-photo";

function subscribeToPhotos(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("ouahid-patient-photo", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("ouahid-patient-photo", onChange);
  };
}

// Photos live only in this browser's localStorage; the server render always sees none.
export function usePatientPhoto(patientId: string) {
  const storageKey = `ouahid:patient-photo:${patientId}`;
  return useSyncExternalStore(subscribeToPhotos, () => {
    try { return localStorage.getItem(storageKey); }
    catch { return null; }
  }, () => null);
}

export function PatientPhoto({ patientId, name, initials, identity, createdAt }: { patientId: string; name: string; initials: string; identity: string; createdAt: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storageKey = `ouahid:patient-photo:${patientId}`;
  const photo = usePatientPhoto(patientId);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const raw = sessionStorage.getItem(pendingPhotoKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const created = new Date(createdAt).getTime();
      if (typeof draft.submittedAt !== "number" || Date.now() - draft.submittedAt > 15 * 60 * 1000) {
        sessionStorage.removeItem(pendingPhotoKey);
        return;
      }
      if (draft.identity !== identity || created < draft.submittedAt - 5000 || created > draft.submittedAt + 15 * 60 * 1000 || typeof draft.photo !== "string" || !draft.photo.startsWith("data:image/jpeg;base64,")) return;
      localStorage.setItem(storageKey, draft.photo);
      sessionStorage.removeItem(pendingPhotoKey);
      window.dispatchEvent(new Event("ouahid-patient-photo"));
    }).catch(() => { if (!cancelled) setError("La photo choisie à la création n’a pas pu être conservée. Vous pouvez la réajouter ici."); });
    return () => { cancelled = true; };
  }, [createdAt, identity, storageKey]);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const resized = await resizePatientPhoto(file);
      localStorage.setItem(storageKey, resized);
      window.dispatchEvent(new Event("ouahid-patient-photo"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de conserver cette photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function removePhoto() {
    try { localStorage.removeItem(storageKey); window.dispatchEvent(new Event("ouahid-patient-photo")); setError(""); }
    catch { setError("Impossible de supprimer la photo dans ce navigateur."); }
  }

  return <div className="w-40 shrink-0">
    <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-[30px] bg-[var(--navy)] text-3xl font-bold text-white shadow-[0_16px_28px_rgba(16,44,76,.22)]">
      {photo ? /* Local browser photo cannot use the Next image optimizer. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={`Photo de ${name}`} className="size-full object-cover" width={112} height={112} /> : <span aria-label={`Initiales de ${name}`}>{initials}</span>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choisir une photo pour ${name}`} className="sr-only" tabIndex={-1} disabled={busy} onChange={event => choosePhoto(event.currentTarget.files?.[0])} />
    <button type="button" disabled={busy} className="mt-3 min-h-11 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-[var(--brand-strong)] transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-50" onClick={() => input.current?.click()}>{busy ? "Ajout…" : photo ? "Changer la photo" : "Ajouter une photo"}</button>
    {photo ? <button type="button" disabled={busy} className="mt-1 block min-h-11 rounded-md px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={removePhoto}>Supprimer la photo</button> : null}
    <p className="mt-2 text-[11px] leading-4 text-slate-600">Photo enregistrée dans ce navigateur uniquement.</p>
    {error ? <p role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}
  </div>;
}
