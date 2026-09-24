begin;

-- Morocco left UTC+1 for good: since 2026-09-20 01:00 UTC the legal time is UTC+0
-- (IANA tzdata 2026c). Browsers, Node and Supabase still ship older tz data that keeps
-- Africa/Casablanca at UTC+1, which shows every clinic time one hour late. Clinic time is
-- therefore computed here: the historical Africa/Casablanca rules before the switch,
-- UTC afterwards. Every function that used the zone name now goes through these two.
create function private.clinic_local(instant timestamptz)
returns timestamp language sql immutable parallel safe set search_path = '' as $$
  select case when instant >= timestamptz '2026-09-20 01:00:00+00'
    then instant at time zone 'UTC' else instant at time zone 'Africa/Casablanca' end
$$;

-- Clinic wall-clock time to an instant (local times from 2026-09-20 01:00 are UTC+0).
create function private.clinic_instant(local_time timestamp)
returns timestamptz language sql immutable parallel safe set search_path = '' as $$
  select case when local_time >= timestamp '2026-09-20 01:00:00'
    then local_time at time zone 'UTC' else local_time at time zone 'Africa/Casablanca' end
$$;

revoke all on function private.clinic_local(timestamptz), private.clinic_instant(timestamp) from public, anon;
grant execute on function private.clinic_local(timestamptz), private.clinic_instant(timestamp) to authenticated;

CREATE OR REPLACE FUNCTION private.patient_balances(reference_time timestamp with time zone)
 RETURNS TABLE(patient_id uuid, outstanding numeric, unpaid_since date, last_payment_at timestamp with time zone, last_reminder_at timestamp with time zone, reminder_count bigint, is_due boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with received as (
    select p.patient_id, sum(p.amount) as total, max(p.received_at) as last_at
    from public.payments p where p.status = 'received' group by p.patient_id
  ), running as (
    select i.patient_id, i.performed_at,
      sum(i.amount_due) over (partition by i.patient_id order by i.performed_at, i.created_at, i.id) as cumulative_due,
      sum(i.amount_due) over (partition by i.patient_id) as total_due
    from public.interventions i
    join public.patients pt on pt.id = i.patient_id and pt.is_active
    where i.status = 'performed'
  ), balances as (
    select r.patient_id, max(r.total_due) - coalesce(max(rc.total), 0) as outstanding,
      min(r.performed_at) filter (where r.cumulative_due > coalesce(rc.total, 0)) as unpaid_since,
      max(rc.last_at) as last_payment_at
    from running r left join received rc on rc.patient_id = r.patient_id
    group by r.patient_id
  ), reminders as (
    select pr.patient_id, max(pr.handled_at) as last_at, count(*) as total
    from public.payment_reminders pr group by pr.patient_id
  )
  select b.patient_id, b.outstanding::numeric(12,2), b.unpaid_since, b.last_payment_at, rm.last_at, coalesce(rm.total, 0),
    b.unpaid_since <= (private.clinic_local(reference_time)::date - 7)
      and (rm.last_at is null or rm.last_at <= reference_time - interval '14 days')
  from balances b left join reminders rm on rm.patient_id = b.patient_id
  where b.outstanding > 0
$function$
;

CREATE OR REPLACE FUNCTION public.claim_due_telegram_appointment_reminders(reference_time timestamp with time zone DEFAULT now())
 RETURNS TABLE(notification_id uuid, appointment_id uuid, patient_id uuid, patient_first_name text, starts_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.appointment_reminder_notifications (appointment_id, reminder_type)
  select a.id, 'two_hours_before'::public.appointment_reminder_type
  from public.appointments a
  join public.patients p on p.id = a.patient_id and p.is_active
  where a.status = 'scheduled'
    and a.starts_at > reference_time
    and reference_time >= greatest(
      a.starts_at - interval '2 hours',
      private.clinic_instant(private.clinic_local(a.starts_at)::date + time '09:00')
    )
  on conflict (appointment_id, reminder_type) do nothing;

  return query
  with candidates as (
    select n.id
    from public.appointment_reminder_notifications n
    join public.appointments a on a.id = n.appointment_id
    join public.patients p on p.id = a.patient_id and p.is_active
    where n.reminder_type = 'two_hours_before'
      and n.status = 'pending'
      and n.next_attempt_at <= reference_time
      and (n.locked_until is null or n.locked_until < reference_time)
      and a.status = 'scheduled'
      and a.starts_at > reference_time
      and reference_time >= greatest(
        a.starts_at - interval '2 hours',
        private.clinic_instant(private.clinic_local(a.starts_at)::date + time '09:00')
      )
    order by a.starts_at, n.created_at
    for update of n skip locked
  ), claimed as (
    update public.appointment_reminder_notifications n
    set attempts = n.attempts + 1,
        locked_until = reference_time + interval '10 minutes',
        updated_at = reference_time
    from candidates c
    where n.id = c.id
    returning n.id, n.appointment_id
  )
  select c.id, a.id, a.patient_id, p.first_name, a.starts_at
  from claimed c
  join public.appointments a on a.id = c.appointment_id
  join public.patients p on p.id = a.patient_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_staff_digests(reference_time timestamp with time zone DEFAULT now())
 RETURNS TABLE(notification_id uuid, kind text, item_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare today_clinic date := private.clinic_local(reference_time)::date; digest_kind text; total integer;
begin
  -- Digests start at the 09:00 opening, once per day and kind.
  if private.clinic_local(reference_time)::time >= time '09:00' then
    foreach digest_kind in array array['unpaid_payments', 'low_stock'] loop
      total := private.digest_item_count(digest_kind, reference_time);
      if total > 0 then
        insert into public.staff_digest_notifications (kind, clinic_day, item_count) values (digest_kind, today_clinic, total)
        on conflict on constraint staff_digest_notifications_once_per_day do nothing;
      end if;
    end loop;
  end if;

  return query
  with candidates as (
    select n.id from public.staff_digest_notifications n
    where n.status = 'pending' and n.clinic_day = today_clinic and n.next_attempt_at <= reference_time
      and (n.locked_until is null or n.locked_until < reference_time)
    for update skip locked
  ), claimed as (
    update public.staff_digest_notifications n set attempts = n.attempts + 1, locked_until = reference_time + interval '10 minutes'
    from candidates c where n.id = c.id
    returning n.id, n.kind, n.item_count
  )
  select c.id, c.kind, c.item_count from claimed c;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_invoice(target_patient_id uuid, target_intervention_ids uuid[], target_idempotency_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  actor_name text;
  patient_record record;
  invoice_id uuid;
  existing_record record;
  item_count integer;
  calculated_total numeric(12,2);
  issued_year smallint := extract(year from private.clinic_local(now()))::smallint;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.create_payment_receipt(target_patient_id uuid, target_payment_id uuid, target_idempotency_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  actor_name text;
  patient_record record;
  payment_record record;
  existing_record record;
  receipt_id uuid;
  issued_year smallint := extract(year from private.clinic_local(now()))::smallint;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.get_accounting_dashboard(target_start_date date, target_end_date date, target_bucket text)
 RETURNS TABLE(production numeric, received numeric, period_net numeric, current_outstanding numeric, active_patient_count bigint, intervention_count bigint, payment_count bigint, series jsonb, payment_methods jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  start_at timestamptz;
  end_at timestamptz;
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  if target_start_date is null
    or target_end_date is null
    or target_start_date >= target_end_date
    or target_start_date < date '2020-01-01'
    or target_end_date > (target_start_date + interval '5 years')::date
  then
    raise exception 'Invalid accounting period' using errcode = '22023';
  end if;

  if target_bucket not in ('day', 'month')
    or (target_bucket = 'day' and target_end_date > target_start_date + 370)
  then
    raise exception 'Invalid accounting bucket' using errcode = '22023';
  end if;

  start_at := private.clinic_instant(target_start_date::timestamp);
  end_at := private.clinic_instant(target_end_date::timestamp);

  return query
  with period_interventions as (
    select i.patient_id, i.performed_at, i.amount_due
    from public.interventions i
    where i.status = 'performed'
      and i.performed_at >= target_start_date
      and i.performed_at < target_end_date
  ),
  period_payments as (
    select p.patient_id, p.received_at, p.amount, p.method
    from public.payments p
    where p.status = 'received'
      and p.received_at >= start_at
      and p.received_at < end_at
  ),
  period_totals as (
    select
      coalesce((select sum(i.amount_due) from period_interventions i), 0)::numeric(12,2) as production,
      coalesce((select sum(p.amount) from period_payments p), 0)::numeric(12,2) as received,
      (select count(*) from period_interventions)::bigint as intervention_count,
      (select count(*) from period_payments)::bigint as payment_count,
      (
        select count(distinct activity.patient_id)::bigint
        from (
          select i.patient_id from period_interventions i
          union all
          select p.patient_id from period_payments p
        ) activity
      ) as active_patient_count
  ),
  global_totals as (
    select
      coalesce((select sum(i.amount_due) from public.interventions i where i.status = 'performed'), 0)::numeric(12,2) as production,
      coalesce((select sum(p.amount) from public.payments p where p.status = 'received'), 0)::numeric(12,2) as received
  )
  select
    totals.production,
    totals.received,
    (totals.production - totals.received)::numeric(12,2),
    (global_values.production - global_values.received)::numeric(12,2),
    totals.active_patient_count,
    totals.intervention_count,
    totals.payment_count,
    case target_bucket
      when 'day' then (
        with buckets as (
          select day_value::date as bucket_start
          from pg_catalog.generate_series(
            target_start_date::timestamp,
            (target_end_date - 1)::timestamp,
            interval '1 day'
          ) day_value
        ),
        production_by_bucket as (
          select i.performed_at as bucket_start, sum(i.amount_due)::numeric(12,2) as amount
          from period_interventions i
          group by i.performed_at
        ),
        received_by_bucket as (
          select private.clinic_local(p.received_at)::date as bucket_start,
            sum(p.amount)::numeric(12,2) as amount
          from period_payments p
          group by private.clinic_local(p.received_at)::date
        )
        select jsonb_agg(
          jsonb_build_object(
            'bucket_start', b.bucket_start,
            'production', coalesce(production_values.amount, 0)::numeric(12,2),
            'received', coalesce(received_values.amount, 0)::numeric(12,2)
          ) order by b.bucket_start
        )
        from buckets b
        left join production_by_bucket production_values using (bucket_start)
        left join received_by_bucket received_values using (bucket_start)
      )
      else (
        with buckets as (
          select month_value::date as bucket_start
          from pg_catalog.generate_series(
            date_trunc('month', target_start_date::timestamp),
            date_trunc('month', (target_end_date - 1)::timestamp),
            interval '1 month'
          ) month_value
        ),
        production_by_bucket as (
          select date_trunc('month', i.performed_at::timestamp)::date as bucket_start,
            sum(i.amount_due)::numeric(12,2) as amount
          from period_interventions i
          group by date_trunc('month', i.performed_at::timestamp)::date
        ),
        received_by_bucket as (
          select date_trunc('month', private.clinic_local(p.received_at))::date as bucket_start,
            sum(p.amount)::numeric(12,2) as amount
          from period_payments p
          group by date_trunc('month', private.clinic_local(p.received_at))::date
        )
        select jsonb_agg(
          jsonb_build_object(
            'bucket_start', b.bucket_start,
            'production', coalesce(production_values.amount, 0)::numeric(12,2),
            'received', coalesce(received_values.amount, 0)::numeric(12,2)
          ) order by b.bucket_start
        )
        from buckets b
        left join production_by_bucket production_values using (bucket_start)
        left join received_by_bucket received_values using (bucket_start)
      )
    end,
    (
      with methods as (
        select method_value as method
        from unnest(enum_range(null::public.payment_method)) method_value
      ),
      received_by_method as (
        select p.method, sum(p.amount)::numeric(12,2) as amount, count(*)::bigint as payment_count
        from period_payments p
        group by p.method
      )
      select jsonb_agg(
        jsonb_build_object(
          'method', methods.method,
          'amount', coalesce(values_by_method.amount, 0)::numeric(12,2),
          'payment_count', coalesce(values_by_method.payment_count, 0)::bigint
        ) order by methods.method::text
      )
      from methods
      left join received_by_method values_by_method using (method)
    )
  from period_totals totals
  cross join global_totals global_values;
end
$function$
;

CREATE OR REPLACE FUNCTION public.get_main_dashboard(reference_time timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  clinic_day date;
  day_start timestamptz;
  day_end timestamptz;
  result jsonb;
begin
  if actor is null or actor_role is null then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  if reference_time is null then
    raise exception 'Invalid reference time' using errcode = '22023';
  end if;

  clinic_day := private.clinic_local(reference_time)::date;
  day_start := private.clinic_instant(clinic_day::timestamp);
  day_end := private.clinic_instant((clinic_day + 1)::timestamp);

  with today_appointments as (
    select a.id, a.patient_id, a.title, a.starts_at, a.status,
      concat_ws(' ', p.first_name, p.last_name) as patient_name
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.starts_at >= day_start and a.starts_at < day_end
  ),
  today_counts as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'scheduled')::bigint as scheduled,
      count(*) filter (where status = 'completed')::bigint as completed,
      count(*) filter (where status = 'cancelled')::bigint as cancelled,
      count(*) filter (where status = 'no_show')::bigint as no_show
    from today_appointments
  ),
  today_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', row_value.id,
      'patient_id', row_value.patient_id,
      'patient_name', row_value.patient_name,
      'title', row_value.title,
      'starts_at', row_value.starts_at,
      'status', row_value.status
    ) order by row_value.starts_at), '[]'::jsonb) as items
    from (
      select id, patient_id, patient_name, title, starts_at, status
      from today_appointments
      order by starts_at
      limit 7
    ) row_value
  ),
  upcoming_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', row_value.id,
      'patient_id', row_value.patient_id,
      'patient_name', row_value.patient_name,
      'title', row_value.title,
      'starts_at', row_value.starts_at
    ) order by row_value.starts_at), '[]'::jsonb) as items
    from (
      select a.id, a.patient_id, concat_ws(' ', p.first_name, p.last_name) as patient_name,
        a.title, a.starts_at
      from public.appointments a
      join public.patients p on p.id = a.patient_id and p.is_active
      where a.status = 'scheduled' and a.starts_at > reference_time
      order by a.starts_at
      limit 5
    ) row_value
  ),
  patient_counts as (
    select
      count(*) filter (where p.is_active)::bigint as active,
      count(*) filter (
        where p.created_at >= private.clinic_instant(date_trunc('month', private.clinic_local(day_start)))
          and p.created_at < day_end
      )::bigint as created_this_month
    from public.patients p
  ),
  treatment_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label', treatment.label,
      'count', treatment.intervention_count
    ) order by treatment.intervention_count desc, treatment.label), '[]'::jsonb) as items
    from (
      select min(i.nature) as label, count(*)::bigint as intervention_count
      from public.interventions i
      where i.status = 'performed'
        and i.performed_at >= (date_trunc('month', clinic_day::timestamp) - interval '5 months')::date
        and i.performed_at <= clinic_day
      group by lower(btrim(i.nature))
      order by intervention_count desc, min(i.nature)
      limit 4
    ) treatment
  )
  select jsonb_build_object(
    'generated_at', reference_time,
    'clinic_date', clinic_day,
    'patients', jsonb_build_object(
      'active', patient_counts.active,
      'created_this_month', patient_counts.created_this_month
    ),
    'appointments', jsonb_build_object(
      'total', today_counts.total,
      'scheduled', today_counts.scheduled,
      'completed', today_counts.completed,
      'cancelled', today_counts.cancelled,
      'no_show', today_counts.no_show,
      'today', today_rows.items,
      'upcoming', upcoming_rows.items
    ),
    'reminder_count', (
      select count(*)::bigint from public.get_due_appointment_reminders(reference_time)
    ),
    'treatments', treatment_rows.items
  )
  into result
  from today_counts
  cross join today_rows
  cross join upcoming_rows
  cross join patient_counts
  cross join treatment_rows;

  return result;
end
$function$
;

CREATE OR REPLACE FUNCTION public.get_monthly_statistics(target_month date)
 RETURNS TABLE(months jsonb, natures jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  target_start date := date_trunc('month', target_month)::date;
  first_month date := (date_trunc('month', target_month) - interval '11 months')::date;
begin
  if actor is null or actor_role is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;
  if target_month is null or target_month < date '2020-01-01' or target_month > (current_date + interval '1 year')::date then
    raise exception 'Invalid month' using errcode = '22023';
  end if;

  return query
  with calendar as (
    select m::date as month_start, (m + interval '1 month')::date as month_end,
      private.clinic_instant(m::timestamp) as start_at,
      private.clinic_instant((m + interval '1 month')::timestamp) as end_at
    from generate_series(first_month, target_start, interval '1 month') m
  ), figures as (
    select c.month_start,
      (select coalesce(sum(i.amount_due), 0) from public.interventions i where i.status = 'performed' and i.performed_at >= c.month_start and i.performed_at < c.month_end) as production,
      (select coalesce(sum(p.amount), 0) from public.payments p where p.status = 'received' and p.received_at >= c.start_at and p.received_at < c.end_at) as received,
      (select count(*) from public.patients pt where pt.created_at >= c.start_at and pt.created_at < c.end_at) as new_patients,
      (select count(*) from public.appointments a where a.status = 'completed' and a.starts_at >= c.start_at and a.starts_at < c.end_at) as completed,
      (select count(*) from public.appointments a where a.status = 'no_show' and a.starts_at >= c.start_at and a.starts_at < c.end_at) as no_show,
      (select count(*) from public.appointments a where a.status = 'cancelled' and a.starts_at >= c.start_at and a.starts_at < c.end_at) as cancelled,
      (select count(*) from public.appointments a where a.status = 'scheduled' and a.starts_at >= c.start_at and a.starts_at < c.end_at) as scheduled
    from calendar c
  )
  select
    (select jsonb_agg(jsonb_build_object(
      'month', to_char(f.month_start, 'YYYY-MM'), 'production', f.production, 'received', f.received, 'new_patients', f.new_patients,
      'completed', f.completed, 'no_show', f.no_show, 'cancelled', f.cancelled, 'scheduled', f.scheduled
    ) order by f.month_start) from figures f),
    coalesce((
      select jsonb_agg(jsonb_build_object('nature', n.nature, 'amount', n.amount, 'count', n.total) order by n.amount desc)
      from (
        select lower(btrim(i.nature)) as nature, sum(i.amount_due) as amount, count(*) as total
        from public.interventions i
        where i.status = 'performed' and i.performed_at >= target_start and i.performed_at < (target_start + interval '1 month')::date
        group by lower(btrim(i.nature))
      ) n
    ), '[]'::jsonb);
end $function$
;

commit;
