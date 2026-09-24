"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";

import type { DentalActionState } from "@/app/(dashboard)/patients/[id]/odontogram-actions";
import { StatusPill } from "@/components/ui/clinic-ui";
import { FormField } from "@/components/ui/form-field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import type { DentalFinding, DentalRevision } from "@/lib/odontogram/data";
import { conditionLabels, dentalConditions, editableDentalStatuses, statusLabels, toothQuadrants, type DentalStatus, type PermanentTooth } from "@/lib/odontogram/validation";
import type { AppRole } from "@/lib/permissions";

type Props = { patientActive:boolean; role:AppRole; findings:DentalFinding[]; revisions:DentalRevision[]; createAction:(state:DentalActionState,formData:FormData)=>Promise<DentalActionState>; updateAction:(findingId:string,state:DentalActionState,formData:FormData)=>Promise<DentalActionState>; resolveAction:(findingId:string)=>Promise<void> };
const initialState:DentalActionState={success:false,message:null,fieldErrors:{}};
const eventLabels={created:"Créée",updated:"Modifiée",status_changed:"Statut modifié",resolved:"Résolue"} as const;
const statusCodes:Record<DentalStatus,string>={untreated:"À traiter",monitoring:"Surveillance",treated:"Traitée",resolved:"Historique"};

export function Odontogram({patientActive,role,findings,revisions,createAction,updateAction,resolveAction}:Props){
  const initialTooth=(findings[0]?.tooth_number??16) as PermanentTooth;
  const[selectedTooth,setSelectedTooth]=useState<PermanentTooth>(initialTooth);
  const [selectedTeeth,setSelectedTeeth]=useState<PermanentTooth[]>([initialTooth]);
  const [saving,setSaving]=useState(false);
  const [composerKey,setComposerKey]=useState(0);
  function selectTooth(tooth:PermanentTooth){if(saving)return;setSelectedTooth(tooth);setSelectedTeeth(current=>current.includes(tooth)?current.filter(value=>value!==tooth):[...current,tooth].sort((a,b)=>a-b));}
  const selectedFindings=findings.filter(finding=>finding.tooth_number===selectedTooth);
  const selectedHistory=revisions.filter(revision=>revision.tooth_number===selectedTooth);
  return <section className="clinic-bento mt-6 !p-0" aria-labelledby="odontogram-title">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-5 sm:px-7"><div><p className="text-[10px] font-bold tracking-[.18em] text-[var(--brand)] uppercase">Carte dentaire</p><h2 className="mt-1 text-xl font-bold tracking-[-.025em] text-[var(--navy)]" id="odontogram-title">Odontogramme permanent</h2><p className="mt-1 text-sm text-[var(--muted)]">Sélectionnez une ou plusieurs dents · cliquez à nouveau pour désélectionner · numérotation FDI</p></div><StatusPill tone={findings.length?"gold":"green"}>{findings.length?`${findings.length} constatation${findings.length===1?"":"s"} active${findings.length===1?"":"s"}`:"✓ Aucune constatation active"}</StatusPill></div>
    <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 sm:mx-7"><p className="text-sm font-semibold text-blue-700" aria-live="polite">Dents sélectionnées (FDI) : {selectedTeeth.join(", ") || "aucune"}</p><button type="button" className="min-h-11 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-blue-50 disabled:opacity-50" disabled={saving || !selectedTeeth.length} onClick={()=>setSelectedTeeth([])}>Tout désélectionner</button></div>
    {!patientActive?<p className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:mx-7">Lecture seule : ce dossier patient est archivé.</p>:null}
    <div className="mx-3 mt-5 overflow-x-auto rounded-[22px] bg-[linear-gradient(155deg,#f8fbff,#edf6ff)] px-3 py-6 ring-1 ring-inset ring-blue-100/70 sm:mx-7 sm:px-6"><div className="mx-auto min-w-[760px] max-w-5xl" aria-label="Arcades dentaires"><div className="mb-3 flex items-center justify-between px-8 text-[10px] font-bold tracking-[.14em] text-slate-400 uppercase"><span>Côté droit du patient</span><span>Arcade supérieure</span><span>Côté gauche du patient</span></div><DentalRow quadrants={[toothQuadrants[0],toothQuadrants[1]]} selected={selectedTeeth} findings={findings} onSelect={selectTooth} disabled={saving} arch="upper"/><div className="my-4 flex items-center gap-4 px-12" aria-hidden="true"><span className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-blue-300"/><span className="rounded-full bg-white px-3 py-1 text-[9px] font-bold tracking-[.16em] text-blue-500 shadow-sm">PLAN OCCLUSAL</span><span className="h-px flex-1 bg-gradient-to-r from-blue-300 via-blue-200 to-transparent"/></div><DentalRow quadrants={[toothQuadrants[2],toothQuadrants[3]]} selected={selectedTeeth} findings={findings} onSelect={selectTooth} disabled={saving} arch="lower"/><p className="mt-3 text-center text-[10px] font-bold tracking-[.14em] text-slate-400 uppercase">Arcade inférieure</p></div></div>
    <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {patientActive
        ? <NewFindingForm key={`${selectedTeeth.join(",")}-${composerKey}`} teeth={selectedTeeth} role={role} action={createAction} onSaving={setSaving} onReset={()=>setComposerKey(key=>key+1)}/>
        : <p className="self-start rounded-[16px] border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">Dossier archivé : les notes restent consultables mais ne peuvent plus être ajoutées.</p>}
      <ToothThread tooth={selectedTooth} findings={selectedFindings} history={selectedHistory} revisions={revisions} patientActive={patientActive} role={role} updateAction={updateAction} resolveAction={resolveAction}/>
    </div>
  </section>;
}

const dateTime=new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Casablanca"});
const roleLabel=(role:string)=>role==="doctor"?"Médecin":"Assistant(e)";

// Colour language shared by bubbles, pills and the tracker.
const statusTone:Record<DentalStatus,{dot:string;pill:string;ring:string}>={
  untreated:{dot:"bg-amber-500",pill:"bg-amber-50 text-amber-800 ring-amber-200",ring:"has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-900"},
  monitoring:{dot:"bg-[var(--blue)]",pill:"bg-[#eef6ff] text-[#0f5fc5] ring-blue-200",ring:"has-[:checked]:border-[var(--blue)] has-[:checked]:bg-[#eef6ff] has-[:checked]:text-[#0f5fc5]"},
  treated:{dot:"bg-[#19a996]",pill:"bg-[#e9f8f4] text-[#0e7c6d] ring-emerald-200",ring:"has-[:checked]:border-[#19a996] has-[:checked]:bg-[#e9f8f4] has-[:checked]:text-[#0e7c6d]"},
  resolved:{dot:"bg-slate-400",pill:"bg-slate-100 text-slate-600 ring-slate-200",ring:""},
};
const statusHints:Record<DentalStatus,string>={untreated:"Soin à prévoir",monitoring:"À recontrôler",treated:"Soin réalisé",resolved:"Dossier clos"};

function StatusBadge({status}:{status:DentalStatus}){return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusTone[status].pill}`}><span className={`size-1.5 rounded-full ${statusTone[status].dot}`}/>{statusLabels[status]}</span>}

function ToothThread({tooth,findings,history,revisions,patientActive,role,updateAction,resolveAction}:{tooth:PermanentTooth;findings:DentalFinding[];history:DentalRevision[];revisions:DentalRevision[];patientActive:boolean;role:AppRole;updateAction:Props["updateAction"];resolveAction:Props["resolveAction"]}){
  return <div className="min-w-0">
    <div className="flex items-center gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[var(--brand)] shadow-[0_8px_18px_-8px_rgba(22,119,242,.7)]"><Image alt="" aria-hidden="true" className="h-9 w-auto object-contain brightness-0 invert" height={40} src={`/assets/dentist-app/tooth-${tooth}.svg`} width={34}/></span>
      <div className="min-w-0"><h3 className="text-[17px] font-semibold tracking-[-.02em] text-[var(--navy)]">Dent {tooth}</h3><p className="truncate text-xs text-slate-500">{toothName(tooth)}</p></div>
      <span className="ml-auto shrink-0 text-xs text-slate-500">{findings.length?`${findings.length} note${findings.length>1?"s":""} active${findings.length>1?"s":""}`:"Aucune note active"}</span>
    </div>
    <ol aria-label={`Notes de la dent ${tooth}`} className="mt-4 space-y-3">
      {findings.map(finding=><FindingBubble key={finding.id} finding={finding} revisions={revisions.filter(revision=>revision.finding_id===finding.id)} patientActive={patientActive} role={role} updateAction={updateAction.bind(null,finding.id)} resolveAction={resolveAction.bind(null,finding.id)}/>)}
      {!findings.length?<li className="rounded-[16px] border border-dashed border-[#d3e1ef] bg-white/60 px-4 py-6 text-center"><p className="text-sm font-medium text-[var(--navy)]">Pas encore de note sur cette dent</p><p className="mt-1 text-xs text-slate-500">{patientActive?"Décrivez ce que vous avez constaté ou réalisé dans le champ à gauche.":"Aucune note active."}</p></li>:null}
    </ol>
    {history.length?<details className="group/history mt-4 rounded-[14px] border border-[#e3ebf3] bg-white/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-xs font-semibold text-slate-600 hover:text-[var(--navy)]">Historique complet de la dent ({history.length})<span aria-hidden="true" className="transition-transform group-open/history:rotate-180">⌄</span></summary>
      <ol className="space-y-3 px-4 pb-4">{history.map(revision=><li className="flex items-start gap-3 text-xs" key={revision.id}><span className={`mt-1 size-2 shrink-0 rounded-full ${statusTone[revision.status].dot}`}/><div><p className="font-semibold text-[var(--navy)]">{eventLabels[revision.event_type]} · {conditionLabels[revision.condition]} · {statusLabels[revision.status]}</p><p className="mt-0.5 text-slate-500">{roleLabel(revision.changed_by_role)} · <time dateTime={revision.changed_at}>{dateTime.format(new Date(revision.changed_at))}</time></p></div></li>)}</ol>
    </details>:null}
  </div>;
}

function FindingBubble({finding,revisions,patientActive,role,updateAction,resolveAction}:{finding:DentalFinding;revisions:DentalRevision[];patientActive:boolean;role:AppRole;updateAction:(state:DentalActionState,formData:FormData)=>Promise<DentalActionState>;resolveAction:()=>Promise<void>}){
  const[open,setOpen]=useState(false);
  const[editing,setEditing]=useState(false);
  const created=[...revisions].reverse().find(revision=>revision.event_type==="created");
  return <li className="flex gap-2.5">
    <span aria-hidden="true" className={`mt-3 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${created?.changed_by_role==="doctor"?"bg-[var(--navy)]":"bg-slate-400"}`}>{created?.changed_by_role==="doctor"?"Dr":"As"}</span>
    <article className="relative min-w-0 flex-1 rounded-[16px] rounded-tl-[6px] border border-[#dbe6f1] bg-white px-4 py-3 shadow-[0_6px_18px_-12px_rgba(16,44,76,.35)] transition-shadow hover:shadow-[0_10px_24px_-12px_rgba(16,44,76,.4)]">
      <header className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[var(--navy)]">{conditionLabels[finding.condition]}</p><StatusBadge status={finding.status}/></header>
      {finding.notes?<p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-slate-700">{finding.notes}</p>:<p className="mt-1.5 text-sm text-slate-400">Aucun détail saisi.</p>}
      {finding.recommendation?<p className="mt-2 flex gap-2 rounded-[10px] bg-[#f5f8fb] px-3 py-2 text-xs leading-5 text-slate-600"><span aria-hidden="true" className="text-[var(--blue)]">→</span><span><span className="font-semibold text-[var(--navy)]">Recommandation : </span>{finding.recommendation}</span></p>:null}
      <footer className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">{created?`${roleLabel(created.changed_by_role)} · `:""}<time dateTime={finding.updated_at}>{finding.updated_at!==finding.created_at?"modifiée le ":""}{dateTime.format(new Date(finding.updated_at))}</time></p>
        <button aria-expanded={open} className="inline-flex min-h-8 items-center gap-1 rounded-[8px] px-2 text-xs font-semibold text-[var(--blue-deep)] transition-colors hover:bg-[#eef6ff]" onClick={()=>setOpen(value=>!value)} type="button">{open?"Masquer les détails":"Voir les détails"}<span aria-hidden="true" className={`transition-transform duration-200 ${open?"rotate-180":""}`}>⌄</span></button>
      </footer>
      {open?<div className="mt-3 border-t border-[#eef3f8] pt-4">
        <StatusTracker status={finding.status} revisions={revisions}/>
        <ol className="mt-5 space-y-0">
          {revisions.map(revision=><li className="relative flex gap-3 pb-3 before:absolute before:top-3 before:bottom-0 before:left-[0.28rem] before:w-px before:bg-[#e3ebf3] last:pb-0 last:before:hidden" key={revision.id}><span className={`relative mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-white ${statusTone[revision.status].dot}`}/><div className="min-w-0 text-xs"><p className="font-semibold text-[var(--navy)]">{eventLabels[revision.event_type]} · {statusLabels[revision.status]}</p><p className="mt-0.5 text-slate-500">{roleLabel(revision.changed_by_role)} · <time dateTime={revision.changed_at}>{dateTime.format(new Date(revision.changed_at))}</time></p></div></li>)}
        </ol>
        {patientActive?<div className="mt-4">
          {editing
            ? <FindingEditor finding={finding} role={role} updateAction={updateAction} resolveAction={resolveAction} onCancel={()=>setEditing(false)}/>
            : <button className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#d6e3f0] bg-white px-3 text-xs font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] hover:text-[var(--blue-deep)] active:scale-[0.98]" onClick={()=>setEditing(true)} type="button">Modifier la note ou le statut</button>}
        </div>:null}
      </div>:null}
    </article>
  </li>;
}

// Delivery-style progress: each step lights up once the finding has reached it.
const trackerSteps:{status:DentalStatus;label:string}[]=[{status:"untreated",label:"À traiter"},{status:"monitoring",label:"Surveillance"},{status:"treated",label:"Traitée"},{status:"resolved",label:"Clôturée"}];
function StatusTracker({status,revisions}:{status:DentalStatus;revisions:DentalRevision[]}){
  const current=trackerSteps.findIndex(step=>step.status===status);
  return <div>
    <p className="text-[11px] font-semibold text-slate-500">Suivi du soin</p>
    <ol className="mt-3 grid grid-cols-4">
      {trackerSteps.map((step,index)=>{
        const reachedAt=[...revisions].reverse().find(revision=>revision.status===step.status)?.changed_at;
        const done=index<current&&Boolean(reachedAt);
        const skipped=index<current&&!reachedAt;
        const active=index===current;
        return <li className="relative flex flex-col items-center text-center" key={step.status}>
          {index>0?<span aria-hidden="true" className={`absolute top-[9px] right-1/2 left-[-50%] h-0.5 ${index<=current?"bg-[var(--blue)]":"bg-[#e3ebf3]"} ${skipped?"opacity-40":""}`}/>:null}
          <span className={`relative z-10 grid size-5 place-items-center rounded-full border-2 ${active?"border-[var(--blue)] bg-white":done?"border-[var(--blue)] bg-[var(--blue)]":skipped?"border-dashed border-slate-300 bg-white":"border-[#dbe6f1] bg-white"}`}>
            {done?<svg aria-hidden="true" className="size-3 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>:null}
            {active?<><span className="absolute inset-0 animate-ping rounded-full bg-[var(--blue)] opacity-25"/><span className="size-2 rounded-full bg-[var(--blue)]"/></>:null}
          </span>
          <span className={`mt-1.5 text-[11px] font-semibold ${active?"text-[var(--blue-deep)]":done?"text-[var(--navy)]":"text-slate-400"}`}>{step.label}</span>
          <span className="text-[10px] text-slate-400">{active||done?(reachedAt?dateTime.format(new Date(reachedAt)):"—"):skipped?"non utilisée":statusHints[step.status]}</span>
        </li>;
      })}
    </ol>
  </div>;
}

function DentalRow({quadrants,selected,findings,onSelect,arch,disabled}:{quadrants:readonly[readonly PermanentTooth[],readonly PermanentTooth[]];selected:PermanentTooth[];findings:DentalFinding[];onSelect:(tooth:PermanentTooth)=>void;arch:"upper"|"lower";disabled:boolean}){
  return <div className={`grid grid-cols-[1fr_auto_1fr] gap-2 ${arch==="upper"?"items-end":"items-start"}`}><div className="flex justify-end gap-1">{quadrants[0].map(renderTooth)}</div><span aria-hidden="true" className="h-24 w-px bg-blue-200"/><div className="flex gap-1">{quadrants[1].map(renderTooth)}</div></div>;
  function renderTooth(tooth:PermanentTooth){const toothFindings=findings.filter(finding=>finding.tooth_number===tooth);const principal=toothFindings.find(item=>item.status==="untreated")?.status??toothFindings.find(item=>item.status==="monitoring")?.status??toothFindings[0]?.status;const label=`Dent ${tooth} — ${toothName(tooth)} — ${toothFindings.length?`${toothFindings.length} constatation(s), ${[...new Set(toothFindings.map(item=>statusCodes[item.status]))].join(", ")}`:"aucune constatation active"}`;return <button disabled={disabled} aria-label={label} aria-pressed={selected.includes(tooth)} className={`group relative flex min-h-24 w-11 flex-col items-center justify-between rounded-2xl px-1 py-2 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:z-10 ${selected.includes(tooth)?"bg-white shadow-[0_8px_24px_rgba(36,107,253,.18)] ring-2 ring-[var(--brand)]":"ring-1 ring-transparent"}`} key={tooth} onClick={()=>onSelect(tooth)} title={label} type="button"><span className={`relative flex h-14 w-full items-center justify-center rounded-xl transition ${selected.includes(tooth)?"bg-[var(--brand)] shadow-sm":"bg-blue-200/65 group-hover:bg-blue-300/70"}`}><Image alt="" aria-hidden="true" className="max-h-12 w-auto object-contain drop-shadow-sm transition group-hover:scale-110" height={54} src={`/assets/dentist-app/tooth-${tooth}.svg`} width={48}/>{toothFindings.length?<span className={`absolute -right-0.5 top-0 grid size-4 place-items-center rounded-full text-[9px] font-black text-white ring-2 ring-white ${principal==="treated"?"bg-emerald-500":principal==="monitoring"?"bg-blue-500":"bg-amber-500"}`}>{toothFindings.length}</span>:null}</span><span className={`text-[11px] font-extrabold ${selected.includes(tooth)?"text-[var(--brand)]":"text-slate-600"}`}>{tooth}</span><span className="sr-only">{principal?statusCodes[principal]:"Sans constatation"}</span></button>}
}

function toothName(tooth:PermanentTooth){const names:Record<number,string>={1:"Incisive centrale",2:"Incisive latérale",3:"Canine",4:"Première prémolaire",5:"Deuxième prémolaire",6:"Première molaire",7:"Deuxième molaire",8:"Troisième molaire"};const quadrant=Math.floor(tooth/10);const level=quadrant<3?"supérieure":"inférieure";const side=quadrant===1||quadrant===4?"droite":"gauche";return `${names[tooth%10]} ${level} ${side}`}

function NewFindingForm({teeth,role,action,onSaving,onReset}:{teeth:PermanentTooth[];role:AppRole;action:Props["createAction"];onSaving:(saving:boolean)=>void;onReset:()=>void}) {
  const completed = useRef(new Set<number>());
  const [state,formAction,pending] = useActionState(async (_state:DentalActionState, data:FormData):Promise<DentalActionState> => {
    if (!teeth.length) return {...initialState,message:"Sélectionnez au moins une dent."};
    onSaving(true);
    try {
      for (const tooth of teeth) {
        if (completed.current.has(tooth)) continue;
        const toothData = new FormData();
        data.forEach((value,key) => toothData.append(key,value));
        toothData.set("toothNumber",String(tooth));
        const result = await action(initialState,toothData);
        if (!result.success) return {...result,message:`Dent ${tooth} : ${result.message ?? "Échec de l’enregistrement."}${completed.current.size ? ` Dents déjà enregistrées : ${[...completed.current].join(", ")}. Réessayez pour les dents restantes.` : ""}`};
        completed.current.add(tooth);
      }
      return {success:true,fieldErrors:{},message:`Constatation enregistrée pour les dents ${teeth.join(", ")}.`};
    } catch {
      return {...initialState,message:`Enregistrement interrompu. Dents confirmées : ${[...completed.current].join(", ") || "aucune"}. Vérifiez le dossier avant de réessayer.`};
    } finally { onSaving(false); }
  },initialState);
  const target=teeth.length===1?`la dent ${teeth[0]}`:teeth.length?`${teeth.length} dents · ${teeth.join(", ")}`:"aucune dent";
  return <form action={formAction} className="self-start rounded-[18px] border border-[#dbe6f1] bg-white p-4 shadow-[0_10px_30px_-20px_rgba(16,44,76,.4)] sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[17px] font-semibold tracking-[-.02em] text-[var(--navy)]">Nouvelle note</h3>
      <span className="rounded-lg bg-[#eef6ff] px-2.5 py-1 text-xs font-semibold text-[#0f5fc5]">Pour {target}</span>
    </div>
    {teeth.length>1?<p className="mt-1 text-xs text-slate-500">La même note sera ajoutée à chaque dent sélectionnée.</p>:null}
    <fieldset className="disabled:opacity-70" disabled={pending || state.success}><FindingFields role={role} state={state}/></fieldset>
    <ActionMessage state={state}/>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {state.success
        ? <button className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[#d6e3f0] bg-white px-4 text-sm font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] active:scale-[0.98]" onClick={onReset} type="button">+ Écrire une autre note</button>
        : <button className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(22,119,242,.7)] transition-all hover:-translate-y-px hover:bg-[var(--brand-strong)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50" disabled={pending || !teeth.length} type="submit">{pending?"Enregistrement…":"Enregistrer la note"}</button>}
      {!teeth.length?<span className="text-xs text-slate-500">Sélectionnez une dent sur le schéma.</span>:null}
    </div>
  </form>;
}

function FindingEditor({finding,role,updateAction,resolveAction,onCancel}:{finding:DentalFinding;role:AppRole;updateAction:(state:DentalActionState,formData:FormData)=>Promise<DentalActionState>;resolveAction:()=>Promise<void>;onCancel:()=>void}){
  const[state,formAction,pending]=useActionState(updateAction,initialState);
  return <form action={formAction} className="rounded-[14px] bg-[#f7fafd] p-3 ring-1 ring-[#e3ebf3] ring-inset sm:p-4">
    <input name="toothNumber" type="hidden" value={finding.tooth_number}/>
    <FindingFields finding={finding} role={role} state={state} compact/>
    <ActionMessage state={state}/>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="min-h-10 rounded-[10px] bg-[var(--brand)] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[var(--brand-strong)] active:scale-[0.98] disabled:opacity-60" disabled={pending} type="submit">{pending?"Mise à jour…":"Enregistrer les modifications"}</button>
      {role==="doctor"?<PendingSubmitButton className="min-h-10 rounded-[10px] border border-emerald-200 bg-white px-3.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60" formAction={resolveAction} pendingLabel="Clôture…">Clôturer (résolue)</PendingSubmitButton>:null}
      <button className="min-h-10 rounded-[10px] px-3 text-xs font-semibold text-slate-500 hover:text-[var(--navy)]" onClick={onCancel} type="button">Annuler</button>
    </div>
  </form>;
}

// Free text first (what was seen or done), then one-tap choices for condition and status.
function FindingFields({finding,role,state,compact=false}:{finding?:DentalFinding;role:AppRole;state:DentalActionState;compact?:boolean}){
  const statuses=role==="doctor"?editableDentalStatuses:editableDentalStatuses.filter(status=>status!=="treated");
  const chip="cursor-pointer rounded-[10px] border border-[#dbe6f1] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:border-[#bfd3e8] hover:text-[var(--navy)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--blue)] active:scale-[0.97]";
  return <div className={`${compact?"mt-1":"mt-4"} space-y-4`}>
    <FormField className="block text-xs font-semibold text-slate-600" error={state.fieldErrors.notes} label="Ce que vous avez constaté ou réalisé">
      <textarea className="mt-1.5 w-full resize-y rounded-[12px] border border-[#d7e2ee] bg-white px-3.5 py-3 text-sm leading-6 text-[var(--navy)] outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:shadow-[0_0_0_4px_rgba(22,119,242,.12)] focus-visible:outline-none" defaultValue={finding?.notes??""} maxLength={4000} name="notes" placeholder="Ex. Carie distale soignée par composite, contrôle dans 6 mois." rows={compact?3:4}/>
    </FormField>
    <fieldset>
      <legend className="text-xs font-semibold text-slate-600">État de la dent</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{dentalConditions.map(condition=><label className={`${chip} has-[:checked]:border-[var(--navy)] has-[:checked]:bg-[var(--navy)] has-[:checked]:text-white`} key={condition}><input className="sr-only" defaultChecked={(finding?.condition??"caries")===condition} name="condition" type="radio" value={condition}/>{conditionLabels[condition]}</label>)}</div>
      {state.fieldErrors.condition?<p className="mt-1 text-sm text-red-700">{state.fieldErrors.condition}</p>:null}
    </fieldset>
    <fieldset>
      <legend className="text-xs font-semibold text-slate-600">Statut</legend>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">{statuses.map(status=><label className={`${chip} flex items-center gap-2 py-2 ${statusTone[status as DentalStatus].ring}`} key={status}><input className="sr-only" defaultChecked={(finding?.status??"untreated")===status} name="status" type="radio" value={status}/><span className={`size-2 shrink-0 rounded-full ${statusTone[status as DentalStatus].dot}`}/><span><span className="block">{statusLabels[status as DentalStatus]}</span><span className="block text-[10px] font-normal opacity-70">{statusHints[status as DentalStatus]}</span></span></label>)}</div>
      {state.fieldErrors.status?<p className="mt-1 text-sm text-red-700">{state.fieldErrors.status}</p>:null}
    </fieldset>
    <details className="group/reco" open={Boolean(finding?.recommendation||state.fieldErrors.recommendation)}>
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--blue-deep)] hover:underline"><span className="transition-transform group-open/reco:rotate-45">+</span> Recommandation pour le patient (facultatif)</summary>
      <FormField className="mt-2 block text-xs font-semibold text-slate-600" error={state.fieldErrors.recommendation} label="Recommandation">
        <textarea className="mt-1.5 w-full resize-y rounded-[12px] border border-[#d7e2ee] bg-white px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none transition focus:border-[var(--blue)] focus:shadow-[0_0_0_4px_rgba(22,119,242,.12)] focus-visible:outline-none" defaultValue={finding?.recommendation??""} maxLength={2000} name="recommendation" placeholder="Ex. Brossage doux, éviter le côté gauche 24 h." rows={2}/>
      </FormField>
    </details>
  </div>;
}
function ActionMessage({state}:{state:DentalActionState}){return state.message?<p aria-live="polite" className={`mt-3 flex items-start gap-2 rounded-[10px] px-3 py-2 text-sm ${state.success?"bg-[#e9f8f4] text-[#0e7c6d]":"bg-red-50 text-red-700"}`} role={state.success?"status":"alert"}>{state.success?"✓ ":""}{state.message}</p>:null}
