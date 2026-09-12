import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

import type { PatientStatusFilter } from "./validation";

export type Patient = Tables<"patients">;

export type PatientListItem = Pick<
  Patient,
  | "id"
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "phone"
  | "has_mutuelle"
  | "mutuelle_name"
  | "is_active"
  | "updated_at"
>;

export async function listPatients(
  query: string,
  status: PatientStatusFilter,
): Promise<PatientListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_patients", {
    search_term: query || undefined,
    patient_status: status,
  });

  if (error) {
    throw new Error("PATIENT_LIST_UNAVAILABLE");
  }

  return data ?? [];
}

export async function getPatient(patientId: string): Promise<Patient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (error) {
    throw new Error("PATIENT_LOOKUP_UNAVAILABLE");
  }

  return data;
}
