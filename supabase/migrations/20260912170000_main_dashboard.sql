begin;

create function public.get_main_dashboard(reference_time timestamptz default now())
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
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

  clinic_day := (reference_time at time zone 'Africa/Casablanca')::date;
  day_start := clinic_day::timestamp at time zone 'Africa/Casablanca';
  day_end := (clinic_day + 1)::timestamp at time zone 'Africa/Casablanca';

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
        where p.created_at >= date_trunc('month', day_start at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca'
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
$$;

revoke all on function public.get_main_dashboard(timestamptz) from public, anon;
grant execute on function public.get_main_dashboard(timestamptz) to authenticated;

commit;
