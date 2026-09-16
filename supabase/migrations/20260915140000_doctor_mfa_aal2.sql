begin;

-- JWT assurance is authoritative. Missing, malformed or unexpected claims
-- deliberately collapse to aal1 so they never grant doctor authority.
create function private.current_aal()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is not null and auth.jwt() ->> 'aal' = 'aal2' then 'aal2'
    else 'aal1'
  end
$$;

-- This raw active-profile lookup is an internal building block only. It is
-- used by the authority helper and narrowly scoped pre-MFA telemetry.
create function private.current_active_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active = true
$$;

-- This remains the single effective authority role used throughout existing
-- RLS policies, RPCs and mutation triggers. Assistants keep their current AAL1
-- authority; doctors receive no authority until the JWT proves AAL2.
create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when active_profile.role = 'assistant'::public.app_role
      then 'assistant'::public.app_role
    when active_profile.role = 'doctor'::public.app_role
      and (select private.current_aal()) = 'aal2'
      then 'doctor'::public.app_role
    else null::public.app_role
  end
  from (select private.current_active_profile_role() as role) as active_profile
$$;

-- Login/session observation must remain possible for an active doctor before
-- the future MFA challenge is completed. This helper records only the caller's
-- own authenticated session and does not grant clinic-data authority.
create or replace function private.observe_authenticated_session(
  mark_ended boolean default false
)
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
  if actor is null
    or private.current_active_profile_role() is null
    or session_value is null
  then
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
    where auth_session_id = session_identifier
      and user_id = actor
      and ended_at is null;
    get diagnostics affected = row_count;
    return affected = 1;
  end if;

  insert into public.user_sessions (auth_session_id, user_id)
  values (session_identifier, actor)
  on conflict (auth_session_id) do nothing;
  get diagnostics affected = row_count;

  if affected = 1 then
    perform private.emit_security_event(
      actor,
      'auth.login_succeeded',
      'info'::public.security_event_severity,
      '{}'::jsonb
    );
    return true;
  end if;

  update public.user_sessions
  set last_seen_at = now()
  where auth_session_id = session_identifier
    and user_id = actor
    and ended_at is null
    and last_seen_at <= now() - interval '10 minutes';
  return false;
end;
$$;

-- Internal building blocks are intentionally not callable application APIs.
revoke all on function private.current_aal()
from public, anon, authenticated;
revoke all on function private.current_active_profile_role()
from public, anon, authenticated;

-- RLS expressions execute these established wrappers as the querying role,
-- so authenticated requires EXECUTE while PUBLIC and anon remain denied.
revoke all on function private.current_user_role()
from public, anon, authenticated;
revoke all on function private.is_active_user()
from public, anon, authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_active_user() to authenticated;

comment on function private.current_aal() is
  'Returns aal2 only from the authenticated JWT claim; all other states fail closed as aal1.';
comment on function private.current_active_profile_role() is
  'Internal active-profile lookup without assurance-based clinic authority.';
comment on function private.current_user_role() is
  'Effective clinic authority: active assistant, or active doctor with an aal2 JWT.';

commit;
