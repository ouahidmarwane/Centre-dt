begin;

create table public.appointment_reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  reminder_type public.appointment_reminder_type not null,
  status text not null default 'pending' check (status in ('pending', 'sent')),
  attempts integer not null default 0 check (attempts >= 0),
  locked_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_reminder_notifications_once unique (appointment_id, reminder_type),
  constraint appointment_reminder_notifications_delivery_consistency check (
    (status = 'sent' and sent_at is not null and locked_until is null)
    or (status = 'pending' and sent_at is null)
  )
);

create index appointment_reminder_notifications_pending_idx
  on public.appointment_reminder_notifications (status, next_attempt_at)
  where status = 'pending';

alter table public.appointment_reminder_notifications enable row level security;
revoke all on table public.appointment_reminder_notifications from public, anon, authenticated;

create function public.claim_due_telegram_appointment_reminders(reference_time timestamptz default now())
returns table(notification_id uuid, appointment_id uuid, patient_id uuid, patient_first_name text, starts_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  insert into public.appointment_reminder_notifications (appointment_id, reminder_type)
  select a.id, 'two_hours_before'::public.appointment_reminder_type
  from public.appointments a
  join public.patients p on p.id = a.patient_id and p.is_active
  where a.status = 'scheduled'
    and a.starts_at > reference_time
    and reference_time >= greatest(
      a.starts_at - interval '2 hours',
      ((a.starts_at at time zone 'Africa/Casablanca')::date + time '09:00') at time zone 'Africa/Casablanca'
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
        ((a.starts_at at time zone 'Africa/Casablanca')::date + time '09:00') at time zone 'Africa/Casablanca'
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
$$;

create function public.complete_telegram_appointment_reminder(target_notification_id uuid, delivered boolean, failure_message text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if delivered then
    update public.appointment_reminder_notifications set status = 'sent', sent_at = now(), locked_until = null, last_error = null, updated_at = now()
    where id = target_notification_id and status = 'pending';
  else
    update public.appointment_reminder_notifications set locked_until = null, next_attempt_at = now() + interval '5 minutes', last_error = left(coalesce(failure_message, 'Telegram delivery failed'), 300), updated_at = now()
    where id = target_notification_id and status = 'pending';
  end if;
  return found;
end;
$$;

revoke all on function public.claim_due_telegram_appointment_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.complete_telegram_appointment_reminder(uuid, boolean, text) from public, anon, authenticated;

commit;
