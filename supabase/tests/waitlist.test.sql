-- Waitlist: add, one waiting entry per patient, booking a freed slot, conflicts, removal.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);
select tests.act_as(current_setting('t.assistant')::uuid);
select set_config('t.sara', tests.create_patient(current_setting('t.assistant')::uuid, 'Rim', 'Waittest')::text, true);
select set_config('t.omar', tests.create_patient(current_setting('t.assistant')::uuid, 'Hamza', 'Waittest')::text, true);

select set_config('t.entry', public.add_waitlist_entry(current_setting('t.sara')::uuid, 'Détartrage', 'morning', 30::smallint, true, 'Disponible dès 9 h')::text, true);
select tests.assert_equal((select status from public.appointment_waitlist where id = current_setting('t.entry')::uuid), 'waiting', 'entry is waiting');
select tests.assert_fails($$select public.add_waitlist_entry(current_setting('t.sara')::uuid, 'Autre', 'any', 30::smallint, false)$$, '23505', 'a patient cannot wait twice');
select tests.assert_fails($$select public.add_waitlist_entry(current_setting('t.omar')::uuid, 'Contrôle', 'night', 30::smallint, false)$$, '22023', 'invalid period rejected');
select tests.assert_fails($$select public.add_waitlist_entry(current_setting('t.omar')::uuid, 'Contrôle', 'any', 20::smallint, false)$$, '22023', 'duration must be a multiple of 15');
select tests.assert_fails($$insert into public.appointment_waitlist (patient_id, reason, created_by) values (current_setting('t.omar')::uuid, 'Direct', auth.uid())$$, '42501', 'direct writes are denied');

-- Omar holds tomorrow 10:00 then cancels: the slot is free again.
select set_config('t.slot', (date_trunc('day', now()) + interval '1 day 10 hours')::text, true);
select set_config('t.omar_appt', public.create_appointment(current_setting('t.omar')::uuid, 'Contrôle', null, current_setting('t.slot')::timestamptz, current_setting('t.slot')::timestamptz + interval '30 minutes', null, gen_random_uuid())::text, true);
select tests.assert_fails($$select public.book_waitlist_entry(current_setting('t.entry')::uuid, current_setting('t.slot')::timestamptz, gen_random_uuid())$$, '23P01', 'booking an occupied slot is refused');
select tests.assert_equal((select status from public.appointment_waitlist where id = current_setting('t.entry')::uuid), 'waiting', 'failed booking keeps the entry waiting');
select public.cancel_appointment(current_setting('t.omar')::uuid, current_setting('t.omar_appt')::uuid, 'Empêchement du patient');

select set_config('t.booked', public.book_waitlist_entry(current_setting('t.entry')::uuid, current_setting('t.slot')::timestamptz, gen_random_uuid())::text, true);
select tests.assert_equal((select status from public.appointment_waitlist where id = current_setting('t.entry')::uuid), 'booked', 'entry booked');
select tests.assert_equal((select booked_appointment_id from public.appointment_waitlist where id = current_setting('t.entry')::uuid), current_setting('t.booked')::uuid, 'entry linked to the new appointment');
select tests.assert_equal((select patient_id from public.appointments where id = current_setting('t.booked')::uuid), current_setting('t.sara')::uuid, 'appointment is for the waiting patient');
select tests.assert_equal((select ends_at - starts_at from public.appointments where id = current_setting('t.booked')::uuid), interval '30 minutes', 'appointment uses the requested duration');
select tests.assert_fails($$select public.book_waitlist_entry(current_setting('t.entry')::uuid, current_setting('t.slot')::timestamptz + interval '2 hours', gen_random_uuid())$$, '22023', 'a booked entry cannot be booked again');
select tests.assert_fails($$select public.book_waitlist_entry(gen_random_uuid(), now() - interval '1 hour', gen_random_uuid())$$, '22023', 'unknown entry rejected');

-- Removal, and the patient may then wait again.
select set_config('t.omar_entry', public.add_waitlist_entry(current_setting('t.omar')::uuid, 'Contrôle', 'any', 45::smallint, false)::text, true);
select tests.assert_equal(public.remove_waitlist_entry(current_setting('t.omar_entry')::uuid), true, 'entry removed');
select tests.assert_equal(public.remove_waitlist_entry(current_setting('t.omar_entry')::uuid), false, 'second removal is a no-op');
select public.add_waitlist_entry(current_setting('t.omar')::uuid, 'Contrôle', 'any', 45::smallint, false);
reset role;

select tests.assert_equal((select count(*) from public.audit_logs where action like 'waitlist.%' and metadata->>'patient_id' in (current_setting('t.sara'), current_setting('t.omar'))), 5::bigint, 'additions, booking and removal are audited');

-- A doctor without MFA has no authority.
select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_fails($$select public.add_waitlist_entry(current_setting('t.sara')::uuid, 'Test', 'any', 30::smallint, false)$$, '42501', 'aal1 doctor cannot add entries');
select tests.assert_equal((select count(*) from public.appointment_waitlist), 0::bigint, 'aal1 doctor reads nothing');
reset role;
