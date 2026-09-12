begin;

create type public.appointment_status as enum ('scheduled','completed','cancelled','no_show');
create type public.appointment_reminder_type as enum ('day_before','two_hours_before');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  title text not null,
  purpose text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  idempotency_key uuid not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint appointments_title_length check (char_length(title) between 1 and 160 and title=btrim(title)),
  constraint appointments_purpose_length check (purpose is null or (char_length(purpose) between 1 and 500 and purpose=btrim(purpose))),
  constraint appointments_notes_length check (notes is null or (char_length(notes) between 1 and 4000 and notes=btrim(notes))),
  constraint appointments_duration check (ends_at>starts_at and ends_at<=starts_at+interval '8 hours'),
  constraint appointments_cancellation check ((status='cancelled' and cancelled_by is not null and cancelled_at is not null and char_length(cancellation_reason) between 5 and 500 and cancellation_reason=btrim(cancellation_reason)) or (status<>'cancelled' and cancelled_by is null and cancelled_at is null and cancellation_reason is null))
);
alter table public.appointments add constraint appointments_no_scheduled_overlap exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&) where (status='scheduled');

create table public.appointment_revisions (
  id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict, title text not null, purpose text,
  starts_at timestamptz not null, ends_at timestamptz not null, status public.appointment_status not null, notes text,
  changed_by uuid not null references auth.users(id) on delete restrict, changed_by_role public.app_role not null, changed_at timestamptz not null default now()
);

create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments(id) on delete restrict,
  reminder_type public.appointment_reminder_type not null, handled_by uuid not null references auth.users(id) on delete restrict,
  handled_at timestamptz not null default now(), unique(appointment_id,reminder_type)
);

create index appointments_day_idx on public.appointments(starts_at,status);
create index appointments_patient_history_idx on public.appointments(patient_id,starts_at desc);
create index appointment_revisions_history_idx on public.appointment_revisions(appointment_id,changed_at desc);

create function private.audit_appointment_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); action_name text;
begin
  if actor is null or actor_role is null then raise exception 'Active authentication required' using errcode='42501'; end if;
  insert into public.appointment_revisions(appointment_id,patient_id,title,purpose,starts_at,ends_at,status,notes,changed_by,changed_by_role) values(new.id,new.patient_id,new.title,new.purpose,new.starts_at,new.ends_at,new.status,new.notes,actor,actor_role);
  action_name:=case when tg_op='INSERT' then 'appointment.created' when new.status='cancelled' and old.status<>'cancelled' then 'appointment.cancelled' when new.status is distinct from old.status then 'appointment.status_changed' else 'appointment.updated' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,action_name,'appointment',new.id,jsonb_build_object('patient_id',new.patient_id)); return new;
end $$;
create trigger appointments_audit after insert or update on public.appointments for each row execute function private.audit_appointment_change();

alter table public.appointments enable row level security;
alter table public.appointment_revisions enable row level security;
alter table public.appointment_reminders enable row level security;
revoke all on table public.appointments,public.appointment_revisions,public.appointment_reminders from public,anon,authenticated;
grant select on table public.appointments,public.appointment_revisions,public.appointment_reminders to authenticated;
create policy appointments_select_staff on public.appointments for select to authenticated using((select private.is_active_user()) and exists(select 1 from public.patients p where p.id=appointments.patient_id));
create policy appointment_revisions_select_staff on public.appointment_revisions for select to authenticated using((select private.is_active_user()) and exists(select 1 from public.patients p where p.id=appointment_revisions.patient_id));
create policy appointment_reminders_select_staff on public.appointment_reminders for select to authenticated using((select private.is_active_user()) and exists(select 1 from public.appointments a where a.id=appointment_reminders.appointment_id));

create function public.create_appointment(target_patient_id uuid,target_title text,target_purpose text,target_starts_at timestamptz,target_ends_at timestamptz,target_notes text,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); result uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  perform 1 from public.patients p where p.id=target_patient_id and p.is_active for update; if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  if target_starts_at is null or target_ends_at is null or target_starts_at<=now() or target_ends_at<=target_starts_at or target_ends_at>target_starts_at+interval '8 hours' then raise exception 'Invalid appointment time' using errcode='22023'; end if;
  if target_idempotency_key is null then raise exception 'Idempotency required' using errcode='22023'; end if;
  if exists(select 1 from public.appointments where idempotency_key=target_idempotency_key) then raise exception 'Duplicate appointment' using errcode='23505'; end if;
  insert into public.appointments(patient_id,title,purpose,starts_at,ends_at,notes,idempotency_key,created_by,updated_by) values(target_patient_id,btrim(target_title),nullif(btrim(target_purpose),''),target_starts_at,target_ends_at,nullif(btrim(target_notes),''),target_idempotency_key,actor,actor) returning id into result; return result;
exception when exclusion_violation then raise exception 'Appointment conflict' using errcode='23P01';
end $$;

create function public.update_appointment(target_patient_id uuid,target_appointment_id uuid,target_title text,target_purpose text,target_starts_at timestamptz,target_ends_at timestamptz,target_notes text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  perform 1 from public.patients p where p.id=target_patient_id and p.is_active for update; if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  if target_starts_at is null or target_ends_at is null or target_starts_at<=now() or target_ends_at<=target_starts_at or target_ends_at>target_starts_at+interval '8 hours' then raise exception 'Invalid appointment time' using errcode='22023'; end if;
  update public.appointments set title=btrim(target_title),purpose=nullif(btrim(target_purpose),''),starts_at=target_starts_at,ends_at=target_ends_at,notes=nullif(btrim(target_notes),''),updated_by=actor,updated_at=now() where id=target_appointment_id and patient_id=target_patient_id and status='scheduled'; get diagnostics affected=row_count; return affected=1;
exception when exclusion_violation then raise exception 'Appointment conflict' using errcode='23P01';
end $$;

create function public.cancel_appointment(target_patient_id uuid,target_appointment_id uuid,target_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 5 and 500 then raise exception 'Invalid reason' using errcode='22023'; end if;
  if not exists(select 1 from public.patients p where p.id=target_patient_id) then raise exception 'Patient unavailable' using errcode='22023'; end if;
  update public.appointments set status='cancelled',cancelled_by=actor,cancelled_at=now(),cancellation_reason=btrim(target_reason),updated_by=actor,updated_at=now() where id=target_appointment_id and patient_id=target_patient_id and status='scheduled'; get diagnostics affected=row_count; return affected=1;
end $$;

create function public.set_appointment_status(target_patient_id uuid,target_appointment_id uuid,target_status public.appointment_status)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  if target_status not in ('completed','no_show') then raise exception 'Invalid transition' using errcode='22023'; end if;
  if not exists(select 1 from public.patients p where p.id=target_patient_id and p.is_active) then raise exception 'Patient unavailable' using errcode='22023'; end if;
  update public.appointments set status=target_status,updated_by=actor,updated_at=now() where id=target_appointment_id and patient_id=target_patient_id and status='scheduled' and starts_at<=now(); get diagnostics affected=row_count; return affected=1;
end $$;

create function public.mark_appointment_reminder_handled(target_patient_id uuid,target_appointment_id uuid,target_type public.appointment_reminder_type)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); start_time timestamptz; inserted integer;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  if not exists(select 1 from public.patients p where p.id=target_patient_id and p.is_active) then raise exception 'Patient unavailable' using errcode='22023'; end if;
  select starts_at into start_time from public.appointments where id=target_appointment_id and patient_id=target_patient_id and status='scheduled' and starts_at>now(); if not found then return false; end if;
  if (target_type='day_before' and now()<start_time-interval '24 hours') or (target_type='two_hours_before' and now()<start_time-interval '2 hours') then raise exception 'Reminder not due' using errcode='22023'; end if;
  insert into public.appointment_reminders(appointment_id,reminder_type,handled_by) values(target_appointment_id,target_type,actor) on conflict do nothing; get diagnostics inserted=row_count;
  if inserted=1 then insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'appointment.reminder_handled','appointment',target_appointment_id,jsonb_build_object('patient_id',target_patient_id,'reminder_type',target_type)); end if; return inserted=1;
end $$;

create function public.get_due_appointment_reminders(reference_time timestamptz default now())
returns table(appointment_id uuid,patient_id uuid,patient_first_name text,patient_phone text,starts_at timestamptz,reminder_type public.appointment_reminder_type)
language sql security definer stable set search_path='' as $$
  select a.id,a.patient_id,p.first_name,p.phone,a.starts_at,r.kind from public.appointments a join public.patients p on p.id=a.patient_id and p.is_active cross join lateral (values ('day_before'::public.appointment_reminder_type,a.starts_at-interval '24 hours'),('two_hours_before'::public.appointment_reminder_type,a.starts_at-interval '2 hours')) r(kind,due_at) left join public.appointment_reminders h on h.appointment_id=a.id and h.reminder_type=r.kind where private.is_active_user() and auth.uid() is not null and a.status='scheduled' and a.starts_at>reference_time and reference_time>=r.due_at and h.id is null order by a.starts_at,r.due_at;
$$;

revoke all on function private.audit_appointment_change() from public;
revoke all on function public.create_appointment(uuid,text,text,timestamptz,timestamptz,text,uuid),public.update_appointment(uuid,uuid,text,text,timestamptz,timestamptz,text),public.cancel_appointment(uuid,uuid,text),public.set_appointment_status(uuid,uuid,public.appointment_status),public.mark_appointment_reminder_handled(uuid,uuid,public.appointment_reminder_type),public.get_due_appointment_reminders(timestamptz) from public,anon;
grant execute on function public.create_appointment(uuid,text,text,timestamptz,timestamptz,text,uuid),public.update_appointment(uuid,uuid,text,text,timestamptz,timestamptz,text),public.cancel_appointment(uuid,uuid,text),public.set_appointment_status(uuid,uuid,public.appointment_status),public.mark_appointment_reminder_handled(uuid,uuid,public.appointment_reminder_type),public.get_due_appointment_reminders(timestamptz) to authenticated;
commit;
