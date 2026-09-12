begin;

create type public.dentition_type as enum ('permanent');
create type public.dental_condition as enum (
  'caries',
  'missing',
  'filled',
  'crown',
  'root_canal',
  'fracture',
  'implant',
  'extraction_indicated',
  'other'
);
create type public.dental_finding_status as enum (
  'untreated',
  'monitoring',
  'treated',
  'resolved'
);
create type public.dental_finding_event as enum (
  'created',
  'updated',
  'status_changed',
  'resolved'
);

create table public.dental_findings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  dentition public.dentition_type not null default 'permanent',
  tooth_number smallint not null,
  condition public.dental_condition not null,
  status public.dental_finding_status not null default 'untreated',
  notes text,
  recommendation text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete restrict,
  resolved_at timestamptz,
  constraint dental_findings_permanent_fdi
    check (
      dentition <> 'permanent'::public.dentition_type
      or tooth_number in (
        11, 12, 13, 14, 15, 16, 17, 18,
        21, 22, 23, 24, 25, 26, 27, 28,
        31, 32, 33, 34, 35, 36, 37, 38,
        41, 42, 43, 44, 45, 46, 47, 48
      )
    ),
  constraint dental_findings_notes_length
    check (
      notes is null
      or (char_length(notes) between 1 and 4000 and notes = btrim(notes))
    ),
  constraint dental_findings_recommendation_length
    check (
      recommendation is null
      or (
        char_length(recommendation) between 1 and 2000
        and recommendation = btrim(recommendation)
      )
    ),
  constraint dental_findings_other_requires_notes
    check (condition <> 'other'::public.dental_condition or notes is not null),
  constraint dental_findings_resolution_consistency
    check (
      (
        is_active
        and status <> 'resolved'::public.dental_finding_status
        and resolved_at is null
        and resolved_by is null
      )
      or (
        not is_active
        and status = 'resolved'::public.dental_finding_status
        and resolved_at is not null
        and resolved_by is not null
      )
    )
);

comment on table public.dental_findings is
  'Current dental findings. Multiple conditions may coexist per tooth; resolved findings remain stored.';
comment on column public.dental_findings.dentition is
  'Permanent dentition is supported now; the enum permits future primary-dentition extension.';

create table public.dental_finding_revisions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.dental_findings (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  dentition public.dentition_type not null,
  tooth_number smallint not null,
  condition public.dental_condition not null,
  status public.dental_finding_status not null,
  notes text,
  recommendation text,
  event_type public.dental_finding_event not null,
  changed_by uuid not null references auth.users (id) on delete restrict,
  changed_by_role public.app_role not null,
  changed_at timestamptz not null default now(),
  constraint dental_finding_revisions_notes_length
    check (notes is null or char_length(notes) between 1 and 4000),
  constraint dental_finding_revisions_recommendation_length
    check (recommendation is null or char_length(recommendation) between 1 and 2000)
);

comment on table public.dental_finding_revisions is
  'Immutable clinical snapshots written only by the dental finding history trigger.';

create unique index dental_findings_unique_active_condition_idx
  on public.dental_findings (patient_id, dentition, tooth_number, condition)
  where is_active;
create index dental_findings_patient_active_idx
  on public.dental_findings (patient_id, is_active, tooth_number, updated_at desc);
create index dental_findings_patient_tooth_idx
  on public.dental_findings (patient_id, tooth_number, created_at desc);
create index dental_findings_actor_updated_idx
  on public.dental_findings (updated_by, updated_at desc);
create index dental_finding_revisions_finding_time_idx
  on public.dental_finding_revisions (finding_id, changed_at desc);
create index dental_finding_revisions_patient_tooth_time_idx
  on public.dental_finding_revisions (patient_id, tooth_number, changed_at desc);

create function private.dental_finding_event_type(
  old_status public.dental_finding_status,
  new_status public.dental_finding_status,
  is_insert boolean
)
returns public.dental_finding_event
language sql
immutable
set search_path = ''
as $$
  select case
    when is_insert then 'created'::public.dental_finding_event
    when new_status = 'resolved'::public.dental_finding_status
      then 'resolved'::public.dental_finding_event
    when old_status is distinct from new_status
      then 'status_changed'::public.dental_finding_event
    else 'updated'::public.dental_finding_event
  end
$$;

create function private.record_dental_finding_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  event_name public.dental_finding_event;
begin
  if actor_id is null or actor_role is null then
    raise exception 'An active authenticated actor is required' using errcode = '42501';
  end if;

  event_name := private.dental_finding_event_type(
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    tg_op = 'INSERT'
  );

  insert into public.dental_finding_revisions (
    finding_id,
    patient_id,
    dentition,
    tooth_number,
    condition,
    status,
    notes,
    recommendation,
    event_type,
    changed_by,
    changed_by_role
  )
  values (
    new.id,
    new.patient_id,
    new.dentition,
    new.tooth_number,
    new.condition,
    new.status,
    new.notes,
    new.recommendation,
    event_name,
    actor_id,
    actor_role
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'dental_finding.' || event_name::text,
    'dental_finding',
    new.id,
    jsonb_build_object(
      'patient_id', new.patient_id,
      'tooth_number', new.tooth_number
    )
  );

  return new;
end;
$$;

create trigger dental_findings_record_revision
after insert or update on public.dental_findings
for each row execute function private.record_dental_finding_revision();

alter table public.dental_findings enable row level security;
alter table public.dental_finding_revisions enable row level security;

revoke all on table public.dental_findings from public, anon, authenticated;
revoke all on table public.dental_finding_revisions from public, anon, authenticated;
grant select on table public.dental_findings to authenticated;
grant select on table public.dental_finding_revisions to authenticated;

create policy dental_findings_select_active_staff
on public.dental_findings
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.patients as patient
    where patient.id = dental_findings.patient_id
  )
);

create policy dental_finding_revisions_select_active_staff
on public.dental_finding_revisions
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.patients as patient
    where patient.id = dental_finding_revisions.patient_id
  )
);

create function public.create_dental_finding(
  target_patient_id uuid,
  target_tooth_number smallint,
  target_condition public.dental_condition,
  target_status public.dental_finding_status,
  target_notes text default null,
  target_recommendation text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  finding_id uuid;
begin
  if actor_role is null then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if actor_role = 'assistant'::public.app_role
    and target_status not in (
      'untreated'::public.dental_finding_status,
      'monitoring'::public.dental_finding_status
    ) then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if target_status = 'resolved'::public.dental_finding_status then
    raise exception 'Use the resolve operation' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.patients as patient
    where patient.id = target_patient_id and patient.is_active
  ) then
    raise exception 'Patient unavailable' using errcode = '22023';
  end if;

  insert into public.dental_findings (
    patient_id,
    tooth_number,
    condition,
    status,
    notes,
    recommendation,
    created_by,
    updated_by
  )
  values (
    target_patient_id,
    target_tooth_number,
    target_condition,
    target_status,
    nullif(btrim(target_notes), ''),
    nullif(btrim(target_recommendation), ''),
    actor_id,
    actor_id
  )
  returning id into finding_id;

  return finding_id;
end;
$$;

create function public.update_dental_finding(
  target_patient_id uuid,
  target_finding_id uuid,
  target_condition public.dental_condition,
  target_status public.dental_finding_status,
  target_notes text default null,
  target_recommendation text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  affected_rows integer;
begin
  if actor_role is null then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if target_status = 'resolved'::public.dental_finding_status then
    raise exception 'Use the resolve operation' using errcode = '22023';
  end if;
  if actor_role = 'assistant'::public.app_role and (
    target_status not in (
      'untreated'::public.dental_finding_status,
      'monitoring'::public.dental_finding_status
    )
    or exists (
      select 1
      from public.dental_findings as finding
      where finding.id = target_finding_id
        and finding.status not in (
          'untreated'::public.dental_finding_status,
          'monitoring'::public.dental_finding_status
        )
    )
  ) then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.patients as patient
    where patient.id = target_patient_id and patient.is_active
  ) then
    raise exception 'Patient unavailable' using errcode = '22023';
  end if;

  update public.dental_findings
  set
    condition = target_condition,
    status = target_status,
    notes = nullif(btrim(target_notes), ''),
    recommendation = nullif(btrim(target_recommendation), ''),
    updated_by = actor_id,
    updated_at = now()
  where id = target_finding_id
    and patient_id = target_patient_id
    and is_active;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create function public.resolve_dental_finding(
  target_patient_id uuid,
  target_finding_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  affected_rows integer;
begin
  if actor_role is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.patients as patient
    where patient.id = target_patient_id and patient.is_active
  ) then
    raise exception 'Patient unavailable' using errcode = '22023';
  end if;

  update public.dental_findings
  set
    status = 'resolved'::public.dental_finding_status,
    is_active = false,
    resolved_by = actor_id,
    resolved_at = now(),
    updated_by = actor_id,
    updated_at = now()
  where id = target_finding_id
    and patient_id = target_patient_id
    and is_active;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function private.dental_finding_event_type(
  public.dental_finding_status,
  public.dental_finding_status,
  boolean
) from public;
revoke all on function private.record_dental_finding_revision() from public;
revoke all on function public.create_dental_finding(
  uuid,
  smallint,
  public.dental_condition,
  public.dental_finding_status,
  text,
  text
) from public, anon;
revoke all on function public.update_dental_finding(
  uuid,
  uuid,
  public.dental_condition,
  public.dental_finding_status,
  text,
  text
) from public, anon;
revoke all on function public.resolve_dental_finding(uuid, uuid) from public, anon;
grant execute on function public.create_dental_finding(
  uuid,
  smallint,
  public.dental_condition,
  public.dental_finding_status,
  text,
  text
) to authenticated;
grant execute on function public.update_dental_finding(
  uuid,
  uuid,
  public.dental_condition,
  public.dental_finding_status,
  text,
  text
) to authenticated;
grant execute on function public.resolve_dental_finding(uuid, uuid) to authenticated;

commit;
