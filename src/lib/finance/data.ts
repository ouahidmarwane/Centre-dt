import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Intervention = Tables<"interventions">;
export type Payment = Tables<"payments">;
export type FinancialSummary = { total_due: number; total_received: number; outstanding: number };
export type InterventionView = Intervention & { teeth: number[]; findingIds: string[] };

export async function getPatientFinances(patientId: string) {
  const supabase=await createClient();
  const [summaryResult,interventionsResult,paymentsResult]=await Promise.all([
    supabase.rpc("get_patient_financial_summary",{target_patient_id:patientId}).single(),
    supabase.from("interventions").select("*").eq("patient_id",patientId).order("performed_at",{ascending:false}),
    supabase.from("payments").select("*").eq("patient_id",patientId).order("received_at",{ascending:false}),
  ]);
  if(summaryResult.error||interventionsResult.error||paymentsResult.error) throw new Error("PATIENT_FINANCES_UNAVAILABLE");
  const interventionIds=(interventionsResult.data??[]).map(item=>item.id);
  const [teethResult,linksResult]=interventionIds.length ? await Promise.all([
    supabase.from("intervention_teeth").select("intervention_id,tooth_number").in("intervention_id",interventionIds),
    supabase.from("intervention_findings").select("intervention_id,dental_finding_id").in("intervention_id",interventionIds),
  ]) : [{data:[],error:null},{data:[],error:null}];
  if(teethResult.error||linksResult.error) throw new Error("PATIENT_FINANCES_UNAVAILABLE");
  const interventions: InterventionView[]=(interventionsResult.data??[]).map(item=>({...item,
    teeth:(teethResult.data??[]).filter(link=>link.intervention_id===item.id).map(link=>link.tooth_number),
    findingIds:(linksResult.data??[]).filter(link=>link.intervention_id===item.id).map(link=>link.dental_finding_id),
  }));
  return {summary:summaryResult.data as FinancialSummary,interventions,payments:paymentsResult.data??[]};
}
