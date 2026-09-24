import "server-only";

import { getPaymentFollowup } from "@/lib/payment-followup/data";
import { hasPermission, type AppRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistOverview } from "@/lib/waitlist/data";
import { buildNotifications, NEXT_PATIENT_WINDOW_MINUTES, type AppNotification, type FeedSources } from "./feed";

// Each source is read only when the role may see it; a failing source is skipped so
// one unavailable module never silences the others.
export async function getNotificationFeed(role: AppRole, now = new Date()): Promise<AppNotification[]> {
  const supabase = await createClient();
  const safe = <T,>(promise: Promise<T>) => promise.catch(() => undefined);
  const windowEnd = new Date(now.getTime() + NEXT_PATIENT_WINDOW_MINUTES * 60_000).toISOString();

  const [reminders, upcoming, payments, waitlist, stock] = await Promise.all([
    hasPermission(role, "appointments.reminders") ? safe(Promise.resolve(supabase.rpc("get_due_appointment_reminders", {})).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []).map((row) => ({ appointmentId: row.appointment_id, patientName: row.patient_first_name, startsAt: row.starts_at, type: row.reminder_type }));
    })) : undefined,
    hasPermission(role, "appointments.read") ? safe(Promise.resolve(supabase.from("appointments").select("id,title,starts_at,patient:patients(first_name,last_name)")
      .eq("status", "scheduled").gte("starts_at", now.toISOString()).lte("starts_at", windowEnd).order("starts_at")).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []).map((row) => ({ appointmentId: row.id, title: row.title, startsAt: row.starts_at, patientName: row.patient ? `${row.patient.first_name} ${row.patient.last_name}` : "Patient" }));
    })) : undefined,
    hasPermission(role, "payments.reminders") ? safe(getPaymentFollowup().then((items) => items.filter((item) => item.isDue))) : undefined,
    hasPermission(role, "appointments.write") ? safe(getWaitlistOverview(now)) : undefined,
    hasPermission(role, "stock.read") ? safe(Promise.resolve(supabase.from("stock_items").select("id,name,unit,quantity,alert_threshold").eq("is_active", true)).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []).filter((row) => Number(row.quantity) <= Number(row.alert_threshold)).map((row) => ({ id: row.id, name: row.name, unit: row.unit, quantity: Number(row.quantity) }));
    })) : undefined,
  ]);

  const sources: FeedSources = {
    reminders, upcoming,
    payments: payments?.map((item) => ({ patientId: item.patientId, name: item.name, outstanding: item.outstanding, lastReminderAt: item.lastReminderAt })),
    freedSlots: waitlist?.freedSlots.map((slot) => ({ startsAt: slot.startsAt, candidates: slot.candidates.length })),
    lowStock: stock,
  };
  return buildNotifications(sources, now);
}
