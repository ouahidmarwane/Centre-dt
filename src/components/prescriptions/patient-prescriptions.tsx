"use client";
import Link from "next/link";import {useActionState,useState} from "react";
import type {PrescriptionActionState} from "@/app/(dashboard)/patients/[id]/prescription-actions";import type {PrescriptionSummary} from "@/lib/prescriptions/data";import type {AppRole} from "@/lib/permissions";
import {FormField} from "@/components/ui/form-field";
import {submitKeepingValues} from "@/components/ui/submit-keeping-values";
import {Badge,Composer,DangerDisclosure,dangerLink,EmptyNote,fieldClass,ghostButton,PanelHeading,panelClass,primaryButton,ReadOnlyNote} from "@/components/ui/panel-ui";
type Props={patientId:string;patientActive:boolean;role:AppRole;prescriptionToken:string;prescriptions:PrescriptionSummary[];createAction:(s:PrescriptionActionState,f:FormData)=>Promise<PrescriptionActionState>;voidAction:(id:string,s:PrescriptionActionState,f:FormData)=>Promise<PrescriptionActionState>};
const initial:PrescriptionActionState={success:false,message:null,fieldErrors:{}};const date=new Intl.DateTimeFormat("fr-FR",{dateStyle:"long",timeZone:"Africa/Casablanca"});

export function PatientPrescriptions(props:Props){
  return <section aria-labelledby="prescriptions-title" className={`${panelClass} mt-5 p-5 sm:p-7`}>
    <PanelHeading id="prescriptions-title" title="Ordonnances" subtitle="Documents cliniques émis et conservés sans modification." action={<Link className={ghostButton} href={`/patients/${props.patientId}/print`}>Imprimer le dossier</Link>}/>
    <ul className="mt-5 grid gap-2 lg:grid-cols-2">{props.prescriptions.map(item=><PrescriptionCard item={item} key={item.id} patientId={props.patientId} role={props.role} voidAction={props.voidAction.bind(null,item.id)}/>)}</ul>
    {!props.prescriptions.length?<EmptyNote text="Aucune ordonnance émise."/>:null}
    {props.role==="doctor"&&props.patientActive?<Composer label="Nouvelle ordonnance"><PrescriptionForm key={props.prescriptionToken} action={props.createAction} idempotencyKey={props.prescriptionToken}/></Composer>:props.role==="doctor"?<ReadOnlyNote text="Le patient est archivé : aucune nouvelle ordonnance ne peut être émise."/>:<p className="mt-4 text-xs text-slate-500">Seul le docteur peut émettre ou annuler une ordonnance.</p>}
  </section>;
}

function PrescriptionCard({item,patientId,role,voidAction}:{item:PrescriptionSummary;patientId:string;role:AppRole;voidAction:(s:PrescriptionActionState,f:FormData)=>Promise<PrescriptionActionState>}){
  const[state,action,pending]=useActionState(voidAction,initial);
  const voided=item.status==="voided";
  return <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-3.5 py-3">
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-[10px] text-sm font-bold ${voided?"bg-slate-100 text-slate-400":"bg-[#eef6ff] text-[#0f5fc5]"}`}>℞</span>
      <div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${voided?"text-slate-400 line-through":"text-[var(--navy)]"}`}>Ordonnance du {date.format(new Date(item.issued_at))}</p><p className="mt-0.5 truncate text-xs text-slate-500">Dr {item.prescriber_name_snapshot} · {item.itemCount} médicament{item.itemCount>1?"s":""}</p></div>
      <Badge tone={voided?"slate":"green"}>{voided?"Annulée":"Active"}</Badge>
    </div>
    {voided?<p className="mt-2 text-xs text-slate-500">Motif : {item.void_reason}</p>:null}
    <div className="mt-2.5 flex flex-wrap items-start gap-2">
      <Link className={ghostButton} href={`/patients/${patientId}/prescriptions/${item.id}/print`}>Version imprimable</Link>
      {role==="doctor"&&item.status==="active"?<DangerDisclosure label="Annuler l’ordonnance…"><form action={action} className="flex flex-wrap items-end gap-2" onSubmit={event=>{if(!confirm("Annuler cette ordonnance ? Son contenu restera conservé."))event.preventDefault();}}><FormField className="block min-w-48 flex-1 text-xs font-medium text-slate-700" error={state.fieldErrors.reason} label="Motif"><input className={fieldClass} maxLength={500} minLength={5} name="reason" required/></FormField><button className={`${dangerLink} min-h-11 border border-red-200 bg-white`} disabled={pending}>{pending?"Annulation…":"Confirmer"}</button>{state.message?<p aria-live="polite" className="w-full text-xs text-red-700" role="alert">{state.message}</p>:null}</form></DangerDisclosure>:null}
    </div>
  </li>;
}

function PrescriptionForm({action,idempotencyKey}:{action:Props["createAction"];idempotencyKey:string}){
  const[state,formAction,pending]=useActionState(action,initial);const[items,setItems]=useState([0]);
  return <form action={formAction} className="mt-1" onSubmit={submitKeepingValues(formAction)}>
    <input name="idempotencyKey" type="hidden" value={idempotencyKey}/>
    <p className="text-xs text-slate-500">Après émission, toute correction exige l’annulation puis une nouvelle ordonnance.</p>
    <ol className="mt-3 space-y-3">{items.map((key,index)=><li key={key}><fieldset className="rounded-[14px] border border-[#e3ebf3] bg-[#fbfcfe] p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-[var(--navy)]"><span className="grid size-5 place-items-center rounded-md bg-[var(--navy)] text-[10px] text-white">{index+1}</span>Médicament</legend>
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Médicament" wide><input className={fieldClass} maxLength={160} name="medicationName" placeholder="Ex. Amoxicilline" required/></Field><Field label="Dosage"><input className={fieldClass} maxLength={160} name="dosage" placeholder="1 g" required/></Field><Field label="Fréquence"><input className={fieldClass} maxLength={160} name="frequency" placeholder="2 fois par jour" required/></Field><Field label="Durée (facultatif)"><input className={fieldClass} maxLength={160} name="duration" placeholder="7 jours"/></Field><Field label="Voie (facultatif)"><input className={fieldClass} maxLength={100} name="route" placeholder="Orale"/></Field><Field label="Instructions (facultatif)" wide><textarea className={fieldClass} maxLength={1000} name="instructions" rows={1}/></Field></div>
      {items.length>1?<button className={`${dangerLink} mt-2`} onClick={()=>setItems(current=>current.filter(item=>item!==key))} type="button">Retirer ce médicament</button>:null}
    </fieldset></li>)}</ol>
    <button className={`${ghostButton} mt-3`} disabled={items.length>=20} onClick={()=>setItems(current=>[...current,Math.max(...current)+1])} type="button">+ Ajouter un médicament</button>
    <div className="mt-3"><Field label="Notes de l’ordonnance" wide><textarea className={fieldClass} maxLength={2000} name="notes" rows={2}/></Field></div>
    {state.fieldErrors.items?<p className="mt-2 text-sm text-red-700">{state.fieldErrors.items}</p>:null}
    {state.message?<p aria-live="polite" className={`mt-3 rounded-[10px] px-3 py-2 text-sm ${state.success?"bg-[#e9f8f4] text-[#0e7c6d]":"bg-red-50 text-red-700"}`}>{state.message}</p>:null}
    <button className={`${primaryButton} mt-4`} disabled={pending} type="submit">{pending?"Émission…":"Émettre l’ordonnance"}</button>
  </form>;
}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <FormField className={`block text-sm font-medium text-slate-700 ${wide?"sm:col-span-3":""}`} label={label}>{children}</FormField>}
