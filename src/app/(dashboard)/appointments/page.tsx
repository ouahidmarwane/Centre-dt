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
        action={<nav aria-label="Navigation par date" className="flex items-center gap-2"><Link className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold" href={`/appointments?date=${shiftCalendarDate(date,-1)}`}>Jour précédent</Link><Link className="rounded-md bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]" href="/appointments">Aujourd’hui</Link><Link className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold" href={`/appointments?date=${shiftCalendarDate(date,1)}`}>Jour suivant</Link></nav>}
        description="Planning quotidien, suivi des statuts et rappels WhatsApp déclenchés manuellement."
        eyebrow="Agenda du cabinet"
        title="Rendez-vous"
      />
      <Schedule {...data} cancelAction={cancelAppointmentAction} createAction={createAppointmentAction} defaultPatientId={defaultPatientId} now={new Date().toISOString()} reminderAction={markReminderHandledAction} selectedDate={date} statusAction={setAppointmentStatusAction} token={crypto.randomUUID()} updateAction={updateAppointmentAction}/>
    </>
  );
}
