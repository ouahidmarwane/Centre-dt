begin;

-- Multi-session treatment plans (implants, orthodontics…). The quote is the sum of
-- the planned steps and is frozen once the patient accepts it. Completing a step
-- records a performed intervention through create_intervention, so the amount enters
-- the patient balance under the existing financial rules.
create type public.treatment_plan_status as enum ('proposed', 'accepted', 'completed', 'cancelled');

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  title text not null,
  category text not null,
  notes text,
  status public.treatment_plan_status not null default 'proposed',
  idempotency_key uuid not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint treatment_plans_title_length check (char_length(title) between 1 and 120 and title = btrim(title)),
  constraint treatment_plans_category check (category in ('implant', 'orthodontics', 'prosthesis', 'endodontics', 'periodontics', 'other')),
  constraint treatment_plans_notes_length check (notes is null or (char_length(notes) between 1 and 2000 and notes = btrim(notes))),
  constraint treatment_plans_acceptance check ((status = 'proposed') = (accepted_at is null) or status = 'cancelled'),
  constraint treatment_plans_acceptance_actor check ((accepted_at is null) = (accepted_by is null)),
  constraint treatment_plans_completion check ((status = 'completed') = (completed_at is not null)),
  constraint treatment_plans_cancellation check (
    (status = 'cancelled' and cancelled_by is not null and cancelled_at is not null and char_length(cancellation_reason) between 5 and 500 and cancellation_reason = btrim(cancellation_reason))
    or (status <> 'cancelled' and cancelled_by is null and cancelled_at is null and cancellation_reason is null)
  )
);

create table public.treatment_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.treatment_plans(id) on delete restrict,
  position smallint not null,
  label text not null,
  amount numeric(12,2) not null,
  planned_date date,
  intervention_id uuid unique references public.interventions(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete restrict,
  completed_at timestamptz,
  constraint treatment_plan_steps_position check (position between 1 and 30),
  constraint treatment_plan_steps_label_length check (char_length(label) between 1 and 120 and label = btrim(label)),
  constraint treatment_plan_steps_amount check (amount >= 0 and amount < 10000000000),
  constraint treatment_plan_steps_completion check ((intervention_id is null) = (completed_at is null) and (completed_at is null) = (completed_by is null)),
  unique (plan_id, position)
);

create index treatment_plans_patient_idx on public.treatment_plans (patient_id, created_at desc);
create index treatment_plan_steps_plan_idx on public.treatment_plan_steps (plan_id, position);

alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_steps enable row level security;
revoke all on table public.treatment_plans, public.treatment_plan_steps from public, anon, authenticated;
grant select on table public.treatment_plans, public.treatment_plan_steps to authenticated;
create policy treatment_plans_select_staff on public.treatment_plans for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = treatment_plans.patient_id));
create policy treatment_plan_steps_select_staff on public.treatment_plan_steps for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.treatment_plans t where t.id = treatment_plan_steps.plan_id));

-- A step counts as done only while its intervention is still performed (a cancelled
-- intervention reopens the step).
create function private.treatment_step_is_done(target_intervention_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_intervention_id is not null and exists (
    select 1 from public.interventions i where i.id = target_intervention_id and i.status = 'performed'
  )
$$;
revoke all on function private.treatment_step_is_done(uuid) from public, anon;
grant execute on function private.treatment_step_is_done(uuid) to authenticated;

create function public.create_treatment_plan(
  target_patient_id uuid, target_title text, target_category text, target_notes text,
  target_steps jsonb, target_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); plan_id uuid; existing public.treatment_plans%rowtype; step jsonb; step_position smallint := 0;
begin
  if actor is null or actor_role is distinct from 'doctor' then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into existing from public.treatment_plans where idempotency_key = target_idempotency_key;
  if found then
    if existing.created_by = actor and existing.patient_id = target_patient_id then return existing.id; end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;
  perform 1 from public.patients p where p.id = target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  if target_title is null or char_length(btrim(target_title)) not between 1 and 120
    or target_category is null or target_category not in ('implant', 'orthodontics', 'prosthesis', 'endodontics', 'periodontics', 'other')
    or (target_notes is not null and char_length(btrim(target_notes)) > 2000)
    or target_steps is null or jsonb_typeof(target_steps) <> 'array' or jsonb_array_length(target_steps) not between 1 and 30
  then raise exception 'Invalid treatment plan' using errcode = '22023'; end if;

  insert into public.treatment_plans (patient_id, title, category, notes, idempotency_key, created_by)
  values (target_patient_id, btrim(target_title), target_category, nullif(btrim(target_notes), ''), target_idempotency_key, actor)
  returning id into plan_id;

  for step in select value from jsonb_array_elements(target_steps) loop
    step_position := step_position + 1;
    if jsonb_typeof(step) <> 'object' or jsonb_typeof(step -> 'label') <> 'string' or jsonb_typeof(step -> 'amount') <> 'number'
      or char_length(btrim(step ->> 'label')) not between 1 and 120
      or (step ->> 'amount')::numeric < 0 or (step ->> 'amount')::numeric <> round((step ->> 'amount')::numeric, 2)
      or (step ? 'planned_date' and jsonb_typeof(step -> 'planned_date') not in ('string', 'null'))
    then raise exception 'Invalid treatment step' using errcode = '22023'; end if;
    insert into public.treatment_plan_steps (plan_id, position, label, amount, planned_date)
    values (plan_id, step_position, btrim(step ->> 'label'), (step ->> 'amount')::numeric, nullif(step ->> 'planned_date', '')::date);
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'treatment_plan.created', 'treatment_plan', plan_id, jsonb_build_object('patient_id', target_patient_id));
  return plan_id;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
  raise exception 'Invalid treatment step' using errcode = '22023';
end $$;

-- Records the patient's acceptance of the quote (front desk or doctor).
create function public.accept_treatment_plan(target_plan_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); plan_patient uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  update public.treatment_plans set status = 'accepted', accepted_by = actor, accepted_at = now(), updated_at = now()
  where id = target_plan_id and status = 'proposed'
    and exists (select 1 from public.patients p where p.id = treatment_plans.patient_id and p.is_active)
  returning patient_id into plan_patient;
  if plan_patient is null then return false; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'treatment_plan.accepted', 'treatment_plan', target_plan_id, jsonb_build_object('patient_id', plan_patient));
  return true;
end $$;

create function public.complete_treatment_step(target_step_id uuid, target_performed_at date, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); plan public.treatment_plans%rowtype; step public.treatment_plan_steps%rowtype; new_intervention uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  select * into step from public.treatment_plan_steps where id = target_step_id for update;
  if not found then raise exception 'Step unavailable' using errcode = '22023'; end if;
  select * into plan from public.treatment_plans where id = step.plan_id for update;
  if plan.status not in ('accepted', 'completed') then raise exception 'Plan not in progress' using errcode = '22023'; end if;
  if private.treatment_step_is_done(step.intervention_id) then raise exception 'Step already completed' using errcode = '22023'; end if;
  if target_performed_at is null or target_performed_at > current_date then raise exception 'Invalid performed date' using errcode = '22023'; end if;

  new_intervention := public.create_intervention(
    plan.patient_id, target_performed_at, left(plan.title || ' — ' || step.label, 160), step.amount,
    'performed'::public.intervention_status, target_idempotency_key, 'Séance du plan de traitement.', '{}'::smallint[], '{}'::uuid[]
  );
  update public.treatment_plan_steps set intervention_id = new_intervention, completed_by = actor, completed_at = now() where id = step.id;

  -- Completed once every step holds a performed intervention; otherwise back in progress.
  if not exists (select 1 from public.treatment_plan_steps s where s.plan_id = plan.id and not private.treatment_step_is_done(s.intervention_id)) then
    update public.treatment_plans set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now() where id = plan.id;
  else
    update public.treatment_plans set status = 'accepted', completed_at = null, updated_at = now() where id = plan.id;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'treatment_plan.step_completed', 'treatment_plan', plan.id, jsonb_build_object('patient_id', plan.patient_id, 'step_id', step.id, 'intervention_id', new_intervention));
  return new_intervention;
end $$;

create function public.cancel_treatment_plan(target_plan_id uuid, target_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); plan_patient uuid;
begin
  if actor is null or actor_role is distinct from 'doctor' then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 5 and 500 then raise exception 'Invalid reason' using errcode = '22023'; end if;
  update public.treatment_plans set status = 'cancelled', cancelled_by = actor, cancelled_at = now(), cancellation_reason = btrim(target_reason), updated_at = now()
  where id = target_plan_id and status in ('proposed', 'accepted')
  returning patient_id into plan_patient;
  if plan_patient is null then return false; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'treatment_plan.cancelled', 'treatment_plan', target_plan_id, jsonb_build_object('patient_id', plan_patient));
  return true;
end $$;

revoke all on function public.create_treatment_plan(uuid, text, text, text, jsonb, uuid), public.accept_treatment_plan(uuid), public.complete_treatment_step(uuid, date, uuid), public.cancel_treatment_plan(uuid, text) from public, anon;
grant execute on function public.create_treatment_plan(uuid, text, text, text, jsonb, uuid), public.accept_treatment_plan(uuid), public.complete_treatment_step(uuid, date, uuid), public.cancel_treatment_plan(uuid, text) to authenticated;

commit;
