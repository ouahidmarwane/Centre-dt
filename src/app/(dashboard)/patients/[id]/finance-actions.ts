"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { isPatientId } from "@/lib/patients/validation";
import { isFinanceId, validateInterventionForm, validatePaymentForm, validateReason, type FinanceField } from "@/lib/finance/validation";
import { createClient } from "@/lib/supabase/server";

export type FinanceActionState={success:boolean;message:string|null;fieldErrors:Partial<Record<FinanceField,string>>};
const fail=(message:string):FinanceActionState=>({success:false,message,fieldErrors:{}});

export async function createInterventionAction(patientId:string,_state:FinanceActionState,formData:FormData):Promise<FinanceActionState>{
  await requirePermission("interventions.write"); if(!isPatientId(patientId)) return fail("Dossier patient invalide.");
  const validation=validateInterventionForm(formData); if(!validation.success) return {success:false,message:"Vérifiez les informations indiquées.",fieldErrors:validation.fieldErrors};
  const idempotencyKey=formData.get("idempotencyKey"); if(!isFinanceId(idempotencyKey)) return fail("Jeton de soumission invalide. Rechargez la page et réessayez.");
  const d=validation.data,supabase=await createClient(); const {error}=await supabase.rpc("create_intervention",{target_patient_id:patientId,target_performed_at:d.performedAt,target_nature:d.nature,target_amount_due:Number(d.amountDue),target_status:d.status,target_idempotency_key:idempotencyKey,target_notes:d.notes??undefined,target_teeth:d.teeth,target_finding_ids:d.findingIds});
  if(error) return fail("L’intervention n’a pas pu être enregistrée."); revalidatePath(`/patients/${patientId}`); return {success:true,message:"Intervention enregistrée.",fieldErrors:{}};
}
export async function updateInterventionAction(patientId:string,interventionId:string,_state:FinanceActionState,formData:FormData):Promise<FinanceActionState>{
  await requirePermission("interventions.write"); if(!isPatientId(patientId)||!isFinanceId(interventionId)) return fail("Intervention invalide.");
  const validation=validateInterventionForm(formData); if(!validation.success) return {success:false,message:"Vérifiez les informations indiquées.",fieldErrors:validation.fieldErrors};
  const d=validation.data,supabase=await createClient(); const {data,error}=await supabase.rpc("update_intervention",{target_patient_id:patientId,target_intervention_id:interventionId,target_performed_at:d.performedAt,target_nature:d.nature,target_amount_due:Number(d.amountDue),target_status:d.status,target_notes:d.notes??undefined,target_teeth:d.teeth,target_finding_ids:d.findingIds});
  if(error||!data) return fail("L’intervention n’a pas pu être mise à jour."); revalidatePath(`/patients/${patientId}`); return {success:true,message:"Intervention mise à jour.",fieldErrors:{}};
}
export async function cancelInterventionAction(patientId:string,interventionId:string,_state:FinanceActionState,_formData:FormData):Promise<FinanceActionState>{
  void _state; void _formData;
  await requirePermission("interventions.cancel"); if(!isPatientId(patientId)||!isFinanceId(interventionId)) return fail("Intervention invalide.");
  const supabase=await createClient(); const {data,error}=await supabase.rpc("cancel_intervention",{target_patient_id:patientId,target_intervention_id:interventionId}); if(error||!data) return fail("Annulation refusée. Vérifiez les paiements reçus."); revalidatePath(`/patients/${patientId}`); return {success:true,message:"Intervention annulée.",fieldErrors:{}};
}
export async function recordPaymentAction(patientId:string,_state:FinanceActionState,formData:FormData):Promise<FinanceActionState>{
  await requirePermission("payments.record"); if(!isPatientId(patientId)) return fail("Dossier patient invalide.");
  const validation=validatePaymentForm(formData); if(!validation.success) return {success:false,message:"Vérifiez les informations indiquées.",fieldErrors:validation.fieldErrors};
  const d=validation.data,supabase=await createClient(); const {error}=await supabase.rpc("record_payment",{target_patient_id:patientId,target_amount:Number(d.amount),target_method:d.method,target_received_at:d.receivedAt,target_idempotency_key:d.idempotencyKey,target_reference:d.reference??undefined,target_notes:d.notes??undefined});
  if(error?.code==="23505") return fail("Ce paiement a déjà été enregistré."); if(error) return fail("Paiement refusé. Vérifiez le reste à recevoir et réessayez."); revalidatePath(`/patients/${patientId}`); return {success:true,message:"Paiement enregistré.",fieldErrors:{}};
}
export async function reversePaymentAction(patientId:string,paymentId:string,_state:FinanceActionState,formData:FormData):Promise<FinanceActionState>{
  await requirePermission("payments.reverse"); if(!isPatientId(patientId)||!isFinanceId(paymentId)) return fail("Paiement invalide.");
  const reason=validateReason(formData.get("reason")); if(!reason) return {success:false,message:"Indiquez un motif de 5 à 500 caractères.",fieldErrors:{reason:"Motif requis."}};
  const supabase=await createClient(); const {data,error}=await supabase.rpc("reverse_payment",{target_patient_id:patientId,target_payment_id:paymentId,target_reason:reason}); if(error||!data) return fail("Le paiement n’a pas pu être annulé."); revalidatePath(`/patients/${patientId}`); return {success:true,message:"Paiement annulé et historique conservé.",fieldErrors:{}};
}
