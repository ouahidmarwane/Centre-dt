import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppPaymentReminderUrl } from "./validation";

export type PaymentFollowupItem = {
  patientId: string; name: string; firstName: string; phone: string; outstanding: number; unpaidSince: string | null;
  lastPaymentAt: string | null; lastReminderAt: string | null; reminderCount: number; isDue: boolean; whatsappUrl: string | null;
};

export async function getPaymentFollowup(): Promise<PaymentFollowupItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payment_followup", {});
  if (error) throw new Error("PAYMENT_FOLLOWUP_UNAVAILABLE");
  return (data ?? []).map((row) => ({
    patientId: row.patient_id, name: `${row.first_name} ${row.last_name}`, firstName: row.first_name, phone: row.phone,
    outstanding: Number(row.outstanding), unpaidSince: row.unpaid_since, lastPaymentAt: row.last_payment_at, lastReminderAt: row.last_reminder_at,
    reminderCount: Number(row.reminder_count), isDue: row.is_due,
    whatsappUrl: buildWhatsAppPaymentReminderUrl({ phone: row.phone, firstName: row.first_name, outstanding: Number(row.outstanding) }),
  }));
}
