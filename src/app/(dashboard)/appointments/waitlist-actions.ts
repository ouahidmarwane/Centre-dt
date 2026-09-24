"use server";

import { revalidatePath } from "next/cache";

import type { AppointmentActionState } from "@/app/(dashboard)/appointments/actions";
import { isUuid } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { validateWaitlistForm } from "@/lib/waitlist/validation";

const fail = (message: string, fieldErrors: AppointmentActionState["fieldErrors"] = {}): AppointmentActionState => ({ success: false, message, fieldErrors });

function refresh(patientId?: string) {
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export async function addWaitlistEntryAction(_state: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  await requirePermission("appointments.write");
  const validation = validateWaitlistForm(formData);
  if (!validation.success) return fail("Vérifiez les informations indiquées.", validation.fieldErrors);
  const value = validation.data, supabase = await createClient();
  const { error } = await supabase.rpc("add_waitlist_entry", {
    target_patient_id: value.patientId, target_reason: value.reason, target_preferred_period: value.preferredPeriod,
    target_duration_minutes: value.durationMinutes, target_is_urgent: value.isUrgent, target_notes: value.notes ?? undefined,
  });
  if (error) return fail(error.code === "23505" ? "Ce patient est déjà dans la liste d’attente." : "L’inscription n’a pas pu être enregistrée.");
  refresh(value.patientId);
  return { success: true, message: "Patient ajouté à la liste d’attente.", fieldErrors: {} };
}

export async function removeWaitlistEntryAction(entryId: string): Promise<void> {
  await requirePermission("appointments.write");
  if (!isUuid(entryId)) return;
  const supabase = await createClient();
  await supabase.rpc("remove_waitlist_entry", { target_entry_id: entryId });
  refresh();
}

export async function bookWaitlistEntryAction(entryId: string, startsAt: string, _state: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  await requirePermission("appointments.write");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!isUuid(entryId) || !isUuid(idempotencyKey) || Number.isNaN(new Date(startsAt).getTime())) return fail("Réservation invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_waitlist_entry", { target_entry_id: entryId, target_starts_at: startsAt, target_idempotency_key: idempotencyKey });
  if (error) {
    if (error.code === "23P01") return fail("Ce créneau vient d’être occupé par un autre rendez-vous.");
    if (error.code === "23505") return fail("Cette réservation a déjà été enregistrée.");
    return fail("Ce créneau ne peut plus être réservé pour ce patient.");
  }
  refresh();
  return { success: true, message: "Rendez-vous réservé depuis la liste d’attente.", fieldErrors: {} };
}
