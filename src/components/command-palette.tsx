"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { quickSearchPatientsAction, type QuickPatientResult } from "@/app/(dashboard)/search-actions";
import { AppIcon } from "@/components/app-icon";
import { filterQuickCommands, normalizeQuickSearchTerm, patientSearchHref, type QuickCommand } from "@/lib/search/quick-search";

type Item =
  | { key: string; kind: "patient"; href: string; patient: QuickPatientResult }
  | { key: string; kind: "all"; href: string; term: string }
  | { key: string; kind: "command"; href: string; command: QuickCommand };

const SEARCH_DELAY_MS = 180;

function useQuickPatients(query: string, open: boolean) {
  const [result, setResult] = useState<{ term: string; patients: QuickPatientResult[] } | null>(null);
  const term = open ? normalizeQuickSearchTerm(query) : null;

  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let patients: QuickPatientResult[] = [];
      try { patients = await quickSearchPatientsAction(term); } catch { patients = []; }
      if (!cancelled) setResult({ term, patients });
    }, SEARCH_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term]);

  // Results are only shown for the exact term on screen, so a slow answer to an
  // earlier query can never be opened by pressing Enter.
  const fresh = term !== null && result?.term === term;
  return { term, patients: fresh ? result.patients : [], loading: term !== null && !fresh };
}

export function CommandPalette({ commands }: { commands: readonly QuickCommand[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const { term, patients, loading } = useQuickPatients(query, open);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = patients.map((patient) => ({ key: `p-${patient.id}`, kind: "patient", href: `/patients/${patient.id}`, patient }));
    for (const command of filterQuickCommands(commands, query)) list.push({ key: `c-${command.href}`, kind: "command", href: command.href, command });
    if (term) list.push({ key: "all", kind: "all", href: patientSearchHref(term), term });
    return list;
  }, [commands, patients, query, term]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const go = useCallback((item: Item | undefined) => {
    if (!item) return;
    close();
    router.push(item.href);
  }, [close, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (items.length ? (index + 1) % items.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); go(items[Math.min(active, items.length - 1)]); }
  }

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));
  const sectionOf = (item: Item) => (item.kind === "command" ? item.command.section : item.kind === "all" ? "Recherche complète" : "Patients");

  return (
    <>
      <button
        aria-keyshortcuts="Control+K Meta+K"
        className="group relative ml-auto hidden w-full max-w-xs items-center gap-3 rounded-[15px] border border-white/90 bg-white/58 py-2.5 pr-3 pl-4 text-left text-xs text-slate-400 shadow-[inset_0_1px_0_white,0_7px_20px_rgba(29,100,170,0.06)] transition-[border-color,background-color] duration-200 hover:border-blue-200 hover:bg-white focus-visible:border-blue-300 focus-visible:outline-none md:flex"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <AppIcon className="size-5 shrink-0" name="search" />
        <span className="flex-1">Rechercher un patient, une page…</span>
        <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500">Ctrl K</kbd>
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/35 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div aria-label="Recherche rapide" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-[20px] border border-white bg-white shadow-[0_30px_80px_-20px_rgba(16,44,76,0.45)]" role="dialog">
            <div className="flex items-center gap-3 border-b border-[#e6edf5] px-4">
              <AppIcon className="size-5 shrink-0 text-slate-400" name="search" />
              <input
                aria-activedescendant={items.length ? `${listId}-${activeIndex}` : undefined}
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded="true"
                aria-label="Rechercher un patient par nom ou téléphone, ou une page"
                autoComplete="off"
                className="min-h-14 flex-1 bg-transparent text-[15px] text-[var(--navy)] outline-none placeholder:text-slate-400"
                maxLength={80}
                onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                onKeyDown={onInputKeyDown}
                placeholder="Nom, prénom ou téléphone…"
                ref={inputRef}
                role="combobox"
                value={query}
              />
              {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--blue)]" /> : null}
              <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Échap</kbd>
            </div>

            <ul className="max-h-[55vh] overflow-y-auto p-2" id={listId} role="listbox">
              {items.map((item, index) => {
                const section = sectionOf(item);
                const heading = index === 0 || sectionOf(items[index - 1]) !== section ? section : null;
                const selected = index === activeIndex;
                return (
                  <li key={item.key} role="presentation">
                    {heading ? <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">{heading}</p> : null}
                    <div
                      aria-selected={selected}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-sm transition-colors ${selected ? "bg-[var(--blue-soft)] text-[var(--navy)]" : "text-slate-600"}`}
                      id={`${listId}-${index}`}
                      onClick={() => go(item)}
                      onMouseMove={() => setActive(index)}
                      role="option"
                    >
                      {item.kind === "patient" ? (
                        <>
                          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-[11px] font-bold text-[var(--navy)]">{item.patient.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[var(--navy)]">{item.patient.name}</span><span className="block text-xs text-slate-500 tabular-nums">{item.patient.phone}</span></span>
                          <span className="text-xs text-slate-400">Dossier →</span>
                        </>
                      ) : item.kind === "all" ? (
                        <span className="flex-1 font-medium text-[var(--blue-deep)]">Voir tous les patients pour « {item.term} »</span>
                      ) : (
                        <>
                          <span className="flex-1 font-medium">{item.command.label}</span>
                          <span className="text-xs text-slate-400">{item.command.section === "Actions" ? "Action" : "Page"}</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
              {!items.length ? <li className="px-3 py-8 text-center text-sm text-slate-500" role="presentation">{loading ? "Recherche…" : "Aucun résultat."}</li> : null}
              {term && !loading && !patients.length ? <li className="px-3 pt-1 pb-2 text-xs text-slate-400" role="presentation">Aucun patient actif ne correspond à « {term} ».</li> : null}
            </ul>

            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#e6edf5] bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
              <span><kbd className="font-semibold">↑ ↓</kbd> naviguer</span>
              <span><kbd className="font-semibold">Entrée</kbd> ouvrir</span>
              <span><kbd className="font-semibold">Ctrl K</kbd> ouvrir / fermer</span>
            </p>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
