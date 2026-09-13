begin;

create type public.invoice_status as enum ('active', 'voided');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  invoice_number text not null unique,
  status public.invoice_status not null default 'active',
  issued_at timestamptz not null default now(),
  issued_by uuid not null references auth.users (id) on delete restrict,
  issuer_name_snapshot text not null,
  subtotal numeric(12,2) not null,
  total numeric(12,2) not null,
  patient_first_name_snapshot text not null,
  patient_last_name_snapshot text not null,
  patient_address_snapshot text,
  clinic_name_snapshot text not null default 'Centre Dentaire Ouahid',
  idempotency_key uuid not null unique,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete restrict,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint invoices_number_format check (invoice_number ~ '^FAC-[0-9]{4}-[0-9]{6,}$'),
  constraint invoices_issuer_name_length check (char_length(issuer_name_snapshot) between 1 and 160 and issuer_name_snapshot = btrim(issuer_name_snapshot)),
  constraint invoices_patient_name_length check (char_length(patient_first_name_snapshot) between 1 and 120 and char_length(patient_last_name_snapshot) between 1 and 120),
  constraint invoices_patient_address_length check (patient_address_snapshot is null or (char_length(patient_address_snapshot) between 1 and 500 and patient_address_snapshot = btrim(patient_address_snapshot))),
  constraint invoices_clinic_name check (clinic_name_snapshot = 'Centre Dentaire Ouahid'),
  constraint invoices_totals check (subtotal > 0 and subtotal < 10000000000 and total = subtotal),
  constraint invoices_void_consistency check (
    (status = 'active' and voided_at is null and voided_by is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null and char_length(void_reason) between 5 and 500 and void_reason = btrim(void_reason))
  )
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  description_snapshot text not null,
  quantity smallint not null default 1,
  unit_amount numeric(12,2) not null,
  line_total numeric(12,2) not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint invoice_items_description_length check (char_length(description_snapshot) between 1 and 160 and description_snapshot = btrim(description_snapshot)),
  constraint invoice_items_fixed_quantity check (quantity = 1),
  constraint invoice_items_amount check (unit_amount >= 0 and unit_amount < 10000000000 and line_total = unit_amount),
  constraint invoice_items_position check (position between 1 and 50),
  unique (invoice_id, position),
  unique (invoice_id, intervention_id)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  receipt_number text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references auth.users (id) on delete restrict,
  issuer_name_snapshot text not null,
  amount_snapshot numeric(12,2) not null,
  payment_method_snapshot public.payment_method not null,
  payment_received_at_snapshot timestamptz not null,
  patient_first_name_snapshot text not null,
  patient_last_name_snapshot text not null,
  patient_address_snapshot text,
  clinic_name_snapshot text not null default 'Centre Dentaire Ouahid',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint payment_receipts_number_format check (receipt_number ~ '^REC-[0-9]{4}-[0-9]{6,}$'),
  constraint payment_receipts_issuer_name_length check (char_length(issuer_name_snapshot) between 1 and 160 and issuer_name_snapshot = btrim(issuer_name_snapshot)),
  constraint payment_receipts_amount check (amount_snapshot > 0 and amount_snapshot < 10000000000),
  constraint payment_receipts_patient_name_length check (char_length(patient_first_name_snapshot) between 1 and 120 and char_length(patient_last_name_snapshot) between 1 and 120),
  constraint payment_receipts_patient_address_length check (patient_address_snapshot is null or (char_length(patient_address_snapshot) between 1 and 500 and patient_address_snapshot = btrim(patient_address_snapshot))),
  constraint payment_receipts_clinic_name check (clinic_name_snapshot = 'Centre Dentaire Ouahid')
);

create table private.financial_document_counters (
  document_kind text not null,
  document_year smallint not null,
  last_value bigint not null,
  primary key (document_kind, document_year),
  constraint financial_document_counters_kind check (document_kind in ('FAC', 'REC')),
  constraint financial_document_counters_year check (document_year between 2020 and 9999),
  constraint financial_document_counters_value check (last_value > 0)
);

create table private.active_invoice_interventions (
  intervention_id uuid primary key references public.interventions (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict
);

create index invoices_patient_history_idx on public.invoices (patient_id, issued_at desc);
create index invoices_patient_status_idx on public.invoices (patient_id, status, issued_at desc);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);
create index invoice_items_intervention_idx on public.invoice_items (intervention_id);
create index payment_receipts_patient_history_idx on public.payment_receipts (patient_id, issued_at desc);
create index private_active_invoice_invoice_idx on private.active_invoice_interventions (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_receipts enable row level security;

revoke all on table public.invoices, public.invoice_items, public.payment_receipts from public, anon, authenticated;
grant select on table public.invoices, public.invoice_items, public.payment_receipts to authenticated;
revoke all on table private.financial_document_counters, private.active_invoice_interventions from public, anon, authenticated;

create policy invoices_select_staff on public.invoices for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = invoices.patient_id));
create policy invoice_items_select_staff on public.invoice_items for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id));
create policy payment_receipts_select_staff on public.payment_receipts for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = payment_receipts.patient_id));

create function private.next_financial_document_number(target_kind text, target_year smallint)
returns text language plpgsql security definer set search_path = '' as $$
declare allocated bigint;
begin
  if target_kind not in ('FAC', 'REC') or target_year not between 2020 and 9999 then
    raise exception 'Invalid document counter' using errcode = '22023';
  end if;
  insert into private.financial_document_counters (document_kind, document_year, last_value)
  values (target_kind, target_year, 1)
  on conflict (document_kind, document_year) do update
  set last_value = private.financial_document_counters.last_value + 1
  returning last_value into allocated;
  return target_kind || '-' || target_year::text || '-' || lpad(allocated::text, 6, '0');
end $$;

create function private.protect_invoice_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Invoice history is immutable' using errcode = '42501'; end if;
  if old.status <> 'active'::public.invoice_status
    or new.status <> 'voided'::public.invoice_status
    or new.id is distinct from old.id
    or new.patient_id is distinct from old.patient_id
    or new.invoice_number is distinct from old.invoice_number
    or new.issued_at is distinct from old.issued_at
    or new.issued_by is distinct from old.issued_by
    or new.issuer_name_snapshot is distinct from old.issuer_name_snapshot
    or new.subtotal is distinct from old.subtotal
    or new.total is distinct from old.total
    or new.patient_first_name_snapshot is distinct from old.patient_first_name_snapshot
    or new.patient_last_name_snapshot is distinct from old.patient_last_name_snapshot
    or new.patient_address_snapshot is distinct from old.patient_address_snapshot
    or new.clinic_name_snapshot is distinct from old.clinic_name_snapshot
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at
    or new.voided_by is distinct from auth.uid()
    or private.current_user_role() is distinct from 'doctor'::public.app_role
  then raise exception 'Invoice history is immutable' using errcode = '42501'; end if;
  return new;
end $$;

create function private.prevent_document_row_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Financial document history is immutable' using errcode = '42501';
end $$;

create function private.protect_invoiced_intervention()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from private.active_invoice_interventions a where a.intervention_id = old.id)
    and (new.patient_id is distinct from old.patient_id
      or new.performed_at is distinct from old.performed_at
      or new.nature is distinct from old.nature
      or new.amount_due is distinct from old.amount_due
      or new.status is distinct from old.status)
  then raise exception 'Active invoiced intervention is immutable' using errcode = '22023'; end if;
  return new;
end $$;

create trigger invoices_protect_history before update or delete on public.invoices
for each row execute function private.protect_invoice_history();
create trigger invoice_items_protect_history before update or delete on public.invoice_items
for each row execute function private.prevent_document_row_mutation();
create trigger payment_receipts_protect_history before update or delete on public.payment_receipts
for each row execute function private.prevent_document_row_mutation();
create trigger interventions_protect_active_invoice before update on public.interventions
for each row execute function private.protect_invoiced_intervention();

create function public.create_invoice(target_patient_id uuid, target_intervention_ids uuid[], target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  actor_name text;
  patient_record record;
  invoice_id uuid;
  existing_record record;
  item_count integer;
  calculated_total numeric(12,2);
  issued_year smallint := extract(year from timezone('Africa/Casablanca', now()))::smallint;
  allocated_number text;
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_idempotency_key::text, 701));
  select id, patient_id, issued_by into existing_record from public.invoices where idempotency_key = target_idempotency_key;
  if found then
    if existing_record.patient_id = target_patient_id and existing_record.issued_by = actor then return existing_record.id; end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;
  select id, first_name, last_name, address into patient_record from public.patients where id = target_patient_id and is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  select full_name into actor_name from public.profiles where id = actor and is_active and role = 'doctor';
  if actor_name is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_intervention_ids is null or cardinality(target_intervention_ids) not between 1 and 50
    or exists (select 1 from unnest(target_intervention_ids) value where value is null)
    or (select count(distinct value) from unnest(target_intervention_ids) value) <> cardinality(target_intervention_ids)
  then raise exception 'Invalid intervention selection' using errcode = '22023'; end if;
  select count(*), sum(amount_due)::numeric(12,2) into item_count, calculated_total
  from public.interventions
  where id = any(target_intervention_ids) and patient_id = target_patient_id and status = 'performed';
  if item_count <> cardinality(target_intervention_ids) or calculated_total is null or calculated_total <= 0 then
    raise exception 'Invalid intervention selection' using errcode = '22023';
  end if;
  allocated_number := private.next_financial_document_number('FAC', issued_year);
  insert into public.invoices (
    patient_id, invoice_number, issued_by, issuer_name_snapshot, subtotal, total,
    patient_first_name_snapshot, patient_last_name_snapshot, patient_address_snapshot, idempotency_key
  ) values (
    patient_record.id, allocated_number, actor, btrim(actor_name), calculated_total, calculated_total,
    patient_record.first_name, patient_record.last_name, patient_record.address, target_idempotency_key
  ) returning id into invoice_id;
  insert into private.active_invoice_interventions (intervention_id, invoice_id)
  select value, invoice_id from unnest(target_intervention_ids) value;
  insert into public.invoice_items (invoice_id, intervention_id, description_snapshot, unit_amount, line_total, position)
  select invoice_id, source.id, source.nature, source.amount_due, source.amount_due, selected.position::smallint
  from unnest(target_intervention_ids) with ordinality selected(id, position)
  join public.interventions source on source.id = selected.id
  order by selected.position;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'invoice.created', 'invoice', invoice_id, jsonb_build_object('patient_id', target_patient_id, 'item_count', item_count));
  return invoice_id;
end $$;

create function public.void_invoice(target_patient_id uuid, target_invoice_id uuid, target_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 5 and 500 then raise exception 'Invalid reason' using errcode = '22023'; end if;
  perform 1 from public.patients where id = target_patient_id for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  update public.invoices set status = 'voided', voided_at = now(), voided_by = actor, void_reason = btrim(target_reason)
  where id = target_invoice_id and patient_id = target_patient_id and status = 'active';
  get diagnostics affected = row_count;
  if affected = 1 then
    delete from private.active_invoice_interventions where invoice_id = target_invoice_id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (actor, 'invoice.voided', 'invoice', target_invoice_id, jsonb_build_object('patient_id', target_patient_id));
  end if;
  return affected = 1;
end $$;

create function public.create_payment_receipt(target_patient_id uuid, target_payment_id uuid, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  actor_name text;
  patient_record record;
  payment_record record;
  existing_record record;
  receipt_id uuid;
  issued_year smallint := extract(year from timezone('Africa/Casablanca', now()))::smallint;
  allocated_number text;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_idempotency_key::text, 702));
  select id, patient_id, issued_by into existing_record from public.payment_receipts where idempotency_key = target_idempotency_key;
  if found then
    if existing_record.patient_id = target_patient_id and existing_record.issued_by = actor then return existing_record.id; end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;
  select id, first_name, last_name, address into patient_record from public.patients where id = target_patient_id and is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  select profile.full_name into actor_name from public.profiles profile
  where profile.id = actor and profile.is_active and profile.role = actor_role;
  if actor_name is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  select id, patient_id, amount, method, received_at, status into payment_record
  from public.payments where id = target_payment_id and patient_id = target_patient_id for update;
  if not found or payment_record.status is distinct from 'received'::public.payment_status then
    raise exception 'Payment unavailable' using errcode = '22023';
  end if;
  select id, patient_id into existing_record from public.payment_receipts where payment_id = target_payment_id;
  if found then
    if existing_record.patient_id = target_patient_id then return existing_record.id; end if;
    raise exception 'Receipt conflict' using errcode = '23505';
  end if;
  allocated_number := private.next_financial_document_number('REC', issued_year);
  insert into public.payment_receipts (
    payment_id, patient_id, receipt_number, issued_by, issuer_name_snapshot, amount_snapshot,
    payment_method_snapshot, payment_received_at_snapshot, patient_first_name_snapshot,
    patient_last_name_snapshot, patient_address_snapshot, idempotency_key
  ) values (
    payment_record.id, patient_record.id, allocated_number, actor, btrim(actor_name), payment_record.amount,
    payment_record.method, payment_record.received_at, patient_record.first_name,
    patient_record.last_name, patient_record.address, target_idempotency_key
  ) returning id into receipt_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'receipt.created', 'payment_receipt', receipt_id, jsonb_build_object('patient_id', target_patient_id));
  return receipt_id;
end $$;

revoke all on function private.next_financial_document_number(text, smallint), private.protect_invoice_history(), private.prevent_document_row_mutation(), private.protect_invoiced_intervention() from public, anon, authenticated;
revoke all on function public.create_invoice(uuid, uuid[], uuid), public.void_invoice(uuid, uuid, text), public.create_payment_receipt(uuid, uuid, uuid) from public, anon;
grant execute on function public.create_invoice(uuid, uuid[], uuid), public.void_invoice(uuid, uuid, text), public.create_payment_receipt(uuid, uuid, uuid) to authenticated;

commit;
