-- Unpaid follow-up: oldest-first allocation, 7-day grace, 14-day cadence, daily digest.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);
select tests.act_as(current_setting('t.assistant')::uuid);
select set_config('t.late', tests.create_patient(current_setting('t.assistant')::uuid, 'Imane', 'Retardtest')::text, true);
select set_config('t.recent', tests.create_patient(current_setting('t.assistant')::uuid, 'Karim', 'Recenttest')::text, true);
select set_config('t.paid', tests.create_patient(current_setting('t.assistant')::uuid, 'Laila', 'Soldetest')::text, true);

-- Late: 1000 (20 days ago) + 500 (2 days ago), 800 paid -> 700 due, unpaid since the first care.
select public.create_intervention(current_setting('t.late')::uuid, current_date - 20, 'Couronne', 1000, 'performed', gen_random_uuid());
select public.create_intervention(current_setting('t.late')::uuid, current_date - 2, 'Détartrage', 500, 'performed', gen_random_uuid());
select public.record_payment(current_setting('t.late')::uuid, 800, 'cash', now() - interval '1 day', gen_random_uuid());
-- Recent: 300 unpaid for 3 days (grace period). Paid: settled.
select public.create_intervention(current_setting('t.recent')::uuid, current_date - 3, 'Soin carie', 300, 'performed', gen_random_uuid());
select public.create_intervention(current_setting('t.paid')::uuid, current_date - 30, 'Extraction', 400, 'performed', gen_random_uuid());
select public.record_payment(current_setting('t.paid')::uuid, 400, 'card', now() - interval '20 days', gen_random_uuid());

create temp table followup on commit drop as select * from public.get_payment_followup() where patient_id in (current_setting('t.late')::uuid, current_setting('t.recent')::uuid, current_setting('t.paid')::uuid);
select tests.assert_equal((select outstanding from followup where patient_id = current_setting('t.late')::uuid), 700.00::numeric, 'balance after payment');
select tests.assert_equal((select unpaid_since from followup where patient_id = current_setting('t.late')::uuid), current_date - 20, 'unpaid since the oldest uncovered care');
select tests.assert_equal((select is_due from followup where patient_id = current_setting('t.late')::uuid), true, 'late balance is due');
select tests.assert_equal((select is_due from followup where patient_id = current_setting('t.recent')::uuid), false, 'recent balance is in its grace period');
select tests.assert_equal((select count(*) from followup where patient_id = current_setting('t.paid')::uuid), 0::bigint, 'settled patients are not listed');

select tests.assert_equal(public.mark_payment_reminder_handled(current_setting('t.late')::uuid), true, 'reminder recorded');
select tests.assert_equal(public.mark_payment_reminder_handled(current_setting('t.late')::uuid), false, 'no second reminder within 14 days');
select tests.assert_equal(public.mark_payment_reminder_handled(current_setting('t.recent')::uuid), false, 'not-yet-due balance cannot be marked');
select tests.assert_equal((select outstanding_amount from public.payment_reminders where patient_id = current_setting('t.late')::uuid), 700.00::numeric, 'reminder keeps the amount at the time');
select tests.assert_equal((select reminder_count from public.get_payment_followup() where patient_id = current_setting('t.late')::uuid), 1::bigint, 'reminder counted');
select tests.assert_equal((select is_due from public.get_payment_followup(now() + interval '15 days') where patient_id = current_setting('t.late')::uuid), true, 'due again after 14 days');
select tests.assert_fails($$insert into public.payment_reminders (patient_id, outstanding_amount, handled_by) values (current_setting('t.late')::uuid, 1, auth.uid())$$, '42501', 'direct inserts denied');
select tests.assert_fails($$select * from public.claim_staff_digests()$$, '42501', 'clients cannot claim digests');
reset role;

select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_fails($$select * from public.get_payment_followup()$$, '42501', 'aal1 doctor has no access');
reset role;

-- Daily digest (service side): nothing before 09:00, once per day after, retried on failure.
-- 15 days later the late patient is due again.
select set_config('t.morning', private.clinic_instant((current_date + 15) + time '08:30')::text, true);
select set_config('t.opening', private.clinic_instant((current_date + 15) + time '09:05')::text, true);
select tests.assert_equal((select count(*) from public.claim_staff_digests(current_setting('t.morning')::timestamptz)), 0::bigint, 'no digest before opening');
create temp table all_claimed on commit drop as select * from public.claim_staff_digests(current_setting('t.opening')::timestamptz);
-- Other digest kinds (e.g. low stock) may be claimed at the same time: follow the unpaid one.
create temp table claimed on commit drop as select * from all_claimed where kind = 'unpaid_payments';
select tests.assert_equal((select kind from claimed), 'unpaid_payments', 'unpaid digest claimed at opening');
select tests.assert_equal((select item_count >= 1 from claimed), true, 'digest counts due reminders');
select tests.assert_equal((select count(*) from public.claim_staff_digests(current_setting('t.opening')::timestamptz + interval '1 minute') where kind = 'unpaid_payments'), 0::bigint, 'claimed digest is locked');
select public.complete_staff_digest((select notification_id from claimed), false, 'Telegram returned 502.');
select tests.assert_equal((select next_attempt_at between now() + interval '4 minutes' and now() + interval '6 minutes' and locked_until is null from public.staff_digest_notifications where id = (select notification_id from claimed)), true, 'failed digest is unlocked and retried 5 minutes later');
select tests.assert_equal((select count(*) from public.staff_digest_notifications where id = (select notification_id from claimed) and last_error = 'Telegram returned 502.'), 1::bigint, 'failure recorded');
update public.staff_digest_notifications set next_attempt_at = current_setting('t.opening')::timestamptz where id = (select notification_id from claimed);
select tests.assert_equal((select notification_id from public.claim_staff_digests(current_setting('t.opening')::timestamptz + interval '20 minutes') where kind = 'unpaid_payments'), (select notification_id from claimed), 'failed digest is retried');
select public.complete_staff_digest((select notification_id from claimed), true);
select tests.assert_equal((select status from public.staff_digest_notifications where id = (select notification_id from claimed)), 'sent', 'digest sent once');
select tests.assert_equal((select count(*) from public.claim_staff_digests(current_setting('t.opening')::timestamptz + interval '3 hours') where kind = 'unpaid_payments'), 0::bigint, 'no second digest the same day');
