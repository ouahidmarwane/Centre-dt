-- Ctrl+K palette: search_patients by name or phone, active patients only, staff only.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);

select tests.act_as(current_setting('t.assistant')::uuid);
select set_config('t.sara', tests.create_patient(current_setting('t.assistant')::uuid, 'Zineb', 'Testaouia', '0611110001')::text, true);
select tests.create_patient(current_setting('t.assistant')::uuid, 'Driss', 'Testbennani', '0611110002');

select tests.assert_equal((select count(*) from public.search_patients('testaouia', 'active')), 1::bigint, 'search by last name');
select tests.assert_equal((select count(*) from public.search_patients('zineb testaouia', 'active')), 1::bigint, 'search by full name');
select tests.assert_equal((select count(*) from public.search_patients('0611110002', 'active')), 1::bigint, 'search by phone');
select tests.assert_equal((select count(*) from public.search_patients('50%', 'active')), 0::bigint, 'wildcards rejected');
reset role;

-- A doctor who has not completed MFA (aal1) sees nothing.
select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_equal((select count(*) from public.search_patients('testaouia', 'active')), 0::bigint, 'aal1 doctor has no clinic access');
reset role;

select tests.act_as(current_setting('t.doctor')::uuid);
select tests.assert_equal((select count(*) from public.search_patients('testaouia', 'active')), 1::bigint, 'aal2 doctor can search');
select public.archive_patient(current_setting('t.sara')::uuid);
select tests.assert_equal((select count(*) from public.search_patients('testaouia', 'active')), 0::bigint, 'archived patient excluded from active search');
reset role;
