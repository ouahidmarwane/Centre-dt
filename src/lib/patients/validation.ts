import { ClinicDateTimeFormat } from "../clinic-time.ts";
export const patientLimits = {
  name: 120,
  phone: 32,
  profession: 160,
  address: 500,
  mutuelleName: 160,
  medicalNotes: 4000,
  allergyNotes: 4000,
  generalNotes: 5000,
  search: 80,
} as const;

export type PatientInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string;
  profession: string | null;
  address: string | null;
  hasMutuelle: boolean;
  mutuelleName: string | null;
  hasMedicalHistory: boolean;
  medicalHistoryNotes: string | null;
  hasAllergies: boolean;
  allergyNotes: string | null;
  generalNotes: string | null;
};

export type PatientField = keyof PatientInput;

export type PatientValidationResult =
  | { success: true; data: PatientInput }
  | { success: false; fieldErrors: Partial<Record<PatientField, string>> };

export type PatientStatusFilter = "active" | "archived" | "all";

export type SearchValidationResult =
  | { success: true; data: { query: string; status: PatientStatusFilter } }
  | { success: false; message: string };

const phonePattern = /^[0-9+()./ -]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value: FormDataEntryValue | null, maximum: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximum ? trimmed : null;
}

function optionalText(value: FormDataEntryValue | null, maximum: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : undefined;
}

function checkbox(value: FormDataEntryValue | null) {
  if (value === null) return { valid: true, value: false } as const;
  if (value === "on") return { valid: true, value: true } as const;
  return { valid: false, value: false } as const;
}

function clinicDate(now: Date): string {
  const parts = new ClinicDateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateOfBirth(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  const today = clinicDate(now);
  return value >= "1900-01-01" && value <= today;
}

export function validatePatientForm(formData: FormData): PatientValidationResult {
  const errors: Partial<Record<PatientField, string>> = {};
  const firstName = requiredText(formData.get("firstName"), patientLimits.name);
  const lastName = requiredText(formData.get("lastName"), patientLimits.name);
  const phone = requiredText(formData.get("phone"), patientLimits.phone);

  if (!firstName) errors.firstName = "Prénom requis (120 caractères maximum).";
  if (!lastName) errors.lastName = "Nom requis (120 caractères maximum).";
  if (!phone || !phonePattern.test(phone)) {
    errors.phone = "Numéro requis avec uniquement des chiffres et symboles téléphoniques usuels.";
  }

  const rawDate = formData.get("dateOfBirth");
  const dateOfBirth = typeof rawDate === "string" && rawDate.trim() ? rawDate.trim() : null;
  if (dateOfBirth && !isValidDateOfBirth(dateOfBirth)) {
    errors.dateOfBirth = "Date de naissance invalide ou située dans le futur.";
  }

  const profession = optionalText(formData.get("profession"), patientLimits.profession);
  const address = optionalText(formData.get("address"), patientLimits.address);
  const generalNotes = optionalText(formData.get("generalNotes"), patientLimits.generalNotes);
  if (profession === undefined) errors.profession = "Profession trop longue.";
  if (address === undefined) errors.address = "Adresse trop longue.";
  if (generalNotes === undefined) errors.generalNotes = "Remarques trop longues.";

  const hasMutuelle = checkbox(formData.get("hasMutuelle"));
  const hasMedicalHistory = checkbox(formData.get("hasMedicalHistory"));
  const hasAllergies = checkbox(formData.get("hasAllergies"));
  if (!hasMutuelle.valid) errors.hasMutuelle = "Valeur invalide.";
  if (!hasMedicalHistory.valid) errors.hasMedicalHistory = "Valeur invalide.";
  if (!hasAllergies.valid) errors.hasAllergies = "Valeur invalide.";

  const mutuelleName = hasMutuelle.value
    ? requiredText(formData.get("mutuelleName"), patientLimits.mutuelleName)
    : null;
  const medicalHistoryNotes = hasMedicalHistory.value
    ? requiredText(formData.get("medicalHistoryNotes"), patientLimits.medicalNotes)
    : null;
  const allergyNotes = hasAllergies.value
    ? requiredText(formData.get("allergyNotes"), patientLimits.allergyNotes)
    : null;

  if (hasMutuelle.value && !mutuelleName) {
    errors.mutuelleName = "Indiquez le nom de la mutuelle.";
  }
  if (hasMedicalHistory.value && !medicalHistoryNotes) {
    errors.medicalHistoryNotes = "Décrivez les antécédents médicaux.";
  }
  if (hasAllergies.value && !allergyNotes) {
    errors.allergyNotes = "Décrivez les allergies connues.";
  }

  if (Object.keys(errors).length > 0 || !firstName || !lastName || !phone) {
    return { success: false, fieldErrors: errors };
  }

  return {
    success: true,
    data: {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      profession: profession ?? null,
      address: address ?? null,
      hasMutuelle: hasMutuelle.value,
      mutuelleName,
      hasMedicalHistory: hasMedicalHistory.value,
      medicalHistoryNotes,
      hasAllergies: hasAllergies.value,
      allergyNotes,
      generalNotes: generalNotes ?? null,
    },
  };
}

export function validatePatientSearch(
  queryValue: string | string[] | undefined,
  statusValue: string | string[] | undefined,
): SearchValidationResult {
  const query = typeof queryValue === "string" ? queryValue.trim() : "";
  const status = typeof statusValue === "string" ? statusValue : "active";

  if (query.length === 1 || query.length > patientLimits.search || /[%_\u0000-\u001f]/.test(query)) {
    return { success: false, message: "La recherche doit contenir entre 2 et 80 caractères." };
  }
  if (status !== "active" && status !== "archived" && status !== "all") {
    return { success: false, message: "Filtre de statut invalide." };
  }
  return { success: true, data: { query, status } };
}

export function isPatientId(value: string): boolean {
  return uuidPattern.test(value);
}

export function calculateAge(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth || !isValidDateOfBirth(dateOfBirth, today)) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = clinicDate(today).split("-").map(Number);
  let age = currentYear - year;
  const beforeBirthday =
    currentMonth < month ||
    (currentMonth === month && currentDay < day);
  if (beforeBirthday) age -= 1;
  return age;
}
