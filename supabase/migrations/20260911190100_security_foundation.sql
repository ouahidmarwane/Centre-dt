begin;

create type public.security_event_severity as enum (
  'info',
  'warning',
  'critical'
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_length check (char_length(action) between 3 and 120),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 1 and 80),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_logs_user_agent_length
    check (user_agent is null or char_length(user_agent) <= 512)
);

comment on table public.audit_logs is
  'Immutable application audit trail. Metadata must be minimal and must not duplicate medical records.';

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  severity public.security_event_severity not null default 'info',
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_events_type_length
    check (char_length(event_type) between 3 and 120),
  constraint security_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint security_events_user_agent_length
    check (user_agent is null or char_length(user_agent) <= 512)
);

comment on table public.security_events is
  'Security-relevant events written only by future trusted database/server mechanisms.';

create table public.blocked_ips (
  id uuid primary key default gen_random_uuid(),
  ip_address inet not null,
  reason text not null,
  blocked_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  constraint blocked_ips_reason_length
    check (char_length(btrim(reason)) between 3 and 500),
  constraint blocked_ips_expiry_after_creation
    check (expires_at is null or expires_at > created_at)
);

comment on table public.blocked_ips is
  'Doctor-managed block records. IPs must originate from a trusted server context.';

create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_session_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_sessions_activity_order
    check (last_seen_at >= first_seen_at),
  constraint user_sessions_end_order
    check (ended_at is null or ended_at >= first_seen_at),
  constraint user_sessions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint user_sessions_user_agent_length
    check (user_agent is null or char_length(user_agent) <= 512)
);

comment on table public.user_sessions is
  'Application activity companion to Supabase Auth sessions; not an authentication authority or revocation mechanism.';

create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create index security_events_user_created_idx
  on public.security_events (user_id, created_at desc);
create index security_events_severity_created_idx
  on public.security_events (severity, created_at desc);
create index security_events_created_idx on public.security_events (created_at desc);

create index blocked_ips_address_idx on public.blocked_ips (ip_address);
create unique index blocked_ips_one_active_address_idx
  on public.blocked_ips (ip_address)
  where is_active = true;
create index blocked_ips_active_expiry_idx
  on public.blocked_ips (is_active, expires_at);

create index user_sessions_user_activity_idx
  on public.user_sessions (user_id, last_seen_at desc);
create index user_sessions_recent_activity_idx
  on public.user_sessions (last_seen_at desc);

alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.blocked_ips enable row level security;
alter table public.user_sessions enable row level security;

revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.security_events from public, anon, authenticated;
revoke all on table public.blocked_ips from public, anon, authenticated;
revoke all on table public.user_sessions from public, anon, authenticated;

grant usage on type public.security_event_severity to authenticated;
grant select on table public.audit_logs to authenticated;
grant select on table public.security_events to authenticated;
grant select, insert on table public.blocked_ips to authenticated;
grant update (reason, expires_at, is_active) on table public.blocked_ips to authenticated;
grant select on table public.user_sessions to authenticated;

commit;
