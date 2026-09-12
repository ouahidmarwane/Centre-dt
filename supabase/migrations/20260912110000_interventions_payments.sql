begin;

create type public.intervention_status as enum ('planned', 'performed', 'cancelled');
create type public.payment_status as enum ('received', 'reversed');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'cheque', 'other');

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  performed_at date not null,
  nature text not null,
  notes text,
  amount_due numeric(12,2) not null,
  status public.intervention_status not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  constraint interventions_nature_length check (char_length(nature) between 1 and 160 and nature = btrim(nature)),
  constraint interventions_notes_length check (notes is null or (char_length(notes) between 1 and 4000 and notes = btrim(notes))),
  constraint interventions_amount check (amount_due >= 0 and amount_due < 10000000000),
  constraint interventions_cancellation_consistency check (
    (status = 'cancelled' and cancelled_by is not null and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_by is null and cancelled_at is null)
  )
);

create table public.intervention_teeth (
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  tooth_number smallint not null,
  primary key (intervention_id, tooth_number),
  constraint intervention_teeth_permanent_fdi check (tooth_number in (
    11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
    31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48
  ))
);

create table public.intervention_findings (
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  dental_finding_id uuid not null references public.dental_findings (id) on delete restrict,
  primary key (intervention_id, dental_finding_id)
);

create table public.intervention_revisions (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  performed_at date not null,
  nature text not null,
  notes text,
  amount_due numeric(12,2) not null,
  status public.intervention_status not null,
  changed_by uuid not null references auth.users (id) on delete restrict,
  changed_by_role public.app_role not null,
  changed_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  amount numeric(12,2) not null,
  method public.payment_method not null,
  received_at timestamptz not null,
  reference text,
  notes text,
  status public.payment_status not null default 'received',
  idempotency_key uuid not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  reversed_by uuid references auth.users (id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  constraint payments_amount check (amount > 0 and amount < 10000000000),
  constraint payments_reference_length check (reference is null or (char_length(reference) between 1 and 160 and reference = btrim(reference))),
  constraint payments_notes_length check (notes is null or (char_length(notes) between 1 and 2000 and notes = btrim(notes))),
  constraint payments_reversal_consistency check (
    (status = 'received' and reversed_by is null and reversed_at is null and reversal_reason is null)
    or (status = 'reversed' and reversed_by is not null and reversed_at is not null and char_length(reversal_reason) between 5 and 500 and reversal_reason = btrim(reversal_reason))
  )
);

create index interventions_patient_date_idx on public.interventions (patient_id, performed_at desc, created_at desc);
create index interventions_patient_status_idx on public.interventions (patient_id, status, performed_at desc);
create index intervention_teeth_tooth_idx on public.intervention_teeth (tooth_number, intervention_id);
create index intervention_findings_finding_idx on public.intervention_findings (dental_finding_id, intervention_id);
create index intervention_revisions_history_idx on public.intervention_revisions (patient_id, changed_at desc);
create index payments_patient_date_idx on public.payments (patient_id, received_at desc, created_at desc);
create index payments_patient_status_idx on public.payments (patient_id, status, received_at desc);

create function private.record_intervention_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); action_name text;
begin
  if actor_id is null or actor_role is null then raise exception 'Active authentication required' using errcode = '42501'; end if;
  insert into public.intervention_revisions (intervention_id, patient_id, performed_at, nature, notes, amount_due, status, changed_by, changed_by_role)
  values (new.id, new.patient_id, new.performed_at, new.nature, new.notes, new.amount_due, new.status, actor_id, actor_role);
  action_name := case when tg_op = 'INSERT' then 'intervention.created' when new.status = 'cancelled' and old.status <> 'cancelled' then 'intervention.cancelled' else 'intervention.updated' end;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, action_name, 'intervention', new.id, jsonb_build_object('patient_id', new.patient_id));
  return new;
end $$;

create trigger interventions_revision after insert or update on public.interventions
for each row execute function private.record_intervention_revision();

create function private.audit_payment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); action_name text;
begin
  if actor_id is null or actor_role is null then raise exception 'Active authentication required' using errcode = '42501'; end if;
  action_name := case when tg_op = 'INSERT' then 'payment.received' else 'payment.reversed' end;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor_id, action_name, 'payment', new.id, jsonb_build_object('patient_id', new.patient_id));
  return new;
end $$;

create trigger payments_audit after insert or update on public.payments
for each row execute function private.audit_payment_change();

alter table public.interventions enable row level security;
alter table public.intervention_teeth enable row level security;
alter table public.intervention_findings enable row level security;
alter table public.intervention_revisions enable row level security;
alter table public.payments enable row level security;

revoke all on table public.interventions, public.intervention_teeth, public.intervention_findings, public.intervention_revisions, public.payments from public, anon, authenticated;
grant select on table public.interventions, public.intervention_teeth, public.intervention_findings, public.intervention_revisions, public.payments to authenticated;

create policy interventions_select_staff on public.interventions for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = interventions.patient_id));
create policy intervention_teeth_select_staff on public.intervention_teeth for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.interventions i where i.id = intervention_teeth.intervention_id));
create policy intervention_findings_select_staff on public.intervention_findings for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.interventions i where i.id = intervention_findings.intervention_id));
create policy intervention_revisions_select_staff on public.intervention_revisions for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = intervention_revisions.patient_id));
create policy payments_select_staff on public.payments for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = payments.patient_id));

create function public.create_intervention(
  target_patient_id uuid, target_performed_at date, target_nature text, target_amount_due numeric,
  target_status public.intervention_status, target_notes text default null,
  target_teeth smallint[] default '{}', target_finding_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); intervention_id uuid; expected integer;
begin
  if actor_id is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  perform 1 from public.patients p where p.id = target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  if target_status = 'cancelled' then raise exception 'Use cancellation operation' using errcode = '22023'; end if;
  if target_performed_at is null or target_nature is null or target_amount_due is null then raise exception 'Invalid intervention' using errcode = '22023'; end if;
  if target_status = 'performed' and target_performed_at > current_date then raise exception 'Invalid performed date' using errcode = '22023'; end if;
  if target_amount_due <> round(target_amount_due, 2) then raise exception 'Invalid money precision' using errcode = '22023'; end if;
  if exists (select 1 from unnest(target_teeth) t where t is null or t not in (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48)) then raise exception 'Invalid tooth' using errcode = '22023'; end if;
  select count(distinct x) into expected from unnest(target_finding_ids) x where x is not null;
  if expected <> coalesce(cardinality(target_finding_ids), 0) or expected <> (select count(*) from public.dental_findings f where f.id = any(target_finding_ids) and f.patient_id = target_patient_id) then raise exception 'Invalid finding relation' using errcode = '22023'; end if;
  insert into public.interventions (patient_id, performed_at, nature, notes, amount_due, status, created_by, updated_by)
  values (target_patient_id, target_performed_at, btrim(target_nature), nullif(btrim(target_notes), ''), target_amount_due, target_status, actor_id, actor_id)
  returning id into intervention_id;
  insert into public.intervention_teeth select intervention_id, t from (select distinct unnest(target_teeth) t) q;
  insert into public.intervention_findings select intervention_id, f from (select distinct unnest(target_finding_ids) f) q;
  return intervention_id;
end $$;

create function public.update_intervention(
  target_patient_id uuid, target_intervention_id uuid, target_performed_at date, target_nature text,
  target_amount_due numeric, target_status public.intervention_status, target_notes text default null,
  target_teeth smallint[] default '{}', target_finding_ids uuid[] default '{}'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); old_amount numeric; expected integer; received_total numeric; due_after numeric;
begin
  if actor_id is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  perform 1 from public.patients p where p.id = target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  select amount_due into old_amount from public.interventions where id = target_intervention_id and patient_id = target_patient_id and status <> 'cancelled';
  if not found then return false; end if;
  if target_status = 'cancelled' then raise exception 'Use cancellation operation' using errcode = '22023'; end if;
  if target_performed_at is null or target_nature is null or target_amount_due is null then raise exception 'Invalid intervention' using errcode = '22023'; end if;
  if target_status = 'performed' and target_performed_at > current_date then raise exception 'Invalid performed date' using errcode = '22023'; end if;
  if target_amount_due <> round(target_amount_due, 2) then raise exception 'Invalid money precision' using errcode = '22023'; end if;
  if actor_role = 'assistant' and old_amount is distinct from target_amount_due and exists (select 1 from public.payments where patient_id = target_patient_id and status = 'received') then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if exists (select 1 from unnest(target_teeth) t where t is null or t not in (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48)) then raise exception 'Invalid tooth' using errcode = '22023'; end if;
  select count(distinct x) into expected from unnest(target_finding_ids) x where x is not null;
  if expected <> coalesce(cardinality(target_finding_ids), 0) or expected <> (select count(*) from public.dental_findings f where f.id = any(target_finding_ids) and f.patient_id = target_patient_id) then raise exception 'Invalid finding relation' using errcode = '22023'; end if;
  select coalesce(sum(amount),0) into received_total from public.payments where patient_id = target_patient_id and status = 'received';
  select coalesce(sum(case when id = target_intervention_id then case when target_status = 'performed' then target_amount_due else 0 end else amount_due end),0)
  into due_after from public.interventions where patient_id = target_patient_id and status = 'performed';
  if (select status from public.interventions where id = target_intervention_id) <> 'performed' and target_status = 'performed' then due_after := due_after + target_amount_due; end if;
  if due_after < received_total then raise exception 'Change would create overpayment' using errcode = '22023'; end if;
  update public.interventions set performed_at=target_performed_at, nature=btrim(target_nature), amount_due=target_amount_due, status=target_status, notes=nullif(btrim(target_notes),''), updated_by=actor_id, updated_at=now()
  where id=target_intervention_id and patient_id=target_patient_id and status <> 'cancelled';
  delete from public.intervention_teeth where intervention_id=target_intervention_id;
  insert into public.intervention_teeth select target_intervention_id, t from (select distinct unnest(target_teeth) t) q;
  delete from public.intervention_findings where intervention_id=target_intervention_id;
  insert into public.intervention_findings select target_intervention_id, f from (select distinct unnest(target_finding_ids) f) q;
  return true;
end $$;

create function public.cancel_intervention(target_patient_id uuid, target_intervention_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); amount_to_remove numeric; due_total numeric; received_total numeric;
begin
  if actor_id is null or actor_role is distinct from 'doctor' then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  perform 1 from public.patients p where p.id=target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  select case when status='performed' then amount_due else 0 end into amount_to_remove from public.interventions where id=target_intervention_id and patient_id=target_patient_id and status <> 'cancelled';
  if not found then return false; end if;
  select coalesce(sum(amount_due),0) into due_total from public.interventions where patient_id=target_patient_id and status='performed';
  select coalesce(sum(amount),0) into received_total from public.payments where patient_id=target_patient_id and status='received';
  if due_total - amount_to_remove < received_total then raise exception 'Cancellation would create overpayment' using errcode='22023'; end if;
  update public.interventions set status='cancelled', cancelled_by=actor_id, cancelled_at=now(), updated_by=actor_id, updated_at=now() where id=target_intervention_id and patient_id=target_patient_id and status <> 'cancelled';
  return found;
end $$;

create function public.record_payment(
  target_patient_id uuid, target_amount numeric, target_method public.payment_method,
  target_received_at timestamptz, target_idempotency_key uuid, target_reference text default null, target_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); due_total numeric; received_total numeric; payment_id uuid;
begin
  if actor_id is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  perform 1 from public.patients p where p.id=target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  if target_idempotency_key is null then raise exception 'Idempotency key required' using errcode='22023'; end if;
  if target_received_at is null or target_received_at > now() then raise exception 'Invalid payment date' using errcode='22023'; end if;
  if target_amount <> round(target_amount, 2) then raise exception 'Invalid money precision' using errcode='22023'; end if;
  if exists (select 1 from public.payments where idempotency_key=target_idempotency_key) then raise exception 'Duplicate payment request' using errcode='23505'; end if;
  select coalesce(sum(amount_due),0) into due_total from public.interventions where patient_id=target_patient_id and status='performed';
  select coalesce(sum(amount),0) into received_total from public.payments where patient_id=target_patient_id and status='received';
  if target_amount is null or target_amount <= 0 or target_amount > due_total - received_total then raise exception 'Invalid payment amount' using errcode='22023'; end if;
  insert into public.payments (patient_id,amount,method,received_at,reference,notes,idempotency_key,created_by)
  values (target_patient_id,target_amount,target_method,target_received_at,nullif(btrim(target_reference),''),nullif(btrim(target_notes),''),target_idempotency_key,actor_id)
  returning id into payment_id;
  return payment_id;
end $$;

create function public.reverse_payment(target_patient_id uuid, target_payment_id uuid, target_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); affected integer;
begin
  if actor_id is null or actor_role is distinct from 'doctor' then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  perform 1 from public.patients p where p.id=target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 5 and 500 then raise exception 'Invalid reversal reason' using errcode='22023'; end if;
  update public.payments set status='reversed', reversed_by=actor_id, reversed_at=now(), reversal_reason=btrim(target_reason)
  where id=target_payment_id and patient_id=target_patient_id and status='received';
  get diagnostics affected = row_count; return affected=1;
end $$;

create function public.get_patient_financial_summary(target_patient_id uuid)
returns table(total_due numeric, total_received numeric, outstanding numeric)
language plpgsql security definer stable set search_path = '' as $$
declare actor_role public.app_role := private.current_user_role();
begin
  if auth.uid() is null or actor_role is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  if not exists (select 1 from public.patients p where p.id=target_patient_id) then raise exception 'Patient unavailable' using errcode='22023'; end if;
  return query with d as (select coalesce(sum(i.amount_due),0)::numeric(12,2) v from public.interventions i where i.patient_id=target_patient_id and i.status='performed'), r as (select coalesce(sum(p.amount),0)::numeric(12,2) v from public.payments p where p.patient_id=target_patient_id and p.status='received') select d.v,r.v,(d.v-r.v)::numeric(12,2) from d,r;
end $$;

revoke all on function private.record_intervention_revision(), private.audit_payment_change() from public;
revoke all on function public.create_intervention(uuid,date,text,numeric,public.intervention_status,text,smallint[],uuid[]), public.update_intervention(uuid,uuid,date,text,numeric,public.intervention_status,text,smallint[],uuid[]), public.cancel_intervention(uuid,uuid), public.record_payment(uuid,numeric,public.payment_method,timestamptz,uuid,text,text), public.reverse_payment(uuid,uuid,text), public.get_patient_financial_summary(uuid) from public, anon;
grant execute on function public.create_intervention(uuid,date,text,numeric,public.intervention_status,text,smallint[],uuid[]), public.update_intervention(uuid,uuid,date,text,numeric,public.intervention_status,text,smallint[],uuid[]), public.cancel_intervention(uuid,uuid), public.record_payment(uuid,numeric,public.payment_method,timestamptz,uuid,text,text), public.reverse_payment(uuid,uuid,text), public.get_patient_financial_summary(uuid) to authenticated;

commit;
