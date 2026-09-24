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
> & { upcoming_appointment_starts_at: string | null };

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

  const patients = data ?? [];
  if (!patients.length) return [];

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("patient_id,starts_at")
    .in("patient_id", patients.map((patient) => patient.id))
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");

  if (appointmentsError) throw new Error("PATIENT_APPOINTMENTS_UNAVAILABLE");

  const nextAppointmentByPatient = new Map<string, string>();
  for (const appointment of appointments ?? []) {
    if (!nextAppointmentByPatient.has(appointment.patient_id)) {
      nextAppointmentByPatient.set(appointment.patient_id, appointment.starts_at);
    }
  }

  return patients.map((patient) => ({
    ...patient,
    upcoming_appointment_starts_at: nextAppointmentByPatient.get(patient.id) ?? null,
  }));
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

export type OperationalPatient=Pick<Patient,"id"|"first_name"|"last_name"|"date_of_birth"|"phone"|"profession"|"address"|"has_mutuelle"|"mutuelle_name"|"is_active">;
export async function getOperationalPatient(patientId:string):Promise<OperationalPatient|null>{const supabase=await createClient();const{data,error}=await supabase.from("patients").select("id,first_name,last_name,date_of_birth,phone,profession,address,has_mutuelle,mutuelle_name,is_active").eq("id",patientId).maybeSingle();if(error)throw new Error("PATIENT_LOOKUP_UNAVAILABLE");return data;}
