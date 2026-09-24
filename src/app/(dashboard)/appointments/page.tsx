import Link from "next/link";
import { DateJump } from "@/components/appointments/date-jump";
import { Schedule } from "@/components/appointments/schedule";
import { requirePermission } from "@/lib/auth/server";
import { getSchedule } from "@/lib/appointments/data";
import { clinicDateValue, isUuid, shiftCalendarDate, validateScheduleDate } from "@/lib/appointments/validation";
import { cancelAppointmentAction, createAppointmentAction, markReminderHandledAction, setAppointmentStatusAction, updateAppointmentAction } from "./actions";

export const dynamic="force-dynamic";

const weekday=new Intl.DateTimeFormat("fr-FR",{weekday:"short",timeZone:"UTC"});
const dayNumber=new Intl.DateTimeFormat("fr-FR",{day:"numeric",timeZone:"UTC"});
const longDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
const asDate=(value:string)=>new Date(`${value}T12:00:00Z`);

function relativeLabel(date:string,today:string){
  if(date===today)return "Aujourd’hui";
  if(date===shiftCalendarDate(today,1))return "Demain";
  if(date===shiftCalendarDate(today,-1))return "Hier";
  return null;
}

export default async function AppointmentsPage({searchParams}:{searchParams:Promise<{date?:string;patient?:string}>}) {
  await requirePermission("appointments.read");const query=await searchParams;const date=validateScheduleDate(query.date);const data=await getSchedule(date);const defaultPatientId=isUuid(query.patient)&&data.patients.some(patient=>patient.id===query.patient)?query.patient:undefined;
  const now=new Date();
  const today=clinicDateValue(now);
  const relative=relativeLabel(date,today);
  // Monday-first week containing the selected day.
  const mondayOffset=(asDate(date).getUTCDay()+6)%7;
  const week=Array.from({length:7},(_,index)=>shiftCalendarDate(date,index-mondayOffset));
  const withPatient=(target:string)=>`/appointments?date=${target}${defaultPatientId?`&patient=${defaultPatientId}`:""}`;

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]"/>Agenda du cabinet</p>
          <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] first-letter:uppercase sm:text-[2.4rem]">
            {relative??longDate.format(asDate(date))}
          </h1>
          {relative?<p className="mt-1 text-sm text-slate-500 first-letter:uppercase">{longDate.format(asDate(date))}</p>:null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {date!==today?<Link className="inline-flex min-h-11 items-center rounded-[12px] bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(22,119,242,0.7)] transition-all hover:-translate-y-px hover:bg-[var(--brand-strong)] active:translate-y-0" href={withPatient(today)}>Revenir à aujourd’hui</Link>:null}
          <DateJump date={date}/>
        </div>
      </header>

      <nav aria-label="Jours de la semaine" className="kpi-rise mt-5 flex items-stretch gap-1.5 rounded-[18px] border border-[#dbe6f1] bg-white/85 p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-18px_rgba(16,44,76,0.35)]">
        <Link aria-label="Semaine précédente" className="grid w-10 shrink-0 place-items-center rounded-[12px] text-lg text-slate-500 transition-colors hover:bg-[#eef6ff] hover:text-[var(--blue-deep)]" href={withPatient(shiftCalendarDate(date,-7))}>‹</Link>
        <ol className="rise-list grid flex-1 grid-cols-7 gap-1">
          {week.map(day=>{
            const selected=day===date;const isToday=day===today;const past=day<today;
            return <li key={day}>
              <Link aria-current={selected?"date":undefined} aria-label={`${longDate.format(asDate(day))}${isToday?" (aujourd’hui)":""}`} className={`group relative flex min-h-16 flex-col items-center justify-center rounded-[12px] transition-all duration-300 ease-out active:scale-[0.97] ${selected?"bg-[linear-gradient(160deg,#2f8bff,#0f5fc5)] text-white shadow-[0_12px_24px_-12px_rgba(22,119,242,0.9)]":"hover:-translate-y-0.5 hover:bg-[#eef6ff] hover:shadow-[0_8px_18px_-12px_rgba(16,44,76,0.4)]"}`} href={withPatient(day)}>
                <span className={`text-[11px] font-medium capitalize ${selected?"text-blue-100":past?"text-slate-400":"text-slate-500"}`}>{weekday.format(asDate(day)).replace(".","")}</span>
                <span className={`metric-number text-lg leading-6 font-semibold ${selected?"text-white":past?"text-slate-400":"text-[var(--navy)]"}`}>{dayNumber.format(asDate(day))}</span>
                {isToday?<span className={`absolute bottom-1.5 size-1.5 rounded-full ${selected?"bg-white":"bg-[var(--blue)]"}`}/>:null}
              </Link>
            </li>;
          })}
        </ol>
        <Link aria-label="Semaine suivante" className="grid w-10 shrink-0 place-items-center rounded-[12px] text-lg text-slate-500 transition-colors hover:bg-[#eef6ff] hover:text-[var(--blue-deep)]" href={withPatient(shiftCalendarDate(date,7))}>›</Link>
      </nav>

      <Schedule key={date} {...data} cancelAction={cancelAppointmentAction} createAction={createAppointmentAction} defaultPatientId={defaultPatientId} isToday={date===today} now={now.toISOString()} reminderAction={markReminderHandledAction} selectedDate={date} statusAction={setAppointmentStatusAction} token={crypto.randomUUID()} updateAction={updateAppointmentAction}/>
    </div>
  );
}
