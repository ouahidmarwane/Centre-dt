import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export type DashboardAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  startsAt: string;
  status?: AppointmentStatus;
};

export type MainDashboard = {
  generatedAt: string;
  clinicDate: string;
  patients: { active: number; createdThisMonth: number };
  appointments: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
    today: DashboardAppointment[];
    upcoming: DashboardAppointment[];
  };
  reminderCount: number;
  treatments: { label: string; count: number }[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DASHBOARD_UNAVAILABLE");
  return value as Record<string, unknown>;
}

function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("DASHBOARD_UNAVAILABLE");
  return value;
}

function appointment(value: unknown, includeStatus: boolean): DashboardAppointment {
  const row = object(value);
  if ([row.id, row.patient_id, row.patient_name, row.title, row.starts_at].some((item) => typeof item !== "string")) {
    throw new Error("DASHBOARD_UNAVAILABLE");
  }
  const allowed = new Set<AppointmentStatus>(["scheduled", "completed", "cancelled", "no_show"]);
  if (includeStatus && !allowed.has(row.status as AppointmentStatus)) throw new Error("DASHBOARD_UNAVAILABLE");
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    patientName: row.patient_name as string,
    title: row.title as string,
    startsAt: row.starts_at as string,
    ...(includeStatus ? { status: row.status as AppointmentStatus } : {}),
  };
}

export function parseMainDashboard(value: unknown): MainDashboard {
  const root = object(value);
  const patients = object(root.patients);
  const appointments = object(root.appointments);
  if (typeof root.generated_at !== "string" || typeof root.clinic_date !== "string") throw new Error("DASHBOARD_UNAVAILABLE");
  if (!Array.isArray(appointments.today) || !Array.isArray(appointments.upcoming) || !Array.isArray(root.treatments)) {
    throw new Error("DASHBOARD_UNAVAILABLE");
  }
  const treatments = root.treatments.map((value) => {
    const row = object(value);
    if (typeof row.label !== "string") throw new Error("DASHBOARD_UNAVAILABLE");
    return { label: row.label, count: finite(row.count) };
  });
  return {
    generatedAt: root.generated_at,
    clinicDate: root.clinic_date,
    patients: { active: finite(patients.active), createdThisMonth: finite(patients.created_this_month) },
    appointments: {
      total: finite(appointments.total), scheduled: finite(appointments.scheduled),
      completed: finite(appointments.completed), cancelled: finite(appointments.cancelled),
      noShow: finite(appointments.no_show),
      today: appointments.today.map((value) => appointment(value, true)),
      upcoming: appointments.upcoming.map((value) => appointment(value, false)),
    },
    reminderCount: finite(root.reminder_count),
    treatments,
  };
}

export async function getMainDashboard(): Promise<MainDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_main_dashboard", {}).single();
  if (error) throw new Error("DASHBOARD_UNAVAILABLE");
  return parseMainDashboard(data);
}
