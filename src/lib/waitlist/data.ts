import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppSlotOfferUrl, FREED_SLOT_WINDOW_DAYS, findFreedSlots, rankWaitlistForSlot, type FreedSlot, type WaitlistEntry, type WaitlistPeriod } from "./validation";

export type FreedSlotSuggestion = FreedSlot & { candidates: (WaitlistEntry & { whatsappUrl: string | null })[] };
export type WaitlistOverview = { entries: WaitlistEntry[]; freedSlots: FreedSlotSuggestion[] };

export async function getWaitlistOverview(now = new Date()): Promise<WaitlistOverview> {
  const supabase = await createClient();
  const windowEnd = new Date(now.getTime() + FREED_SLOT_WINDOW_DAYS * 86_400_000).toISOString();
  const [entriesResult, cancelledResult, scheduledResult] = await Promise.all([
    supabase.from("appointment_waitlist").select("id,patient_id,reason,preferred_period,duration_minutes,is_urgent,notes,created_at,patient:patients(first_name,last_name,phone)").eq("status", "waiting").order("is_urgent", { ascending: false }).order("created_at"),
    supabase.from("appointments").select("title,starts_at,ends_at").eq("status", "cancelled").gt("starts_at", now.toISOString()).lt("starts_at", windowEnd).order("starts_at"),
    supabase.from("appointments").select("starts_at,ends_at").eq("status", "scheduled").gt("ends_at", now.toISOString()).lt("starts_at", windowEnd),
  ]);
  if (entriesResult.error || cancelledResult.error || scheduledResult.error) throw new Error("WAITLIST_UNAVAILABLE");

  const entries: WaitlistEntry[] = (entriesResult.data ?? []).flatMap((row) => row.patient ? [{
    id: row.id,
    patientId: row.patient_id,
    patientName: `${row.patient.first_name} ${row.patient.last_name}`,
    patientFirstName: row.patient.first_name,
    patientPhone: row.patient.phone,
    reason: row.reason,
    preferredPeriod: row.preferred_period as WaitlistPeriod,
    durationMinutes: row.duration_minutes,
    isUrgent: row.is_urgent,
    notes: row.notes,
    createdAt: row.created_at,
  }] : []);

  const freedSlots = findFreedSlots(
    (cancelledResult.data ?? []).map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at, cancelledTitle: row.title })),
    (scheduledResult.data ?? []).map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at })),
    now,
  ).map((slot) => ({
    ...slot,
    candidates: rankWaitlistForSlot(slot, entries).slice(0, 3).map((entry) => ({
      ...entry,
      whatsappUrl: buildWhatsAppSlotOfferUrl({ phone: entry.patientPhone, firstName: entry.patientFirstName, startsAt: slot.startsAt }),
    })),
  }));

  return { entries, freedSlots };
}
