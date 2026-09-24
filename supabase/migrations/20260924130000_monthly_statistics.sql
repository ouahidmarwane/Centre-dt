begin;

create index appointments_statistics_idx on public.appointments (starts_at, status);
create index patients_created_at_idx on public.patients (created_at);

-- Doctor-only monthly figures (clinic time, Africa/Casablanca):
--   months:  target month, previous month and the 12 months ending with the target,
--            each with production, payments, new patients and appointment outcomes;
--   natures: production of the target month grouped by intervention wording, which the
--            application folds into care types.
-- The no-show rate is no_show / (completed + no_show): only visits whose outcome is known.
create function public.get_monthly_statistics(target_month date)
returns table(months jsonb, natures jsonb)
language plpgsql stable security definer set search_path = '' as $$
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
      (m::timestamp at time zone 'Africa/Casablanca') as start_at,
      ((m + interval '1 month')::timestamp at time zone 'Africa/Casablanca') as end_at
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
end $$;

revoke all on function public.get_monthly_statistics(date) from public, anon;
grant execute on function public.get_monthly_statistics(date) to authenticated;

commit;
