import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Schedule } from "@/components/appointments/schedule";
import { requirePermission } from "@/lib/auth/server";
import { getSchedule } from "@/lib/appointments/data";
import { isUuid, shiftCalendarDate, validateScheduleDate } from "@/lib/appointments/validation";
import { cancelAppointmentAction, createAppointmentAction, markReminderHandledAction, setAppointmentStatusAction, updateAppointmentAction } from "./actions";

export const dynamic="force-dynamic";
export default async function AppointmentsPage({searchParams}:{searchParams:Promise<{date?:string;patient?:string}>}) {
  await requirePermission("appointments.read");const query=await searchParams;const date=validateScheduleDate(query.date);const data=await getSchedule(date);const defaultPatientId=isUuid(query.patient)&&data.patients.some(patient=>patient.id===query.patient)?query.patient:undefined;
  return (
    <>
      <PageHeader
        action={<nav aria-label="Navigation par date" className="flex items-center gap-1 rounded-2xl border border-white/80 bg-white/75 p-1.5 shadow-[0_10px_28px_rgba(32,104,177,.08)] backdrop-blur-xl"><Link aria-label="Jour précédent" className="grid size-11 place-items-center rounded-xl text-lg font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" href={`/appointments?date=${shiftCalendarDate(date,-1)}`}>←</Link><Link className="inline-flex min-h-11 items-center rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white shadow-sm" href="/appointments">Aujourd’hui</Link><Link aria-label="Jour suivant" className="grid size-11 place-items-center rounded-xl text-lg font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" href={`/appointments?date=${shiftCalendarDate(date,1)}`}>→</Link></nav>}
        description="Planning quotidien, suivi des statuts et rappels WhatsApp déclenchés manuellement."
        eyebrow="Agenda du cabinet"
        title="Rendez-vous"
      />
      <Schedule {...data} cancelAction={cancelAppointmentAction} createAction={createAppointmentAction} defaultPatientId={defaultPatientId} now={new Date().toISOString()} reminderAction={markReminderHandledAction} selectedDate={date} statusAction={setAppointmentStatusAction} token={crypto.randomUUID()} updateAction={updateAppointmentAction}/>
    </>
  );
}
