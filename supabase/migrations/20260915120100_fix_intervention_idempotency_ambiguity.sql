begin;

create or replace function public.create_intervention(
  target_patient_id uuid,
  target_performed_at date,
  target_nature text,
  target_amount_due numeric,
  target_status public.intervention_status,
  target_idempotency_key uuid,
  target_notes text default null,
  target_teeth smallint[] default '{}',
  target_finding_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  new_intervention_id uuid;
  existing public.interventions%rowtype;
  expected integer;
  normalized_notes text := nullif(btrim(target_notes), '');
  requested_teeth smallint[];
  requested_findings uuid[];
  stored_teeth smallint[];
  stored_findings uuid[];
begin
  if actor_id is null or actor_role is null then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if target_idempotency_key is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;

  perform 1 from public.patients p
  where p.id = target_patient_id and p.is_active
  for update;
  if not found then
    raise exception 'Patient unavailable' using errcode = '22023';
  end if;

  if target_status = 'cancelled' then
    raise exception 'Use cancellation operation' using errcode = '22023';
  end if;
  if target_performed_at is null or target_nature is null or target_amount_due is null then
    raise exception 'Invalid intervention' using errcode = '22023';
  end if;
  if target_status = 'performed' and target_performed_at > current_date then
    raise exception 'Invalid performed date' using errcode = '22023';
  end if;
  if target_amount_due <> round(target_amount_due, 2) then
    raise exception 'Invalid money precision' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(target_teeth) t
    where t is null or t not in (
      11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
      31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48
    )
  ) then
    raise exception 'Invalid tooth' using errcode = '22023';
  end if;

  select count(distinct x) into expected
  from unnest(target_finding_ids) x where x is not null;
  if expected <> coalesce(cardinality(target_finding_ids), 0)
    or expected <> (
      select count(*) from public.dental_findings f
      where f.id = any(target_finding_ids) and f.patient_id = target_patient_id
    )
  then
    raise exception 'Invalid finding relation' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct t order by t), '{}'::smallint[])
  into requested_teeth from unnest(target_teeth) t;
  select coalesce(array_agg(distinct f order by f), '{}'::uuid[])
  into requested_findings from unnest(target_finding_ids) f;

  select i.* into existing from public.interventions i
  where i.idempotency_key = target_idempotency_key;
  if found then
    select coalesce(array_agg(it.tooth_number order by it.tooth_number), '{}'::smallint[])
    into stored_teeth from public.intervention_teeth it
    where it.intervention_id = existing.id;
    select coalesce(array_agg(inf.dental_finding_id order by inf.dental_finding_id), '{}'::uuid[])
    into stored_findings from public.intervention_findings inf
    where inf.intervention_id = existing.id;

    if existing.created_by = actor_id
      and existing.patient_id = target_patient_id
      and existing.performed_at = target_performed_at
      and existing.nature = btrim(target_nature)
      and existing.amount_due = target_amount_due
      and existing.status = target_status
      and existing.notes is not distinct from normalized_notes
      and stored_teeth = requested_teeth
      and stored_findings = requested_findings
    then
      return existing.id;
    end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;

  insert into public.interventions (
    patient_id, performed_at, nature, notes, amount_due, status,
    idempotency_key, created_by, updated_by
  ) values (
    target_patient_id, target_performed_at, btrim(target_nature), normalized_notes,
    target_amount_due, target_status, target_idempotency_key, actor_id, actor_id
  ) returning id into new_intervention_id;

  insert into public.intervention_teeth
  select new_intervention_id, t from unnest(requested_teeth) t;
  insert into public.intervention_findings
  select new_intervention_id, f from unnest(requested_findings) f;
  return new_intervention_id;
end
$$;

revoke all on function public.create_intervention(
  uuid,date,text,numeric,public.intervention_status,uuid,text,smallint[],uuid[]
) from public, anon, authenticated;
grant execute on function public.create_intervention(
  uuid,date,text,numeric,public.intervention_status,uuid,text,smallint[],uuid[]
) to authenticated;

commit;
