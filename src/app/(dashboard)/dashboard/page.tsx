import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/server";
import { getDashboardSchedule } from "@/lib/appointments/data";
import { formatClinicTime } from "@/lib/appointments/validation";

export default async function DashboardPage() {
  const user = await requireUser();
  const schedule=await getDashboardSchedule();

  return (
    <>
      <PageHeader
        description="Retrouvez les priorités opérationnelles de la journée."
        eyebrow="Vue d’ensemble"
        title={`Bonjour, ${user.fullName}`}
      />
      <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Résumé de la journée">
        <Summary label="Rendez-vous aujourd’hui" value={String(schedule.count)}/>
        <Summary label="Prochain rendez-vous" value={schedule.next?`${formatClinicTime(schedule.next.starts_at)} · ${schedule.next.title}`:"Aucun à venir"}/>
        <Summary label="Rappels à traiter" value={String(schedule.reminderCount)} attention={schedule.reminderCount>0}/>
      </section>
      <Link className="mt-5 inline-flex rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white" href={`/appointments?date=${schedule.date}`}>Ouvrir le planning du jour</Link>
    </>
  );
}

function Summary({label,value,attention=false}:{label:string;value:string;attention?:boolean}){return <div className={`rounded-lg border p-5 ${attention?"border-amber-200 bg-amber-50":"border-[var(--border)] bg-white"}`}><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{value}</p></div>}
