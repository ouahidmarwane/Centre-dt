"use server";

import { requirePermission } from "@/lib/auth/server";
import { normalizeQuickSearchTerm, QUICK_SEARCH_PATIENT_LIMIT } from "@/lib/search/quick-search";
import { createClient } from "@/lib/supabase/server";

export type QuickPatientResult = { id: string; name: string; phone: string };

export async function quickSearchPatientsAction(query: string): Promise<QuickPatientResult[]> {
  await requirePermission("patients.read");
  const term = normalizeQuickSearchTerm(query);
  if (!term) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_patients", { search_term: term, patient_status: "active" });
  if (error) return [];
  return (data ?? []).slice(0, QUICK_SEARCH_PATIENT_LIMIT).map((patient) => ({
    id: patient.id,
    name: `${patient.first_name} ${patient.last_name}`,
    phone: patient.phone,
  }));
}
