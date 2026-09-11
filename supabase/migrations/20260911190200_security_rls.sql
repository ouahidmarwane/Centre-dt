begin;

create policy audit_logs_select_doctor
on public.audit_logs
for select
to authenticated
using ((select private.current_user_role()) = 'doctor'::public.app_role);

create policy security_events_select_doctor
on public.security_events
for select
to authenticated
using ((select private.current_user_role()) = 'doctor'::public.app_role);

create policy blocked_ips_select_doctor
on public.blocked_ips
for select
to authenticated
using ((select private.current_user_role()) = 'doctor'::public.app_role);

create policy blocked_ips_insert_doctor
on public.blocked_ips
for insert
to authenticated
with check (
  (select private.current_user_role()) = 'doctor'::public.app_role
  and blocked_by = (select auth.uid())
);

create policy blocked_ips_update_doctor
on public.blocked_ips
for update
to authenticated
using ((select private.current_user_role()) = 'doctor'::public.app_role)
with check ((select private.current_user_role()) = 'doctor'::public.app_role);

create policy user_sessions_select_doctor
on public.user_sessions
for select
to authenticated
using ((select private.current_user_role()) = 'doctor'::public.app_role);

commit;
