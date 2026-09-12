begin;

create type public.prescription_status as enum ('active','voided');

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  status public.prescription_status not null default 'active',
  issued_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  prescriber_name_snapshot text not null,
  clinic_name_snapshot text not null default 'Centre Dentaire Ouahid',
  patient_first_name_snapshot text not null,
  patient_last_name_snapshot text not null,
  patient_date_of_birth_snapshot date,
  notes text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint prescriptions_prescriber_name_length check (char_length(prescriber_name_snapshot) between 1 and 160 and prescriber_name_snapshot=btrim(prescriber_name_snapshot)),
  constraint prescriptions_clinic_name check (clinic_name_snapshot='Centre Dentaire Ouahid'),
  constraint prescriptions_patient_name_length check (char_length(patient_first_name_snapshot) between 1 and 120 and char_length(patient_last_name_snapshot) between 1 and 120),
  constraint prescriptions_notes_length check (notes is null or (char_length(notes) between 1 and 2000 and notes=btrim(notes))),
  constraint prescriptions_void_consistency check ((status='voided' and voided_at is not null and voided_by is not null and char_length(void_reason) between 5 and 500 and void_reason=btrim(void_reason)) or (status='active' and voided_at is null and voided_by is null and void_reason is null))
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete restrict,
  medication_name text not null,
  dosage text not null,
  route text,
  frequency text not null,
  duration text,
  instructions text,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint prescription_items_medication_length check (char_length(medication_name) between 1 and 160 and medication_name=btrim(medication_name)),
  constraint prescription_items_dosage_length check (char_length(dosage) between 1 and 160 and dosage=btrim(dosage)),
  constraint prescription_items_route_length check (route is null or (char_length(route) between 1 and 100 and route=btrim(route))),
  constraint prescription_items_frequency_length check (char_length(frequency) between 1 and 160 and frequency=btrim(frequency)),
  constraint prescription_items_duration_length check (duration is null or (char_length(duration) between 1 and 160 and duration=btrim(duration))),
  constraint prescription_items_instructions_length check (instructions is null or (char_length(instructions) between 1 and 1000 and instructions=btrim(instructions))),
  constraint prescription_items_position check (position between 1 and 20),
  unique(prescription_id,position)
);

create index prescriptions_patient_history_idx on public.prescriptions(patient_id,issued_at desc);
create index prescriptions_status_issued_idx on public.prescriptions(status,issued_at desc);

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
revoke all on table public.prescriptions,public.prescription_items from public,anon,authenticated;
grant select on table public.prescriptions,public.prescription_items to authenticated;

create policy prescriptions_select_staff on public.prescriptions for select to authenticated using ((select private.is_active_user()) and exists(select 1 from public.patients p where p.id=prescriptions.patient_id));
create policy prescription_items_select_staff on public.prescription_items for select to authenticated using ((select private.is_active_user()) and exists(select 1 from public.prescriptions rx where rx.id=prescription_items.prescription_id));

create function public.create_prescription(target_patient_id uuid,target_notes text,target_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); doctor_name text; patient_record record; prescription_id uuid; item jsonb; item_position integer:=0; allowed_keys text[]:=array['medication_name','dosage','route','frequency','duration','instructions'];
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  select full_name into doctor_name from public.profiles where id=actor and is_active and role='doctor';
  if doctor_name is null then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  select id,first_name,last_name,date_of_birth into patient_record from public.patients where id=target_patient_id and is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode='22023'; end if;
  if target_notes is not null and (char_length(btrim(target_notes))=0 or char_length(btrim(target_notes))>2000) then raise exception 'Invalid prescription notes' using errcode='22023'; end if;
  if jsonb_typeof(target_items)<>'array' or jsonb_array_length(target_items) not between 1 and 20 then raise exception 'Prescription requires 1 to 20 items' using errcode='22023'; end if;
  insert into public.prescriptions(patient_id,created_by,prescriber_name_snapshot,patient_first_name_snapshot,patient_last_name_snapshot,patient_date_of_birth_snapshot,notes)
  values(patient_record.id,actor,btrim(doctor_name),patient_record.first_name,patient_record.last_name,patient_record.date_of_birth,nullif(btrim(target_notes),'')) returning id into prescription_id;
  for item in select value from jsonb_array_elements(target_items) loop
    item_position:=item_position+1;
    if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) key where key<>all(allowed_keys))
      or jsonb_typeof(item->'medication_name') is distinct from 'string'
      or jsonb_typeof(item->'dosage') is distinct from 'string'
      or jsonb_typeof(item->'frequency') is distinct from 'string'
      or (item ? 'route' and jsonb_typeof(item->'route') is distinct from 'string')
      or (item ? 'duration' and jsonb_typeof(item->'duration') is distinct from 'string')
      or (item ? 'instructions' and jsonb_typeof(item->'instructions') is distinct from 'string')
      or char_length(btrim(item->>'medication_name')) not between 1 and 160
      or char_length(btrim(item->>'dosage')) not between 1 and 160
      or char_length(btrim(item->>'frequency')) not between 1 and 160
      or (item ? 'route' and nullif(btrim(item->>'route'),'') is not null and char_length(btrim(item->>'route'))>100)
      or (item ? 'duration' and nullif(btrim(item->>'duration'),'') is not null and char_length(btrim(item->>'duration'))>160)
      or (item ? 'instructions' and nullif(btrim(item->>'instructions'),'') is not null and char_length(btrim(item->>'instructions'))>1000)
    then raise exception 'Invalid prescription item' using errcode='22023'; end if;
    insert into public.prescription_items(prescription_id,medication_name,dosage,route,frequency,duration,instructions,position)
    values(prescription_id,btrim(item->>'medication_name'),btrim(item->>'dosage'),nullif(btrim(item->>'route'),''),btrim(item->>'frequency'),nullif(btrim(item->>'duration'),''),nullif(btrim(item->>'instructions'),''),item_position);
  end loop;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'prescription.created','prescription',prescription_id,jsonb_build_object('patient_id',target_patient_id,'item_count',item_position));
  return prescription_id;
end $$;

create function public.void_prescription(target_patient_id uuid,target_prescription_id uuid,target_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.app_role:=private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then raise exception 'Insufficient privilege' using errcode='42501'; end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 5 and 500 then raise exception 'Invalid reason' using errcode='22023'; end if;
  if not exists(select 1 from public.patients p where p.id=target_patient_id) then raise exception 'Patient unavailable' using errcode='22023'; end if;
  update public.prescriptions set status='voided',voided_at=now(),voided_by=actor,void_reason=btrim(target_reason) where id=target_prescription_id and patient_id=target_patient_id and status='active';
  get diagnostics affected=row_count;
  if affected=1 then insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(actor,'prescription.voided','prescription',target_prescription_id,jsonb_build_object('patient_id',target_patient_id)); end if;
  return affected=1;
end $$;

revoke all on function public.create_prescription(uuid,text,jsonb),public.void_prescription(uuid,uuid,text) from public,anon;
grant execute on function public.create_prescription(uuid,text,jsonb),public.void_prescription(uuid,uuid,text) to authenticated;

commit;
