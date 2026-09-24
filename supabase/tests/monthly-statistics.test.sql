-- Monthly statistics: doctor only; production, payments, new patients, appointment
-- outcomes and production by intervention wording, in clinic time.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);
select tests.act_as(current_setting('t.doctor')::uuid);
select set_config('t.a', tests.create_patient(current_setting('t.doctor')::uuid, 'Amal', 'Statest')::text, true);
select set_config('t.b', tests.create_patient(current_setting('t.doctor')::uuid, 'Bilal', 'Statest')::text, true);
select public.create_intervention(current_setting('t.a')::uuid, date '2025-03-05', 'Détartrage', 400, 'performed', gen_random_uuid());
select public.create_intervention(current_setting('t.a')::uuid, date '2025-03-25', ' détartrage ', 300, 'performed', gen_random_uuid());
select public.create_intervention(current_setting('t.b')::uuid, date '2025-03-20', 'Implant 36 — Pose', 6000, 'performed', gen_random_uuid());
select set_config('t.cancelled', public.create_intervention(current_setting('t.b')::uuid, date '2025-03-21', 'Extraction', 900, 'performed', gen_random_uuid())::text, true);
select public.cancel_intervention(current_setting('t.b')::uuid, current_setting('t.cancelled')::uuid);
select public.create_intervention(current_setting('t.b')::uuid, date '2025-02-10', 'Contrôle', 500, 'performed', gen_random_uuid());
select public.record_payment(current_setting('t.b')::uuid, 1000, 'card', timestamptz '2025-03-21 10:00 Africa/Casablanca', gen_random_uuid());
-- Appointments are created in the future, then moved into March 2025 with their outcome.
select public.create_appointment(case when n % 2 = 0 then current_setting('t.a')::uuid else current_setting('t.b')::uuid end, 'Contrôle', null, now() + make_interval(days => n), now() + make_interval(days => n, mins => 30), null, gen_random_uuid()) from generate_series(1, 5) n;
reset role;
-- created_at is immutable by design; the trigger is bypassed only inside this rolled-back test.
alter table public.patients disable trigger patients_set_actor_fields;
update public.patients set created_at = timestamptz '2025-03-02 11:00 Africa/Casablanca' where id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid);
alter table public.patients enable trigger patients_set_actor_fields;
update public.appointments a set starts_at = timestamptz '2025-03-01 09:00 Africa/Casablanca' + make_interval(days => x.n),
  ends_at = timestamptz '2025-03-01 09:30 Africa/Casablanca' + make_interval(days => x.n),
  status = (array['completed','completed','completed','no_show','cancelled'])[x.n]::public.appointment_status,
  cancelled_by = case when x.n = 5 then current_setting('t.doctor')::uuid end, cancelled_at = case when x.n = 5 then now() end,
  cancellation_reason = case when x.n = 5 then 'Test statistique' end
from (select id, row_number() over (order by starts_at)::int as n from public.appointments where patient_id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid)) x
where a.id = x.id;

select tests.act_as(current_setting('t.doctor')::uuid);
create temp table stats on commit drop as select * from public.get_monthly_statistics(date '2025-03-14');
create temp table march on commit drop as select m from stats, jsonb_array_elements(stats.months) m where m ->> 'month' = '2025-03';
select tests.assert_equal((select jsonb_array_length(months) from stats), 12, 'twelve months of trend');
select tests.assert_equal((select months -> 11 ->> 'month' from stats), '2025-03', 'trend ends with the target month');
select tests.assert_equal((select (m ->> 'production')::numeric from march), 6700::numeric, 'production excludes cancelled care');
select tests.assert_equal((select (m ->> 'received')::numeric from march), 1000::numeric, 'payments of the month');
select tests.assert_equal((select (m ->> 'new_patients')::int from march), 2, 'new patients of the month');
select tests.assert_equal((select (m ->> 'completed')::int || '/' || (m ->> 'no_show') || '/' || (m ->> 'cancelled') from march), '3/1/1', 'appointment outcomes');
select tests.assert_equal((select (m ->> 'production')::numeric from stats, jsonb_array_elements(stats.months) m where m ->> 'month' = '2025-02'), 500::numeric, 'previous month production');
select tests.assert_equal((select natures -> 0 ->> 'nature' from stats), 'implant 36 — pose', 'natures ordered by amount');
select tests.assert_equal((select (n ->> 'amount')::numeric || ' x' || (n ->> 'count') from stats, jsonb_array_elements(stats.natures) n where n ->> 'nature' = 'détartrage'), '700.00 x2', 'wording grouped regardless of case and spaces');
select tests.assert_fails($$select * from public.get_monthly_statistics(date '2019-12-01')$$, '22023', 'months before 2020 rejected');
reset role;

select tests.act_as(current_setting('t.assistant')::uuid);
select tests.assert_fails($$select * from public.get_monthly_statistics(date '2025-03-01')$$, '42501', 'assistant has no access to statistics');
reset role;
select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_fails($$select * from public.get_monthly_statistics(date '2025-03-01')$$, '42501', 'doctor without MFA has no access');
reset role;
