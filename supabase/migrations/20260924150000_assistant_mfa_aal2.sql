begin;

-- Assistants handle patient health data too: from now on every clinic role needs a
-- verified TOTP session (AAL2) before receiving any authority. This is the single
-- effective-role helper behind every RLS policy, business RPC and mutation trigger,
-- so an AAL1 assistant session now reads and writes nothing, exactly like an AAL1
-- doctor session. Routing (enrollment / challenge) is handled by the application.
create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when active_profile.role in ('assistant'::public.app_role, 'doctor'::public.app_role)
      and (select private.current_aal()) = 'aal2'
      then active_profile.role
    else null::public.app_role
  end
  from (select private.current_active_profile_role() as role) as active_profile
$$;

comment on function private.current_user_role() is
  'Effective clinic authority: active assistant or doctor, only with an aal2 JWT.';

commit;
