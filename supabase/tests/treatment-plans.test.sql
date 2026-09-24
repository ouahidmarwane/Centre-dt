-- Treatment plans: doctor-only creation, frozen quote, acceptance, step completion into
-- interventions (patient balance), reopening after a cancelled intervention, completion.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);
select tests.act_as(current_setting('t.assistant')::uuid);
select set_config('t.patient', tests.create_patient(current_setting('t.assistant')::uuid, 'Nadia', 'Plantest')::text, true);
select set_config('t.steps', '[{"label":"Pose de l''implant","amount":6000,"planned_date":"2026-11-02"},{"label":"Pilier","amount":2000},{"label":"Couronne céramique","amount":4000.5,"planned_date":null}]', true);
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'Implant 36', 'implant', null, current_setting('t.steps')::jsonb, gen_random_uuid())$$, '42501', 'assistant cannot create a plan');
reset role;

select tests.act_as(current_setting('t.doctor')::uuid);
select set_config('t.key', gen_random_uuid()::text, true);
select set_config('t.plan', public.create_treatment_plan(current_setting('t.patient')::uuid, 'Implant 36', 'implant', 'Greffe non nécessaire', current_setting('t.steps')::jsonb, current_setting('t.key')::uuid)::text, true);
select tests.assert_equal(public.create_treatment_plan(current_setting('t.patient')::uuid, 'Implant 36', 'implant', null, current_setting('t.steps')::jsonb, current_setting('t.key')::uuid), current_setting('t.plan')::uuid, 'replayed creation returns the same plan');
select tests.assert_equal((select sum(amount) from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid), 12000.50::numeric, 'quote is the sum of the steps');
select tests.assert_equal((select string_agg(label, '|' order by position) from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid), 'Pose de l''implant|Pilier|Couronne céramique', 'steps keep their order');
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'Vide', 'implant', null, '[]'::jsonb, gen_random_uuid())$$, '22023', 'a plan needs at least one step');
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'Négatif', 'implant', null, '[{"label":"X","amount":-5}]'::jsonb, gen_random_uuid())$$, '22023', 'negative amounts rejected');
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'Date', 'implant', null, '[{"label":"X","amount":5,"planned_date":"2026-13-45"}]'::jsonb, gen_random_uuid())$$, '22023', 'invalid planned date rejected');
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'Cat', 'magic', null, '[{"label":"X","amount":5}]'::jsonb, gen_random_uuid())$$, '22023', 'unknown category rejected');
select tests.assert_fails($$select public.complete_treatment_step((select id from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid and position = 1), current_date, gen_random_uuid())$$, '22023', 'steps cannot be completed before acceptance');
reset role;

-- The front desk records the acceptance and completes the first session.
select tests.act_as(current_setting('t.assistant')::uuid);
select tests.assert_equal(public.accept_treatment_plan(current_setting('t.plan')::uuid), true, 'acceptance recorded');
select tests.assert_equal(public.accept_treatment_plan(current_setting('t.plan')::uuid), false, 'second acceptance is a no-op');
select set_config('t.step1', (select id from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid and position = 1)::text, true);
select set_config('t.i1', public.complete_treatment_step(current_setting('t.step1')::uuid, current_date, gen_random_uuid())::text, true);
select tests.assert_equal((select amount_due from public.interventions where id = current_setting('t.i1')::uuid), 6000.00::numeric, 'step created an intervention with the step amount');
select tests.assert_equal((select nature from public.interventions where id = current_setting('t.i1')::uuid), 'Implant 36 — Pose de l''implant', 'intervention named after plan and step');
select tests.assert_equal((select total_due from public.get_patient_financial_summary(current_setting('t.patient')::uuid)), 6000.00::numeric, 'amount entered the patient balance');
select tests.assert_fails($$select public.complete_treatment_step(current_setting('t.step1')::uuid, current_date, gen_random_uuid())$$, '22023', 'a done step cannot be completed twice');
select tests.assert_fails($$select public.complete_treatment_step((select id from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid and position = 2), current_date + 1, gen_random_uuid())$$, '22023', 'future performed date rejected');
select tests.assert_fails($$select public.cancel_treatment_plan(current_setting('t.plan')::uuid, 'Le patient renonce')$$, '42501', 'assistant cannot cancel a plan');
reset role;

-- The doctor cancels the first session's intervention: the step reopens and can be redone.
select tests.act_as(current_setting('t.doctor')::uuid);
select public.cancel_intervention(current_setting('t.patient')::uuid, current_setting('t.i1')::uuid);
select tests.assert_equal(private.treatment_step_is_done(current_setting('t.i1')::uuid), false, 'cancelled intervention reopens the step');
select public.complete_treatment_step(current_setting('t.step1')::uuid, current_date, gen_random_uuid());
select public.complete_treatment_step(id, current_date, gen_random_uuid()) from public.treatment_plan_steps where plan_id = current_setting('t.plan')::uuid and position in (2, 3);
select tests.assert_equal((select status from public.treatment_plans where id = current_setting('t.plan')::uuid), 'completed'::public.treatment_plan_status, 'plan completed once every step is done');
select tests.assert_equal((select total_due from public.get_patient_financial_summary(current_setting('t.patient')::uuid)), 12000.50::numeric, 'patient owes exactly the quote');
select tests.assert_equal(public.cancel_treatment_plan(current_setting('t.plan')::uuid, 'Trop tard pour annuler'), false, 'a completed plan cannot be cancelled');

select set_config('t.plan2', public.create_treatment_plan(current_setting('t.patient')::uuid, 'Orthodontie', 'orthodontics', null, '[{"label":"Bilan","amount":500}]'::jsonb, gen_random_uuid())::text, true);
select tests.assert_fails($$select public.cancel_treatment_plan(current_setting('t.plan2')::uuid, 'Non')$$, '22023', 'cancellation needs a real reason');
select tests.assert_equal(public.cancel_treatment_plan(current_setting('t.plan2')::uuid, 'Le patient préfère attendre'), true, 'proposed plan cancelled');
reset role;
select tests.act_as(current_setting('t.doctor')::uuid);
select tests.assert_equal(public.accept_treatment_plan(current_setting('t.plan2')::uuid), false, 'a cancelled plan cannot be accepted');
reset role;
select tests.assert_equal((select count(*) from public.audit_logs where entity_type = 'treatment_plan' and metadata->>'patient_id' = current_setting('t.patient')), 8::bigint, 'plan lifecycle audited');

-- Direct writes and pre-MFA doctors are denied.
select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_equal((select count(*) from public.treatment_plans), 0::bigint, 'aal1 doctor reads no plan');
select tests.assert_fails($$select public.create_treatment_plan(current_setting('t.patient')::uuid, 'X', 'other', null, '[{"label":"X","amount":1}]'::jsonb, gen_random_uuid())$$, '42501', 'aal1 doctor cannot create');
reset role;
select tests.act_as(current_setting('t.assistant')::uuid);
select tests.assert_fails($$update public.treatment_plans set title = 'Pirate'$$, '42501', 'direct updates denied');
reset role;
