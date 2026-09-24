import { clinicTimeValue, formatClinicDate, formatClinicTime, isUuid, normalizeWhatsAppPhone } from "../appointments/validation.ts";

export const waitlistPeriods = ["any", "morning", "afternoon"] as const;
export type WaitlistPeriod = (typeof waitlistPeriods)[number];
export const waitlistPeriodLabels: Record<WaitlistPeriod, string> = { any: "Indifférent", morning: "Matin", afternoon: "Après-midi" };
export const waitlistDurations = [15, 30, 45, 60, 90, 120] as const;
export const FREED_SLOT_WINDOW_DAYS = 14;
// Clinic-time boundary between a morning and an afternoon slot.
const AFTERNOON_STARTS_AT = "13:00";

export type WaitlistField = "patientId" | "reason" | "preferredPeriod" | "durationMinutes" | "notes";
export type WaitlistInput = { patientId: string; reason: string; preferredPeriod: WaitlistPeriod; durationMinutes: number; isUrgent: boolean; notes: string | null };

export type WaitlistEntry = {
  id: string; patientId: string; patientName: string; patientFirstName: string; patientPhone: string;
  reason: string; preferredPeriod: WaitlistPeriod; durationMinutes: number; isUrgent: boolean; notes: string | null; createdAt: string;
};
export type TimeRange = { startsAt: string; endsAt: string };
export type FreedSlot = TimeRange & { cancelledTitle: string };

export function validateWaitlistForm(formData: FormData): { success: true; data: WaitlistInput } | { success: false; fieldErrors: Partial<Record<WaitlistField, string>> } {
  const text = (name: string) => { const value = formData.get(name); return typeof value === "string" ? value.trim() : ""; };
  const patientId = text("patientId"), reason = text("reason"), preferredPeriod = text("preferredPeriod"), notes = text("notes");
  const durationMinutes = Number(text("durationMinutes"));
  const fieldErrors: Partial<Record<WaitlistField, string>> = {};
  if (!isUuid(patientId)) fieldErrors.patientId = "Sélectionnez un patient valide.";
  if (!reason || reason.length > 160) fieldErrors.reason = "Le motif doit contenir entre 1 et 160 caractères.";
  if (!waitlistPeriods.includes(preferredPeriod as WaitlistPeriod)) fieldErrors.preferredPeriod = "Choisissez une préférence valide.";
  if (!(waitlistDurations as readonly number[]).includes(durationMinutes)) fieldErrors.durationMinutes = "Choisissez une durée valide.";
  if (notes.length > 1000) fieldErrors.notes = "La note est limitée à 1 000 caractères.";
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return { success: true, data: { patientId, reason, preferredPeriod: preferredPeriod as WaitlistPeriod, durationMinutes, isUrgent: formData.get("isUrgent") === "on", notes: notes || null } };
}

// Key of the idempotency token prepared by the page for each (freed slot, candidate) pair.
export const bookingTokenKey = (startsAt: string, entryId: string) => `${startsAt}|${entryId}`;

export function slotPeriod(startsAt: string): Exclude<WaitlistPeriod, "any"> {
  return clinicTimeValue(new Date(startsAt)) < AFTERNOON_STARTS_AT ? "morning" : "afternoon";
}

const time = (value: string) => new Date(value).getTime();
const overlaps = (a: TimeRange, b: TimeRange) => time(a.startsAt) < time(b.endsAt) && time(b.startsAt) < time(a.endsAt);
const minutes = (range: TimeRange) => Math.round((time(range.endsAt) - time(range.startsAt)) / 60_000);

// Future cancelled slots that no scheduled appointment has taken back, without duplicates.
export function findFreedSlots(cancelled: FreedSlot[], scheduled: TimeRange[], now: Date): FreedSlot[] {
  const seen = new Set<string>();
  return cancelled
    .filter((slot) => time(slot.startsAt) > now.getTime())
    .filter((slot) => !scheduled.some((taken) => overlaps(slot, taken)))
    .filter((slot) => { const key = `${time(slot.startsAt)}|${time(slot.endsAt)}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => time(a.startsAt) - time(b.startsAt));
}

// Waiting patients who fit the slot: duration and period preference; urgent first, then oldest request.
export function rankWaitlistForSlot(slot: TimeRange, entries: WaitlistEntry[]): WaitlistEntry[] {
  const period = slotPeriod(slot.startsAt);
  const length = minutes(slot);
  return entries
    .filter((entry) => entry.durationMinutes <= length && (entry.preferredPeriod === "any" || entry.preferredPeriod === period))
    .sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent) || a.createdAt.localeCompare(b.createdAt));
}

export function buildWhatsAppSlotOfferUrl(input: { phone: string | null; firstName: string; startsAt: string }): string | null {
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) return null;
  const time = formatClinicTime(input.startsAt);
  const french = `Bonjour ${input.firstName}, un créneau vient de se libérer au Centre Dentaire Ouahid le ${formatClinicDate(input.startsAt)} à ${time}. Souhaitez-vous le réserver ? Merci de nous répondre rapidement.`;
  const arabic = `مرحبا ${input.firstName}، تحرّر موعد في مركز وحيد لطب الأسنان يوم ${formatClinicDate(input.startsAt)} على الساعة ${time}. هل ترغبون في حجزه؟ المرجو الرد في أقرب وقت.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`${french}\n\n${arabic}`)}`;
}
