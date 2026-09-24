"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/server";
import { isPatientId } from "@/lib/patients/validation";
import { createClient } from "@/lib/supabase/server";

export async function markPaymentReminderAction(patientId: string): Promise<void> {
  await requirePermission("payments.reminders");
  if (!isPatientId(patientId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_payment_reminder_handled", { target_patient_id: patientId });
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}
