begin;

create type public.app_role as enum ('doctor', 'assistant');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'assistant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length
    check (char_length(btrim(full_name)) between 1 and 160)
);

comment on table public.profiles is
  'Application identity and authorization attributes linked to auth.users.';
comment on column public.profiles.role is
  'Authorization attribute. Client roles cannot modify this column.';
comment on column public.profiles.is_active is
  'Authorization attribute. Client roles cannot modify this column.';

create index profiles_role_active_idx on public.profiles (role, is_active);

create function private.current_user_role()
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

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_user_role()) is not null
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');

  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    left(coalesce(requested_name, 'Membre de l''équipe'), 160),
    'assistant'::public.app_role,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

revoke all on function private.current_user_role() from public;
revoke all on function private.is_active_user() from public;
revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_auth_user() from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant usage on type public.app_role to authenticated;

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

create policy profiles_select_active_self_or_doctor
on public.profiles
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    id = (select auth.uid())
    or (select private.current_user_role()) = 'doctor'::public.app_role
  )
);

create policy profiles_update_own_name
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  and (select private.is_active_user())
)
with check (
  id = (select auth.uid())
  and (select private.is_active_user())
);

commit;
