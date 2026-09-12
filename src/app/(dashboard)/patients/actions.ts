"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/server";
import { listPatients, type PatientListItem } from "@/lib/patients/data";
import {
  isPatientId,
  validatePatientForm,
  validatePatientSearch,
  type PatientField,
  type PatientInput,
} from "@/lib/patients/validation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

export type PatientActionState = {
  message: string | null;
  fieldErrors: Partial<Record<PatientField, string>>;
};

export type PatientSearchState = {
  items: PatientListItem[];
  query: string;
  status: "active" | "archived" | "all";
  message: string | null;
};

export async function searchPatientsAction(
  previousState: PatientSearchState,
  formData: FormData,
): Promise<PatientSearchState> {
  await requirePermission("patients.read");
  const query = formData.get("query");
  const status = formData.get("status");
  const validation = validatePatientSearch(
    typeof query === "string" ? query : undefined,
    typeof status === "string" ? status : undefined,
  );

  if (!validation.success) {
    return { ...previousState, message: validation.message };
  }

  try {
    const items = await listPatients(validation.data.query, validation.data.status);
    return { items, ...validation.data, message: null };
  } catch {
    return { ...previousState, message: "La recherche est momentanément indisponible." };
  }
}

function patientColumns(input: PatientInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    date_of_birth: input.dateOfBirth,
    phone: input.phone,
    profession: input.profession,
    address: input.address,
    has_mutuelle: input.hasMutuelle,
    mutuelle_name: input.mutuelleName,
    has_medical_history: input.hasMedicalHistory,
    medical_history_notes: input.medicalHistoryNotes,
    has_allergies: input.hasAllergies,
    allergy_notes: input.allergyNotes,
    general_notes: input.generalNotes,
  };
}

export async function createPatientAction(
  _previousState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const user = await requirePermission("patients.write");
  const validation = validatePatientForm(formData);

  if (!validation.success) {
    return {
      message: "Vérifiez les informations indiquées.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const payload: TablesInsert<"patients"> = {
    ...patientColumns(validation.data),
    created_by: user.id,
    updated_by: user.id,
  };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: "Le patient n’a pas pu être enregistré. Réessayez.",
      fieldErrors: {},
    };
  }

  revalidatePath("/patients");
  redirect(`/patients/${data.id}`);
}

export async function updatePatientAction(
  patientId: string,
  _previousState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  await requirePermission("patients.write");
  if (!isPatientId(patientId)) {
    return { message: "Dossier patient invalide.", fieldErrors: {} };
  }

  const validation = validatePatientForm(formData);
  if (!validation.success) {
    return {
      message: "Vérifiez les informations indiquées.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const payload: TablesUpdate<"patients"> = patientColumns(validation.data);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update(payload)
    .eq("id", patientId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      message: "Le dossier n’a pas pu être mis à jour. Vérifiez qu’il est toujours actif.",
      fieldErrors: {},
    };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function archivePatientAction(patientId: string): Promise<void> {
  await requirePermission("patients.archive");
  if (!isPatientId(patientId)) {
    redirect("/patients?error=invalid-patient");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_patient", {
    patient_id: patientId,
  });

  if (error || !data) {
    redirect(`/patients/${patientId}?error=archive-failed`);
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
