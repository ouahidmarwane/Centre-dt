-- Every clinic role needs AAL2: an assistant without a verified TOTP session has no authority.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select tests.act_as(current_setting('t.assistant')::uuid, 'aal2');
select set_config('t.patient', tests.create_patient(current_setting('t.assistant')::uuid, 'Mona', 'Mfatest')::text, true);
select tests.assert_equal(private.current_user_role(), 'assistant'::public.app_role, 'aal2 assistant has authority');
reset role;

select tests.act_as(current_setting('t.assistant')::uuid, 'aal1');
select tests.assert_equal(private.current_user_role(), null::public.app_role, 'aal1 assistant has no authority');
select tests.assert_equal((select count(*) from public.patients), 0::bigint, 'aal1 assistant reads no patient');
select tests.assert_fails($$select tests.create_patient(current_setting('t.assistant')::uuid, 'X', 'Y')$$, '42501', 'aal1 assistant cannot create patients');
select tests.assert_fails($$select public.create_appointment(current_setting('t.patient')::uuid, 'Contrôle', null, now() + interval '1 day', now() + interval '1 day 30 minutes', null, gen_random_uuid())$$, '42501', 'aal1 assistant cannot book');
select tests.assert_equal((select count(*) from public.get_mfa_bootstrap_profile()), 1::bigint, 'routing profile stays readable to reach MFA');
reset role;
