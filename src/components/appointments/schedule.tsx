"use client";

import Link from "next/link";
import {useActionState,useEffect,useRef,useState} from "react";
import type {AppointmentActionState} from "@/app/(dashboard)/appointments/actions";
import {FormField} from "@/components/ui/form-field";
import {PendingSubmitButton} from "@/components/ui/pending-submit-button";
import {submitKeepingValues} from "@/components/ui/submit-keeping-values";
import {SpotlightSurface} from "@/components/dashboard/spotlight-surface";
import {WhatsAppGlyph} from "@/components/patients/patient-list";
import {Badge,dangerLink,fieldClass,ghostButton,panelClass,primaryButton,type Tone} from "@/components/ui/panel-ui";
import type {AppointmentListItem,PatientOption,ReminderItem} from "@/lib/appointments/data";
import {buildWhatsAppAppointmentUrl,clinicDateValue,clinicTimeValue,formatClinicDate,formatClinicTime} from "@/lib/appointments/validation";

type Props={appointments:AppointmentListItem[];patients:PatientOption[];reminders:ReminderItem[];selectedDate:string;isToday:boolean;defaultPatientId?:string;now:string;token:string;createAction:(s:AppointmentActionState,f:FormData)=>Promise<AppointmentActionState>;updateAction:(id:string,s:AppointmentActionState,f:FormData)=>Promise<AppointmentActionState>;cancelAction:(id:string,patientId:string,s:AppointmentActionState,f:FormData)=>Promise<AppointmentActionState>;statusAction:(id:string,patientId:string,status:"completed"|"no_show")=>Promise<void>;reminderAction:(id:string,patientId:string,type:"day_before"|"two_hours_before")=>Promise<void>};
type Slot={start:string;end:string};
const initial:AppointmentActionState={success:false,message:null,fieldErrors:{}};

const statusLabels={scheduled:"Prévu",completed:"Venu",cancelled:"Annulé",no_show:"Absent"} as const;
const statusTones:Record<keyof typeof statusLabels,Tone>={scheduled:"blue",completed:"green",cancelled:"slate",no_show:"amber"};
const reminderLabels={day_before:"Rappel de la veille",two_hours_before:"Rappel 2 h avant"} as const;
const quickTitles=["Consultation","Contrôle","Détartrage","Soin de carie","Extraction","Urgence"];
const durations=[15,30,45,60,90];

const toMinutes=(time:string)=>{const[h,m]=time.split(":").map(Number);return h*60+m;};
const fromMinutes=(value:number)=>{const clamped=Math.max(0,Math.min(value,23*60+59));return `${String(Math.floor(clamped/60)).padStart(2,"0")}:${String(clamped%60).padStart(2,"0")}`;};
const minutesBetween=(start:string,end:string)=>Math.round((new Date(end).getTime()-new Date(start).getTime())/60000);
const durationLabel=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)} h${minutes%60?` ${String(minutes%60).padStart(2,"0")}`:""}`:`${minutes} min`;
const personName=(item:AppointmentListItem)=>item.patient?`${item.patient.first_name} ${item.patient.last_name}`:"Patient";

type Entry={kind:"appointment";item:AppointmentListItem}|{kind:"gap";start:string;end:string}|{kind:"now"};

// Appointments in order, with free gaps (≥ 15 min, still in the future) and a "now" marker for today.
function buildTimeline(appointments:AppointmentListItem[],now:string,isToday:boolean):Entry[]{
  const entries:Entry[]=[];let lastEnd:string|null=null;let nowPlaced=!isToday;
  for(const item of appointments){
    if(!nowPlaced&&item.starts_at>now){entries.push({kind:"now"});nowPlaced=true;}
    if(item.status!=="cancelled"){
      if(lastEnd&&minutesBetween(lastEnd,item.starts_at)>=15&&item.starts_at>now)entries.push({kind:"gap",start:lastEnd>now?lastEnd:now,end:item.starts_at});
      if(!lastEnd||item.ends_at>lastEnd)lastEnd=item.ends_at;
    }
    entries.push({kind:"appointment",item});
  }
  if(!nowPlaced&&appointments.length)entries.push({kind:"now"});
  // A gap whose start was pulled to "now" can shrink below 15 min.
  return entries.filter(entry=>entry.kind!=="gap"||minutesBetween(entry.start,entry.end)>=15);
}

export function Schedule(props:Props){
  const[slot,setSlot]=useState<Slot|null>(null);
  const timeline=buildTimeline(props.appointments,props.now,props.isToday);
  const counts={scheduled:0,completed:0,no_show:0,cancelled:0};
  for(const item of props.appointments)counts[item.status]+=1;
  const dayIsPast=props.selectedDate<clinicDateValue(new Date(props.now));

  function pickSlot(next:Slot){
    setSlot(next);
    const form=document.getElementById("nouveau-rendez-vous");
    form?.scrollIntoView({behavior:"smooth",block:"start"});
    window.setTimeout(()=>form?.querySelector<HTMLElement>("select[name=patientId]")?.focus({preventScroll:true}),350);
  }

  return <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
    <div className="min-w-0 space-y-5">
      <SpotlightSurface className={`kpi-rise relative ${panelClass}`} texture="clock"><section aria-labelledby="day-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6edf5] px-5 py-4 sm:px-6">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="day-title">
            {props.appointments.length?`${props.appointments.length} rendez-vous`:"Aucun rendez-vous"}
            <span className="sr-only"> le {formatClinicDate(`${props.selectedDate}T12:00:00Z`)}</span>
          </h2>
          {props.appointments.length?<ul aria-label="Répartition" className="flex flex-wrap gap-1.5">
            {counts.scheduled?<li><Badge tone="blue">{counts.scheduled} prévu{counts.scheduled>1?"s":""}</Badge></li>:null}
            {counts.completed?<li><Badge tone="green">{counts.completed} venu{counts.completed>1?"s":""}</Badge></li>:null}
            {counts.no_show?<li><Badge tone="amber">{counts.no_show} absent{counts.no_show>1?"s":""}</Badge></li>:null}
            {counts.cancelled?<li><Badge tone="slate">{counts.cancelled} annulé{counts.cancelled>1?"s":""}</Badge></li>:null}
          </ul>:null}
        </div>

        <div className="px-3 py-4 sm:px-6 sm:py-5">
          {props.appointments.length?<ol className="rise-list space-y-2.5">
            {timeline.map((entry,index)=>entry.kind==="now"
              ?<NowMarker key="now" now={props.now}/>
              :entry.kind==="gap"
                ?<FreeGap end={entry.end} key={`gap-${index}`} onPick={pickSlot} start={entry.start}/>
                :<AppointmentCard item={entry.item} key={entry.item.id} {...props}/>)}
          </ol>:<EmptyDay onPick={pickSlot} past={dayIsPast}/>}
        </div>
      </section></SpotlightSurface>

      {props.reminders.length?<Reminders items={props.reminders} markAction={props.reminderAction}/>:null}
    </div>

    <SpotlightSurface className={`${panelClass} kpi-rise relative xl:sticky xl:top-24`} texture="calendar">
      <AppointmentForm action={props.createAction} date={props.selectedDate} defaultPatientId={props.defaultPatientId} key={`${slot?.start??"none"}-${slot?.end??""}-${props.token}`} patients={props.patients} slot={slot??undefined} token={props.token}/>
    </SpotlightSurface>
  </div>;
}

function NowMarker({now}:{now:string}){
  return <li aria-label={`Maintenant, ${formatClinicTime(now)}`} className="flex items-center gap-2 py-0.5">
    <span className="metric-number shrink-0 text-[11px] font-semibold text-red-500">{formatClinicTime(now)}</span>
    <span aria-hidden="true" className="relative size-2.5 shrink-0 rounded-full bg-red-500"><span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60"/></span>
    <span aria-hidden="true" className="h-px flex-1 bg-red-300"/>
    <span className="text-[11px] font-semibold text-red-500">Maintenant</span>
  </li>;
}

function FreeGap({start,end,onPick}:{start:string;end:string;onPick:(slot:Slot)=>void}){
  const startTime=clinicTimeValue(new Date(start));const endTime=clinicTimeValue(new Date(end));
  const suggestedEnd=fromMinutes(Math.min(toMinutes(startTime)+30,toMinutes(endTime)));
  return <li className="flex items-center gap-3">
    <button className="group flex min-h-11 flex-1 items-center justify-between gap-3 rounded-[12px] border border-dashed border-[#cddcec] bg-[#fbfdff] px-4 text-left text-sm text-slate-500 transition-all hover:border-[var(--blue)] hover:bg-[#f3f8ff] hover:text-[var(--blue-deep)] active:scale-[0.99]" onClick={()=>onPick({start:startTime,end:suggestedEnd})} type="button">
      <span>Libre de <span className="metric-number font-semibold">{startTime}</span> à <span className="metric-number font-semibold">{endTime}</span> · {durationLabel(minutesBetween(start,end))}</span>
      <span className="shrink-0 text-xs font-semibold opacity-70 transition-opacity group-hover:opacity-100">+ Réserver ce créneau</span>
    </button>
  </li>;
}

function EmptyDay({onPick,past}:{onPick:(slot:Slot)=>void;past:boolean}){
  return <div className="flex flex-col items-center px-4 py-12 text-center">
    <span aria-hidden="true" className="grid size-14 place-items-center rounded-[18px] bg-[#eef6ff] text-[var(--blue)]"><svg className="size-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24"><rect height="16" rx="2.5" width="18" x="3" y="5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
    <h3 className="mt-4 text-base font-semibold text-[var(--navy)]">{past?"Aucun rendez-vous ce jour-là":"La journée est libre"}</h3>
    {past?<p className="mt-1.5 text-sm text-slate-500">Rien n’a été enregistré pour cette date.</p>:<>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">Touchez une heure pour préparer le rendez-vous, ou remplissez directement le formulaire de réservation.</p>
      <div className="rise-list mt-5 flex flex-wrap justify-center gap-2 [&>button:hover]:-translate-y-0.5 [&>button:hover]:shadow-[0_8px_18px_-10px_rgba(22,119,242,0.6)]">{["09:00","10:00","11:00","14:00","15:00","16:00"].map(time=><button className={`${ghostButton} min-h-10 px-4 text-sm tabular-nums`} key={time} onClick={()=>onPick({start:time,end:fromMinutes(toMinutes(time)+30)})} type="button">{time}</button>)}</div>
    </>}
  </div>;
}

function Reminders({items,markAction}:{items:ReminderItem[];markAction:Props["reminderAction"]}){
  return <SpotlightSurface className={`kpi-rise relative ${panelClass}`} texture="people"><section aria-labelledby="reminders-title" className="p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#e7f6f3] text-[#128c7e]"><WhatsAppGlyph className="size-5"/></span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="reminders-title">Rappels à envoyer</h2>
          <p className="mt-0.5 text-xs text-slate-500">Pour chaque patient : ouvrez WhatsApp, envoyez le message, puis confirmez ici.</p>
        </div>
      </div>
      <span aria-label={`${items.length} rappels à envoyer`} className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#128c7e] text-sm font-bold text-white shadow-[0_6px_14px_-6px_rgba(18,140,126,0.9)]"><span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#128c7e] opacity-20"/>{items.length}</span>
    </div>
    <ul className="rise-list mt-4 grid gap-2 md:grid-cols-2">{items.map(item=><li className="rounded-[14px] border border-[#e3ebf3] bg-white px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#cfe9e4] hover:shadow-[0_12px_26px_-18px_rgba(16,44,76,0.45)]" key={`${item.appointmentId}-${item.type}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--navy)]">{item.patientName}</p><p className="mt-0.5 text-xs text-slate-500 first-letter:uppercase">{formatClinicDate(item.startsAt)} à {formatClinicTime(item.startsAt)}</p></div>
        <span className="shrink-0 rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-[11px] font-semibold text-[#0f5fc5]">{reminderLabels[item.type]}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.whatsappUrl?<a className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#128c7e] px-3 text-xs font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0d7166] active:translate-y-0" href={item.whatsappUrl} rel="noopener noreferrer" target="_blank"><span className="grid size-4 place-items-center rounded-full bg-white/25 text-[10px]">1</span>Ouvrir WhatsApp</a>:<Link className="inline-flex min-h-10 items-center rounded-[10px] bg-amber-50 px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset transition-colors hover:bg-amber-100" href={`/patients/${item.patientId}/edit`} title="Le numéro n’est pas reconnu par WhatsApp. Cliquez pour le corriger.">Numéro à corriger</Link>}
        <form action={markAction.bind(null,item.appointmentId,item.patientId,item.type)}><PendingSubmitButton className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#d6e3f0] bg-white px-3 text-xs font-semibold text-[var(--navy)] transition-all hover:border-[var(--blue)] hover:text-[var(--blue-deep)] active:scale-[0.97] disabled:opacity-60" pendingLabel="Enregistrement…"><span className="grid size-4 place-items-center rounded-full bg-[#eef3f8] text-[10px]">2</span>C’est envoyé ✓</PendingSubmitButton></form>
      </div>
    </li>)}</ul>
    <p className="mt-3 text-[11px] text-slate-400">Ouvrir WhatsApp ne suffit pas : l’envoi n’est confirmé que lorsque vous cliquez sur « C’est envoyé ».</p>
  </section></SpotlightSurface>;
}

// Colour by kind of visit, read from the free-text title so any wording works
// ("urgence", "Urgence dentaire", "soin carie"…). Cancelled visits stay grey.
type VisitKind="urgent"|"extraction"|"caries"|"scaling"|"checkup"|"default";
const visitStyles:Record<VisitKind,{block:string;pill:string;dot:string;card?:string}>={
  urgent:{block:"bg-red-50 text-red-700",pill:"bg-red-50 text-red-700 ring-red-200",dot:"bg-red-500",card:"border-red-200 hover:border-red-300"},
  extraction:{block:"bg-orange-50 text-orange-700",pill:"bg-orange-50 text-orange-700 ring-orange-200",dot:"bg-orange-500"},
  caries:{block:"bg-[#f3efff] text-[#5548bd]",pill:"bg-[#f3efff] text-[#5548bd] ring-[#ddd4fb]",dot:"bg-[#7c6ee6]"},
  scaling:{block:"bg-cyan-50 text-cyan-700",pill:"bg-cyan-50 text-cyan-700 ring-cyan-200",dot:"bg-cyan-500"},
  checkup:{block:"bg-[#eefaf6] text-[#0e7c6d]",pill:"bg-[#eefaf6] text-[#0e7c6d] ring-emerald-200",dot:"bg-[#19a996]"},
  default:{block:"bg-[#f2f7ff] text-[#0f5fc5]",pill:"bg-[#f2f7ff] text-[#0f5fc5] ring-blue-200",dot:"bg-[var(--blue)]"},
};
function visitKind(title:string):VisitKind{
  const text=title.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  if(/urgen|douleur aigu/.test(text))return "urgent";
  if(/extract/.test(text))return "extraction";
  if(/carie|soin|composite|obtur/.test(text))return "caries";
  if(/detartr|nettoy/.test(text))return "scaling";
  if(/control|suivi/.test(text))return "checkup";
  return "default";
}
const Icon=({d,className="size-3.5"}:{d:string;className?:string})=><svg aria-hidden="true" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24"><path d={d}/></svg>;
const icons={
  tooth:"M7 3c-2.2 0-4 1.8-4 4.5 0 2 .8 3.6 1.6 5.4L6 20c.3 1.3 2 1.3 2.3 0l1-4.5c.3-1.3 2.1-1.3 2.4 0l1 4.5c.3 1.3 2 1.3 2.3 0l1.4-7.1c.8-1.8 1.6-3.4 1.6-5.4C18 4.8 16.2 3 14 3c-1.4 0-2.2.7-3.5.7S8.4 3 7 3",
  phone:"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1",
  pencil:"M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  check:"m5 12 5 5 9-10",
  cross:"M6 6l12 12M18 6 6 18",
  alert:"M12 4 3 20h18zM12 10v4M12 17h.01",
};

function AppointmentCard({item,now,patients,updateAction,cancelAction,statusAction,token}:Props&{item:AppointmentListItem}){
  const[panel,setPanel]=useState<"edit"|"cancel"|null>(null);
  const patient=personName(item);
  const future=new Date(item.starts_at)>new Date(now);
  const ongoing=!future&&new Date(item.ends_at)>new Date(now)&&item.status==="scheduled";
  const editable=item.status==="scheduled"&&future;
  const whatsappUrl=item.patient&&future&&item.status==="scheduled"?buildWhatsAppAppointmentUrl({phone:item.patient.phone,firstName:item.patient.first_name,startsAt:item.starts_at}):null;
  const faded=item.status==="cancelled";
  const kind=visitKind(item.title);
  const style=visitStyles[kind];
  const urgent=kind==="urgent"&&!faded;
  const toggle=(next:"edit"|"cancel")=>setPanel(current=>current===next?null:next);

  return <li>
    <article className={`group overflow-hidden rounded-[16px] border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#cddcec] hover:shadow-[0_16px_34px_-22px_rgba(16,44,76,0.55)] ${ongoing?"border-[var(--blue)] shadow-[0_0_0_3px_rgba(22,119,242,0.12)]":urgent?`${style.card} shadow-[0_8px_22px_-16px_rgba(220,38,38,0.6)]`:"border-[#e3ebf3] shadow-[0_1px_2px_rgba(16,44,76,0.04)]"}`}>
      <div className="flex">
        <div className={`flex w-[76px] shrink-0 flex-col items-center justify-center border-r border-[#eef3f8] px-2 py-4 sm:w-[88px] ${faded?"bg-slate-50 text-slate-400":style.block}`}>
          <p className="metric-number text-[19px] leading-6 font-semibold tracking-[-0.02em]">{formatClinicTime(item.starts_at)}</p>
          <p className="metric-number text-[11px] opacity-70">{formatClinicTime(item.ends_at)}</p>
          <p className="mt-1.5 rounded-md bg-white/70 px-1.5 py-px text-[10px] font-semibold">{durationLabel(minutesBetween(item.starts_at,item.ends_at))}</p>
        </div>

        <div className="min-w-0 flex-1 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <Link className={`inline-flex min-w-0 items-center gap-2 truncate text-[15px] font-semibold transition-colors ${faded?"text-slate-400 line-through":"text-[var(--navy)] hover:text-[var(--blue-deep)]"}`} href={`/patients/${item.patient_id}`}>{urgent?<span aria-hidden="true" className="relative size-2 shrink-0 rounded-full bg-red-500"><span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-70"/></span>:null}<span className={`truncate ${faded?"line-through":""}`}>{patient}</span></Link>
            {ongoing?<span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--blue)] px-2 py-0.5 text-[11px] font-semibold text-white"><span className="size-1.5 animate-pulse rounded-full bg-white"/>En cours</span>:<Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold ring-1 ring-inset ${faded?"bg-slate-50 text-slate-400 ring-slate-200":style.pill}`}><Icon d={urgent?icons.alert:icons.tooth}/>{urgent?<span className="sr-only">Urgent : </span>:null}{item.title}</span>
            {item.patient?.phone?<a className="inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-[var(--blue-deep)]" href={`tel:${item.patient.phone.replace(/[^0-9+]/g,"")}`}><Icon d={icons.phone}/>{item.patient.phone}</a>:null}
          </p>
          {item.purpose?<p className="mt-2 border-l-2 border-[#dbe6f1] pl-2.5 text-sm leading-5 text-slate-600">{item.purpose}</p>:null}
          {item.notes?<p className="mt-1.5 text-xs leading-5 whitespace-pre-wrap text-slate-400">Note : {item.notes}</p>:null}
          {item.cancellation_reason?<p className="mt-1.5 text-xs text-slate-500">Motif d’annulation : {item.cancellation_reason}</p>:null}
        </div>
      </div>

      {item.status==="scheduled"?<div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef3f8] bg-[#fafcfe] px-3 py-2 sm:px-4">
        <button aria-expanded={panel==="cancel"} className={`inline-flex min-h-9 items-center rounded-[9px] px-2.5 text-xs font-medium transition-colors ${panel==="cancel"?"bg-red-50 text-red-700":"text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`} onClick={()=>toggle("cancel")} type="button">Annuler</button>
        <div className="flex flex-wrap items-center gap-1.5">
          {!future?<>
            <span className="mr-1 hidden text-xs text-slate-500 sm:inline">Le patient est-il venu ?</span>
            <form action={statusAction.bind(null,item.id,item.patient_id,"no_show")}><PendingSubmitButton className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-[#e3d2b0] bg-white px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-60" pendingLabel="…"><Icon d={icons.cross}/>Absent</PendingSubmitButton></form>
            <form action={statusAction.bind(null,item.id,item.patient_id,"completed")}><PendingSubmitButton className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] bg-[#19a996] px-3 text-xs font-semibold text-white shadow-[0_6px_14px_-8px_rgba(25,169,150,0.9)] transition-all hover:bg-[#12907f] active:scale-[0.97] disabled:opacity-60" pendingLabel="…"><Icon d={icons.check}/>Présent</PendingSubmitButton></form>
          </>:<>
            {editable?<button aria-expanded={panel==="edit"} className={`inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border px-3 text-xs font-semibold transition-all active:scale-[0.97] ${panel==="edit"?"border-[var(--navy)] bg-[var(--navy)] text-white":"border-[#d6e3f0] bg-white text-[var(--navy)] hover:border-[var(--blue)] hover:text-[var(--blue-deep)]"}`} onClick={()=>toggle("edit")} type="button"><Icon d={icons.pencil}/>Modifier</button>:null}
            {whatsappUrl
              ?<a className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] bg-[#128c7e] px-3 text-xs font-semibold text-white shadow-[0_6px_14px_-8px_rgba(18,140,126,0.9)] transition-all hover:bg-[#0d7166] active:scale-[0.97]" href={whatsappUrl} rel="noopener noreferrer" target="_blank" title="Ouvre WhatsApp avec le message de rappel déjà écrit"><WhatsAppGlyph className="size-3.5"/>Rappel WhatsApp</a>
              :item.patient?<Link className="inline-flex min-h-9 items-center rounded-[9px] bg-amber-50 px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100" href={`/patients/${item.patient_id}/edit`} title="Le numéro n’est pas reconnu par WhatsApp">Numéro à corriger</Link>:null}
          </>}
        </div>
      </div>:null}

      {panel==="cancel"?<div className="border-t border-red-100 bg-red-50/40 px-4 py-3"><CancelForm action={cancelAction.bind(null,item.id,item.patient_id)} onClose={()=>setPanel(null)}/></div>:null}
      {panel==="edit"?<div className="border-t border-[#eef3f8] bg-[#f7fafd] px-4 py-4"><AppointmentForm action={updateAction.bind(null,item.id)} compact date={clinicDateValue(new Date(item.starts_at))} initial={item} patients={patients} token={token}/></div>:null}
    </article>
  </li>;
}

function Step({number,label,children}:{number:number;label:string;children:React.ReactNode}){
  return <fieldset className="relative pl-9">
    <legend className="contents"><span className="absolute top-0 left-0 grid size-6 place-items-center rounded-full bg-[var(--navy)] text-[11px] font-semibold text-white">{number}</span><span className="block text-sm font-semibold text-[var(--navy)]">{label}</span></legend>
    <div className="mt-2">{children}</div>
  </fieldset>;
}

function AppointmentForm({action,date,patients,token,initial:appointment,compact=false,defaultPatientId,slot}:{action:Props["createAction"];date:string;patients:PatientOption[];token:string;initial?:AppointmentListItem;compact?:boolean;defaultPatientId?:string;slot?:Slot}){
  const[state,formAction,pending]=useActionState(action,initial);
  const formRef=useRef<HTMLFormElement>(null);const titleRef=useRef<HTMLInputElement>(null);const startRef=useRef<HTMLInputElement>(null);const endRef=useRef<HTMLInputElement>(null);
  const defaultStart=slot?.start??(appointment?clinicTimeValue(new Date(appointment.starts_at)):"09:00");
  const defaultEnd=slot?.end??(appointment?clinicTimeValue(new Date(appointment.ends_at)):"09:30");
  const[duration,setDuration]=useState(toMinutes(defaultEnd)-toMinutes(defaultStart));
  useEffect(()=>{if(!state.success&&Object.keys(state.fieldErrors).length)formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()},[state]);

  function applyDuration(minutes:number){setDuration(minutes);if(startRef.current&&endRef.current&&startRef.current.value)endRef.current.value=fromMinutes(toMinutes(startRef.current.value)+minutes);}

  return <form action={formAction} aria-labelledby={compact?undefined:"new-appointment-title"} className={compact?"":"scroll-mt-24 p-5 sm:p-6"} id={compact?undefined:"nouveau-rendez-vous"} onSubmit={submitKeepingValues(formAction)} ref={formRef}>
    {compact?<p className="text-xs font-semibold text-slate-500">Modifier le rendez-vous</p>:<div className="flex items-start justify-between gap-3">
      <div><h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="new-appointment-title">Nouveau rendez-vous</h2><p className="mt-0.5 text-xs text-slate-500">Heures de Casablanca</p></div>
      {slot?<span className="rounded-lg bg-[#eef6ff] px-2 py-1 text-xs font-semibold text-[#0f5fc5]">Créneau {slot.start}</span>:null}
    </div>}
    <input name="idempotencyKey" type="hidden" value={appointment?.idempotency_key??token}/>

    <div className={`${compact?"mt-3":"mt-5"} space-y-5`}>
      <Step label="Patient" number={1}>
        <Field error={state.fieldErrors.patientId} label="">
          <select aria-label="Patient" className={`${fieldClass} mt-0`} defaultValue={appointment?.patient_id??defaultPatientId??""} disabled={Boolean(appointment)} name="patientId" required><option disabled value="">Choisir le patient…</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.last_name} {patient.first_name}</option>)}</select>
        </Field>
        {appointment?<input name="patientId" type="hidden" value={appointment.patient_id}/>:null}
        {!compact?<Link className="mt-1.5 inline-flex min-h-8 items-center text-xs font-semibold text-[var(--blue-deep)] hover:underline" href="/patients/new">+ Nouveau patient</Link>:null}
      </Step>

      <Step label="Pour quoi ?" number={2}>
        <div className="flex flex-wrap gap-1.5">{quickTitles.map(title=><button className="inline-flex min-h-8 items-center rounded-[9px] border border-[#dbe6f1] bg-white px-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-[var(--blue)] hover:text-[var(--blue-deep)] active:scale-[0.96]" key={title} onClick={()=>{if(titleRef.current){titleRef.current.value=title;titleRef.current.focus();}}} type="button"><span aria-hidden="true" className={`mr-1.5 size-1.5 rounded-full ${visitStyles[visitKind(title)].dot}`}/>{title}</button>)}</div>
        <Field error={state.fieldErrors.title} label="Type de rendez-vous"><input className={fieldClass} defaultValue={appointment?.title??""} maxLength={160} name="title" placeholder="Ex. Contrôle" ref={titleRef} required/></Field>
        <Field error={state.fieldErrors.purpose} label="Précision (facultatif)"><input className={fieldClass} defaultValue={appointment?.purpose??""} maxLength={500} name="purpose" placeholder="Ex. Douleur molaire en bas à gauche"/></Field>
      </Step>

      <Step label="Quand ?" number={3}>
        <div className="grid grid-cols-2 gap-3 [&>label]:mt-0">
          <Field error={state.fieldErrors.date} label="Jour"><input className={fieldClass} defaultValue={appointment?clinicDateValue(new Date(appointment.starts_at)):date} name="date" required type="date"/></Field>
          <Field error={state.fieldErrors.startTime} label="Heure"><input className={fieldClass} defaultValue={defaultStart} name="startTime" onChange={event=>{if(endRef.current&&event.target.value)endRef.current.value=fromMinutes(toMinutes(event.target.value)+duration);}} ref={startRef} required type="time"/></Field>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-600">Durée</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{durations.map(minutes=><button aria-pressed={duration===minutes} className={`inline-flex min-h-9 items-center rounded-[9px] border px-3 text-xs font-semibold transition-all active:scale-[0.96] ${duration===minutes?"border-[var(--navy)] bg-[var(--navy)] text-white":"border-[#dbe6f1] bg-white text-slate-600 hover:border-[#bfd3e8]"}`} key={minutes} onClick={()=>applyDuration(minutes)} type="button">{durationLabel(minutes)}</button>)}</div>
        <Field error={state.fieldErrors.endTime} label="Fin"><input className={`${fieldClass} block max-w-40`} defaultValue={defaultEnd} name="endTime" onChange={event=>{if(startRef.current?.value&&event.target.value)setDuration(toMinutes(event.target.value)-toMinutes(startRef.current.value));}} ref={endRef} required type="time"/></Field>
      </Step>

      <details className="group/notes pl-9" open={Boolean(appointment?.notes||state.fieldErrors.notes)}>
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--blue-deep)] hover:underline"><span className="transition-transform group-open/notes:rotate-45">+</span> Ajouter une note interne</summary>
        <Field error={state.fieldErrors.notes} label="Note interne (facultatif)"><textarea className={fieldClass} defaultValue={appointment?.notes??""} maxLength={4000} name="notes" placeholder="Visible uniquement par l’équipe" rows={2}/></Field>
      </details>
    </div>

    {state.message?<p aria-live="polite" className={`mt-4 rounded-[10px] px-3 py-2 text-sm ${state.success?"bg-[#e9f8f4] text-[#0e7c6d]":"bg-red-50 text-red-700"}`} role={state.success?"status":"alert"}>{state.success?"✓ ":""}{state.message}</p>:null}
    <button className={`${compact?`${ghostButton} min-h-10 border-[var(--blue)] text-[var(--blue-deep)]`:`${primaryButton} w-full text-[15px]`} mt-5`} disabled={pending||!patients.length} type="submit">{pending?"Enregistrement…":appointment?"Enregistrer les modifications":"Réserver le rendez-vous"}</button>
    {!patients.length?<p className="mt-2 text-center text-xs text-slate-500">Créez d’abord un dossier patient actif.</p>:null}
  </form>;
}

function CancelForm({action,onClose}:{action:(s:AppointmentActionState,f:FormData)=>Promise<AppointmentActionState>;onClose:()=>void}){
  const[state,formAction,pending]=useActionState(action,initial);
  return <form action={formAction} onSubmit={event=>{if(!confirm("Annuler ce rendez-vous ? Son historique sera conservé."))event.preventDefault()}}>
    <p className="text-sm font-semibold text-red-800">Annuler ce rendez-vous</p>
    <p className="mt-0.5 text-xs text-slate-500">Le rendez-vous restera visible, barré, dans l’historique du patient.</p>
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1"><Field error={state.fieldErrors.reason} label="Pourquoi ?"><input autoFocus className={fieldClass} maxLength={500} minLength={5} name="reason" placeholder="Ex. Le patient a appelé pour reporter" required/></Field></div>
      <button className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-xs font-semibold text-slate-500 hover:bg-white" onClick={onClose} type="button">Garder le rendez-vous</button>
      <button className={`${dangerLink} min-h-11 border border-red-200 bg-white px-3`} disabled={pending}>{pending?"Annulation…":"Confirmer l’annulation"}</button>
    </div>
    {state.message?<p aria-live="polite" className="mt-2 text-xs text-red-700" role="alert">{state.message}</p>:null}
  </form>;
}

function Field({children,label,error}:{children:React.ReactNode;label:string;error?:string}){
  return <FormField className="mt-2 block text-xs font-medium text-slate-600 first:mt-0" error={error} errorClassName="mt-1 block text-xs text-red-700" label={label}>{children}</FormField>;
}
