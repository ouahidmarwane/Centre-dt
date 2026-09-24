begin;

-- Patients waiting for an earlier slot. When an appointment is cancelled, staff are
-- shown the freed slot with the matching waiting patients and can book it directly.
create table public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  reason text not null,
  preferred_period text not null default 'any',
  duration_minutes smallint not null default 30,
  is_urgent boolean not null default false,
  notes text,
  status text not null default 'waiting',
  booked_appointment_id uuid references public.appointments(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  constraint appointment_waitlist_reason_length check (char_length(reason) between 1 and 160 and reason = btrim(reason)),
  constraint appointment_waitlist_notes_length check (notes is null or (char_length(notes) between 1 and 1000 and notes = btrim(notes))),
  constraint appointment_waitlist_period check (preferred_period in ('any', 'morning', 'afternoon')),
  constraint appointment_waitlist_duration check (duration_minutes between 15 and 240 and duration_minutes % 15 = 0),
  constraint appointment_waitlist_status check (status in ('waiting', 'booked', 'removed')),
  constraint appointment_waitlist_closure check (
    (status = 'waiting' and closed_by is null and closed_at is null and booked_appointment_id is null)
    or (status = 'booked' and closed_by is not null and closed_at is not null and booked_appointment_id is not null)
    or (status = 'removed' and closed_by is not null and closed_at is not null and booked_appointment_id is null)
  )
);

-- A patient waits at most once at a time.
create unique index appointment_waitlist_one_waiting_per_patient on public.appointment_waitlist (patient_id) where status = 'waiting';
create index appointment_waitlist_queue_idx on public.appointment_waitlist (status, is_urgent desc, created_at);
-- Freed slots are looked up among recent cancellations.
create index appointments_cancelled_future_idx on public.appointments (starts_at) where status = 'cancelled';

alter table public.appointment_waitlist enable row level security;
revoke all on table public.appointment_waitlist from public, anon, authenticated;
grant select on table public.appointment_waitlist to authenticated;
create policy appointment_waitlist_select_staff on public.appointment_waitlist for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = appointment_waitlist.patient_id));

create function public.add_waitlist_entry(
  target_patient_id uuid, target_reason text, target_preferred_period text,
  target_duration_minutes smallint, target_is_urgent boolean, target_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); entry_id uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  perform 1 from public.patients p where p.id = target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 1 and 160
    or target_preferred_period is null or target_preferred_period not in ('any', 'morning', 'afternoon')
    or target_duration_minutes is null or target_duration_minutes not between 15 and 240 or target_duration_minutes % 15 <> 0
    or target_is_urgent is null
    or (target_notes is not null and char_length(btrim(target_notes)) > 1000)
  then raise exception 'Invalid waitlist entry' using errcode = '22023'; end if;
  if exists (select 1 from public.appointment_waitlist w where w.patient_id = target_patient_id and w.status = 'waiting') then
    raise exception 'Patient already waiting' using errcode = '23505';
  end if;
  insert into public.appointment_waitlist (patient_id, reason, preferred_period, duration_minutes, is_urgent, notes, created_by)
  values (target_patient_id, btrim(target_reason), target_preferred_period, target_duration_minutes, target_is_urgent, nullif(btrim(target_notes), ''), actor)
  returning id into entry_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'waitlist.added', 'appointment_waitlist', entry_id, jsonb_build_object('patient_id', target_patient_id));
  return entry_id;
end $$;

create function public.remove_waitlist_entry(target_entry_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); entry_patient uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  update public.appointment_waitlist set status = 'removed', closed_by = actor, closed_at = now()
  where id = target_entry_id and status = 'waiting'
  returning patient_id into entry_patient;
  if entry_patient is null then return false; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'waitlist.removed', 'appointment_waitlist', target_entry_id, jsonb_build_object('patient_id', entry_patient));
  return true;
end $$;

-- Books a freed slot for a waiting patient: the appointment is created through the
-- regular create_appointment rules (future time, no overlap, idempotency) and the
-- entry is closed in the same transaction.
create function public.book_waitlist_entry(target_entry_id uuid, target_starts_at timestamptz, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); entry public.appointment_waitlist%rowtype; appointment_id uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  select * into entry from public.appointment_waitlist where id = target_entry_id and status = 'waiting' for update;
  if not found then raise exception 'Waitlist entry unavailable' using errcode = '22023'; end if;
  appointment_id := public.create_appointment(
    entry.patient_id, entry.reason, null, target_starts_at,
    target_starts_at + make_interval(mins => entry.duration_minutes),
    'Réservé depuis la liste d''attente.', target_idempotency_key
  );
  update public.appointment_waitlist set status = 'booked', booked_appointment_id = appointment_id, closed_by = actor, closed_at = now()
  where id = target_entry_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'waitlist.booked', 'appointment_waitlist', target_entry_id, jsonb_build_object('patient_id', entry.patient_id, 'appointment_id', appointment_id));
  return appointment_id;
end $$;

revoke all on function public.add_waitlist_entry(uuid, text, text, smallint, boolean, text), public.remove_waitlist_entry(uuid), public.book_waitlist_entry(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.add_waitlist_entry(uuid, text, text, smallint, boolean, text), public.remove_waitlist_entry(uuid), public.book_waitlist_entry(uuid, timestamptz, uuid) to authenticated;

commit;
