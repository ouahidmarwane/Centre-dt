begin;

alter table public.security_events
  add constraint security_events_controlled_type
  check (event_type in (
    'auth.login_succeeded',
    'auth.logout',
    'auth.inactive_account_denied',
    'security.rate_limited',
    'security.ip_policy_added',
    'security.ip_policy_disabled',
    'security.user_deactivated',
    'security.user_reactivated'
  ));

alter table public.blocked_ips
  add constraint blocked_ips_single_address
  check (((family(ip_address) = 4) and (masklen(ip_address) = 32))
    or ((family(ip_address) = 6) and (masklen(ip_address) = 128)));

create table private.security_rate_limit_buckets (
  action text not null,
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  expires_at timestamptz not null,
  primary key (action, bucket_key, window_started_at),
  constraint security_rate_limit_action_length check (char_length(action) between 3 and 80),
  constraint security_rate_limit_key_length check (char_length(bucket_key) between 1 and 200),
  constraint security_rate_limit_count_positive check (request_count > 0),
  constraint security_rate_limit_expiry_order check (expires_at > window_started_at)
);

create index security_rate_limit_expiry_idx on private.security_rate_limit_buckets (expires_at);
revoke all on table private.security_rate_limit_buckets from public, anon, authenticated;

create function private.is_unsafe_block_target(target_ip inet)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when target_ip is null then true
    when family(target_ip) = 4 and masklen(target_ip) <> 32 then true
    when family(target_ip) = 6 and masklen(target_ip) <> 128 then true
    when family(target_ip) = 4 then
      target_ip <<= '0.0.0.0/8'::inet
      or target_ip <<= '10.0.0.0/8'::inet
      or target_ip <<= '100.64.0.0/10'::inet
      or target_ip <<= '127.0.0.0/8'::inet
      or target_ip <<= '169.254.0.0/16'::inet
      or target_ip <<= '172.16.0.0/12'::inet
      or target_ip <<= '192.0.0.0/24'::inet
      or target_ip <<= '192.0.2.0/24'::inet
      or target_ip <<= '192.88.99.0/24'::inet
      or target_ip <<= '192.168.0.0/16'::inet
      or target_ip <<= '198.18.0.0/15'::inet
      or target_ip <<= '198.51.100.0/24'::inet
      or target_ip <<= '203.0.113.0/24'::inet
      or target_ip <<= '224.0.0.0/4'::inet
      or target_ip <<= '240.0.0.0/4'::inet
    else
      target_ip = '::'::inet
      or target_ip = '::1'::inet
      or target_ip <<= '::ffff:0:0/96'::inet
      or target_ip <<= '100::/64'::inet
      or target_ip <<= '2001:2::/48'::inet
      or target_ip <<= '2001:db8::/32'::inet
      or target_ip <<= 'fc00::/7'::inet
      or target_ip <<= 'fe80::/10'::inet
      or target_ip <<= 'ff00::/8'::inet
  end
$$;

create function private.consume_security_rate_limit(
  target_action text,
  target_key text,
  target_limit integer,
  target_window_seconds integer
)
returns table (allowed boolean, request_count integer, window_started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  moment timestamptz := clock_timestamp();
  current_window timestamptz;
  current_count integer;
begin
  if target_action is null
    or char_length(target_action) not between 3 and 80
    or target_key is null
    or char_length(target_key) not between 1 and 200
    or target_limit not between 1 and 1000
    or target_window_seconds not between 10 and 86400 then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from moment) / target_window_seconds) * target_window_seconds
  );

  delete from private.security_rate_limit_buckets
  where expires_at < moment - interval '1 day';

  insert into private.security_rate_limit_buckets (
    action, bucket_key, window_started_at, request_count, expires_at
  ) values (
    target_action,
    target_key,
    current_window,
    1,
    current_window + make_interval(secs => target_window_seconds)
  )
  on conflict on constraint security_rate_limit_buckets_pkey
  do update set
    request_count = private.security_rate_limit_buckets.request_count + 1,
    expires_at = excluded.expires_at
  returning private.security_rate_limit_buckets.request_count into current_count;

  return query select current_count <= target_limit, current_count, current_window;
end;
$$;

create function private.emit_security_event(
  target_user_id uuid,
  target_event_type text,
  target_severity public.security_event_severity,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_event_type not in (
    'auth.login_succeeded',
    'auth.logout',
    'auth.inactive_account_denied',
    'security.rate_limited',
    'security.ip_policy_added',
    'security.ip_policy_disabled',
    'security.user_deactivated',
    'security.user_reactivated'
  ) or target_metadata is null or jsonb_typeof(target_metadata) <> 'object' then
    raise exception 'Invalid security event' using errcode = '22023';
  end if;

  delete from public.security_events where created_at < now() - interval '90 days';
  insert into public.security_events (
    user_id, event_type, severity, ip_address, user_agent, metadata
  ) values (
    target_user_id, target_event_type, target_severity, null, null, target_metadata
  );
end;
$$;

create function private.observe_authenticated_session(mark_ended boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  session_value text := nullif(auth.jwt() ->> 'session_id', '');
  session_identifier uuid;
  affected integer;
begin
  if actor is null or private.current_user_role() is null or session_value is null then
    return false;
  end if;

  begin
    session_identifier := session_value::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if mark_ended then
    update public.user_sessions
    set ended_at = now(), last_seen_at = greatest(last_seen_at, now())
    where auth_session_id = session_identifier and user_id = actor and ended_at is null;
    get diagnostics affected = row_count;
    return affected = 1;
  end if;

  insert into public.user_sessions (auth_session_id, user_id)
  values (session_identifier, actor)
  on conflict (auth_session_id) do nothing;
  get diagnostics affected = row_count;

  if affected = 1 then
    perform private.emit_security_event(
      actor, 'auth.login_succeeded', 'info'::public.security_event_severity, '{}'::jsonb
    );
    return true;
  end if;

  update public.user_sessions set last_seen_at = now()
  where auth_session_id = session_identifier
    and user_id = actor
    and ended_at is null
    and last_seen_at <= now() - interval '10 minutes';
  return false;
end;
$$;

create function public.observe_current_session()
returns void
language sql
security definer
set search_path = ''
as $$ select private.observe_authenticated_session(false) $$;

create function public.record_inactive_account_denied()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); emission record;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and is_active = false
  ) then return; end if;

  select * into emission from private.consume_security_rate_limit(
    'event.inactive_account_denied', actor::text, 1, 300
  );
  if emission.request_count = 1 then
    perform private.emit_security_event(
      actor, 'auth.inactive_account_denied', 'warning'::public.security_event_severity, '{}'::jsonb
    );
  end if;
end;
$$;

create function public.record_logout()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if private.observe_authenticated_session(true) then
    perform private.emit_security_event(
      actor,
      'auth.logout',
      'info'::public.security_event_severity,
      jsonb_build_object('scope', 'local', 'result', 'requested')
    );
  end if;
end;
$$;

create function public.create_ip_policy(
  target_ip inet,
  target_reason text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing_id uuid;
  policy_id uuid;
  rate_result record;
begin
  if actor is null or private.current_user_role() is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  select * into rate_result from private.consume_security_rate_limit(
    'security.create_ip_policy', actor::text, 6, 300
  );
  if not rate_result.allowed then
    if rate_result.request_count = 7 then
      perform private.emit_security_event(
        actor,
        'security.rate_limited',
        'warning'::public.security_event_severity,
        jsonb_build_object('action', 'security.create_ip_policy')
      );
    end if;
    return null;
  end if;

  if private.is_unsafe_block_target(target_ip)
    or target_reason is null
    or char_length(btrim(target_reason)) not between 3 and 500
    or target_expires_at is null
    or target_expires_at < now() + interval '5 minutes'
    or target_expires_at > now() + interval '30 days' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(host(target_ip), 90409));
  select id into existing_id from public.blocked_ips
  where ip_address = target_ip and is_active = true
    and (expires_at is null or expires_at > now())
  for update;
  if existing_id is not null then return existing_id; end if;

  update public.blocked_ips set is_active = false
  where ip_address = target_ip and is_active = true;
  insert into public.blocked_ips (ip_address, reason, blocked_by, expires_at)
  values (target_ip, btrim(target_reason), actor, target_expires_at)
  returning id into policy_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'security.ip_policy_added', 'ip_policy', policy_id, '{}'::jsonb);
  perform private.emit_security_event(
    actor,
    'security.ip_policy_added',
    'warning'::public.security_event_severity,
    jsonb_build_object('policy_id', policy_id)
  );
  return policy_id;
end;
$$;

create function public.disable_ip_policy(target_policy_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); affected integer; rate_result record;
begin
  if actor is null or private.current_user_role() is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  select * into rate_result from private.consume_security_rate_limit(
    'security.disable_ip_policy', actor::text, 6, 300
  );
  if not rate_result.allowed then
    if rate_result.request_count = 7 then
      perform private.emit_security_event(
        actor,
        'security.rate_limited',
        'warning'::public.security_event_severity,
        jsonb_build_object('action', 'security.disable_ip_policy')
      );
    end if;
    return false;
  end if;

  update public.blocked_ips set is_active = false
  where id = target_policy_id and is_active = true;
  get diagnostics affected = row_count;
  if affected = 1 then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (actor, 'security.ip_policy_disabled', 'ip_policy', target_policy_id, '{}'::jsonb);
    perform private.emit_security_event(
      actor,
      'security.ip_policy_disabled',
      'info'::public.security_event_severity,
      jsonb_build_object('policy_id', target_policy_id)
    );
  end if;
  return affected = 1;
end;
$$;

create function public.set_user_active(target_user_id uuid, target_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_profile public.profiles%rowtype;
  active_doctor_count integer;
  rate_result record;
begin
  if actor is null or private.current_user_role() is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  select * into rate_result from private.consume_security_rate_limit(
    'security.user_state', actor::text, 6, 300
  );
  if not rate_result.allowed then
    if rate_result.request_count = 7 then
      perform private.emit_security_event(
        actor,
        'security.rate_limited',
        'warning'::public.security_event_severity,
        jsonb_build_object('action', 'security.user_state')
      );
    end if;
    return false;
  end if;

  if target_user_id is null or target_active is null then return false; end if;
  lock table public.profiles in share row exclusive mode;
  select * into target_profile from public.profiles where id = target_user_id for update;
  if not found then return false; end if;
  if target_profile.is_active = target_active then return true; end if;
  if target_active = false and target_user_id = actor then return false; end if;

  if target_active = false and target_profile.role = 'doctor'::public.app_role then
    select count(*) into active_doctor_count from public.profiles
    where role = 'doctor'::public.app_role and is_active = true;
    if active_doctor_count <= 1 then return false; end if;
  end if;

  update public.profiles set is_active = target_active where id = target_user_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when target_active then 'security.user_reactivated' else 'security.user_deactivated' end,
    'profile',
    target_user_id,
    '{}'::jsonb
  );
  perform private.emit_security_event(
    target_user_id,
    case when target_active then 'security.user_reactivated' else 'security.user_deactivated' end,
    case when target_active then 'info'::public.security_event_severity else 'warning'::public.security_event_severity end,
    jsonb_build_object('actor_user_id', actor)
  );
  return true;
end;
$$;

create function public.get_security_center(reference_time timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); cutoff timestamptz; result jsonb;
begin
  if reference_time is null then reference_time := now(); end if;
  cutoff := now() - interval '14 days';
  if actor is null or private.current_user_role() is distinct from 'doctor'::public.app_role then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'window_started_at', cutoff,
    'summary', jsonb_build_object(
      'events_24h', (select count(*) from public.security_events where created_at >= now() - interval '24 hours'),
      'alerts_14d', (select count(*) from public.security_events where created_at >= cutoff and severity in ('warning', 'critical')),
      'critical_14d', (select count(*) from public.security_events where created_at >= cutoff and severity = 'critical'),
      'active_ip_policies', (select count(*) from public.blocked_ips where is_active and (expires_at is null or expires_at > now())),
      'observed_connections', (select count(*) from public.user_sessions where last_seen_at >= cutoff),
      'active_users', (select count(*) from public.profiles where is_active)
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'user_id', event.user_id, 'event_type', event.event_type,
        'severity', event.severity, 'created_at', event.created_at
      ) order by event.created_at desc, event.id desc)
      from (
        select id, user_id, event_type, severity, created_at from public.security_events
        where created_at >= cutoff order by created_at desc, id desc limit 50
      ) event
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session_row.id, 'user_id', session_row.user_id,
        'first_seen_at', session_row.first_seen_at, 'last_seen_at', session_row.last_seen_at,
        'ended_at', session_row.ended_at
      ) order by session_row.last_seen_at desc, session_row.id desc)
      from (
        select id, user_id, first_seen_at, last_seen_at, ended_at from public.user_sessions
        where last_seen_at >= cutoff order by last_seen_at desc, id desc limit 50
      ) session_row
    ), '[]'::jsonb),
    'ip_policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', policy.id, 'ip_address', host(policy.ip_address), 'reason', policy.reason,
        'blocked_by', policy.blocked_by, 'created_at', policy.created_at,
        'expires_at', policy.expires_at,
        'is_active', policy.is_active and (policy.expires_at is null or policy.expires_at > now())
      ) order by policy.created_at desc, policy.id desc)
      from (
        select id, ip_address, reason, blocked_by, created_at, expires_at, is_active
        from public.blocked_ips order by created_at desc, id desc limit 50
      ) policy
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id, 'full_name', profile.full_name, 'role', profile.role,
        'is_active', profile.is_active, 'created_at', profile.created_at,
        'last_observed_at', (
          select max(observed.last_seen_at) from public.user_sessions observed
          where observed.user_id = profile.id
        )
      ) order by profile.role, profile.full_name, profile.id)
      from public.profiles profile
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function private.is_unsafe_block_target(inet) from public, anon, authenticated;
revoke all on function private.consume_security_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function private.emit_security_event(uuid, text, public.security_event_severity, jsonb) from public, anon, authenticated;
revoke all on function private.observe_authenticated_session(boolean) from public, anon, authenticated;
revoke all on function public.observe_current_session() from public, anon, authenticated;
revoke all on function public.record_inactive_account_denied() from public, anon, authenticated;
revoke all on function public.record_logout() from public, anon, authenticated;
revoke all on function public.create_ip_policy(inet, text, timestamptz) from public, anon, authenticated;
revoke all on function public.disable_ip_policy(uuid) from public, anon, authenticated;
revoke all on function public.set_user_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_security_center(timestamptz) from public, anon, authenticated;

grant execute on function public.observe_current_session() to authenticated;
grant execute on function public.record_inactive_account_denied() to authenticated;
grant execute on function public.record_logout() to authenticated;
grant execute on function public.create_ip_policy(inet, text, timestamptz) to authenticated;
grant execute on function public.disable_ip_policy(uuid) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
grant execute on function public.get_security_center(timestamptz) to authenticated;

revoke select on table public.security_events from authenticated;
revoke select on table public.user_sessions from authenticated;
revoke select on table public.blocked_ips from authenticated;
revoke insert, delete on table public.blocked_ips from authenticated;
revoke update (reason, expires_at, is_active) on table public.blocked_ips from authenticated;

commit;
