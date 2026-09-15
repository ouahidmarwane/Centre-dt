begin;

alter table public.prescriptions add column idempotency_key uuid;

-- Existing immutable prescriptions receive their own existing identifier as
-- an opaque replay key. IDs, snapshots, items and audit history are untouched.
update public.prescriptions
set idempotency_key = id
where idempotency_key is null;

alter table public.prescriptions
  alter column idempotency_key set not null,
  add constraint prescriptions_idempotency_key_key unique (idempotency_key);

comment on column public.prescriptions.idempotency_key is
  'Opaque request key used to make prescription creation replay-safe.';

create function public.create_prescription(
  target_patient_id uuid,
  target_notes text,
  target_items jsonb,
  target_idempotency_key uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  doctor_name text;
  patient_record record;
  new_prescription_id uuid;
  existing public.prescriptions%rowtype;
  item jsonb;
  item_position integer := 0;
  allowed_keys text[] := array[
    'medication_name','dosage','route','frequency','duration','instructions'
  ];
  normalized_notes text := nullif(btrim(target_notes), '');
  normalized_items jsonb := '[]'::jsonb;
  stored_items jsonb;
begin
  if actor_id is null or actor_role is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if target_idempotency_key is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;

  select p.full_name into doctor_name
  from public.profiles p
  where p.id = actor_id and p.is_active and p.role = 'doctor';
  if doctor_name is null then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  select p.id, p.first_name, p.last_name, p.date_of_birth into patient_record
  from public.patients p
  where p.id = target_patient_id and p.is_active
  for update;
  if not found then
    raise exception 'Patient unavailable' using errcode = '22023';
  end if;

  if target_notes is not null
    and (char_length(btrim(target_notes)) = 0 or char_length(btrim(target_notes)) > 2000)
  then
    raise exception 'Invalid prescription notes' using errcode = '22023';
  end if;
  if target_items is null or jsonb_typeof(target_items) is distinct from 'array' then
    raise exception 'Prescription requires 1 to 20 items' using errcode = '22023';
  end if;
  if jsonb_array_length(target_items) not between 1 and 20 then
    raise exception 'Prescription requires 1 to 20 items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(target_items) loop
    item_position := item_position + 1;
    if jsonb_typeof(item) is distinct from 'object' then
      raise exception 'Invalid prescription item' using errcode = '22023';
    end if;
    if exists (
        select 1 from jsonb_object_keys(item) item_key
        where item_key <> all(allowed_keys)
      )
      or jsonb_typeof(item->'medication_name') is distinct from 'string'
      or jsonb_typeof(item->'dosage') is distinct from 'string'
      or jsonb_typeof(item->'frequency') is distinct from 'string'
      or (item ? 'route' and jsonb_typeof(item->'route') is distinct from 'string')
      or (item ? 'duration' and jsonb_typeof(item->'duration') is distinct from 'string')
      or (item ? 'instructions' and jsonb_typeof(item->'instructions') is distinct from 'string')
      or char_length(btrim(item->>'medication_name')) not between 1 and 160
      or char_length(btrim(item->>'dosage')) not between 1 and 160
      or char_length(btrim(item->>'frequency')) not between 1 and 160
      or (item ? 'route' and nullif(btrim(item->>'route'), '') is not null
        and char_length(btrim(item->>'route')) > 100)
      or (item ? 'duration' and nullif(btrim(item->>'duration'), '') is not null
        and char_length(btrim(item->>'duration')) > 160)
      or (item ? 'instructions' and nullif(btrim(item->>'instructions'), '') is not null
        and char_length(btrim(item->>'instructions')) > 1000)
    then
      raise exception 'Invalid prescription item' using errcode = '22023';
    end if;

    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'medication_name', btrim(item->>'medication_name'),
      'dosage', btrim(item->>'dosage'),
      'route', nullif(btrim(item->>'route'), ''),
      'frequency', btrim(item->>'frequency'),
      'duration', nullif(btrim(item->>'duration'), ''),
      'instructions', nullif(btrim(item->>'instructions'), '')
    ));
  end loop;

  select rx.* into existing
  from public.prescriptions rx
  where rx.idempotency_key = target_idempotency_key;
  if found then
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'medication_name', pi.medication_name,
        'dosage', pi.dosage,
        'route', pi.route,
        'frequency', pi.frequency,
        'duration', pi.duration,
        'instructions', pi.instructions
      ) order by pi.position),
      '[]'::jsonb
    ) into stored_items
    from public.prescription_items pi
    where pi.prescription_id = existing.id;

    if existing.created_by = actor_id
      and existing.patient_id = target_patient_id
      and existing.notes is not distinct from normalized_notes
      and stored_items = normalized_items
    then
      return existing.id;
    end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;

  insert into public.prescriptions (
    patient_id, created_by, prescriber_name_snapshot,
    patient_first_name_snapshot, patient_last_name_snapshot,
    patient_date_of_birth_snapshot, notes, idempotency_key
  ) values (
    patient_record.id, actor_id, btrim(doctor_name),
    patient_record.first_name, patient_record.last_name,
    patient_record.date_of_birth, normalized_notes, target_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into new_prescription_id;

  -- A concurrent transaction may have committed the same key after the
  -- earlier replay lookup. The unique index serializes that race; once the
  -- conflict wait ends, compare the now-visible committed payload.
  if new_prescription_id is null then
    select rx.* into existing
    from public.prescriptions rx
    where rx.idempotency_key = target_idempotency_key;

    select coalesce(
      jsonb_agg(jsonb_build_object(
        'medication_name', pi.medication_name,
        'dosage', pi.dosage,
        'route', pi.route,
        'frequency', pi.frequency,
        'duration', pi.duration,
        'instructions', pi.instructions
      ) order by pi.position),
      '[]'::jsonb
    ) into stored_items
    from public.prescription_items pi
    where pi.prescription_id = existing.id;

    if existing.created_by = actor_id
      and existing.patient_id = target_patient_id
      and existing.notes is not distinct from normalized_notes
      and stored_items = normalized_items
    then
      return existing.id;
    end if;
    raise exception 'Idempotency key conflict' using errcode = '23505';
  end if;

  insert into public.prescription_items (
    prescription_id, medication_name, dosage, route,
    frequency, duration, instructions, position
  )
  select
    new_prescription_id,
    normalized_item->>'medication_name',
    normalized_item->>'dosage',
    normalized_item->>'route',
    normalized_item->>'frequency',
    normalized_item->>'duration',
    normalized_item->>'instructions',
    item_ordinality::smallint
  from jsonb_array_elements(normalized_items) with ordinality
    as ordered_items(normalized_item, item_ordinality);

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'prescription.created', 'prescription', new_prescription_id,
    jsonb_build_object('patient_id', target_patient_id, 'item_count', item_position)
  );
  return new_prescription_id;
end
$$;

revoke all on function public.create_prescription(uuid,text,jsonb)
from public, anon, authenticated;

revoke all on function public.create_prescription(uuid,text,jsonb,uuid)
from public, anon, authenticated;
grant execute on function public.create_prescription(uuid,text,jsonb,uuid)
to authenticated;

commit;
