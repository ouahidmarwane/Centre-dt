"use client";

import { useActionState, useState } from "react";

import type { PatientActionState } from "@/app/(dashboard)/patients/actions";
import { patientLimits, type PatientInput } from "@/lib/patients/validation";

type PatientFormProps = {
  action: (state: PatientActionState, formData: FormData) => Promise<PatientActionState>;
  initialValues?: PatientInput;
  submitLabel: string;
};

const emptyValues: PatientInput = {
  firstName: "",
  lastName: "",
  dateOfBirth: null,
  phone: "",
  profession: null,
  address: null,
  hasMutuelle: false,
  mutuelleName: null,
  hasMedicalHistory: false,
  medicalHistoryNotes: null,
  hasAllergies: false,
  allergyNotes: null,
  generalNotes: null,
};

const initialActionState: PatientActionState = {
  message: null,
  fieldErrors: {},
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-700">{message}</p> : null;
}

const inputClass =
  "mt-1.5 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-teal-100";

export function PatientForm({ action, initialValues = emptyValues, submitLabel }: PatientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [hasMutuelle, setHasMutuelle] = useState(initialValues.hasMutuelle);
  const [hasMedicalHistory, setHasMedicalHistory] = useState(initialValues.hasMedicalHistory);
  const [hasAllergies, setHasAllergies] = useState(initialValues.hasAllergies);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </div>
      ) : null}

      <FormSection description="Informations principales du patient." title="Identité">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Prénom <span aria-hidden="true">*</span>
            <input className={inputClass} defaultValue={initialValues.firstName} maxLength={patientLimits.name} name="firstName" required />
            <FieldError message={state.fieldErrors.firstName} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nom <span aria-hidden="true">*</span>
            <input className={inputClass} defaultValue={initialValues.lastName} maxLength={patientLimits.name} name="lastName" required />
            <FieldError message={state.fieldErrors.lastName} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Date de naissance
            <input className={inputClass} defaultValue={initialValues.dateOfBirth ?? ""} min="1900-01-01" name="dateOfBirth" type="date" />
            <FieldError message={state.fieldErrors.dateOfBirth} />
          </label>
        </div>
      </FormSection>

      <FormSection description="Coordonnées et informations administratives." title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Téléphone <span aria-hidden="true">*</span>
            <input className={inputClass} defaultValue={initialValues.phone} inputMode="tel" maxLength={patientLimits.phone} name="phone" required type="tel" />
            <FieldError message={state.fieldErrors.phone} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Profession
            <input className={inputClass} defaultValue={initialValues.profession ?? ""} maxLength={patientLimits.profession} name="profession" />
            <FieldError message={state.fieldErrors.profession} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Adresse
            <textarea className={inputClass} defaultValue={initialValues.address ?? ""} maxLength={patientLimits.address} name="address" rows={3} />
            <FieldError message={state.fieldErrors.address} />
          </label>
        </div>
      </FormSection>

      <FormSection description="Couverture déclarée par le patient." title="Mutuelle">
        <BooleanChoice checked={hasMutuelle} label="Le patient dispose d’une mutuelle" name="hasMutuelle" onChange={setHasMutuelle} />
        {hasMutuelle ? (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Nom de la mutuelle <span aria-hidden="true">*</span>
            <input className={inputClass} defaultValue={initialValues.mutuelleName ?? ""} maxLength={patientLimits.mutuelleName} name="mutuelleName" required />
            <FieldError message={state.fieldErrors.mutuelleName} />
          </label>
        ) : null}
      </FormSection>

      <FormSection description="Données de santé sensibles accessibles uniquement au personnel authentifié." title="Antécédents médicaux">
        <BooleanChoice checked={hasMedicalHistory} label="Antécédents médicaux connus" name="hasMedicalHistory" onChange={setHasMedicalHistory} />
        {hasMedicalHistory ? (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Description <span aria-hidden="true">*</span>
            <textarea className={inputClass} defaultValue={initialValues.medicalHistoryNotes ?? ""} maxLength={patientLimits.medicalNotes} name="medicalHistoryNotes" required rows={4} />
            <FieldError message={state.fieldErrors.medicalHistoryNotes} />
          </label>
        ) : null}
      </FormSection>

      <FormSection description="Informations distinctes des antécédents médicaux." title="Allergies">
        <BooleanChoice checked={hasAllergies} label="Allergies connues" name="hasAllergies" onChange={setHasAllergies} />
        {hasAllergies ? (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Description <span aria-hidden="true">*</span>
            <textarea className={inputClass} defaultValue={initialValues.allergyNotes ?? ""} maxLength={patientLimits.allergyNotes} name="allergyNotes" required rows={4} />
            <FieldError message={state.fieldErrors.allergyNotes} />
          </label>
        ) : null}
      </FormSection>

      <FormSection description="Informations générales utiles au suivi, hors données dentaires futures." title="Remarques">
        <label className="block text-sm font-medium text-slate-700">
          Remarques générales
          <textarea className={inputClass} defaultValue={initialValues.generalNotes ?? ""} maxLength={patientLimits.generalNotes} name="generalNotes" rows={4} />
          <FieldError message={state.fieldErrors.generalNotes} />
        </label>
      </FormSection>

      <div className="flex justify-end border-t border-[var(--border)] pt-5">
        <button className="rounded-md bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FormSection({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BooleanChoice({ checked, label, name, onChange }: { checked: boolean; label: string; name: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
      <input checked={checked} className="size-4 accent-[var(--brand)]" name={name} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}
