"use client";

import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { searchPatientsAction, type PatientSearchState } from "@/app/(dashboard)/patients/actions";
import { SpotlightSurface, spotlightClass, trackSpotlight, type SpotlightTexture } from "@/components/dashboard/spotlight-surface";
import { buildWhatsAppAppointmentUrl } from "@/lib/appointments/validation";
import { calculateAge } from "@/lib/patients/validation";

import styles from "./patient-list.module.css";
import { usePatientPhoto } from "./patient-photo";

type Patient = PatientSearchState["items"][number];
type Status = PatientSearchState["status"];
type Sort = "recent" | "name" | "next";

const updatedFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const apptDay = new ClinicDateTimeFormat("fr-FR", { day: "2-digit" });
const apptMonth = new ClinicDateTimeFormat("fr-FR", { month: "short" });
const apptWeekday = new ClinicDateTimeFormat("fr-FR", { weekday: "long" });
const apptTime = new ClinicDateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const statusOptions: { value: Status; label: string }[] = [
  { value: "active", label: "Actifs" },
  { value: "archived", label: "Archivés" },
  { value: "all", label: "Tous" },
];
const sortOptions: { value: Sort; label: string }[] = [
  { value: "recent", label: "Récents" },
  { value: "name", label: "A → Z" },
  { value: "next", label: "Prochain RDV" },
];

// Calm tints picked from the id so a patient keeps the same colour everywhere in the list.
const avatarTints = [
  "bg-[#e3f0ff] text-[#0f5fc5]",
  "bg-[#dff6f2] text-[#0e7c6d]",
  "bg-[#f6efdf] text-[#8a6a25]",
  "bg-[#efeafc] text-[#5548bd]",
  "bg-[#fdebe6] text-[#ad4739]",
  "bg-[#e8eef5] text-[#34506f]",
];

function tintFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarTints[hash % avatarTints.length];
}

function fullName(patient: Patient) {
  return `${patient.first_name} ${patient.last_name}`;
}

function sortPatients(items: Patient[], sort: Sort) {
  const copy = [...items];
  if (sort === "name") return copy.sort((a, b) => a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"));
  if (sort === "next") return copy.sort((a, b) => (a.upcoming_appointment_starts_at ?? "￿").localeCompare(b.upcoming_appointment_starts_at ?? "￿"));
  return copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function PatientList({ initialState }: { initialState: PatientSearchState }) {
  const [state, formAction, pending] = useActionState(searchPatientsAction, initialState);
  // Controlled fields: React resets uncontrolled inputs after a form action, which would
  // swallow characters typed while an automatic search is in flight.
  const [query, setQuery] = useState(initialState.query);
  const [status, setStatus] = useState<Status>(initialState.status);
  const [sort, setSort] = useState<Sort>("recent");
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => sortPatients(state.items, sort), [state.items, sort]);

  function submitSoon(delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => form.current?.requestSubmit(), delay);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="mt-6 space-y-4">
      <form action={formAction} className="relative overflow-hidden rounded-[20px] border border-[#dbe6f1] bg-white/85 p-3 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)] sm:p-4" ref={form} role="search">
        {pending ? <span aria-hidden="true" className={styles.progress} /> : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="group relative flex min-h-12 flex-1 items-center rounded-[14px] border border-[#d7e2ee] bg-white transition-all duration-200 focus-within:border-[var(--blue)] focus-within:shadow-[inset_0_0_0_1px_var(--blue)] hover:border-[#bfd3e8]">
            <span className="sr-only">Rechercher un patient</span>
            <svg aria-hidden="true" className="ml-4 size-[18px] shrink-0 text-slate-400 transition-colors group-focus-within:text-[var(--blue)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-[var(--navy)] outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-slate-400"
              maxLength={80}
              name="query"
              onChange={(event) => { setQuery(event.target.value); submitSoon(350); }}
              placeholder="Nom, prénom ou téléphone"
              ref={input}
              value={query}
            />
            {query ? (
              <button aria-label="Effacer la recherche" className="mr-2 grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[var(--navy)]" onClick={() => { setQuery(""); submitSoon(0); input.current?.focus(); }} type="button">
                <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            ) : (
              <kbd aria-hidden="true" className="mr-3 hidden rounded-md border border-[#dbe6f1] bg-[#f5f8fb] px-1.5 py-0.5 font-sans text-[11px] text-slate-400 sm:inline">/</kbd>
            )}
          </label>

          <fieldset className="flex items-center gap-3">
            <legend className="sr-only">Statut des dossiers</legend>
            <Segmented name="status" onChange={(value) => { setStatus(value); submitSoon(0); }} options={statusOptions} value={status} />
          </fieldset>

          <button className="ios-button min-h-12 shrink-0 bg-[var(--navy)] px-5 text-sm font-semibold text-white transition-all hover:bg-[#1b3d63] active:scale-[0.98] disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </form>

      {state.message ? <p aria-live="polite" className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p> : null}

      <PatientStats items={state.items} status={state.status} />

      <section aria-busy={pending} aria-label="Liste des patients" className={`relative overflow-hidden rounded-[20px] border border-[#dbe6f1] bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)] transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6edf5] px-5 py-3.5 sm:px-6">
          <p aria-live="polite" className="text-sm text-slate-500">
            <strong className="metric-number font-semibold text-[var(--navy)]">{items.length}</strong> {items.length > 1 ? "dossiers" : "dossier"}
            {state.query ? <> pour « <span className="font-medium text-[var(--navy)]">{state.query}</span> »</> : null}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Trier</span>
            <Segmented compact name="sort" onChange={setSort} options={sortOptions} value={sort} />
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState hasQuery={Boolean(state.query)} onClear={() => { setQuery(""); setStatus("active"); submitSoon(0); }} />
        ) : (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2.3fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.9fr)_96px_20px] gap-4 px-6 pt-3 pb-1 text-[11px] font-medium text-slate-400 lg:grid">
              <span>Patient</span><span>Téléphone</span><span>Mutuelle</span><span>Prochain rendez-vous</span><span>Statut</span><span />
            </div>
            <ul className="divide-y divide-[#eef3f8] px-2 pb-2 sm:px-3">
              {items.map((patient) => <PatientRow key={patient.id} patient={patient} />)}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Segmented<T extends string>({ name, value, options, onChange, compact = false }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; compact?: boolean }) {
  return (
    <div className={`inline-flex rounded-[12px] bg-[#eef3f8] p-1 ${compact ? "" : "min-h-12 items-center"}`}>
      {options.map((option) => (
        <label className={`relative cursor-pointer rounded-[9px] font-semibold transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--blue)] ${compact ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-[13px]"} ${value === option.value ? "bg-white text-[var(--navy)] shadow-[0_1px_3px_rgba(16,44,76,0.14)]" : "text-slate-500 hover:text-[var(--navy)]"}`} key={option.value}>
          <input checked={value === option.value} className="sr-only" name={name} onChange={() => onChange(option.value)} type="radio" value={option.value} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function PatientStats({ items, status }: { items: Patient[]; status: Status }) {
  const withAppointment = items.filter((patient) => patient.upcoming_appointment_starts_at).length;
  const withMutuelle = items.filter((patient) => patient.has_mutuelle).length;
  const ages = items.map((patient) => calculateAge(patient.date_of_birth)).filter((age): age is number => age !== null);
  const averageAge = ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
  const share = (part: number) => (items.length ? Math.round((part / items.length) * 100) : 0);
  const stats: { label: string; value: string; note: string; texture: SpotlightTexture }[] = [
    { label: status === "archived" ? "Dossiers archivés" : status === "all" ? "Tous les dossiers" : "Dossiers actifs", value: String(items.length), note: "Dans la vue actuelle", texture: "people" },
    { label: "Rendez-vous à venir", value: String(withAppointment), note: items.length ? `${share(withAppointment)} % des patients` : "—", texture: "calendar" },
    { label: "Couverts par une mutuelle", value: String(withMutuelle), note: items.length ? `${share(withMutuelle)} % des patients` : "—", texture: "money" },
    { label: "Âge moyen", value: averageAge === null ? "—" : String(averageAge), note: ages.length ? `Sur ${ages.length} date${ages.length > 1 ? "s" : ""} de naissance` : "Aucune date renseignée", texture: "pulse" },
  ];
  return (
    <section aria-label="Aperçu de la patientèle" className="overflow-hidden rounded-[20px] border border-[#dbe6f1] bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)]">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <SpotlightSurface className={`kpi-rise relative flex flex-col border-[#e6edf5] px-5 py-4 sm:px-6 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`} key={stat.label} texture={stat.texture}>
            <dt className="text-[13px] font-medium text-slate-600">{stat.label}</dt>
            <dd className="mt-2 flex items-baseline gap-1.5">
              <span className="metric-number text-[28px] leading-none font-semibold tracking-[-0.03em] text-[var(--navy)]">{stat.value}</span>
              {stat.label === "Âge moyen" && averageAge !== null ? <span className="text-xs font-medium text-slate-400">ans</span> : null}
            </dd>
            <dd className="mt-2 text-xs text-slate-500">{stat.note}</dd>
          </SpotlightSurface>
        ))}
      </dl>
    </section>
  );
}

function PatientRow({ patient }: { patient: Patient }) {
  const name = fullName(patient);
  const age = calculateAge(patient.date_of_birth);
  const startsAt = patient.upcoming_appointment_starts_at;
  const whatsapp = startsAt ? buildWhatsAppAppointmentUrl({ phone: patient.phone, firstName: patient.first_name, startsAt }) : null;

  return (
    <li className={`${styles.row} ${spotlightClass("dots")} group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-[14px] px-3 py-3.5 transition-colors duration-200 hover:bg-[#f5f9fd] has-[a:focus-visible]:bg-[#f5f9fd] sm:px-4 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.9fr)_96px_20px]`} onPointerMove={trackSpotlight}>
      <span aria-hidden="true" className="absolute top-[18%] bottom-[18%] left-0 z-[2] w-[3px] origin-center scale-y-0 rounded-r-[3px] bg-[var(--blue)] transition-transform duration-300 ease-out group-hover:scale-y-100 group-has-[a:focus-visible]:scale-y-100" />
      <div className="col-span-2 flex min-w-0 items-center gap-3.5 lg:col-span-1">
        <PatientAvatar patient={patient} />
        <div className="min-w-0">
          <Link aria-label={`Ouvrir le dossier de ${name}`} className="block truncate text-[15px] font-semibold text-[var(--navy)] outline-none after:absolute after:inset-0 after:z-[1] after:rounded-[14px] after:content-[''] group-hover:text-[var(--blue-deep)]" href={`/patients/${patient.id}`}>{name}</Link>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {age === null ? "Âge non renseigné" : `${age} ans`}
            <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
            mis à jour le {updatedFormatter.format(new Date(patient.updated_at))}
          </p>
        </div>
      </div>

      <div className="col-start-3 row-start-1 lg:hidden"><StatusBadge active={patient.is_active} /></div>

      <div className="col-span-3 flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.625rem] text-sm lg:contents">
        <a className="relative z-10 w-fit rounded-md font-medium text-slate-700 tabular-nums transition-colors hover:text-[var(--blue-deep)] hover:underline" href={`tel:${patient.phone.replace(/[^0-9+]/g, "")}`}>{patient.phone}</a>

        <div className="min-w-0">
          {patient.has_mutuelle ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#eef6ff] px-2.5 py-1 text-xs font-semibold text-[#0f5fc5]">
              <svg aria-hidden="true" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
              <span className="truncate">{patient.mutuelle_name}</span>
            </span>
          ) : <span className="text-xs text-slate-400">Sans mutuelle</span>}
        </div>

        <div className="flex min-w-0 items-center gap-3">
          {startsAt ? (
            <>
              <span aria-hidden="true" className="grid w-10 shrink-0 overflow-hidden rounded-[9px] border border-[#dbe6f1] bg-white text-center shadow-[0_1px_2px_rgba(16,44,76,0.06)]">
                <span className="bg-[var(--blue)] py-px text-[9px] font-semibold text-white uppercase">{apptMonth.format(new Date(startsAt)).replace(".", "")}</span>
                <span className="metric-number py-0.5 text-sm leading-5 font-semibold text-[var(--navy)]">{apptDay.format(new Date(startsAt))}</span>
              </span>
              <span className="min-w-0 text-xs leading-5">
                <span className="block truncate font-medium text-[var(--navy)] capitalize">{apptWeekday.format(new Date(startsAt))}</span>
                <span className="metric-number text-slate-500">{apptTime.format(new Date(startsAt))}</span>
              </span>
              <WhatsAppReminder name={name} patientId={patient.id} url={whatsapp} />
            </>
          ) : <span className="text-xs text-slate-400">Aucun rendez-vous prévu</span>}
        </div>

        <div className="hidden lg:block"><StatusBadge active={patient.is_active} /></div>
      </div>

      <span aria-hidden="true" className="hidden text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--blue)] lg:block">→</span>
    </li>
  );
}

// Opens WhatsApp with the pre-written reminder; if the number can't be used, says so and links to the fix.
function WhatsAppReminder({ url, name, patientId }: { url: string | null; name: string; patientId: string }) {
  if (!url) {
    return (
      <Link className="relative z-10 ml-auto inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset transition-colors hover:bg-amber-100 lg:ml-0" href={`/patients/${patientId}/edit`} title="Le numéro n’est pas reconnu par WhatsApp. Cliquez pour le corriger.">
        Numéro à corriger
      </Link>
    );
  }
  return (
    <a aria-label={`Envoyer un rappel WhatsApp à ${name}`} className="relative z-10 ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#128c7e] px-2.5 text-xs font-semibold text-white shadow-[0_6px_14px_-8px_rgba(18,140,126,0.9)] transition-all duration-200 hover:-translate-y-px hover:bg-[#0d7166] active:translate-y-0 active:scale-95 lg:ml-0" href={url} rel="noopener noreferrer" target="_blank" title="Ouvre WhatsApp avec le message de rappel déjà écrit">
      <WhatsAppGlyph />
      Rappel
    </a>
  );
}

export function WhatsAppGlyph({ className = "size-4" }: { className?: string }) {
  return <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3" /></svg>;
}

function PatientAvatar({ patient }: { patient: Patient }) {
  const photo = usePatientPhoto(patient.id);
  const initials = `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();
  return (
    <span aria-hidden="true" className={`relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[14px] text-[13px] font-semibold transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-2 ${photo ? "bg-slate-100" : tintFor(patient.id)}`}>
      {photo ? (
        // Local browser photo cannot use the Next image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" height={44} src={photo} width={44} />
      ) : initials}
      {patient.upcoming_appointment_starts_at ? <span className="absolute right-0.5 bottom-0.5 size-2.5 rounded-full border-2 border-white bg-[var(--blue)]" /> : null}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${active ? "bg-[#e9f8f4] text-[#0e7c6d]" : "bg-slate-100 text-slate-500"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-[#19a996]" : "bg-slate-400"}`} />
      {active ? "Actif" : "Archivé"}
    </span>
  );
}

function EmptyState({ hasQuery, onClear }: { hasQuery: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span aria-hidden="true" className="grid size-14 place-items-center rounded-[18px] bg-[#eef6ff] text-[var(--blue)]">
        <svg className="size-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
          {hasQuery ? <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 11h5" /></> : <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6" /></>}
        </svg>
      </span>
      <h2 className="mt-4 text-base font-semibold text-[var(--navy)]">{hasQuery ? "Aucun patient ne correspond" : "Aucun patient dans cette vue"}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{hasQuery ? "Vérifiez l’orthographe, essayez avec le numéro de téléphone ou élargissez le statut." : "Créez un premier dossier pour commencer à suivre vos patients."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasQuery ? <button className="rounded-[10px] border border-[#d6e3f0] bg-white px-4 py-2 text-sm font-semibold text-[var(--blue-deep)] transition-all hover:border-[var(--blue)] active:scale-[0.98]" onClick={onClear} type="button">Effacer la recherche</button> : null}
        <Link className="rounded-[10px] bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--blue-deep)] active:scale-[0.98]" href="/patients/new">Nouveau patient</Link>
      </div>
    </div>
  );
}
