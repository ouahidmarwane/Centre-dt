"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid, reminderTypes, validateAppointmentForm, type AppointmentField, type AppointmentStatus, type ReminderType } from "@/lib/appointments/validation";

export type AppointmentActionState={success:boolean;message:string|null;fieldErrors:Partial<Record<AppointmentField|string,string>>};
const fail=(message:string,fieldErrors:AppointmentActionState["fieldErrors"]={}):AppointmentActionState=>({success:false,message,fieldErrors});
function rpcMessage(code?:string){if(code==="23P01")return "Ce créneau chevauche un autre rendez-vous.";if(code==="23505")return "Cette soumission a déjà été enregistrée.";if(code==="22023")return "L’opération ne respecte pas l’état actuel du rendez-vous ou du patient.";return "L’opération n’a pas pu être enregistrée.";}
function refresh(patientId?:string){revalidatePath("/appointments");revalidatePath("/dashboard");if(patientId)revalidatePath(`/patients/${patientId}`);}

export async function createAppointmentAction(_state:AppointmentActionState,formData:FormData):Promise<AppointmentActionState>{
  await requirePermission("appointments.write"); const validation=validateAppointmentForm(formData); if(!validation.success)return fail("Vérifiez les informations indiquées.",validation.fieldErrors);
  const v=validation.data,supabase=await createClient(); const {error}=await supabase.rpc("create_appointment",{target_patient_id:v.patientId,target_title:v.title,target_purpose:v.purpose??"",target_starts_at:v.startsAt,target_ends_at:v.endsAt,target_notes:v.notes??"",target_idempotency_key:v.idempotencyKey});
  if(error)return fail(rpcMessage(error.code)); refresh(v.patientId); return {success:true,message:"Rendez-vous créé.",fieldErrors:{}};
}

export async function updateAppointmentAction(appointmentId:string,_state:AppointmentActionState,formData:FormData):Promise<AppointmentActionState>{
  await requirePermission("appointments.write"); if(!isUuid(appointmentId))return fail("Rendez-vous invalide."); const validation=validateAppointmentForm(formData);if(!validation.success)return fail("Vérifiez les informations indiquées.",validation.fieldErrors);
  const v=validation.data,supabase=await createClient();const {data,error}=await supabase.rpc("update_appointment",{target_appointment_id:appointmentId,target_patient_id:v.patientId,target_title:v.title,target_purpose:v.purpose??"",target_starts_at:v.startsAt,target_ends_at:v.endsAt,target_notes:v.notes??""});
  if(error||!data)return fail(error?rpcMessage(error.code):"Ce rendez-vous ne peut plus être modifié.");refresh(v.patientId);return {success:true,message:"Rendez-vous mis à jour.",fieldErrors:{}};
}

export async function cancelAppointmentAction(appointmentId:string,patientId:string,_state:AppointmentActionState,formData:FormData):Promise<AppointmentActionState>{
  await requirePermission("appointments.cancel");if(!isUuid(appointmentId)||!isUuid(patientId))return fail("Rendez-vous invalide.");const reason=String(formData.get("reason")??"").trim();if(reason.length<5||reason.length>500)return fail("Le motif doit contenir entre 5 et 500 caractères.",{reason:"Motif requis."});
  const supabase=await createClient();const {data,error}=await supabase.rpc("cancel_appointment",{target_appointment_id:appointmentId,target_patient_id:patientId,target_reason:reason});if(error||!data)return fail(error?rpcMessage(error.code):"Ce rendez-vous ne peut plus être annulé.");refresh(patientId);return {success:true,message:"Rendez-vous annulé; son historique est conservé.",fieldErrors:{}};
}

export async function setAppointmentStatusAction(appointmentId:string,patientId:string,status:AppointmentStatus):Promise<void>{
  await requirePermission("appointments.status");if(!isUuid(appointmentId)||!isUuid(patientId)||!(["completed","no_show"] as string[]).includes(status))return;
  const supabase=await createClient();await supabase.rpc("set_appointment_status",{target_appointment_id:appointmentId,target_patient_id:patientId,target_status:status});refresh(patientId);
}

export async function markReminderHandledAction(appointmentId:string,patientId:string,type:ReminderType):Promise<void>{
  await requirePermission("appointments.reminders");if(!isUuid(appointmentId)||!isUuid(patientId)||!reminderTypes.includes(type))return;
  const supabase=await createClient();await supabase.rpc("mark_appointment_reminder_handled",{target_appointment_id:appointmentId,target_patient_id:patientId,target_type:type});refresh(patientId);
}
