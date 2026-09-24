import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppAppointmentUrl, buildWhatsAppReminderUrl, clinicDateTimeValue, clinicLocalToIso, isReminderDue, normalizeWhatsAppPhone, shiftCalendarDate, validateAppointmentForm } from "./validation.ts";

test("clinic local times use Africa/Casablanca rules instead of a fixed offset",()=>{
  assert.equal(clinicLocalToIso("2026-01-15T10:00"),"2026-01-15T09:00:00.000Z");
  assert.equal(clinicLocalToIso("2026-03-01T10:00"),"2026-03-01T10:00:00.000Z");
  assert.equal(clinicLocalToIso("invalid"),null);
  assert.equal(shiftCalendarDate("2026-12-31",1),"2027-01-01");
});

test("datetime-local values are formatted in clinic time",()=>{
  assert.equal(clinicDateTimeValue(new Date("2026-09-12T23:30:00Z")),"2026-09-13T00:30");
});

test("appointment validation rejects past and excessive durations",()=>{
  const form=new FormData(); Object.entries({patientId:"11111111-1111-4111-8111-111111111111",title:"Contrôle",date:"2026-09-13",startTime:"09:00",endTime:"18:00",idempotencyKey:"22222222-2222-4222-8222-222222222222"}).forEach(([k,v])=>form.set(k,v));
  const result=validateAppointmentForm(form,new Date("2026-09-12T00:00:00Z")); assert.equal(result.success,false);
  if(!result.success)assert.match(result.fieldErrors.endTime??"",/8 heures/);
});

test("phone normalization is strict and supports Moroccan and explicit international numbers",()=>{
  assert.equal(normalizeWhatsAppPhone("06 12 34 56 78"),"212612345678");
  assert.equal(normalizeWhatsAppPhone("+212 7 12 34 56 78"),"212712345678");
  assert.equal(normalizeWhatsAppPhone("00212-612345678"),"212612345678");
  assert.equal(normalizeWhatsAppPhone("+33 6 12 34 56 78"),"33612345678");
  assert.equal(normalizeWhatsAppPhone("javascript:alert(1)"),null);
  assert.equal(normalizeWhatsAppPhone("123"),null);
});

test("WhatsApp copy is encoded, minimal and contains no clinical or financial payload",()=>{
  const url=buildWhatsAppReminderUrl({phone:"0612345678",firstName:"Sara & Co",startsAt:"2026-09-13T09:00:00Z",type:"day_before"});
  assert.ok(url?.startsWith("https://wa.me/212612345678?text="));
  const message=decodeURIComponent(url!.split("?text=")[1]);
  assert.match(message,/Centre Dentaire Ouahid/); assert.match(message,/Sara & Co/); assert.doesNotMatch(message,/traitement|montant|diagnostic/i);
});

test("appointment WhatsApp link has a ready-to-send neutral appointment message",()=>{
  const url=buildWhatsAppAppointmentUrl({phone:"0612345678",firstName:"Sara",startsAt:"2026-09-13T09:00:00Z"});
  assert.ok(url?.startsWith("https://wa.me/212612345678?text="));
  const message=decodeURIComponent(url!.split("?text=")[1]);
  assert.match(message,/Sara/); assert.match(message,/rendez-vous/); assert.doesNotMatch(message,/traitement|montant|diagnostic/i);
});

test("WhatsApp messages carry an Arabic version after the French one",()=>{
  for(const url of [
    buildWhatsAppReminderUrl({phone:"0612345678",firstName:"Sara",startsAt:"2026-09-24T08:00:00Z",type:"day_before"}),
    buildWhatsAppAppointmentUrl({phone:"0612345678",firstName:"Sara",startsAt:"2026-09-24T08:00:00Z"}),
  ]){
    const [french,arabic]=decodeURIComponent(url!.split("?text=")[1]).split("\n\n");
    assert.match(french,/^Bonjour Sara/);
    assert.match(arabic,/^مرحبا Sara/); assert.match(arabic,/مركز وحيد لطب الأسنان/); assert.match(arabic,/09:00/);
  }
});

test("reminders stay due after threshold until handled or obsolete",()=>{
  const base={startsAt:"2026-09-13T12:00:00Z",type:"day_before" as const,status:"scheduled" as const,handled:false};
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-12T11:59:59Z"}),false);
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-12T12:00:00Z"}),true);
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-13T11:00:00Z"}),true);
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-13T12:00:00Z"}),false);
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-12T13:00:00Z",handled:true}),false);
  assert.equal(isReminderDue({...base,referenceTime:"2026-09-12T13:00:00Z",status:"cancelled"}),false);
});
