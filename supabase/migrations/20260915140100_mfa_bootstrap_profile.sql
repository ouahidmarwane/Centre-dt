begin;

-- BOOTSTRAP ROLE != AUTHORIZATION.
-- This deliberately tiny self-only read exists only to route an authenticated
-- user through MFA or inactive-account handling. It confers no clinic-data
-- authority; private.current_user_role(), RLS and business RPCs remain
-- authoritative.
create function public.get_mfa_bootstrap_profile()
returns table (
  role public.app_role,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role, profile.is_active
  from public.profiles as profile
  where auth.uid() is not null
    and profile.id = auth.uid()
$$;

revoke all on function public.get_mfa_bootstrap_profile()
from public, anon, authenticated;
grant execute on function public.get_mfa_bootstrap_profile()
to authenticated;

comment on function public.get_mfa_bootstrap_profile() is
  'Self-only role and active-state bootstrap for MFA routing; never an authorization source.';

commit;
