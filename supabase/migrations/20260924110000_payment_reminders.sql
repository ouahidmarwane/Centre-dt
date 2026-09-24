begin;

-- Unpaid-balance follow-up, on the same model as appointment reminders: the app lists
-- the patients to remind, staff send a prefilled WhatsApp message, then confirm it here.
-- A reminder is due when a balance has been unpaid for 7 days (the oldest performed
-- intervention not covered by payments, oldest first) and nobody reminded the patient
-- during the last 14 days.
create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  outstanding_amount numeric(12,2) not null,
  handled_by uuid not null references auth.users(id) on delete restrict,
  handled_at timestamptz not null default now(),
  constraint payment_reminders_amount check (outstanding_amount > 0)
);
create index payment_reminders_patient_idx on public.payment_reminders (patient_id, handled_at desc);

alter table public.payment_reminders enable row level security;
revoke all on table public.payment_reminders from public, anon, authenticated;
grant select on table public.payment_reminders to authenticated;
create policy payment_reminders_select_staff on public.payment_reminders for select to authenticated
using ((select private.is_active_user()) and exists (select 1 from public.patients p where p.id = payment_reminders.patient_id));

-- Internal: balances of active patients. Not callable by clients.
create function private.patient_balances(reference_time timestamptz)
returns table(patient_id uuid, outstanding numeric, unpaid_since date, last_payment_at timestamptz, last_reminder_at timestamptz, reminder_count bigint, is_due boolean)
language sql stable security definer set search_path = '' as $$
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
    b.unpaid_since <= ((reference_time at time zone 'Africa/Casablanca')::date - 7)
      and (rm.last_at is null or rm.last_at <= reference_time - interval '14 days')
  from balances b left join reminders rm on rm.patient_id = b.patient_id
  where b.outstanding > 0
$$;
revoke all on function private.patient_balances(timestamptz) from public, anon, authenticated;

create function public.get_payment_followup(reference_time timestamptz default now())
returns table(patient_id uuid, first_name text, last_name text, phone text, outstanding numeric, unpaid_since date, last_payment_at timestamptz, last_reminder_at timestamptz, reminder_count bigint, is_due boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.current_user_role() is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  return query
    select b.patient_id, p.first_name, p.last_name, p.phone, b.outstanding, b.unpaid_since, b.last_payment_at, b.last_reminder_at, b.reminder_count, b.is_due
    from private.patient_balances(reference_time) b join public.patients p on p.id = b.patient_id
    order by b.is_due desc, b.unpaid_since, b.outstanding desc;
end $$;

create function public.mark_payment_reminder_handled(target_patient_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); balance record;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  perform 1 from public.patients p where p.id = target_patient_id and p.is_active for update;
  if not found then raise exception 'Patient unavailable' using errcode = '22023'; end if;
  select * into balance from private.patient_balances(now()) b where b.patient_id = target_patient_id;
  if not found or not balance.is_due then return false; end if;
  insert into public.payment_reminders (patient_id, outstanding_amount, handled_by) values (target_patient_id, balance.outstanding, actor);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.reminder_handled', 'patient', target_patient_id, jsonb_build_object('patient_id', target_patient_id, 'reminder_number', balance.reminder_count + 1));
  return true;
end $$;

revoke all on function public.get_payment_followup(timestamptz), public.mark_payment_reminder_handled(uuid) from public, anon;
grant execute on function public.get_payment_followup(timestamptz), public.mark_payment_reminder_handled(uuid) to authenticated;

-- Daily Telegram digests for the team (service role only, like appointment reminders).
-- One row per kind and clinic day; retried every 5 minutes on delivery failure.
create table public.staff_digest_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  clinic_day date not null,
  item_count integer not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  locked_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint staff_digest_notifications_kind check (kind in ('unpaid_payments', 'low_stock')),
  constraint staff_digest_notifications_count check (item_count > 0),
  constraint staff_digest_notifications_status check (status in ('pending', 'sent')),
  constraint staff_digest_notifications_delivery check ((status = 'sent' and sent_at is not null and locked_until is null) or (status = 'pending' and sent_at is null)),
  constraint staff_digest_notifications_once_per_day unique (kind, clinic_day)
);
alter table public.staff_digest_notifications enable row level security;
revoke all on table public.staff_digest_notifications from public, anon, authenticated;

-- Counts only: no patient name, phone or amount leaves the database through Telegram.
create function private.digest_item_count(digest_kind text, reference_time timestamptz)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if digest_kind = 'unpaid_payments' then
    return (select count(*) from private.patient_balances(reference_time) b where b.is_due);
  end if;
  return 0;
end $$;
revoke all on function private.digest_item_count(text, timestamptz) from public, anon, authenticated;

create function public.claim_staff_digests(reference_time timestamptz default now())
returns table(notification_id uuid, kind text, item_count integer)
language plpgsql security definer set search_path = '' as $$
declare today_clinic date := (reference_time at time zone 'Africa/Casablanca')::date; digest_kind text; total integer;
begin
  -- Digests start at the 09:00 opening, once per day and kind.
  if (reference_time at time zone 'Africa/Casablanca')::time >= time '09:00' then
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
end $$;

create function public.complete_staff_digest(target_notification_id uuid, delivered boolean, failure_message text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if delivered then
    update public.staff_digest_notifications set status = 'sent', sent_at = now(), locked_until = null, last_error = null
    where id = target_notification_id and status = 'pending';
  else
    update public.staff_digest_notifications set locked_until = null, next_attempt_at = now() + interval '5 minutes', last_error = left(coalesce(failure_message, 'Telegram delivery failed'), 300)
    where id = target_notification_id and status = 'pending';
  end if;
  return found;
end $$;

revoke all on function public.claim_staff_digests(timestamptz), public.complete_staff_digest(uuid, boolean, text) from public, anon, authenticated;

commit;
