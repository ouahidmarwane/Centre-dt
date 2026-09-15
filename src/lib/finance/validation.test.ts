import assert from "node:assert/strict";
import test from "node:test";
import { isFinanceId, isMoney, validateInterventionForm, validatePaymentForm, validateReason } from "./validation.ts";

function form(values: Record<string,string|string[]>) { const f=new FormData(); for(const [k,v] of Object.entries(values)) for(const item of Array.isArray(v)?v:[v]) f.append(k,item); return f; }
const uuid="f47ac10b-58cc-4372-a567-0e02b2c3d479";

test("validates precise MAD amounts without floating point",()=>{
  for(const value of ["0","10","10.5","10.50","9999999999.99"]) assert.equal(isMoney(value,true),true);
  for(const value of ["-1","1.234","NaN","Infinity","01","10000000000"]) assert.equal(isMoney(value,true),false);
  assert.equal(isMoney("0",false),false);
});
test("validates intervention fields, FDI teeth and finding UUIDs",()=>{
  const good=validateInterventionForm(form({performedAt:"2026-09-12",nature:"Obturation test",amountDue:"500.00",status:"performed",notes:"",teeth:["16","17"],findingIds:[uuid]}),new Date("2026-09-12T12:00:00Z"));
  assert.equal(good.success,true);
  assert.equal(validateInterventionForm(form({performedAt:"2026-09-13",nature:"Test",amountDue:"1",status:"performed",teeth:["19"]}),new Date("2026-09-12T12:00:00Z")).success,false);
});
test("validates payments, idempotency and reversal reasons",()=>{
  const good=validatePaymentForm(form({amount:"200.00",method:"cash",receivedAt:"2026-09-12T10:00",idempotencyKey:uuid}),new Date("2026-09-12T12:00:00Z"));
  assert.equal(good.success,true);
  if(good.success) assert.equal(good.data.receivedAt,"2026-09-12T09:00:00.000Z");
  assert.equal(validatePaymentForm(form({amount:"-1",method:"coin",receivedAt:"later",idempotencyKey:"bad"})).success,false);
  assert.equal(validateReason(" erreur de saisie "),"erreur de saisie");
  assert.equal(validateReason("non"),null);
  assert.equal(isFinanceId(uuid),true); assert.equal(isFinanceId("bad"),false);
});
test("interprets finance dates in Africa/Casablanca rather than the server timezone",()=>{
  const nearMidnight=new Date("2026-09-12T23:30:00Z");
  const intervention=validateInterventionForm(form({performedAt:"2026-09-13",nature:"Contrôle",amountDue:"0",status:"performed"}),nearMidnight);
  assert.equal(intervention.success,true);
  const payment=validatePaymentForm(form({amount:"10",method:"cash",receivedAt:"2026-09-13T00:15",idempotencyKey:uuid}),nearMidnight);
  assert.equal(payment.success,true);
  if(payment.success) assert.equal(payment.data.receivedAt,"2026-09-12T23:15:00.000Z");
});
