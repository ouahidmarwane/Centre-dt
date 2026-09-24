// In-app notification feed: pure transformation from clinic data to banner items.
// Ids are stable for one event, so a banner shows once per device (seen ids are kept
// client-side), and change when the event recurs (e.g. a new unpaid reminder cycle).
import { clinicDateValue, formatClinicTime } from "../appointments/validation.ts";

export type NotificationKind = "appointment_reminder" | "next_patient" | "payment_reminder" | "freed_slot" | "low_stock";
export type AppNotification = { id: string; kind: NotificationKind; title: string; body: string; href: string; at: string };

export type FeedSources = {
  reminders?: { appointmentId: string; patientName: string; startsAt: string; type: "day_before" | "two_hours_before" }[];
  upcoming?: { appointmentId: string; patientName: string; title: string; startsAt: string }[];
  payments?: { patientId: string; name: string; outstanding: number; lastReminderAt: string | null }[];
  freedSlots?: { startsAt: string; candidates: number }[];
  lowStock?: { id: string; name: string; unit: string; quantity: number }[];
};

export const NEXT_PATIENT_WINDOW_MINUTES = 15;
const money = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const weekday = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${clinicDateValue(new Date(iso))}T12:00:00Z`));

// "aujourd’hui", "demain" or the weekday, from clinic dates (a day-before reminder that
// was not handled in time can concern an appointment of the same day).
function relativeDay(iso: string, now: Date): string {
  const day = clinicDateValue(new Date(iso)), today = clinicDateValue(now);
  const tomorrow = clinicDateValue(new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000));
  return day === today ? "aujourd’hui" : day === tomorrow ? "demain" : `le ${weekday(iso)}`;
}

export function buildNotifications(sources: FeedSources, now: Date): AppNotification[] {
  const items: AppNotification[] = [];
  const nowIso = now.toISOString();
  for (const reminder of sources.reminders ?? []) {
    items.push({
      id: `appointment_reminder:${reminder.appointmentId}:${reminder.type}`, kind: "appointment_reminder",
      title: reminder.type === "day_before" ? "Rappel de la veille à envoyer" : "Rappel 2 h avant à envoyer",
      body: `${reminder.patientName} — rendez-vous ${relativeDay(reminder.startsAt, now)} à ${formatClinicTime(reminder.startsAt)}`,
      href: `/appointments?date=${clinicDateValue(new Date(reminder.startsAt))}`, at: nowIso,
    });
  }
  for (const next of sources.upcoming ?? []) {
    const minutes = Math.round((new Date(next.startsAt).getTime() - now.getTime()) / 60_000);
    if (minutes < 0 || minutes > NEXT_PATIENT_WINDOW_MINUTES) continue;
    items.push({
      id: `next_patient:${next.appointmentId}`, kind: "next_patient", title: "Prochain patient",
      body: `${next.patientName} à ${formatClinicTime(next.startsAt)} (${minutes <= 1 ? "maintenant" : `dans ${minutes} min`}) · ${next.title}`,
      href: `/appointments?date=${clinicDateValue(new Date(next.startsAt))}`, at: nowIso,
    });
  }
  for (const payment of sources.payments ?? []) {
    items.push({
      id: `payment_reminder:${payment.patientId}:${payment.lastReminderAt ?? "first"}`, kind: "payment_reminder", title: "Relance d’impayé à envoyer",
      body: `${payment.name} — ${money.format(payment.outstanding)} MAD à régler`, href: "/payments", at: nowIso,
    });
  }
  for (const slot of sources.freedSlots ?? []) {
    if (slot.candidates < 1) continue;
    items.push({
      id: `freed_slot:${new Date(slot.startsAt).toISOString()}`, kind: "freed_slot", title: "Créneau libéré",
      body: `${weekday(slot.startsAt)} à ${formatClinicTime(slot.startsAt)} — ${slot.candidates} patient${slot.candidates > 1 ? "s" : ""} en attente`,
      href: `/appointments?date=${clinicDateValue(new Date(slot.startsAt))}`, at: nowIso,
    });
  }
  for (const item of sources.lowStock ?? []) {
    items.push({
      id: `low_stock:${item.id}:${item.quantity}`, kind: "low_stock", title: item.quantity <= 0 ? "Rupture de stock" : "Stock bas",
      body: `${item.name} — stock : ${quantity.format(item.quantity)} ${item.unit}`, href: "/stock", at: nowIso,
    });
  }
  return items;
}

// Relative time in the iOS style of the design ("maintenant", "il y a 3 min").
export function relativeTime(at: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(at).getTime()) / 60_000));
  if (minutes < 1) return "maintenant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

// Banners to show: unseen items, oldest event kinds first as they arrive.
export function unseenNotifications(items: AppNotification[], seen: ReadonlySet<string>): AppNotification[] {
  return items.filter((item) => !seen.has(item.id));
}

// Notification centre (bell): notifications received today on this device. The list
// starts empty every clinic day; an entry keeps the time it first appeared.
export type HistoryEntry = AppNotification & { read: boolean };

export function pruneHistory(history: HistoryEntry[], now: Date): HistoryEntry[] {
  const today = clinicDateValue(now);
  const dayAgo = now.getTime() - 86_400_000;
  return history.filter((entry) => clinicDateValue(new Date(entry.at)) === today && new Date(entry.at).getTime() > dayAgo);
}

export function mergeHistory(history: HistoryEntry[], fresh: AppNotification[], now: Date): HistoryEntry[] {
  const known = new Set(history.map((entry) => entry.id));
  const added = fresh.filter((item) => !known.has(item.id)).map((item) => ({ ...item, at: now.toISOString(), read: false }));
  return pruneHistory([...added, ...history], now).sort((a, b) => b.at.localeCompare(a.at));
}
