"use client";

import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import { useActionState } from "react";
import type { FinanceActionState } from "@/app/(dashboard)/patients/[id]/finance-actions";
import type { DentalFinding } from "@/lib/odontogram/data";
import type { FinancialSummary, InterventionView, Payment } from "@/lib/finance/data";
import { interventionStatuses, paymentMethodLabels, paymentMethods } from "@/lib/finance/validation";
import { conditionLabels, permanentTeeth } from "@/lib/odontogram/validation";
import type { AppRole } from "@/lib/permissions";
import { FormField } from "@/components/ui/form-field";
import { Badge, chipClass, Composer, DangerDisclosure, dangerLink, EmptyNote, fieldClass, FormMessage, ghostButton, PanelHeading, panelClass, primaryButton, ReadOnlyNote } from "@/components/ui/panel-ui";

type Props={patientActive:boolean;role:AppRole;summary:FinancialSummary;interventions:InterventionView[];payments:Payment[];findings:DentalFinding[];interventionToken:string;paymentToken:string;today:string;nowLocal:string;createAction:(s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>;updateAction:(id:string,s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>;cancelAction:(id:string,s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>;recordAction:(s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>;reverseAction:(id:string,s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>};
const initial:FinanceActionState={success:false,message:null,fieldErrors:{}};
const money=new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD",minimumFractionDigits:2});
const date=new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeZone:"UTC"});
const day=new Intl.DateTimeFormat("fr-FR",{day:"2-digit",timeZone:"UTC"});
const month=new Intl.DateTimeFormat("fr-FR",{month:"short",timeZone:"UTC"});
const dateTime=new ClinicDateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"});
const statusLabel=(status:string)=>status==="cancelled"?"Annulée":status==="performed"?"Réalisée":"Planifiée";
const statusTone=(status:string)=>status==="cancelled"?"slate" as const:status==="performed"?"green" as const:"blue" as const;

export function PatientFinances(props:Props){
  const received=props.summary.outstanding===0;
  const paidShare=props.summary.total_due>0?Math.min(1,props.summary.total_received/props.summary.total_due):received?1:0;
  return <section className="mt-6 space-y-5" aria-labelledby="finances-title">
    <div className={`${panelClass} overflow-hidden`}>
      <div className="p-5 sm:p-7">
        <PanelHeading id="finances-title" title="Situation financière" subtitle="Calculée à partir des interventions réalisées et des paiements reçus." action={<Badge tone={received?"green":"amber"}>{received?"Compte soldé":"Reste à recevoir"}</Badge>}/>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <Figure label="Total des interventions" value={props.summary.total_due}/>
          <Figure label="Montant reçu" value={props.summary.total_received} tone="text-[#0e7c6d]"/>
          <Figure label="Reste à recevoir" value={props.summary.outstanding} tone={props.summary.outstanding>0?"text-[#b4541a]":"text-[var(--navy)]"}/>
        </dl>
        <div className="mt-5">
          <svg aria-hidden="true" className="block h-2 w-full overflow-hidden rounded-full" preserveAspectRatio="none" viewBox="0 0 100 2"><rect fill="#edf2f7" height="2" width="100"/><rect fill="#19a996" height="2" width={Math.round(paidShare*100)}/></svg>
          <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span><strong className="font-semibold text-[var(--navy)]">{Math.round(paidShare*100)} %</strong> réglé</span><span>Les paiements sont affectés au compte global du patient, pas à une intervention particulière.</span></p>
        </div>
      </div>
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className={`${panelClass} p-5 sm:p-6`}>
        <PanelHeading title="Interventions" subtitle={`${props.interventions.length} enregistrée${props.interventions.length>1?"s":""}`}/>
        <ul className="mt-4 space-y-2">{props.interventions.map(item=><InterventionCard key={item.id} item={item} {...props}/>)}</ul>
        {!props.interventions.length?<EmptyNote text="Aucune intervention enregistrée."/>:null}
        {props.patientActive?<Composer label="Nouvelle intervention"><InterventionForm action={props.createAction} findings={props.findings} idempotencyKey={props.interventionToken} today={props.today}/></Composer>:<ReadOnlyNote text="Lecture seule : dossier patient archivé."/>}
      </div>

      <div className={`${panelClass} p-5 sm:p-6`}>
        <PanelHeading title="Paiements" subtitle={`${props.payments.length} enregistré${props.payments.length>1?"s":""}`}/>
        <ul className="mt-4 space-y-2">{props.payments.map(item=><PaymentCard key={item.id} item={item} role={props.role} patientActive={props.patientActive} reverseAction={props.reverseAction.bind(null,item.id)}/>)}</ul>
        {!props.payments.length?<EmptyNote text="Aucun paiement enregistré."/>:null}
        {props.patientActive&&props.summary.outstanding>0
          ?<Composer label="Enregistrer un paiement"><PaymentForm key={props.paymentToken} action={props.recordAction} nowLocal={props.nowLocal} outstanding={props.summary.outstanding} token={props.paymentToken}/></Composer>
          :props.patientActive?<p className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#e9f8f4] px-4 py-3 text-sm text-[#0e7c6d]"><span aria-hidden="true">✓</span>Aucun montant à recevoir.</p>:<ReadOnlyNote text="Lecture seule : dossier patient archivé."/>}
      </div>
    </div>
  </section>;
}

function Figure({label,value,tone="text-[var(--navy)]"}:{label:string;value:number;tone?:string}){return <div><dt className="text-[13px] font-medium text-slate-500">{label}</dt><dd className={`metric-number mt-1.5 text-2xl font-semibold tracking-[-0.02em] ${tone}`}>{money.format(value)}</dd></div>}

function DateTile({value}:{value:string}){const parsed=new Date(`${value}T00:00:00Z`);return <span aria-hidden="true" className="grid w-11 shrink-0 overflow-hidden rounded-[10px] border border-[#dbe6f1] bg-white text-center"><span className="bg-[var(--navy)] py-px text-[9px] font-semibold text-white uppercase">{month.format(parsed).replace(".","")}</span><span className="metric-number py-1 text-sm leading-5 font-semibold text-[var(--navy)]">{day.format(parsed)}</span></span>}

function InterventionSummary({item}:{item:InterventionView}){
  return <div className="flex min-w-0 flex-1 items-center gap-3">
    <DateTile value={item.performed_at}/>
    <div className="min-w-0 flex-1">
      <p className={`truncate text-sm font-semibold ${item.status==="cancelled"?"text-slate-400 line-through":"text-[var(--navy)]"}`}>{item.nature}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{date.format(new Date(`${item.performed_at}T00:00:00Z`))} · {item.teeth.length?`Dent${item.teeth.length>1?"s":""} ${item.teeth.join(", ")}`:"Dents non précisées"}</p>
    </div>
    <div className="shrink-0 text-right"><p className="metric-number text-sm font-semibold text-[var(--navy)]">{money.format(item.amount_due)}</p><div className="mt-1"><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></div></div>
  </div>;
}

function InterventionCard({item,patientActive,role,findings,today,updateAction,cancelAction}:Props&{item:InterventionView}){
  const [cancelState,cancelFormAction,cancelPending]=useActionState(cancelAction.bind(null,item.id),initial);
  if(item.status==="cancelled"||!patientActive)return <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-3.5 py-3"><InterventionSummary item={item}/>{item.notes?<p className="mt-2 border-t border-[#eef3f8] pt-2 text-xs leading-5 whitespace-pre-wrap text-slate-600">{item.notes}</p>:null}</li>;
  return <li><details className="group/item rounded-[14px] border border-[#e3ebf3] bg-white transition-shadow open:shadow-[0_10px_30px_-22px_rgba(16,44,76,0.45)] hover:border-[#cddcec]">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-3"><InterventionSummary item={item}/><span aria-hidden="true" className="text-slate-300 transition-transform duration-200 group-open/item:rotate-180">⌄</span></summary>
    <div className="border-t border-[#eef3f8] px-3.5 pb-4">
      {item.notes?<p className="mt-3 rounded-[10px] bg-[#f5f8fb] px-3 py-2 text-xs leading-5 whitespace-pre-wrap text-slate-600">{item.notes}</p>:null}
      <InterventionForm action={updateAction.bind(null,item.id)} findings={findings} initialValue={item} today={today}/>
      {role==="doctor"?<div className="mt-3"><DangerDisclosure label="Annuler l’intervention…"><form action={cancelFormAction} onSubmit={event=>{if(!confirm("Annuler cette intervention ? L’historique sera conservé."))event.preventDefault();}}><p className="text-xs text-slate-600">L’intervention restera visible dans l’historique, barrée.</p><FormMessage state={cancelState}/><button className={`${dangerLink} mt-2 border border-red-200 bg-white`} disabled={cancelPending} type="submit">{cancelPending?"Annulation…":"Confirmer l’annulation"}</button></form></DangerDisclosure></div>:null}
    </div>
  </details></li>;
}

function InterventionForm({action,findings,today,initialValue,idempotencyKey}:{action:Props["createAction"];findings:DentalFinding[];today:string;initialValue?:InterventionView;idempotencyKey?:string}){
  const [state,formAction,pending]=useActionState(action,initial);
  return <form action={formAction} className="mt-3">
    {idempotencyKey?<input name="idempotencyKey" type="hidden" value={idempotencyKey}/>:null}
    {initialValue?<p className="text-xs font-semibold text-slate-500">Modifier l’intervention</p>:null}
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <Field label="Nature du soin" error={state.fieldErrors.nature} wide><input className={fieldClass} defaultValue={initialValue?.nature??""} maxLength={160} name="nature" placeholder="Ex. Détartrage, composite 36…" required/></Field>
      <Field label="Date" error={state.fieldErrors.performedAt}><input className={fieldClass} defaultValue={initialValue?.performed_at??today} name="performedAt" required type="date"/></Field>
      <Field label="Prix (MAD)" error={state.fieldErrors.amountDue}><input className={fieldClass} defaultValue={initialValue?.amount_due.toFixed(2)??""} inputMode="decimal" name="amountDue" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" required/></Field>
    </div>
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-slate-700">Statut</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{interventionStatuses.map(s=><label className={chipClass} key={s}><input className="sr-only" defaultChecked={(initialValue?.status??"performed")===s} name="status" type="radio" value={s}/>{s==="performed"?"Réalisée":"Planifiée"}</label>)}</div>
      {state.fieldErrors.status?<p className="mt-1 text-sm text-red-700">{state.fieldErrors.status}</p>:null}
    </fieldset>
    <div className="mt-3"><Field label="Notes cliniques" error={state.fieldErrors.notes} wide><textarea className={fieldClass} defaultValue={initialValue?.notes??""} maxLength={4000} name="notes" rows={2}/></Field></div>
    <details className="group/teeth mt-3" open={Boolean(initialValue?.teeth.length)}>
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-[var(--navy)]"><span aria-hidden="true" className="text-slate-400 transition-transform group-open/teeth:rotate-90">›</span>Dents concernées</summary>
      <div className="mt-2 flex flex-wrap gap-1">{permanentTeeth.map(tooth=><label className={`${chipClass} min-h-8 w-11 justify-center px-0 tabular-nums`} key={tooth}><input className="sr-only" defaultChecked={initialValue?.teeth.includes(tooth)} name="teeth" type="checkbox" value={tooth}/>{tooth}</label>)}</div>
    </details>
    {findings.length?<details className="group/findings mt-2" open={Boolean(initialValue?.findingIds.length)}>
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-[var(--navy)]"><span aria-hidden="true" className="text-slate-400 transition-transform group-open/findings:rotate-90">›</span>Constatations liées</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">{findings.map(f=><label className={chipClass} key={f.id}><input className="sr-only" defaultChecked={initialValue?.findingIds.includes(f.id)} name="findingIds" type="checkbox" value={f.id}/>Dent {f.tooth_number} · {conditionLabels[f.condition]}</label>)}</div>
    </details>:null}
    <FormMessage state={state}/>
    <button className={`${initialValue?ghostButton+" min-h-10":primaryButton} mt-4`} disabled={pending} type="submit">{pending?"Enregistrement…":initialValue?"Enregistrer les modifications":"Enregistrer l’intervention"}</button>
  </form>;
}

function PaymentForm({action,nowLocal,token,outstanding}:{action:Props["recordAction"];nowLocal:string;token:string;outstanding:number}){
  const[state,formAction,pending]=useActionState(action,initial);
  return <form action={formAction} className="mt-2">
    <input name="idempotencyKey" type="hidden" value={token}/>
    <p className="text-xs text-slate-500">Reste à recevoir : <strong className="font-semibold text-[var(--navy)]">{money.format(outstanding)}</strong></p>
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <Field label="Montant reçu (MAD)" error={state.fieldErrors.amount}><input className={`${fieldClass} text-base font-semibold`} inputMode="decimal" name="amount" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" required/></Field>
      <Field label="Reçu le" error={state.fieldErrors.receivedAt}><input className={fieldClass} defaultValue={nowLocal} name="receivedAt" required type="datetime-local"/></Field>
    </div>
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-slate-700">Mode de paiement</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{paymentMethods.map((m,index)=><label className={chipClass} key={m}><input className="sr-only" defaultChecked={index===0} name="method" type="radio" value={m}/>{paymentMethodLabels[m]}</label>)}</div>
      {state.fieldErrors.method?<p className="mt-1 text-sm text-red-700">{state.fieldErrors.method}</p>:null}
    </fieldset>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Référence (facultatif)" error={state.fieldErrors.reference}><input className={fieldClass} maxLength={160} name="reference" placeholder="N° de chèque, virement…"/></Field>
      <Field label="Note (facultatif)" error={state.fieldErrors.notes}><textarea className={fieldClass} maxLength={2000} name="notes" rows={1}/></Field>
    </div>
    <FormMessage state={state}/>
    <button className={`${primaryButton} mt-4`} disabled={pending} type="submit">{pending?"Enregistrement…":"Enregistrer le paiement"}</button>
  </form>;
}

function PaymentCard({item,role,patientActive,reverseAction}:{item:Payment;role:AppRole;patientActive:boolean;reverseAction:(s:FinanceActionState,f:FormData)=>Promise<FinanceActionState>}){
  const[state,formAction,pending]=useActionState(reverseAction,initial);
  const reversed=item.status!=="received";
  return <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-3.5 py-3">
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${reversed?"bg-slate-100 text-slate-400":"bg-[#e9f8f4] text-[#0e7c6d]"}`}>
        <svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="12" rx="2" width="18" x="3" y="6"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5v0M17 14.5v0"/></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`metric-number text-sm font-semibold ${reversed?"text-slate-400 line-through":"text-[var(--navy)]"}`}>{money.format(item.amount)}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{dateTime.format(new Date(item.received_at))} · {paymentMethodLabels[item.method]}{item.reference?` · Réf. ${item.reference}`:""}</p>
      </div>
      <Badge tone={reversed?"slate":"green"}>{reversed?"Annulé":"Reçu"}</Badge>
    </div>
    {item.notes?<p className="mt-2 text-xs leading-5 whitespace-pre-wrap text-slate-600">{item.notes}</p>:null}
    {reversed?<p className="mt-2 text-xs text-slate-500">Motif d’annulation : {item.reversal_reason}</p>:null}
    {role==="doctor"&&patientActive&&item.status==="received"?<div className="mt-2"><DangerDisclosure label="Annuler le paiement…"><form action={formAction} onSubmit={event=>{if(!confirm("Annuler ce paiement ? Le solde sera recalculé."))event.preventDefault();}}><Field error={state.fieldErrors.reason} label="Motif"><input className={fieldClass} maxLength={500} minLength={5} name="reason" placeholder="Ex. Erreur de saisie" required/></Field><FormMessage state={state}/><button className={`${dangerLink} mt-2 border border-red-200 bg-white`} disabled={pending} type="submit">{pending?"Annulation…":"Confirmer l’annulation"}</button></form></DangerDisclosure></div>:null}
  </li>;
}

function Field({children,label,error,wide=false}:{children:React.ReactNode;label:string;error?:string;wide?:boolean}){return <FormField className={`block text-sm font-medium text-slate-700 ${wide?"sm:col-span-2":""}`} error={error} label={label}>{children}</FormField>}
