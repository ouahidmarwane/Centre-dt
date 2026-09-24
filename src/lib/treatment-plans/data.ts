import "server-only";

import { createClient } from "@/lib/supabase/server";
import { summarizePlan, type PlanSummary, type TreatmentCategory, type TreatmentPlanStatus } from "./validation";

export type TreatmentStepView = { id: string; position: number; label: string; amount: number; plannedDate: string | null; done: boolean; completedAt: string | null };
export type TreatmentPlanView = {
  id: string; title: string; category: TreatmentCategory; notes: string | null; status: TreatmentPlanStatus;
  createdAt: string; acceptedAt: string | null; completedAt: string | null; cancelledAt: string | null; cancellationReason: string | null;
  steps: TreatmentStepView[]; summary: PlanSummary;
};

export async function getPatientTreatmentPlans(patientId: string): Promise<TreatmentPlanView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .select("id,title,category,notes,status,created_at,accepted_at,completed_at,cancelled_at,cancellation_reason,steps:treatment_plan_steps(id,position,label,amount,planned_date,completed_at,intervention:interventions(status))")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("TREATMENT_PLANS_UNAVAILABLE");
  return (data ?? []).map((plan) => {
    const steps = [...plan.steps].sort((a, b) => a.position - b.position).map((step) => ({
      id: step.id, position: step.position, label: step.label, amount: Number(step.amount), plannedDate: step.planned_date,
      // A step whose intervention was cancelled is open again.
      done: step.intervention?.status === "performed", completedAt: step.intervention?.status === "performed" ? step.completed_at : null,
    }));
    return {
      id: plan.id, title: plan.title, category: plan.category as TreatmentCategory, notes: plan.notes, status: plan.status,
      createdAt: plan.created_at, acceptedAt: plan.accepted_at, completedAt: plan.completed_at, cancelledAt: plan.cancelled_at, cancellationReason: plan.cancellation_reason,
      steps, summary: summarizePlan(steps),
    };
  });
}
