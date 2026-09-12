import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type DentalFinding = Tables<"dental_findings">;
export type DentalRevision = Pick<
  Tables<"dental_finding_revisions">,
  "id" | "finding_id" | "tooth_number" | "condition" | "status" | "event_type" | "changed_by_role" | "changed_at"
>;

export async function getDentalChart(patientId: string) {
  const supabase = await createClient();
  const [findingsResult, revisionsResult] = await Promise.all([
    supabase.from("dental_findings").select("*").eq("patient_id", patientId).eq("is_active", true).order("tooth_number"),
    supabase
      .from("dental_finding_revisions")
      .select("id, finding_id, tooth_number, condition, status, event_type, changed_by_role, changed_at")
      .eq("patient_id", patientId)
      .order("changed_at", { ascending: false })
      .limit(500),
  ]);

  if (findingsResult.error || revisionsResult.error) throw new Error("DENTAL_CHART_UNAVAILABLE");
  return { findings: findingsResult.data ?? [], revisions: revisionsResult.data ?? [] };
}
