import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { buildWhatsAppReminderUrl, clinicDateValue, clinicLocalToIso, shiftCalendarDate, type ReminderType } from "./validation";

export type Appointment=Tables<"appointments">;
export type AppointmentListItem=Appointment&{patient:{first_name:string;last_name:string;phone:string}|null};
export type PatientOption={id:string;first_name:string;last_name:string};
export type ReminderItem={appointmentId:string;patientId:string;patientName:string;startsAt:string;type:ReminderType;whatsappUrl:string|null};

function dayBounds(date:string){const start=clinicLocalToIso(`${date}T00:00`);const end=clinicLocalToIso(`${shiftCalendarDate(date,1)}T00:00`);if(!start||!end)throw new Error("INVALID_CLINIC_DATE");return {start,end};}

export async function getSchedule(date:string){
  const supabase=await createClient(); const {start,end}=dayBounds(date);
  const [appointmentsResult,patientsResult,remindersResult]=await Promise.all([
    supabase.from("appointments").select("*, patient:patients(first_name,last_name,phone)").gte("starts_at",start).lt("starts_at",end).order("starts_at"),
    supabase.from("patients").select("id,first_name,last_name").eq("is_active",true).order("last_name").order("first_name"),
    supabase.rpc("get_due_appointment_reminders",{}),
  ]);
  if(appointmentsResult.error||patientsResult.error||remindersResult.error)throw new Error("SCHEDULE_UNAVAILABLE");
  const reminders:ReminderItem[]=(remindersResult.data??[]).map(item=>({
    appointmentId:item.appointment_id,patientId:item.patient_id,patientName:item.patient_first_name,startsAt:item.starts_at,type:item.reminder_type,
    whatsappUrl:buildWhatsAppReminderUrl({phone:item.patient_phone,firstName:item.patient_first_name,startsAt:item.starts_at,type:item.reminder_type}),
  }));
  return {appointments:(appointmentsResult.data??[]) as AppointmentListItem[],patients:(patientsResult.data??[]) as PatientOption[],reminders};
}

export async function getPatientAppointments(patientId:string){
  const supabase=await createClient(); const {data,error}=await supabase.from("appointments").select("*").eq("patient_id",patientId).order("starts_at",{ascending:false}).limit(8);
  if(error)throw new Error("PATIENT_APPOINTMENTS_UNAVAILABLE"); return data??[];
}

export async function getDashboardSchedule(reference=new Date()){
  const date=clinicDateValue(reference);
  const schedule=await getSchedule(date);
  const active=schedule.appointments.filter(item=>item.status==="scheduled");
  return {date,count:active.length,next:active.find(item=>new Date(item.starts_at)>reference)??null,reminderCount:schedule.reminders.length};
}
