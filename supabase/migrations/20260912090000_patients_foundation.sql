begin;

create extension if not exists pg_trgm with schema extensions;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  phone text not null,
  profession text,
  address text,
  has_mutuelle boolean not null default false,
  mutuelle_name text,
  has_medical_history boolean not null default false,
  medical_history_notes text,
  has_allergies boolean not null default false,
  allergy_notes text,
  general_notes text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint patients_first_name_length
    check (char_length(first_name) between 1 and 120 and first_name = btrim(first_name)),
  constraint patients_last_name_length
    check (char_length(last_name) between 1 and 120 and last_name = btrim(last_name)),
  constraint patients_date_of_birth_range
    check (date_of_birth is null or date_of_birth between date '1900-01-01' and current_date),
  constraint patients_phone_format
    check (
      char_length(phone) between 3 and 32
      and phone = btrim(phone)
      and phone ~ '^[0-9+()./ -]+$'
    ),
  constraint patients_profession_length
    check (profession is null or char_length(profession) between 1 and 160),
  constraint patients_address_length
    check (address is null or char_length(address) between 1 and 500),
  constraint patients_mutuelle_consistency
    check (
      (has_mutuelle and mutuelle_name is not null and char_length(mutuelle_name) between 1 and 160)
      or (not has_mutuelle and mutuelle_name is null)
    ),
  constraint patients_medical_history_consistency
    check (
      (
        has_medical_history
        and medical_history_notes is not null
        and char_length(medical_history_notes) between 1 and 4000
      )
      or (not has_medical_history and medical_history_notes is null)
    ),
  constraint patients_allergy_consistency
    check (
      (
        has_allergies
        and allergy_notes is not null
        and char_length(allergy_notes) between 1 and 4000
      )
      or (not has_allergies and allergy_notes is null)
    ),
  constraint patients_general_notes_length
    check (general_notes is null or char_length(general_notes) between 1 and 5000),
  constraint patients_archive_consistency
    check (
      (is_active and archived_at is null)
      or (not is_active and archived_at is not null)
    )
);

comment on table public.patients is
  'Patient identity, contact, intake and archive state. Normal application access never hard-deletes rows.';
comment on column public.patients.medical_history_notes is
  'Sensitive health information. Never duplicate in audit metadata or list views.';
comment on column public.patients.allergy_notes is
  'Sensitive allergy information. Never duplicate in audit metadata or list views.';

create index patients_active_updated_idx
  on public.patients (is_active, updated_at desc);
create index patients_last_first_idx
  on public.patients (lower(last_name), lower(first_name));
create index patients_first_name_trgm_idx
  on public.patients using gin (first_name extensions.gin_trgm_ops);
create index patients_last_name_trgm_idx
  on public.patients using gin (last_name extensions.gin_trgm_ops);
create index patients_phone_trgm_idx
  on public.patients using gin (phone extensions.gin_trgm_ops);

create function private.set_patient_actor_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'An authenticated actor is required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := actor_id;
    new.created_at := now();
    new.is_active := true;
    new.archived_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.updated_by := actor_id;
  new.updated_at := now();
  return new;
end;
$$;

create trigger patients_set_actor_fields
before insert or update on public.patients
for each row execute function private.set_patient_actor_fields();

create function private.audit_patient_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  audit_action := case
    when tg_op = 'INSERT' then 'patient.created'
    when old.is_active and not new.is_active then 'patient.archived'
    else 'patient.updated'
  end;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    audit_action,
    'patient',
    new.id,
    '{}'::jsonb
  );

  return new;
end;
$$;

create trigger patients_audit_change
after insert or update on public.patients
for each row execute function private.audit_patient_change();

alter table public.patients enable row level security;

revoke all on table public.patients from public, anon, authenticated;
grant select, insert on table public.patients to authenticated;
grant update (
  first_name,
  last_name,
  date_of_birth,
  phone,
  profession,
  address,
  has_mutuelle,
  mutuelle_name,
  has_medical_history,
  medical_history_notes,
  has_allergies,
  allergy_notes,
  general_notes
) on table public.patients to authenticated;

create policy patients_select_active_staff
on public.patients
for select
to authenticated
using ((select private.is_active_user()));

create policy patients_insert_active_staff
on public.patients
for insert
to authenticated
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and is_active
  and archived_at is null
);

create policy patients_update_active_staff
on public.patients
for update
to authenticated
using (
  (select private.is_active_user())
  and is_active
)
with check (
  (select private.is_active_user())
  and is_active
  and archived_at is null
  and updated_by = (select auth.uid())
);

create function public.archive_patient(patient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if (select private.current_user_role()) is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  update public.patients
  set
    is_active = false,
    archived_at = now()
  where id = patient_id
    and is_active = true;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create function public.search_patients(
  search_term text default null,
  patient_status text default 'active'
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  has_mutuelle boolean,
  mutuelle_name text,
  is_active boolean,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    patient.id,
    patient.first_name,
    patient.last_name,
    patient.date_of_birth,
    patient.phone,
    patient.has_mutuelle,
    patient.mutuelle_name,
    patient.is_active,
    patient.updated_at
  from public.patients as patient
  where
    patient_status in ('active', 'archived', 'all')
    and (
      patient_status = 'all'
      or (patient_status = 'active' and patient.is_active)
      or (patient_status = 'archived' and not patient.is_active)
    )
    and (
      search_term is null
      or btrim(search_term) = ''
      or (
        char_length(btrim(search_term)) between 2 and 80
        and position('%' in search_term) = 0
        and position('_' in search_term) = 0
        and (
          patient.first_name ilike '%' || btrim(search_term) || '%'
          or patient.last_name ilike '%' || btrim(search_term) || '%'
          or patient.phone ilike '%' || btrim(search_term) || '%'
          or concat_ws(' ', patient.first_name, patient.last_name)
            ilike '%' || btrim(search_term) || '%'
        )
      )
    )
  order by patient.updated_at desc, patient.last_name, patient.first_name
  limit 100
$$;

revoke all on function private.set_patient_actor_fields() from public;
revoke all on function private.audit_patient_change() from public;
revoke all on function public.archive_patient(uuid) from public, anon;
revoke all on function public.search_patients(text, text) from public, anon;
grant execute on function public.archive_patient(uuid) to authenticated;
grant execute on function public.search_patients(text, text) to authenticated;

commit;
