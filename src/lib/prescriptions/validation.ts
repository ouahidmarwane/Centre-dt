export type PrescriptionItemInput={medication_name:string;dosage:string;route:string;frequency:string;duration:string;instructions:string};
export type PrescriptionInput={notes:string;items:PrescriptionItemInput[];idempotencyKey:string};
export type PrescriptionField="notes"|"items"|"idempotencyKey";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isPrescriptionId(value:unknown):value is string{return typeof value==="string"&&uuid.test(value);}
function strings(formData:FormData,name:string){return formData.getAll(name).map(value=>typeof value==="string"?value.trim():"");}
export function validatePrescriptionForm(formData:FormData):{success:true;data:PrescriptionInput}|{success:false;message:string;fieldErrors:Partial<Record<PrescriptionField,string>>}{
  const notes=typeof formData.get("notes")==="string"?String(formData.get("notes")).trim():"";
  const idempotencyKey=typeof formData.get("idempotencyKey")==="string"?String(formData.get("idempotencyKey")).trim():"";
  const medications=strings(formData,"medicationName"),dosages=strings(formData,"dosage"),routes=strings(formData,"route"),frequencies=strings(formData,"frequency"),durations=strings(formData,"duration"),instructions=strings(formData,"instructions");
  const fieldErrors:Partial<Record<PrescriptionField,string>>={};
  if(notes.length>2000)fieldErrors.notes="Les notes ne peuvent pas dépasser 2 000 caractères.";
  if(!isPrescriptionId(idempotencyKey))fieldErrors.idempotencyKey="Jeton de soumission invalide.";
  const lengths=[medications.length,dosages.length,routes.length,frequencies.length,durations.length,instructions.length];
  if(medications.length<1||medications.length>20||!lengths.every(length=>length===medications.length))fieldErrors.items="Ajoutez entre 1 et 20 médicaments valides.";
  const items=medications.map((medication_name,index)=>({medication_name,dosage:dosages[index]??"",route:routes[index]??"",frequency:frequencies[index]??"",duration:durations[index]??"",instructions:instructions[index]??""}));
  if(items.some(item=>!item.medication_name||item.medication_name.length>160||!item.dosage||item.dosage.length>160||item.route.length>100||!item.frequency||item.frequency.length>160||item.duration.length>160||item.instructions.length>1000))fieldErrors.items="Vérifiez le médicament, le dosage, la fréquence et les limites de texte.";
  if(Object.keys(fieldErrors).length)return {success:false,message:"Vérifiez les informations de l’ordonnance.",fieldErrors};
  return {success:true,data:{notes,items,idempotencyKey}};
}
export function validateVoidReason(value:unknown){if(typeof value!=="string")return null;const reason=value.trim();return reason.length>=5&&reason.length<=500?reason:null;}
