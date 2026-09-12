"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/server";
import { isPatientId } from "@/lib/patients/validation";
import { isDentalFindingId, validateDentalFindingForm, type DentalFindingField } from "@/lib/odontogram/validation";
import { createClient } from "@/lib/supabase/server";

export type DentalActionState = {
  success: boolean;
  message: string | null;
  fieldErrors: Partial<Record<DentalFindingField, string>>;
};

const invalidState = (message: string): DentalActionState => ({ success: false, message, fieldErrors: {} });

export async function createDentalFindingAction(patientId: string, _state: DentalActionState, formData: FormData): Promise<DentalActionState> {
  await requirePermission("odontogram.write");
  if (!isPatientId(patientId)) return invalidState("Dossier patient invalide.");
  const validation = validateDentalFindingForm(formData);
  if (!validation.success) return { success: false, message: "Vérifiez les informations indiquées.", fieldErrors: validation.fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_dental_finding", {
    target_patient_id: patientId,
    target_tooth_number: validation.data.toothNumber,
    target_condition: validation.data.condition,
    target_status: validation.data.status,
    target_notes: validation.data.notes ?? undefined,
    target_recommendation: validation.data.recommendation ?? undefined,
  });
  if (error) return invalidState("La constatation n’a pas pu être enregistrée.");
  revalidatePath(`/patients/${patientId}`);
  return { success: true, message: "Constatation enregistrée.", fieldErrors: {} };
}

export async function updateDentalFindingAction(patientId: string, findingId: string, _state: DentalActionState, formData: FormData): Promise<DentalActionState> {
  await requirePermission("odontogram.write");
  if (!isPatientId(patientId) || !isDentalFindingId(findingId)) return invalidState("Constatation invalide.");
  const validation = validateDentalFindingForm(formData);
  if (!validation.success) return { success: false, message: "Vérifiez les informations indiquées.", fieldErrors: validation.fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_dental_finding", {
    target_patient_id: patientId,
    target_finding_id: findingId,
    target_condition: validation.data.condition,
    target_status: validation.data.status,
    target_notes: validation.data.notes ?? undefined,
    target_recommendation: validation.data.recommendation ?? undefined,
  });
  if (error || !data) return invalidState("La constatation n’a pas pu être mise à jour.");
  revalidatePath(`/patients/${patientId}`);
  return { success: true, message: "Constatation mise à jour.", fieldErrors: {} };
}

export async function resolveDentalFindingAction(patientId: string, findingId: string): Promise<void> {
  await requirePermission("odontogram.resolve");
  if (!isPatientId(patientId) || !isDentalFindingId(findingId)) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_dental_finding", { target_patient_id: patientId, target_finding_id: findingId });
  if (!error && data) revalidatePath(`/patients/${patientId}`);
}
