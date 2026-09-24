"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { isPatientId } from "@/lib/patients/validation";
import { createClient } from "@/lib/supabase/server";
import { validateTreatmentPlanForm, type TreatmentPlanField } from "@/lib/treatment-plans/validation";

export type TreatmentPlanActionState = { success: boolean; message: string | null; fieldErrors: Partial<Record<TreatmentPlanField | "reason" | "performedAt", string>> };
const fail = (message: string, fieldErrors: TreatmentPlanActionState["fieldErrors"] = {}): TreatmentPlanActionState => ({ success: false, message, fieldErrors });
const done = (patientId: string, message: string): TreatmentPlanActionState => { revalidatePath(`/patients/${patientId}`); revalidatePath("/dashboard"); return { success: true, message, fieldErrors: {} }; };

export async function createTreatmentPlanAction(patientId: string, _state: TreatmentPlanActionState, formData: FormData): Promise<TreatmentPlanActionState> {
  await requirePermission("treatment_plans.write");
  if (!isPatientId(patientId)) return fail("Dossier patient invalide.");
  const validation = validateTreatmentPlanForm(formData);
  if (!validation.success) return fail("Vérifiez les informations du plan.", validation.fieldErrors);
  const value = validation.data, supabase = await createClient();
  const { error } = await supabase.rpc("create_treatment_plan", {
    target_patient_id: patientId, target_title: value.title, target_category: value.category, target_notes: value.notes ?? "",
    target_steps: value.steps, target_idempotency_key: value.idempotencyKey,
  });
  if (error) return fail(error.code === "23505" ? "Ce plan a déjà été enregistré." : "Le plan n’a pas pu être enregistré.");
  return done(patientId, "Plan de traitement enregistré. Faites accepter le devis au patient.");
}

export async function acceptTreatmentPlanAction(patientId: string, planId: string): Promise<void> {
  await requirePermission("treatment_plans.progress");
  if (!isPatientId(patientId) || !isUuid(planId)) return;
  const supabase = await createClient();
  await supabase.rpc("accept_treatment_plan", { target_plan_id: planId });
  done(patientId, "");
}

export async function completeTreatmentStepAction(patientId: string, stepId: string, _state: TreatmentPlanActionState, formData: FormData): Promise<TreatmentPlanActionState> {
  await requirePermission("treatment_plans.progress");
  const performedAt = String(formData.get("performedAt") ?? ""), idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!isPatientId(patientId) || !isUuid(stepId) || !isUuid(idempotencyKey)) return fail("Séance invalide. Rechargez la page.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedAt)) return fail("Indiquez la date de la séance.", { performedAt: "Date requise." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_treatment_step", { target_step_id: stepId, target_performed_at: performedAt, target_idempotency_key: idempotencyKey });
  if (error) return fail(error.message.includes("performed date") ? "La date de séance ne peut pas être dans le futur." : "Cette séance ne peut pas être validée.");
  return done(patientId, "Séance validée : le soin est ajouté au compte du patient.");
}

export async function cancelTreatmentPlanAction(patientId: string, planId: string, _state: TreatmentPlanActionState, formData: FormData): Promise<TreatmentPlanActionState> {
  await requirePermission("treatment_plans.write");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isPatientId(patientId) || !isUuid(planId)) return fail("Plan invalide.");
  if (reason.length < 5 || reason.length > 500) return fail("Le motif doit contenir entre 5 et 500 caractères.", { reason: "Motif requis." });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_treatment_plan", { target_plan_id: planId, target_reason: reason });
  if (error || !data) return fail("Ce plan ne peut plus être annulé.");
  return done(patientId, "Plan annulé. Les séances déjà réalisées restent facturées.");
}
