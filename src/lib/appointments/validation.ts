export const CLINIC_TIME_ZONE = "Africa/Casablanca";

export const appointmentStatuses = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];
export const reminderTypes = ["day_before", "two_hours_before"] as const;
export type ReminderType = (typeof reminderTypes)[number];

export type AppointmentField = "patientId" | "title" | "purpose" | "date" | "startTime" | "endTime" | "notes" | "idempotencyKey";
export type AppointmentInput = { patientId:string; title:string; purpose:string|null; startsAt:string; endsAt:string; notes:string|null; idempotencyKey:string };

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTime=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function zonedParts(date:Date){
  const values=new Intl.DateTimeFormat("en-CA",{timeZone:CLINIC_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  return Object.fromEntries(values.map(part=>[part.type,part.value]));
}

export function clinicLocalToIso(value:string):string|null{
  const match=localDateTime.exec(value);
  if(!match)return null;
  const [,year,month,day,hour,minute]=match;
  const wanted=`${year}-${month}-${day}T${hour}:${minute}`;
  const guess=Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute));
  const matches:string[]=[];
  for(let offset=-4*60;offset<=4*60;offset+=15){
    const candidate=new Date(guess+offset*60_000);
    const parts=zonedParts(candidate);
    if(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`===wanted)matches.push(candidate.toISOString());
  }
  return matches.length===1?matches[0]:null;
}

export function clinicDateValue(date:Date){
  const parts=zonedParts(date); return `${parts.year}-${parts.month}-${parts.day}`;
}

export function clinicTimeValue(date:Date){
  const parts=zonedParts(date); return `${parts.hour}:${parts.minute}`;
}

export function clinicDateTimeValue(date:Date){
  return `${clinicDateValue(date)}T${clinicTimeValue(date)}`;
}

export function formatClinicDate(value:string|Date){return new Intl.DateTimeFormat("fr-FR",{timeZone:CLINIC_TIME_ZONE,dateStyle:"full"}).format(new Date(value));}
export function formatClinicTime(value:string|Date){return new Intl.DateTimeFormat("fr-FR",{timeZone:CLINIC_TIME_ZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function isUuid(value:unknown):value is string{return typeof value==="string"&&uuid.test(value);}

export function validateAppointmentForm(formData:FormData, now=new Date()):{success:true;data:AppointmentInput}|{success:false;fieldErrors:Partial<Record<AppointmentField,string>>}{
  const text=(name:string)=>typeof formData.get(name)==="string"?String(formData.get(name)).trim():"";
  const patientId=text("patientId"),title=text("title"),purpose=text("purpose"),date=text("date"),startTime=text("startTime"),endTime=text("endTime"),notes=text("notes"),idempotencyKey=text("idempotencyKey");
  const fieldErrors:Partial<Record<AppointmentField,string>>={};
  if(!isUuid(patientId))fieldErrors.patientId="Sélectionnez un patient valide.";
  if(!title||title.length>160)fieldErrors.title="Le titre doit contenir entre 1 et 160 caractères.";
  if(purpose.length>500)fieldErrors.purpose="Le motif ne peut pas dépasser 500 caractères.";
  if(notes.length>4000)fieldErrors.notes="Les notes ne peuvent pas dépasser 4 000 caractères.";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fieldErrors.date="Choisissez une date valide.";
  const startsAt=clinicLocalToIso(`${date}T${startTime}`),endsAt=clinicLocalToIso(`${date}T${endTime}`);
  if(!startsAt)fieldErrors.startTime="Choisissez une heure valide pour le cabinet.";
  if(!endsAt)fieldErrors.endTime="Choisissez une heure valide pour le cabinet.";
  if(startsAt&&endsAt){const duration=new Date(endsAt).getTime()-new Date(startsAt).getTime();if(duration<=0||duration>8*3_600_000)fieldErrors.endTime="La fin doit suivre le début, avec une durée maximale de 8 heures.";if(new Date(startsAt)<=now)fieldErrors.startTime="Le rendez-vous doit être dans le futur.";}
  if(!isUuid(idempotencyKey))fieldErrors.idempotencyKey="Jeton de soumission invalide.";
  if(Object.keys(fieldErrors).length||!startsAt||!endsAt)return {success:false,fieldErrors};
  return {success:true,data:{patientId,title,purpose:purpose||null,startsAt,endsAt,notes:notes||null,idempotencyKey}};
}

export function normalizeWhatsAppPhone(value:string|null):string|null{
  if(!value)return null;
  const raw=value.trim();
  if(!/^[+\d\s().-]+$/.test(raw))return null;
  const plus=raw.startsWith("+"); let digits=raw.replace(/\D/g,"");
  if(digits.startsWith("00"))digits=digits.slice(2);
  else if(!plus&&/^0[67]\d{8}$/.test(digits))digits=`212${digits.slice(1)}`;
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  return digits;
}

export function buildWhatsAppReminderUrl(input:{phone:string|null;firstName:string;startsAt:string;type:ReminderType}):string|null{
  const phone=normalizeWhatsAppPhone(input.phone); if(!phone)return null;
  const timing=input.type==="day_before"?"demain":"dans environ deux heures";
  const message=`Bonjour ${input.firstName}, rappel de votre rendez-vous ${timing} au Centre Dentaire Ouahid, le ${formatClinicDate(input.startsAt)} à ${formatClinicTime(input.startsAt)}. Merci de nous prévenir en cas d’empêchement.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function isReminderDue(input:{startsAt:string;referenceTime:string;type:ReminderType;status:AppointmentStatus;handled:boolean}){
  if(input.handled||input.status!=="scheduled")return false;
  const start=new Date(input.startsAt).getTime(),reference=new Date(input.referenceTime).getTime();
  if(!Number.isFinite(start)||!Number.isFinite(reference)||reference>=start)return false;
  const threshold=input.type==="day_before"?24:2;
  return reference>=start-threshold*3_600_000;
}

export function validateScheduleDate(value:unknown, fallback=new Date()):string{
  if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&clinicLocalToIso(`${value}T12:00`))return value;
  return clinicDateValue(fallback);
}

export function shiftCalendarDate(value:string,days:number){const [y,m,d]=value.split("-").map(Number);const date=new Date(Date.UTC(y,m-1,d+days,12));return date.toISOString().slice(0,10);}
