begin;

create index interventions_accounting_performed_date_idx
on public.interventions (performed_at, patient_id)
include (amount_due)
where status = 'performed';

create index payments_accounting_received_date_idx
on public.payments (received_at, patient_id)
include (amount, method)
where status = 'received';

create function public.get_accounting_dashboard(
  target_start_date date,
  target_end_date date,
  target_bucket text
)
returns table (
  production numeric,
  received numeric,
  period_net numeric,
  current_outstanding numeric,
  active_patient_count bigint,
  intervention_count bigint,
  payment_count bigint,
  series jsonb,
  payment_methods jsonb
)
language plpgsql
security definer
stable
set search_path = ''
as $$
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

  start_at := target_start_date::timestamp at time zone 'Africa/Casablanca';
  end_at := target_end_date::timestamp at time zone 'Africa/Casablanca';

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
          select (p.received_at at time zone 'Africa/Casablanca')::date as bucket_start,
            sum(p.amount)::numeric(12,2) as amount
          from period_payments p
          group by (p.received_at at time zone 'Africa/Casablanca')::date
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
          select date_trunc('month', p.received_at at time zone 'Africa/Casablanca')::date as bucket_start,
            sum(p.amount)::numeric(12,2) as amount
          from period_payments p
          group by date_trunc('month', p.received_at at time zone 'Africa/Casablanca')::date
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
$$;

revoke all on function public.get_accounting_dashboard(date, date, text) from public, anon;
grant execute on function public.get_accounting_dashboard(date, date, text) to authenticated;

commit;
